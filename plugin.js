module.exports = function(options, imports, register) {
  'use strict';

  var logger = require('./logger');

  var api = {};

  //All debug calls will use the same transports
  api.debug = logger.debugLogger(options);

  //When using this one, module must pass in transport configuration
  api.logger = logger;

  //This one will always log to configured transports (like using console.log)
  api.appLogger = logger('APP', options);

  register(null, api);
};
