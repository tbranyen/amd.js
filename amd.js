(function(global, document) {
  'use strict';

  // Save the Node/whatever global require.
  var nodeRequire = global.require;
  var requireRegExp = /require\(.*\)/g;
  var promiseCache = {};

  /**
   * join
   *
   * @param pathA
   * @param pathB
   * @return
   */
  function join(pathA, pathB) {
    var base = pathA.split('/');
    var segment = pathB
      .split('/')
      .map(function(part) {
        if (part === '.') {
          base.pop();
        }

        else if (part === '..') {
          base.pop();
          base.pop();
        }

        else {
          return part;
        }
      })
      .filter(Boolean);

    return base.concat(segment).join('/');
  }

  /**
   * define
   *
   * @param deps
   * @param callback
   * @return
   */
  function define(deps, callback) {
    var isCjs;

    // Browser env, get access to the parent script.
    if (!nodeRequire) {
      var script = document.scripts[document.scripts.length - 1];
    }

    // Find current module id.
    var moduleName = nodeRequire ? define.__module_name__ : script.dataset.moduleName;

    delete define.__module_name__;

    // Using a named define.
    if (typeof deps === 'string') {
      moduleName = deps;
      deps = callback;
      callback = arguments[2];
    }

    // User opt'd into Simplified Common JS pattern.
    if (!callback) {
      callback = deps;

      deps = callback.toString().match(requireRegExp) || [];
      deps = deps.map(function(req) {
        var currentModule = req.slice(9, -2);

        return {
          name: currentModule,
          path: join(moduleName, currentModule)
        };
      });

      // In CJS-mode.
      isCjs = true;
    }

    // If no module name exists, use a UUID.
    if (!moduleName) {
      moduleName = "0000-0000-0000-0000-0000".replace(/0/g, function() {
        return Math.floor(Math.random() * 16).toString(16);
      });
    }

    var loadAllDeps = Promise.all(deps.map(require.load)).then(function() {
      var module = { exports: {} };

      // In CommonJS the user will set the `module.exports`.
      if (isCjs) {
        callback.apply(global, [require, module.exports, module]);
      }
      // In AMD we set the `module.exports` with the return value.
      else {
        module.exports = callback.apply(global, arguments);
      }

      if (nodeRequire) {
        require.cache[moduleName] = {
          exports: module.exports
        };
      }
      else {
        require.cache[moduleName] = {
          exports: module.exports
        }
      }

      // Attach the current module name.
      module.name = moduleName;

      return module;
    });

    // Attach the in-flight promise.
    return promiseCache[moduleName] = loadAllDeps;
  }

  /**
   * require
   *
   * @param moduleName
   * @return
   */
  function require(moduleName) {
    var resolvedPath = require.resolve(moduleName);
    var module = require.cache[resolvedPath];

    // Exists in the cache.
    if (module) {
      return module.exports;
    }
    // Attempt to use the already defined require function.
    else if (nodeRequire) {
      return nodeRequire(moduleName);
    }
    else {
      console.log('Module: ' + moduleName + ' not found, attempting to load');
      return require.load(moduleName);
    }
  }

  // Cache modules, this is a public interface.
  require.cache = {
    require: {
      exports: require
    }
  };

  // Convert a module name to a path.
  require.resolve = function(moduleName) {
    return arguments[0];
  };

  require.toUrl = function(moduleName) {
    // Default to index.js when supplied a folder.
    if (moduleName.slice(-1) === '/') {
      moduleName += 'index';
    }
    return moduleName + '.js';
  };

  require.load = function(moduleName) {
    var name = moduleName;
    var path = moduleName;

    if (typeof moduleName !== 'string') {
      name = moduleName.name;
      path = moduleName.path;
    }

    // If a module is in-flight, meaning still loading, wait for it.
    if (promiseCache[name]) {
      return promiseCache[name].then(function(module) {
        return module.exports;
      });
    }

    // TODO this only works now because ./success is assumed unique, we need to
    // normalize all modules to full paths in the main cache.  the local require
    // might be able to figure out relative paths better
    if (require.cache[path] && require.cache[path].exports) {
      require.cache[name] = require.cache[path];
      return Promise.resolve(require.cache[path].exports);
    }

    if (nodeRequire) {
      define.__module_name__ = name;

      return new Promise(function(resolve, reject) {
        try {
          nodeRequire(path);
        }
        catch (ex) {
          ex.message = 'Module: ' + name + ' failed to load';
          return reject(ex);
        }

        return promiseCache[name].then(function() {
          resolve(require.cache[name].exports);
        });
      });
    }

    var script = document.createElement('script');
    script.src = require.toUrl(path);
    script.dataset.moduleName = name;
    document.body.appendChild(script);

    return new Promise(function(resolve, reject) {
      var oldError = window.onerror;

      window.onerror = function(ex) {
        reject(ex);
        window.onerror = oldError;
      };

      script.addEventListener('error', function(ex) {
        window.onerror = oldError;
        script.parentNode.removeChild(script);
        reject(new Error('Module: ' + name + ' failed to load'));
      });

      script.addEventListener('load', function() {
        window.onerror = oldError;
        script.parentNode.removeChild(script);

        promiseCache[name].then(function() {
          if (require.cache[name]) {
            resolve(require.cache[name].exports);
          }
          else {
            reject(new Error('Module: ' + name + ' failed to load'));
          }
        });
      });
    });
  };

  var exports = {
    define: define, require: require
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = exports;
  }
  else {
    global.amd = exports;
  }

  if (!global.require) {
    global.require = require;
  }

  if (!global.define) {
    global.define = define;
  }
})(typeof global !== 'undefined' ? global : this, this.document);
