describe('Define', function() {
  it('is a function', function() {
    assert(typeof amd.define === 'function');
  });

  it('has an amd object', function() {
    assert(typeof amd.define.amd === 'object');
  });

  it('can define a named module', function() {
    var jQuery = {};

    amd.define('jquery', [], function() {
      return jQuery;
    });

    return amd.require.load('jquery').then(function(module) {
      assert(module === jQuery);
    });
  });

  it('can define an anonymous module', function() {
    return amd.define([], function() {
      return 'Anonymous';
    }).then(function(module) {
      assert(module.exports === 'Anonymous', 'Exports the right value');
      assert(amd.require(module.name) === 'Anonymous');
    });
  });
});
