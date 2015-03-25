define(function(require, exports, module) {
  var mustache = require('mustache');

  function resolve(contents) {
    return function() {
      var args = [contents].concat([].slice.call(arguments));
      return mustache.render.apply(mustache, args).trim();
    };
  }

  exports.load = function(url, req, done) {
    if (require.isBrowser) {
      var xhr = new XMLHttpRequest();

      xhr.onload = function() {
        done(resolve(xhr.responseText));
      };

      xhr.open('GET', url + '.html', true);
      xhr.send(null);
    }
    else {
      var path = req('path');
      var fs = req('fs');

      fs.readFile(path.join(__dirname, '../', url), function(err, contents) {
        done(resolve(String(contents)));
      });
    }
  };
});
