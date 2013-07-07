console.log('dir', __dirname);

var cronJob = require("cron").CronJob,
	async = require("async");

var lightTests = require("./lightTests");
var heavyTests = require("./heavyTests");
var failedTests = require("./failedTests");

var logger = require("./lib/logger")();

logger.i("Tests started.");

async.series([
	startLightTests,
	startHeavyTests,
	startFailedTests
]);

// Run light tests immediately and every 5 minutes afterwards (when minutes can be divided by 5)
function startLightTests(finish){
	(new cronJob("*/5 * * * *", lightTests)).start();
	lightTests(finish);
}

// Run heavy tests immedidately and every hour afterwards
function startHeavyTests(finish){
	(new cronJob("0 * * * *", heavyTests)).start();
	heavyTests(finish);
}

// Run failed tests immediately and every hour afterwards
function startFailedTests(finish){
	(new cronJob("0 * * * *", failedTests)).start();
	failedTests(finish);
}


