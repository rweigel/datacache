var logger = require("./lib/logger")(),
	request = require("request"),
	async = require("async"),
	assert = require("assert"),
	simpleReporter = require("./lib/testReporter").simpleReporter;

var urls = [
	"http://www.google.com",
	"http://www.yahoo.com",
	"http://www.quotationspage.com/random.php3"
];

module.exports = function(finish){
	logger.i("light tests started");

	finish = finish || function(){};

	// Create a new runner in each run so that runner.results is clean
	var runner = require("./lib/testRunner")(),
		suite = runner.suite,
		assertNot =  runner.assertNot;

	// Test urls concurrently
	async.map(urls, testUrl, function(err, results){
		logger.i("\n" + simpleReporter(runner.results));
		finish();
	});

	// Test urls sequentially
	// async.mapSeries(urls, testUrl, function(err, results){
	// 	logger.i("\n" + simpleReporter(runner.results));
	// 	finish();
	// });

	function testUrl(url, urlDone){
		suite(url, function(test, testInfo, suiteDone){
			request({
				uri: url,
				timeout: 3111
			}, function(err, res, body){
				// Add info to runner.results
				testInfo("err", err);
				testInfo("res", res);
				testInfo("body", body);

				test("request should not timeout", function(){
					assertNot(err!=null && err.code == "ETIMEDOUT");
				});

				test("status code should be 200", function(){
					assert(res.statusCode == 200);
				})

				suiteDone();

				urlDone();
			});
		})
	}
}
