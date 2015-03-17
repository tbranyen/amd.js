describe('require', function() {
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

  describe('config', function() {
    before(function() {
      this.options = amd.require.config();
    });

    afterEach(function() {
      Object.keys(this.options).forEach(function(key) {
        delete this.options[key];
      }, this);

      assert(Object.keys(this.options).length === 0);
    });

    it('will return options when called', function() {
      assert(typeof this.options === 'object');
    });

    it('can set options', function() {
      amd.require.config({ paths: { a: 'b' } });

      assert(typeof this.options.paths === 'object');
      assert(this.options.paths.a === 'b');
    });

    it('can merge options', function() {
      amd.require.config({ paths: { a: 'b', b: 'a' } });
      amd.require.config({ paths: { a: 'a', b: 'b' } });

      assert(this.options.paths.a === 'a');
      assert(this.options.paths.b === 'b');
    });

    it('can get a single option by passing a string', function() {
      amd.require.config({ custom: 'prop' });
      assert(amd.require.config('custom') === 'prop');
    });
  });

  it('can use paths configuration', function() {
    amd.require.config({ paths: { 'nested-path': './nested' } });

    return amd.require.load('./fixtures/paths').then(function(module) {
      assert(module === true);
    });
  });
});
