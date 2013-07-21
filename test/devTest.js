var cronJob = require("cron").CronJob,
	assert = require("assert"),
	async = require("async"),
	logger = require("./lib/logger")("devTests"),
	request = require("request"),
	simpleReporter = require("./lib/testReporter").simpleReporter;

var logger = require("./lib/logger")();

var server = "http://localhost:8000/sync";

logger.i("Dev Tests started.");

var runner = require("./lib/testRunner")(),
	suite = runner.suite,
	assertNot =  runner.assertNot;

async.series([
function(cb){
	suite("should success for a valid URL", function(test, testInfo, suiteDone){
		request({
			uri: server + "?source=http://www.google.com",
			timeout: 1000
		}, function(err, res, body){
			// Add info to runner.results
			testInfo("err", err);
			testInfo("res", res);
			testInfo("body", body);

			test("request should succeed", function(){
				assert( !err );
			});

			test("status code should be 200", function(){
				assert(res);
				assert.equal(res.statusCode, 200);
			});

			test("returned JSON should have 'error' set to false", function(){
				var json;
				try{
					json = JSON.parse(body);
				} catch(e){}
				assert(json);
				assert.equal(json[0].error, false);
			});

			suiteDone();
			cb();
		});
	})
},
function(cb){
	suite("should handle an invalid URL gracefully", function(test, testInfo, suiteDone){
		request({
			uri: server + "?source=http://www.notexist.forever",
			timeout: 1000
		}, function(err, res, body){
			// Add info to runner.results
			testInfo("err", err);
			testInfo("res", res);
			testInfo("body", body);

			test("request should succeed", function(){
				assert( !err );
			});

			test("status code should be 200", function(){
				assert(res);
				assert.equal(res.statusCode, 200);
			});

			test("returned JSON should have 'error' set to true", function(){
				var json;
				try{
					json = JSON.parse(body);
				} catch(e){}
				assert(json);
				assert(json[0].error);
			});

			suiteDone();
			cb();
		});
	})
},
function(cb){
	suite("should not crash with an invalid URL and includeData=true", function(test, testInfo, suiteDone){
		request({
			uri: server + "?source=http://www.notexist.forever&includeData=true",
			timeout: 1000
		}, function(err, res, body){
			// Add info to runner.results
			testInfo("err", err);
			testInfo("res", res);
			testInfo("body", body);

			test("request should succeed", function(){
				assert( !err );
			});

			test("status code should be 200", function(){
				assert(res);
				assert.equal(res.statusCode, 200);
			});

			test("returned JSON should have 'error' set to true", function(){
				var json;
				try{
					json = JSON.parse(body);
				} catch(e){}
				assert(json);
				assert(json[0].error);
			});

			suiteDone();
			cb();
		});
	})
},
function(cb){
	suite("should not crash with an 404 URL and return=stream", function(test, testInfo, suiteDone){
		request({
			uri: server + "?source=http://www.google.com/404&return=stream",
			timeout: 1000
		}, function(err, res, body){
			// Add info to runner.results
			testInfo("err", err);
			testInfo("res", res);
			testInfo("body", body);

			test("request should succeed", function(){
				assert( !err );
			});

			test("status code should be 200", function(){
				assert(res);
				assert.equal(res.statusCode, 200);
			});

			suiteDone();
			cb();
		});
	})
},
function(cb){
	suite("should not halt with an invalid domain name and return=stream", function(test, testInfo, suiteDone){
		request({
			uri: server + "?source=http://www.notexist.forever&return=stream",
			timeout: 1000
		}, function(err, res, body){
			// Add info to runner.results
			testInfo("err", err);
			testInfo("res", res);
			testInfo("body", body);

			test("request should succeed", function(){
				assert( !err );
			});

			test("status code should be 200", function(){
				assert(res);
				assert.equal(res.statusCode, 200);
			});

			suiteDone();
			cb();
		});
	})
},
function(){
	logger.i("\n" + simpleReporter(runner.results));
	logger.i("Dev Tests finished.");
}
]);
