'use strict';

/*
 TODO:
 - browser support
 - documentation
 - express request and response routing (express-winston-2)
 - http or ws logging (winstond, winston-tagged-http-logger?)
 - loggly
 - mail (winston-mail)
 - file
 -
 */

var winston = require('winston');
var util = require('util');
var _ = require('lodash');
var color = require('cli-color');
var moment = require('moment');
var EventEmitter = require('events').EventEmitter;
var loggerEventBus = new EventEmitter();
var prevColor = 0;
var Daily = require('winston-daily-rotate-file');

exports = module.exports = logger;
exports.debugLogger = debugLogger;

// If they want to use a transport not in the list, they need to use
// .add after creating the logger
exports.availableTransports = {
  console: winston.transports.Console,
  file: winston.transports.File,
  webhook: winston.transports.Webhook,
  http: winston.transports.Http
};

exports.enable = enable;
exports.disable = disable;
exports.disableAll = disableAll;
exports.enabled = enabled;
exports.load = load;
exports.save = save;
exports.timestamp = timestamp;
exports.formatter = formatter;
exports.colors = [
  'green',
  'blue',
  'magenta',
  'cyan',
  'greenBright',
  'blueBright',
  'magentaBright',
  'cyanBright'
];

/**
 * The currently active debug mode names, and names to skip.
 */
exports.names = [];
exports.skips = [];

function logger(namespace, options){
  var actualLogger = function(){};

  loggerEventBus.on('disable', function(namespace){
    if (namespace === actualLogger.namespace && namespace !== 'APP') {
      actualLogger('disabled');
      actualLogger.enabled = false;
    }
  });

  loggerEventBus.on('enable', function(namespace){
    if (namespace === actualLogger.namespace) {
      actualLogger.enabled = true;
      actualLogger('enabled');
    }
  });

  if (exports.enabled(namespace) || namespace === 'APP'){
    actualLogger = getEnabledLogger(namespace, options);
    actualLogger.enabled = true;
  } else {
    actualLogger = disabled;
  }

  actualLogger.namespace = namespace;

  return actualLogger;
}

function getEnabledLogger(namespace, options){
  options.color = randomColor();
  var logger = createLogger(namespace, options);
  return createEnabledLogger(namespace, logger);
}

function randomColor() {
  return exports.colors[prevColor++ % exports.colors.length];
}

function createLogger(namespace, options){
  var transportConfig = getTransportConfiguration(namespace, options);
  if (transportConfig.dailyFileRotate) {
    winston.loggers.options.transports = [
      new Daily(transportConfig.dailyFileRotate)
    ];
    delete transportConfig.dailyFileRotate;
  }
  winston.loggers.add(namespace, transportConfig);
  var logger = winston.loggers.get(namespace);
  return logger;
}

function getTransportConfiguration(namespace, options){
  var transports = _.create({}, options.transports);
  for (var transport in transports){
    var transportOptions = transports[transport];
    if (transport === 'console'){
      transportOptions = _.merge({
        timestamp: timestamp,
        formatter: formatter,
        colorize: true,
        stderrLevels: ['error'],
        align: true,
        humanReadableUnhandledException: true
      }, transportOptions);
    }
    // Have to color it here because the transport object is not available in
    // the format function
    transportOptions.label = color[options.color]('[' + namespace + ']');
    transports[transport] = transportOptions;
  }

  return transports;
}

function timestamp(){
  return '[' + moment().format('YYYY/MM/DD hh:mm:ss') + ']';
}

function formatter(options){
  var colors = {
    timestamp: 'blackBright',
    debug: 'whiteBright',
    log: 'whiteBright',
    warn: 'yellowBright',
    error: 'red',
    critical: 'redBright'
  };
  var message = options.message;
  var meta = options.meta;
  var ident = options.label;
  var level = '['+options.level+']';
  var levelColor = options.level === 'debug' ?
    colors.timestamp : colors[options.level];
  var messageColor = colors[options.level];
  if (meta._hr) {
    return ident + ' ' + message;
  } else {
    return color[colors.timestamp](options.timestamp()) +
      color[levelColor](level.toUpperCase()) +
      ident + ' ' +
      color[messageColor](
        (message !== undefined ? message : '') +
        (meta && Object.keys(meta).length ? '\n\t'+ JSON.stringify(meta) : ''));
  }
}

function createEnabledLogger(namespace, logger){
  // Wrap winston logger to be somewhat api compatible with debug
  function logFn(level){
    return function(msg){
      var args = Array.prototype.slice.call(arguments);

      if (level === 'hr'){
        args = ['------------------------------------------------------------'];
        args.push({_hr: true});
        level = 'debug';
      }

      var logFn = logger[level] || console[level].bind(console);
      if (enabled.enabled) logFn.apply(logger, args);
    };
  }
  var enabled = logFn('debug');
  enabled.warn = logFn('warn');
  enabled.error = logFn('error');
  enabled.hr = logFn('hr');
  enabled.enabled = true;

  return _.defaults(enabled, logger);
}

function noop(){};

function disabled(){}
disabled.enabled = false;
disabled.error = noop;
disabled.warn = noop;

function debugLogger(options){
  // Force configured options into debug loggers since they won't be passed
  // from the modules
  return function newDebugLogger(namespace){
    return logger(namespace, options);
  };
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */
function load() {
  return process.env.DEBUG;
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */
function enable(namespaces) {
  exports.save(namespaces);

  var split = (namespaces || '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
      loggerEventBus.emit('enable', split[i]);
    }
  }
}

/**
 * Disables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */
function disable(namespaces) {
  var split = (namespaces || '').split(/[\s,]+/);
  var len = split.length;

  function removeNamespaceFromNames(namespaces){
    _.remove(exports.names, function(name){
      return name.toString() === '/^' + namespaces + '$/';
    });
  }

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      removeNamespaceFromNames(namespaces);
      exports.skips.push(new RegExp('^' + namespaces + '$'));
      loggerEventBus.emit('disable', split[i]);
    }
  }

  exports.save(namespaces);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */
function save(namespaces) {
  if (null == namespaces) {
    // If you set a process.env field to null or undefined, it gets cast to the
    // string 'null' or 'undefined'. Just delete instead.
    delete process.env.DEBUG;
  } else {
    process.env.DEBUG = namespaces;
  }
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */
function enabled(name) {
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Disable debug output.
 *
 * @api public
 */
function disableAll() {
  exports.enable('');
}

exports.enable(load());


