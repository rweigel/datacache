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
	suite("Should be success for a valid URL", function(test, testInfo, suiteDone){
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
	suite("Should handle an invalid URL gracefully", function(test, testInfo, suiteDone){
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
	suite("Should not crash with an invalid URL and includeData=true", function(test, testInfo, suiteDone){
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
	suite("Should not crash with an 404 URL and return=stream", function(test, testInfo, suiteDone){
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
	suite("Should not halt with an invalid domain name and return=stream", function(test, testInfo, suiteDone){
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
function(cb){
	suite("Should not return only partial data with return=stream", function(test, testInfo, suiteDone){
		request({
			uri: server + "?source=http://www.google.com&return=stream&forceUpdate=true",
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

			test("should return all data", function(){
				assert(body !== undefined, 'body should not be undefined');
				assert(body.indexOf("</html>") > 1, 'body should contain the end of document');
			});

			suiteDone();
			cb();
		});
	})
},
function(cb){
	suite("Request a file in zip with return=json", function(test, testInfo, suiteDone){
		request({
			uri: server + "?source=http://localhost:8000/test/data/test.zip/ephx_00_161.txt&return=json&forceUpdate=true",
			timeout: 5000
		}, function(err, res, body){
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

			test("error should be null", function(){
				var result = JSON.parse(body)[0];
				assert(!result.error);
			});

			suiteDone();
			cb();
		});
	})
},
function(cb){
	suite("Request a file in zip with return=stream", function(test, testInfo, suiteDone){
		request({
			uri: server + "?source=http://localhost:8000/test/data/test.zip/ephx_00_161.txt&return=stream&forceUpdate=true",
			timeout: 5000
		}, function(err, res, body){
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

			test("should return correct data", function(){
				assert(body.length > 0);
			});

			suiteDone();
			cb();
		});
	})
},
function(cb){
	suite("Request an inexist file in zip with return=json", function(test, testInfo, suiteDone){
		request({
			uri: server + "?source=http://localhost:8000/test/data/test.zip/INEXIST.txt&return=json&forceUpdate=true",
			timeout: 1000
		}, function(err, res, body){
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

			test("error should be be set to true", function(){
				var result = JSON.parse(body)[0];
				assert(result.error);
			});

			suiteDone();
			cb();
		});
	})
},
function(cb){
	suite("Request an inexist file in zip with return=stream", function(test, testInfo, suiteDone){
		request({
			uri: server + "?source=http://localhost:8000/test/data/test.zip/INEXIST.txt&return=stream&forceUpdate=true",
			timeout: 1000
		}, function(err, res, body){
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

			test("response should be empty", function(){
				assert(!body);
			});

			suiteDone();
			cb();
		});
	})
},
function(cb){
	suite("should parse http://tsds.org/cc/ky.htm correctly", function(test, testInfo, suiteDone){
		request({
			uri: server + "?source=http://tsds.org/cc/ky.htm&return=stream&forceUpdate=true",
			timeout: 1000
		}, function(err, res, body){
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

			test("result should be correct", function(){
				console.log(body);
				assert(body.length > 0)
				assert(body.indexOf("2012-01-01 01:00:00.00000 -6") > -1);
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
