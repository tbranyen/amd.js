describe('Require', function() {
  it('is a function', function() {
    assert(typeof amd.require === 'function');
  });

  it('can require a cached module', function() {
    amd.require.cache = {
      assert: { exports: assert }
    };

    assert(amd.require('assert') === assert);
  });

  inNodeIt('can require a node module', function() {
    assert(amd.require('mocha') === require('mocha'));
  });

  it('can load a basic amd module', function() {
    return amd.require.load('./fixtures/success').then(function(module) {
      assert(module === 'the accomplishment of an aim or purpose.');
    });
  });

  it('can load a simplified commonjs amd module', function() {
    return amd.require.load('./fixtures/scjs').then(function(module) {
      assert(module === 'the accomplishment of an aim or purpose.');
    });
  });

  it('will fail when loading a missing file', function() {
    return amd.require.load('./fixtures/not-found').catch(function(ex) {
      assert(ex.message === 'Module: ./fixtures/not-found failed to load');
    });
  });

  it('will fail when loading an invalid script', function(done) {
    amd.require.load('./fixtures/failure').catch(function() {
      done();
    });
  });
});
