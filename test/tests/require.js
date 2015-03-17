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

  it('can require a node module', function() {
    return amd.require.load('mustache').then(function(module) {
      assert(module.name === 'mustache.js');
    });
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

  it('can load an empty simplified commonjs amd module', function() {
    return amd.require.load('./fixtures/empty-cjs').then(function(module) {
      assert(typeof module === 'object');
    });
  });

  it('will automatically load index.js when supplied a folder', function() {
    return amd.require.load('./fixtures/').then(function(module) {
      assert(module.test === 'the accomplishment of an aim or purpose.');
      assert(module.mustache.name === 'mustache.js');
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

  it('can load a primed module', function() {
    amd.require.cache['test'] = { exports: 'hello world' };
    assert(amd.require('test') === 'hello world');
  });
});
