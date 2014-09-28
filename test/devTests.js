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
	var uri = server + "sync?source="+server+"&forceUpdate=true&forceWrite=true";
	suite("should be success for a valid URL: "+uri, function(test, testInfo, suiteDone){
		request({
			uri: uri,
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
				assert(!json[0].error);
			});

			suiteDone();
			cb();
		});
	})
},
function(cb){
	var uri = server + "sync/?source=http://www.notexist.forever&forceUpdate=true&forceWrite=true";
	suite("should handle an invalid URL gracefully: "+uri, function(test, testInfo, suiteDone){
		request({
			uri: uri,
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
				assert(json[0].error);
				
			});

			suiteDone();
			cb();
		});
	})
},
function(cb){
	var uri = server + "sync?source=http://www.notexist.forever&includeData=true&forceUpdate=true&forceWrite=true";
	suite("should not crash with an invalid URL and includeData=true: "+uri, function(test, testInfo, suiteDone){
		request({
			uri: uri,
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
	var uri = server + "sync?source=http://localhost:8000/404&return=stream&forceUpdate=true&forceWrite=true";
	suite("should not crash with an 404 URL and return=stream: "+uri, function(test, testInfo, suiteDone){
		request({
			uri: uri,
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
	var uri = server + "sync?source=http://www.notexist.forever&return=stream&forceUpdate=true&forceWrite=true";
	suite("should not halt with an invalid domain name and return=stream: "+uri, function(test, testInfo, suiteDone){
		request({
			uri: uri,
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
	var uri = server + "sync?source="+server+"test/data/google.html&return=stream&forceUpdate=true&forceWrite=true";
	suite("should not return only partial data with return=stream: "+uri, function(test, testInfo, suiteDone){
		request({
			uri: uri,
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
	var uri = server + "sync?source="+server+"test/data/test.zip/ephx_00_161.txt&return=json&forceUpdate=true&forceWrite=true";
	suite("request a file in zip with return=json: "+uri, function(test, testInfo, suiteDone){
		request({
			uri: uri,
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
	var uri = server + "sync?source="+server+"test/data/test.zip/ephx_00_161.txt&return=stream&forceUpdate=true&forceWrite=true";
	suite("request a file in zip with return=stream: "+uri, function(test, testInfo, suiteDone){
		request({
			uri: uri,
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
	var uri = server + "sync?source="+server+"test/data/test.zip/INEXIST.txt&return=json&forceUpdate=true&forceWrite=true";
	suite("request an inexist file in zip with return=json: "+uri, function(test, testInfo, suiteDone){
		request({
			uri: uri,
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
	var uri = server + "sync?source="+server+"test/data/test.zip/INEXIST.txt&return=stream&forceUpdate=true&forceWrite=true";
	suite("request an inexist file in zip with return=stream: "+uri, function(test, testInfo, suiteDone){
		request({
			uri: uri,
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
	var uri = server + "sync?source="+server+"test/data/google.html&extractData=$(\"p\").text()&return=stream&forceUpdate=true&forceWrite=true";
	suite("request with extractData: "+uri, function(test, testInfo, suiteDone){
		request({
			uri: uri,
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
	var uri = server + "sync?source="+server+"test/data/google.html\n"+server+"test/data/yahoo.html&extractData=$(\"p\").text()&return=stream&forceUpdate=true&forceWrite=true";
	suite("request with more than 1 URLs: "+uri, function(test, testInfo, suiteDone){
		request({
			uri: uri,
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
	var uri = server + "sync?prefix="+server+"&source=test/data/google.html&extractData=$(\"p\").text()&return=stream&forceUpdate=true&forceWrite=true";
	suite("request with prefix: "+uri, function(test, testInfo, suiteDone){
		request({
			uri: uri,
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
	var uri = server + "sync?template="+server+"test/data/file$Y$m$d.txt&timeRange=1999-01-01/1999-01-03&forceUpdate=true&forceWrite=true";
	suite("request with template and timeRange: "+uri, function(test, testInfo, suiteDone){
		request({
			uri: uri,
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
	var uri = server + "sync?template="+server+"test/data/file%d.txt&indexRange=1/2";
	suite("request with template and indexRange: "+uri, function(test, testInfo, suiteDone){
		request({
			uri: uri,
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
	var uri = server + "sync?source="+server+"test/data/stream.txt&return=json&lineRegExp=^[0-9].*&includeData=true&forceUpdate=true&forceWrite=true";
	suite("request with lineRegExp: "+uri, function(test, testInfo, suiteDone){
		request({
			uri: uri,
			timeout: 10000
		}, function(err, res, body){
			testInfo("err", err);
			testInfo("res", res);
			testInfo("body", body);

			test("request should succeed", function(){
				if (err) console.log(err);
				assert( !err );
			});

			test("status code should be 200", function(){
				assert(res);
				assert.equal(res.statusCode, 200);
			});

			test("response should have the correct content", function(){
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
