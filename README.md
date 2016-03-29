Config Format

{
  "packagePath": "architect-debug-loggerr",
  "exitOnError": false,
  "transports": {
    "console": {
      "colorize": true,
      "level": "verbose"
    },
    "file": {
      "filename": "./logs/errors.log",
      "level": "warn"
    }
  }
}

Usage

Let's use that puppy in our plugin

module.exports = function (options, imports, register) {

  var log = imports.logger;

  logger.info("Hello!");
  logger.warn("Uh oh! There's an error coming...");
  logger.error("We're going down");

};
