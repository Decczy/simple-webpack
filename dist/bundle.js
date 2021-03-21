(function(modules){
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
    })({0: [
      function (require, module, exports) {
        "use strict";

var _b = require("./b.js");

var foo = function foo() {
  console.log('The result is: ', _b.result);
};

foo();
      },
      {"./b.js":1},
    ],1: [
      function (require, module, exports) {
        "use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "result", {
  enumerable: true,
  get: function get() {
    return _c.result;
  }
});

var _c = require("./c.js");
      },
      {"./c.js":2},
    ],2: [
      function (require, module, exports) {
        "use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.result = void 0;

function add() {
  return 1 + 2;
}

var result = add();
exports.result = result;
      },
      {},
    ],});