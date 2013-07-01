console.log('dir', __dirname);

var cronJob = require("cron").CronJob;

var lightTests = require("./lightTests");
var heavyTests = require("./heavyTests");
var failedTests = require("./failedTests");

var logger = require("./lib/logger")();

logger.i("Tests started.");

// Run light tests immediately and every 5 minutes afterwards (when minutes can be divided by 5)
lightTests();
(new cronJob("*/5 * * * *", lightTests)).start();

// Run heavy tests immedidately and every hour afterwards
heavyTests();
(new cronJob("0 * * * *", heavyTests)).start();

// Run failed tests immediately and every hour afterwards
failedTests();
(new cronJob("0 * * * *", failedTests)).start();
