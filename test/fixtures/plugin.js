define(function(require, exports, module) {
  'use strict';

  var template = require('./templates/test.html');

  module.exports = template({ woah: 'man' });
});
