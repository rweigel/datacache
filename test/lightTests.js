var logger = require("./lib/logger")(),
	request = require("request"),
	assert = require("assert"),
	simpleReporter = require("./lib/testReporter").simpleReporter;

var urls = [
	"http://www.google.com"
];

module.exports = function(){
	logger.i("light tests started");

	// Create a new runner in each run so that runner.results is clean
	var runner = require("./lib/testRunner")(),
		suite = runner.suite,
		test = runner.test,
		testInfo = runner.testInfo,
		assertNot =  runner.assertNot;

	urls.forEach(testUrl);

	function testUrl(url){
		suite(url, function(done){
			request({
				uri: url,
				timeout: 1
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

				// Needs to explictly call done() since tests are executed in 
				// request()'s callback function
				done();

				// console.log(runner.results);
				// console.log(simpleReporter(runner.results));
				logger.i("\n" + simpleReporter(runner.results));
			});
		})
	}
}
