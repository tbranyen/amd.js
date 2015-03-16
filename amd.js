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
    var script;
    var moduleName;
    var modulePath;

    // Browser env, get access to the parent script.
    if (!nodeRequire) {
      script = define.__script__;
    }

    // Find current module id.
    if (nodeRequire || script) {
      moduleName = nodeRequire ? define.__module_name__ : script.dataset.moduleName;
      modulePath = nodeRequire ? define.__module_path__ : script.dataset.modulePath;
    }

    delete define.__module_name__;
    delete define.__module_path__;

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
        var isLocal = currentModule.indexOf('.') === 0 || currentModule.indexOf('/') === 0;

        return {
          name: currentModule,
          path: isLocal ? join(modulePath, currentModule) : currentModule
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

    var loadAllDeps = Promise.all(deps.map(require.load)).then(function(deps) {
      var module = { exports: {} };
      var isMixed = false;

      // Pass `exports` and `module`.
      deps = deps.map(function(dep) {
        if (dep === 'exports') {
          isMixed = true;
          return module.exports;
        }
        else if (dep === 'module') {
          isMixed = true;
          return module;
        }

        return dep;
      });

      // In CommonJS the user will set the `module.exports`.
      if (isCjs) {
        callback.apply(global, [require, module.exports, module]);
      }
      // An annoying signature to support, allows mixed CJS and AMD.
      else if (isMixed) {
        callback.apply(global, deps);
      }
      // In AMD we set the `module.exports` with the return value.
      else {
        module.exports = callback.apply(global, deps);
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

  define.amd = {};

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
    else {
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
    return moduleName + '.js';
  };

  require.load = function(moduleName) {
    var name = moduleName;
    var path = moduleName;

    if (typeof moduleName !== 'string') {
      name = moduleName.name;
      path = moduleName.path;
    }

    // Just return the name and replace in `define`.
    if (name === 'exports' || name === 'module') {
      return name;
    }

    // Default to index.js when supplied a folder.
    if (path.slice(-1) === '/') {
      path += 'index';
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
      define.__module_path__ = path;

      return new Promise(function(resolve, reject) {
        var exported;

        try {
          exported = nodeRequire(path);
        }
        catch (ex) {
          ex.message = 'Module: ' + name + ' failed to load';
          return reject(ex);
        }

        if (!promiseCache[name]) {
          require.cache[name] = { exports: exported };
          return resolve(exported);
        }

        return promiseCache[name].then(function() {
          resolve(require.cache[name].exports);
        });
      });
    }

    // If it is a path, do not try and look up.
    if (path === name && name.indexOf('.') !== 0 && name.indexOf('/') !== 0) {
      return nodeModulesResolve(name);
    }

    var script = document.createElement('script');
    script.src = require.toUrl(path);
    script.dataset.moduleName = name;
    script.dataset.modulePath = path;
    define.__script__ = script;
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

        if (!promiseCache[name]) {
          return console.log('Could not find module: ' + name + ' in flight');
        }

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

  function makeRequest(name) {

  }

  /**
   * nodeModulesResolve
   *
   * @param moduleName
   * @return
   */
  function nodeModulesResolve(moduleName) {
    var pkgPath = '../node_modules/' + moduleName + '/package.json';

    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();

      xhr.onreadystatechange = function() {
        var DONE = this.DONE || 4;

        if (this.readyState == DONE) {
          resolve(JSON.parse(xhr.responseText));
        }
      };

      // Find the package.json.
      xhr.open('GET', pkgPath, true);

      xhr.send(null);
    }).then(function(pkg) {
      if (!pkg.main) {
        throw new Error('Package ' + name + ' missing main property');
      }

      // If there is a trailing `.js` trim.
      if (pkg.main.indexOf('.js') === pkg.main.length - 3) {
        pkg.main = pkg.main.slice(0, -3);

        // TODO Refactor into `join`.
        if (pkg.main[0] !== '.') {
          pkg.main = './' + pkg.main;
        }
      }

      return require.load({
        name: pkg.name,
        path: join(pkgPath, pkg.main)
      });
    });
  }

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

  if (!nodeRequire) {
    var thisScript = document.scripts[document.scripts.length - 1];

    if (thisScript.dataset.main) {
      require.load(thisScript.dataset.main);
    }
  }
})(typeof global !== 'undefined' ? global : this, this.document);
