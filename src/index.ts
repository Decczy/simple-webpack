const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const { transformFromAst } = require("@babel/core");

interface Asset{
  filename: string;
  id: number;
  mapping: object;
  dependencies: string[];
  code: string;
}

type Graph = Asset[];


let ID: number = 0;

function createAsset(filename: string): Asset {
  // 根据绝对路径读取文件
  const entry = fs.readFileSync(filename, {
    encoding: "utf8",
  });

  // 生成ast
  const ast = parser.parse(entry, {
    sourceType: "module",
  });

  // 遍历ast找到依赖声明，并将依赖模块的相对路径保存至 dependencies 数组
  let dependencies: string[] = [];
  traverse(ast, {
    ImportDeclaration: ({ node }) => {
      dependencies.push(node.source.value);
    },
  });

  // 使用 babel 将 ast 转译
  const { code } = transformFromAst(ast, null, {
    presets: ["@babel/preset-env"],
  });

  return {
      filename: filename,
      id: ID++,
      dependencies,
      code,
      mapping: {}
  }
}

function generateGraph(entry: string): Graph {
    // 入口文件
    const mainAsset = createAsset(entry);
    const queue = [mainAsset];
    for(let asset of queue){
        const basePath = path.dirname(asset.filename);
        // mapping 是模块的相对路径和模块的 id 之间的映射
        // 在代码中 require 传入相对路径，通过路径找到依赖模块
        // 而打包后需要通过模块 id 找到模块文件，因此可通过 mapping 来取某一相对路径对应的 id
        asset.mapping = {};
        asset.dependencies.forEach(relativePath=>{
          // 生成绝对路径
          const absolutePath = path.join(basePath, relativePath);
          // 生成依赖的 asset
          const child = createAsset(absolutePath);
          // 形成相对路径和 id 的映射
          asset.mapping[relativePath] = child.id;
          // 将依赖的 asset push 进队列
          queue.push(child);
        })
    }
    return queue;
}

// 根据生成的依赖图生成打包文件
// 这里的图是一个 asset 队列
function bundle(graph: Graph){
  let modules = '';
  // 生成一个 modules 对象
  // 值为 module id
  // 键为一个数组
  // 数组第一个元素为函数封装的模块代码（为了让所有模块代码跑在一个文件内，需要用函数封装，以免出现作用域冲突）
  // 数组第二个元素为该模块的依赖 mapping
  // modules 对象可理解为一个 module 仓库，需要执行某个 module 时，传入 id 即可取出相关的代码和依赖
  graph.forEach(mod=>{
    modules += `${mod.id}: [
      function (require, module, exports) {
        ${mod.code}
      },
      ${JSON.stringify(mod.mapping)},
    ],`;
  });
  // 打包后的结果为一个立即执行函数，接受上一步生成的 modules 对象
  // 构造一个 require 函数，require 接受模块 id，返回模块的 exports
  // require 通过 id 从 modules 中取出对应的 module，并拿到函数封装后的模块代码，和依赖 mapping
  // 要执行这个函数封装后的模块，首先需要覆盖掉模块中调用的 require 和 export 语句
  // 因此构造 localRequire 函数，他像模块中普通的 require 函数一样，接受一个相对路径，但实现是通过 mapping 拿到相对路径对应的模块 id，再递归调用父函数 require，拿到 export
  // 再自定义一个 module 对象，module 对象上有 exports 属性，暂设为空
  // 将 localRequire, module, module.exports 传入封装模块的函数
  // 在执行这个函数时，就是在执行模块的代码，而模块中原有的 require 则实际上是函数执行时注入的 localRequire，而原有的 exports 也实际上是函数定义时传入的 module.exports
  // 这样函数执行后，就能在预先定义的 module.exports 上拿到该模块的输出，再将该输出返回，完成 require 函数的功能
  // 最后执行require(0)，即从第一个入口文件开始，递归的执行上述过程
  const result = 
  `(function(modules){
    function require(id){
      const [fn, mapping] = modules[id];
        function localRequire(relativePath){
          return require(mapping[relativePath]);
        }
        const module = {
          exports: {}
        };
        fn(localRequire, module, module.exports);
        return module.exports;
      }
      require(0);
    })({${modules}});`;
  return result;
}

const ENTRY_URL = './examples/a.js';
const OUTPUT_PATH = './dist/bundle.js';

const graph = generateGraph(ENTRY_URL);
const result = bundle(graph);

fs.writeFileSync(OUTPUT_PATH, result);