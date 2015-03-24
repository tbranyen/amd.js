(function(global, nodeRequire) {
  'use strict';

  // Save the Node/whatever global require.
  var requireRegExp = /require\(['"](.*)['"]\)/g;
  var hasPluginRegExp = /(.*\w)\.(.*)$/;
  var promiseCache = {};
  var isConfig = '';
  var options = {
    paths: {},
    shim: {},
    baseUrl: ''
  };
  // In the browser we queue up the anonymous defines and pair them with the
  // script `onload` event.
  var toBeNamed = [];

  // Find a valid `require` function.
  nodeRequire = global.require || nodeRequire;

  // Expose convenience booleans to determine environment.
  require.isNode = Boolean(nodeRequire);
  require.isBrowser = !require.isNode;

  // TODO Support symlinks in node_modules.
  //if (__dirname !== process.cwd()) {}

  /**
   * Joins two paths together.
   *
   * @param pathA
   * @param pathB
   * @return A normalized combined path
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
   * isLocal
   *
   * @param module
   * @return
   */
  function isLocal(module) {
    return module.indexOf('.') === 0 || module.indexOf('/') === 0;
  }

  function addOption(key, value) {
    var option = options[key];

    // If it's an object, merge the keys.
    if (typeof option === 'object') {
      Object.keys(value || {}).forEach(function(propKey) {
        option[propKey] = value[propKey];
      });
    }
    else {
      options[key] = value;
    }
  }

  /**
   * addOptions
   *
   * @param opts
   * @return
   */
  function addOptions(opts) {
    Object.keys(opts || {}).forEach(function(key) {
      addOption(key, opts[key]);
    });
  }

  /**
   * Process a module definition via `define`.
   *
   * @param deps
   * @param callback
   * @return {Promise} that resolves when the module has loaded.
   */
  function processDefine(deps, callback) {
    var isCjs, isMixed;

    var moduleName = define.__module_name__;
    var modulePath = define.__module_path__;

    if (typeof moduleName === 'object') {
      modulePath = moduleName.path;
      moduleName = moduleName.name;
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
    if (!callback && typeof deps === 'function') {
      callback = deps;

      deps = callback.toString().match(requireRegExp) || [];
      deps = deps.map(function(req) {
        var current = req.slice(9, -2);

        // Normalize.
        current = require.resolve(current);

        return {
          name: current,
          path: isLocal(current) ? join(modulePath, current) : current
        };
      });

      // In CJS-mode.
      isCjs = true;

      // FIXME lodash in NPM uses define(function() { return });...
      if (!callback.length) {
        deps = [];
        isCjs = false;
      }
    }

    // Map over the deps and ensure they are normalized.
    if (!isCjs) {
      deps = (deps || []).map(function(dep) {
        // Do not mess with special imports.
        if (['require', 'exports', 'module'].indexOf(dep) > -1) {
          return dep;
        }

        // Normalize.
        dep = require.resolve(dep);

        return {
          name: dep,
          path: isLocal(dep) ? join(modulePath, dep) : dep
        };
      });
    }

    var registerModule = function(deps) {
      var module = { exports: {} };

      // Ensure special imports are addressed.
      deps = deps.map(function(dep) {
        if (dep === 'exports') {
          isMixed = true;
          return module.exports;
        }
        else if (dep === 'module') {
          isMixed = true;
          return module;
        }
        else if (dep === 'require') {
          return require;
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
      else if (callback) {
        module.exports = callback.apply(global, deps);
      }

      if (moduleName) {
        require.cache[moduleName] = module;
      }

      // Attach the current module name.
      module.name = moduleName;

      return module;
    };

    var loadModule = Promise.all(deps.map(require.load))
      .then(registerModule)
      .catch(function(ex) {
        console.log(ex.stack);
        throw ex;
      });

    promiseCache[moduleName] = loadModule;

    return loadModule;
  }

  /**
   * Defines a module to be required.
   *
   * @param deps
   * @param callback
   * @return {Promise}
   */
  function define(deps, callback) {
    // Node `defines` are synchronous, so immediately process.
    if (require.isNode || typeof deps === 'string') {
      processDefine.apply(this, arguments);
    }
    else {
      toBeNamed.push(arguments);
    }
  }

  // This is often required to load UMD modules.
  define.amd = {};

  /**
   * Require or load a module.
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
    else if (require.isNode) {
      try {
        return nodeRequire(moduleName);
      }
      catch (unhandledException) {}
    }
    else {
      require.load(moduleName);
    }
  }

  // Cache modules, this is a public interface.
  require.cache = {
    require: {
      exports: require
    }
  };

  // Configure the loader.
  require.config = function(opts) {
    // If the argument is a string, pass back the configuration prop.
    if (typeof opts === 'string') {
      return options[opts];
    }

    // Add all options.
    addOptions(opts);

    return options;
  };

  // Convert a module name to a path.
  require.resolve = function(moduleName) {
    var parts = moduleName.split('/');
    var paths = require.config('paths') || {};

    // Check if the first part is in `require.config('paths')`.
    if (Object.keys(paths).indexOf(parts[0]) > -1) {
      parts[0] = paths[parts[0]];
      return parts.join('/');
    }

    return moduleName;
  };

  require.toUrl = function(moduleName) {
    return moduleName;
  };

  require.load = function(moduleParts) {
    var name = moduleParts;
    var path = moduleParts;

    if (typeof moduleParts === 'object') {
      name = moduleParts.name;
      path = moduleParts.path;
    }

    var moduleName = name;

    // Normalize the name and path.
    name = require.resolve(name);
    path = require.resolve(path);

    var hasPlugin = name.match(hasPluginRegExp);

    // Support plugins.
    if (hasPlugin && require.config('paths')[hasPlugin[2]]) {
      return require.load(require.resolve(hasPlugin[2])).then(function(plugin) {
        return new Promise(function(resolve) {
          plugin.load(path, require, function(exports) {
            require.cache[name] = {
              exports: exports
            };

            resolve(exports);
          }, options);
        });
      });
    }

    // Just return the name and replace in `define`.
    if (name === 'exports' || name === 'module') {
      return name;
    }

    // TODO this only works now because ./success is assumed unique, we need to
    // normalize all modules to full paths in the main cache.  the local require
    // might be able to figure out relative paths better
    if (require.cache[path] && require.cache[path].exports) {
      require.cache[name] = require.cache[path];
      return Promise.resolve(require.cache[path].exports);
    }

    if (promiseCache[name] && name === path) {
      return promiseCache[name].then(function(module) {
        require.cache[name] = module;
        return module.exports;
      });
    }

    if (require.isNode) {
      define.__module_name__ = name;
      define.__module_path__ = path;

      return new Promise(function(resolve, reject) {
        var exported;

        try {
          if (process.cwd() !== __dirname && isLocal(path)) {
            path = join(nodeRequire.main.filename, path);
          }

          exported = nodeRequire(path);
        }
        catch (ex) {
          ex.message = 'Module: ' + name + ' failed to load';
          return reject(ex);
        }

        if (!promiseCache[name]) {
          require.cache[name] = { exports: exported };
          resolve(exported);
        }
        else {
          promiseCache[name].then(function(module) {
            require.cache[name] = module;
            resolve(module.exports);
          });
        }
      });
    }

    // If it is a path, do not try and look up.
    if (path === name && !isLocal(path)) {
      return nodeModulesResolve(name);
    }

    // Load JSON.
    if (path.slice(-5) === '.json') {
      return makeRequest(require.toUrl(path))
        .then(JSON.parse)
        .then(require.config);
    }

    var script = document.createElement('script');
    script.src = require.toUrl(path) + '.js';
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
        define.__module_name__ = moduleName;
        define.__module_path__ = script.src;

        var modSpec = toBeNamed.shift();
        var loadModule = processDefine.apply(this, modSpec);

        promiseCache[moduleName] = loadModule.then(function(module) {
          require.cache[moduleName.name || moduleName] = module;

          // Attach the current module name.
          module.name = moduleName;

          resolve(module.exports);

          return module;
        });

        window.onerror = oldError;
        script.parentNode.removeChild(script);
      });
    });
  };

  /**
   * makeRequest
   *
   * @param path
   * @return
   */
  function makeRequest(path) {
    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();

      xhr.onreadystatechange = function() {
        var DONE = this.DONE || 4;

        if (this.readyState == DONE) {
          resolve(xhr.responseText);
        }
      };

      // Find the package.json.
      xhr.open('GET', path, true);

      xhr.send(null);

      return xhr;
    });
  }

  /**
   * nodeModulesResolve
   *
   * @param moduleName
   * @return
   */
  function nodeModulesResolve(moduleName) {
    var pkgPath = '../node_modules/' + moduleName + '/package.json';
    var pkg = {};

    // Fetch from nested modules.
    if (moduleName.indexOf('/') > -1) {
      return require.load({
        name: moduleName,
        path: join(pkgPath, './')
      });
    }

    var normalizeMain = function(pkg) {
      if (!pkg.main) {
        throw new Error('Package ' + name + ' missing main property');
      }

      // If there is a trailing `.js` trim.
      if (pkg.main.indexOf('.js') === pkg.main.length - 3) {
        pkg.main = pkg.main.slice(0, -3);

        if (pkg.main[0] !== '.') {
          pkg.main = join('.', pkg.main);
        }
      }

      return pkg;
    };

    var loadMainScript = function(pkg) {
      if (pkg.main.slice(-3) !== '.js' && pkg.main.slice(-5) !== '.json') {
        pkg.main += '.js';
      }

      var modulePath = join(pkgPath, pkg.main);
      var cache = global.sessionStorage[pkg.main + ':' + pkg.version];
      var getCallback = cache ? Promise.resolve(cache) : makeRequest(modulePath);

      return getCallback.then(function(callback) {
        callback = callback.toString();

        // Cache this module callback.
        global.sessionStorage[moduleName + ':' + pkg.version] = callback;

        if (modulePath.slice(-3) === '.js') {
          modulePath = modulePath.slice(0, -3);
        }

        // FIXME Naive check here for AMD compat.
        if (callback.indexOf('define.amd') > -1 || callback.indexOf('define(') > -1) {
          return require.load({ name: moduleName, path: modulePath }).then(function(module) {
            return [moduleName, module];
          });
        }

        var deps = callback.toString().match(requireRegExp) || [];

        deps = deps.map(function(dep) {
          return dep.slice(9, -2);
        });

        var shim = require.config('shim');

        if (shim[moduleName]) {
          deps = deps.concat(shim[moduleName]);
        }

        return deps.reduce(function(previous, dep) {
          return previous.then(function() {
            // If already in flight, simply return that Promise.
            if (promiseCache[dep]) {
              return promiseCache[dep];
            }

            var current = dep;
            var _module = global.module;
            var _exports = global.exports;

            global.module = { exports: {} };
            global.exports = module.exports;

            if (isLocal(current)) {
              current = join(pkgPath, current);
            }

            if (require.cache[dep]) {
              return require.cache[dep].exports;
            }

            return require.load(current).then(function() {
              // TODO Make this localized to a specific requiring module.
              require.cache[dep] = global.module;

              global.module = _module;
              global.exports = _exports;

              return require.cache[dep].exports;
            });
          });
        }, Promise.resolve()).then(function() {
          var _module = global.module;
          var _exports = global.exports;

          global.module = { exports: {} };
          global.exports = module.exports;

          return require.load(modulePath).then(function() {
            require.cache[moduleName] = global.module;

            global.module = _module;
            global.exports = _exports;

            return [moduleName, require.cache[moduleName].exports];
          });
        });
      });
    };

    var cacheResult = function(result) {
      var moduleName = result[0];
      var exports = result[1];

      require.cache[moduleName] = { exports: exports };

      return require.cache[moduleName].exports;
    };

    return promiseCache[moduleName] = makeRequest(pkgPath)
      .then(JSON.parse)
      .then(normalizeMain)
      .then(loadMainScript)
      .then(cacheResult);
  }

  var exports = {
    define: define, require: require
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = exports;
  }

  // Always expose the global amd.
  global.amd = exports;

  if (!global.require) {
    global.require = require;
  }

  if (!global.define) {
    global.define = define;
  }

  if (require.isBrowser) {
    var thisScript = document.scripts[document.scripts.length - 1];
    var loadConfig = Promise.resolve(true);

    if (thisScript.dataset.config) {
      isConfig = thisScript.dataset.config;
      loadConfig = require.load(thisScript.dataset.config);
    }

    if (thisScript.dataset.main) {
      loadConfig.then(function() {
        require.load(thisScript.dataset.main);
      });
    }
  }
})(
  typeof global !== 'undefined' ? global : this,
  typeof require !== 'undefined' ? require : null
);
