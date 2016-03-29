'use strict';

var util = require('util');
var fs = require('fs');
var stream = require('stream');
var colors = require('tty').isatty(2) || process.env.DEBUG_COLORS;

module.exports = function(name, options){
  var logger = new Logger(name);
  var newLogger = function(){
    var args = Array.prototype.slice.call(arguments, 0);
    args.unshift('debug');
    return logger.log.apply(logger, args);
  };

  Object.keys(Logger.prototype).map(function(fn){
    newLogger[fn] = logger[fn];
  });

  ['debug', 'warn', 'error', 'info', 'critical'].map(function(level){
    newLogger[level] = function(){
      var args = Array.prototype.slice.call(arguments, 0);
      args.unshift(level);
      return logger.log.apply(logger, args);
    };
  });

  newLogger.silly = newLogger.debug;
  newLogger.transports = logger.transports;

  return newLogger;
};

var levels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  critical: 4
};

var colors = {
  debug: 4, //blue
  info: 6, // cyan
  warn: 3, // yellow
  error: 1, // red
  critical: 5 // magenta
};

module.exports.defaultLevel = 'critical';

function Logger(name){
  this.name = name;
  this.level(module.exports.defaultLevel);
  this.transports = {
    console: [new Console(this, module.exports.defaultLevel)]
  };
  processSearches(this);
}

Logger.prototype.transports = {};

Logger.prototype.log = function(){
  var args = Array.prototype.slice.call(arguments, 0);
  var self = this;

  return Object.keys(self.transports).some(function(transport){
    return self.transports[transport].some(function(handler){
      return handler.log.apply(handler, args);
    });
  });
};

Logger.prototype.level = function(level){
  var self = this;
  // Setting a top level should cascade to transports
  Object.keys(this.transports).map(function(transport){
    self.transport[transport].map(function(t){
      t.level(level);
    });
  });

  this.levelNumber = levels[level];

  return this;
};




