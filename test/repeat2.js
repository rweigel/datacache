var async = require("async"),
	logger = require("./lib/logger")(),
	request = require("request"),
	md5 = require("./lib/util").md5;

var runner = require("./lib/testRunner")(),
	suite = runner.suite,
	assertNot =  runner.assertNot;

logger.i("repeat2.js tests started.");

var settings = {
	base: "http://datacache.org/dc/sync?",
	com: "streamOrder=true&return=stream&forceUpdate=true&forceWrite=true&inOrder=true&prefix=http://datacache.org/dc/demo/file&source=1.txt%0A2.txt",
	n: 10
};

var url = settings.base + settings.com;

// Concurrently repeat execution n times
//async.times(settings.n, function(n, next){

// Sequentially repeat execution n times
async.timesSeries(settings.n, function(n, next){
	suite("#" + n, function(test, testInfo, suiteDone){
		logger.i("test #" + n);

		request({
			uri: url
		}, function(err, res, body){
			// Add info to runner.results
			testInfo("err", err);
			testInfo("res", res);
			testInfo("body", body);
			
			suiteDone();
			next();
		});
	});
}, 

// Generate report. Usually we can call a testReporter to generate report. 
// But this case is very simple, so we can generate the report here directly. 
function(err){
	var testReport = runner.results.suites
	.map(function(result){
		return md5(result.info.body);
	})
	.join("\n");

	logger.i("\n" + testReport);

	logger.i("repeat2.js tests ended.");
});