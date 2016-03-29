'use strict';

module.exports = function (options, imports, register) {
  var log = imports.debug('plugins:debug-logger');
  log('start');

  var api = {
    debug: imports.debug
  };

  options = setOptions(options);

  if (options.active) {
    var logger = imports.logger.create(options);
    api.debug = function(name){
      return function() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(name);
        logger.info.apply(this, args);
      };
    };
  }

  log('register');
  if (options.active) log('switching to alternate logger');
  register(null, api);
};

function setOptions(options){
  var defaults = {
    name: 'debug.log',
    transports: [
      {
        'type': 'daily',
        'name': 'debug'
      }
    ]
  };

  if (options.name === undefined) {
    options.name = defaults.name;
  }

  if (options.transports === undefined) {
    options.transports = defaults.transports;
  }

  return options;
}
