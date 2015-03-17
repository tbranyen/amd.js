(function(global) {
  'use strict';

  if (typeof require === 'function') {
    // Mocha overrides the global object, reattach the `require` function.
    global.require = require;
    global.amd = require('../amd');
  }

  global.assert = function(val, msg) {
    if (!val) {
      throw new Error(msg);
    }
  };

  global.inNodeIt = typeof module === "object" ? it : function() {};
  global.inBrowserIt = typeof module !== "object" ? it : function() {};
})(typeof global === 'object' ? global : this);
