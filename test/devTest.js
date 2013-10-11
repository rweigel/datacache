var cronJob = require("cron").CronJob,
	assert = require("assert"),
	async = require("async"),
	logger = require("./lib/logger")("devTests"),
	request = require("request"),
	simpleReporter = require("./lib/testReporter").simpleReporter;

var logger = require("./lib/logger")();

var server = process.argv[2] || "http://localhost:8000/";

logger.i("Dev Tests started.");

var runner = require("./lib/testRunner")(),
	suite = runner.suite,
	assertNot =  runner.assertNot;

async.series([
function(cb){
	suite("Should be success for a valid URL", function(test, testInfo, suiteDone){
		request({
			uri: server + "sync?source=http://localhost:8000",
			timeout: 10000
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
			uri: server + "sync/?source=http://www.notexist.forever",
			timeout: 10000
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
			uri: server + "sync?source=http://www.notexist.forever&includeData=true",
			timeout: 10000
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
			uri: server + "sync?source=http://localhost:8000/404&return=stream",
			timeout: 10000
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
			uri: server + "sync?source=http://www.notexist.forever&return=stream",
			timeout: 10000
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
			uri: server + "sync?source="+server+"test/data/google.html&return=stream&forceUpdate=true",
			timeout: 10000
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
			uri: server + "sync?source="+server+"test/data/test.zip/ephx_00_161.txt&return=json&forceUpdate=true",
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
			uri: server + "sync?source="+server+"test/data/test.zip/ephx_00_161.txt&return=stream&forceUpdate=true",
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
			uri: server + "sync?source="+server+"test/data/test.zip/INEXIST.txt&return=json&forceUpdate=true",
			timeout: 10000
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
			uri: server + "sync?source="+server+"test/data/test.zip/INEXIST.txt&return=stream&forceUpdate=true",
			timeout: 10000
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
	suite("request with extractData", function(test, testInfo, suiteDone){
		request({
			uri: server + "sync?source="+server+"test/data/google.html&extractData=$(\"p\").text()&return=stream&forceUpdate=true",
			timeout: 10000
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

			test("response should have the correct content", function(){
				assert(body.indexOf("google")==0);
			});

			suiteDone();
			cb();
		});
	})
},
function(cb){
	suite("request with more than 1 URLs", function(test, testInfo, suiteDone){
		request({
			uri: server + "sync?source="+server+"test/data/google.html\n"+server+"test/data/yahoo.html&extractData=$(\"p\").text()&return=stream&forceUpdate=true",
			timeout: 10000
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

			test("response should have the correct content", function(){
				assert(body.indexOf("google") > -1, "should have content from google");
				assert(body.indexOf("yahoo") > -1, "should have content from Yahoo");
			});

			suiteDone();
			cb();
		});
	})
},
function(cb){
	suite("request with prefix", function(test, testInfo, suiteDone){
		request({
			uri: server + "sync?prefix="+server+"&source=test/data/google.html&extractData=$(\"p\").text()&return=stream&forceUpdate=true",
			timeout: 10000
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

			test("response should have the correct content", function(){
				assert(body.indexOf("google") > -1, "should have content from google");
			});

			suiteDone();
			cb();
		});
	})
},
function(cb){
	suite("request with template and timeRange", function(test, testInfo, suiteDone){
		request({
			uri: server + "sync?template="+server+"test/data/file$Y$m$d.txt&timeRange=1999-01-01/1999-01-03",
			timeout: 10000
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

			test("response should have the correct content", function(){
				var result = JSON.parse(body);
				assert(result.length === 2);
				assert(result[0].url === server+"test/data/file19990101.txt");
				assert(result[1].url === server+"test/data/file19990102.txt");
			});

			suiteDone();
			cb();
		});
	})
},
function(cb){
	suite("request with template and indexRange", function(test, testInfo, suiteDone){
		request({
			uri: server + "sync?template="+server+"test/data/file%d.txt&indexRange=1/2",
			timeout: 10000
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

			test("response should have the correct content", function(){
				var result = JSON.parse(body);
				assert(result.length === 2);
				assert(result[0].url === server+"test/data/file1.txt");
				assert(result[1].url === server+"test/data/file2.txt");
			});

			suiteDone();
			cb();
		});
	})
},
function(cb){
	suite("request with lineRegExp", function(test, testInfo, suiteDone){
		request({
			uri: server + "sync?source="+server+"test/data/stream.txt&return=json&lineRegExp=^[0-9].*&includeData=true&forceUpdate=true",
			timeout: 10000
		}, function(err, res, body){
			testInfo("err", err);
			testInfo("res", res);
			testInfo("body", body);

			test("request should succeed", function(){
				console.log(err);
				assert( !err );
			});

			test("status code should be 200", function(){
				assert(res);
				assert.equal(res.statusCode, 200);
			});

			test("response should have the correct content", function(){
				console.log("body", body)
				assert(body.indexOf("1 2 3") > -1);
				assert(body.indexOf("a b c") == -1);
				assert(body.indexOf("4 5 6") > -1);
			});

			suiteDone();
			cb();
		});
	})
},
function(){
	logger.i("\n" + simpleReporter(runner.results));
	logger.i("Dev Tests finished.");
	if(runner.results.failedSuitesCount > 0){
		process.exit(1);
	}
}
]);
