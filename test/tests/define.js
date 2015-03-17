describe('define', function() {
  var define = amd.define;

  it('is a function', function() {
    assert(typeof define === 'function');
  });

  it('has an amd object', function() {
    assert(typeof define.amd === 'object');
  });

  it('can define a named module', function() {
    var jQuery = {};

    define('jquery', [], function() {
      return jQuery;
    });

    return amd.require.load('jquery').then(function(module) {
      assert(module === jQuery);
    });
  });

  it('can define an anonymous module', function() {
    return define([], function() {
      return 'Anonymous';
    }).then(function(module) {
      assert(module.exports === 'Anonymous', 'Exports the right value');
      assert(amd.require(module.name) === 'Anonymous');
    });
  });
});
