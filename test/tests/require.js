describe('require', function() {
  var require = amd.require;

  it('is a function', function() {
    assert(typeof require === 'function');
  });

  inNodeIt('can require a core node module', function() {
    return require.load('fs').then(function(fs) {
      assert(typeof fs.readFileSync === 'function');
    });
  });

  it('can require a cached module', function() {
    require.cache = {
      assert: { exports: assert }
    };

    assert(require('assert') === assert);
  });

  it('can require a node module', function() {
    return require.load('mustache').then(function(module) {
      assert(module.name === 'mustache.js');
    });
  });

  it('can load a basic amd module', function() {
    return require.load('./fixtures/success').then(function(module) {
      assert(module === 'the accomplishment of an aim or purpose.');
    });
  });

  it('can load a simplified commonjs amd module', function() {
    return require.load('./fixtures/scjs').then(function(module) {
      assert(module === 'the accomplishment of an aim or purpose.');
    });
  });

  //it('can load an empty simplified commonjs amd module', function() {
  //  return require.load('./fixtures/empty-cjs').then(function(module) {
  //    assert(typeof module === 'object');
  //  });
  //});

  it('will automatically load index.js when supplied a folder', function() {
    return require.load('./fixtures/').then(function(module) {
      assert(module.test === 'the accomplishment of an aim or purpose.');
      assert(module.mustache.name === 'mustache.js');
    });
  });

  it('will fail when loading a missing file', function() {
    return require.load('./fixtures/not-found').catch(function(ex) {
      assert(ex.message === 'Module: ./fixtures/not-found failed to load');
    });
  });

  it('will fail when loading an invalid script', function(done) {
    require.load('./fixtures/failure').catch(function() {
      done();
    });
  });

  it('can load a primed module', function() {
    require.cache['test'] = { exports: 'hello world' };
    assert(require('test') === 'hello world');
  });

  describe('config', function() {
    before(function() {
      this.options = require.config();
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
      require.config({ paths: { a: 'b' } });

      assert(typeof this.options.paths === 'object');
      assert(this.options.paths.a === 'b');
    });

    it('can merge options', function() {
      require.config({ paths: { a: 'b', b: 'a' } });
      require.config({ paths: { a: 'a', b: 'b' } });

      assert(this.options.paths.a === 'a');
      assert(this.options.paths.b === 'b');
    });

    it('can get a single option by passing a string', function() {
      require.config({ custom: 'prop' });
      assert(require.config('custom') === 'prop');
    });
  });

  it('can use paths configuration', function() {
    require.config({ paths: { 'nested-path': './nested' } });

    return require.load('./fixtures/paths').then(function(module) {
      assert(module === true);
    });
  });

  it('can use a plugin', function() {
    require.config({ paths: { html: './fixtures/mustache' } });

    return require.load('./fixtures/templates/test.html').then(function(tmpl) {
      var output = tmpl({ woah: 'man' });
      assert(output === 'man');
    });
  });

  it('can use a plugin in a module', function() {
    require.config({ paths: { html: './fixtures/mustache' } });

    return require.load('./fixtures/plugin').then(function(module) {
      assert(module === 'man');
    });
  });

  inBrowserIt('can use a pre-existing plugin', function() {
    require.config({
      paths: {
        html: 'lodash-template-loader'
      },

      lodashLoader: {
        ext: ''
      }
    });

    return require.load('./fixtures/templates/ldsh.html').then(function(tmpl) {
      var output = tmpl({ woah: 'man' });
      assert(output === 'man\n');
    });
  });
});
