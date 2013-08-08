var server = process.argv[2] || "http://localhost:8000/";
//var server = process.argv[2] || "http://datacache.org/dc/";


// Testing streamOrder, streamFilterReadLines, and streamFilterReadBytes 

//var prefix    = "http://magweb.cr.usgs.gov/data-stream/magnetometer/BOU/OneMinute/bou201308";
var prefix    = server + "test/data-stream/bou201308";
var args      = server + "sync?return=stream&forceUpdate=true&forceWrite=true&lineRegExp=^[0-9]";

// Base test.

// These two files are served without delay
var source    = "01vmin.min%0A02vmin.min";
var tests     = [];

var j = 0;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=true&streamFilterReadLines=10&prefix="+prefix+"&source="+source;
tests[j].sort = false;
tests[j].n    = 10;
tests[j].md5  = "";

// Stream order = false.  Sorted stream should have same md5 as previous.
j = j+1;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=false&streamFilterReadLines=10&prefix="+prefix+"&source="+source;
tests[j].sort = true;
tests[j].n    = 10;
tests[j].md5  = "";

j = j+1;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=true&streamFilterReadBytes=720&prefix="+prefix+"&source="+source;
tests[j].sort = false;
tests[j].n    = 10;
tests[j].md5  = "";

// Fails
j = j+1;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=false&streamFilterReadBytes=720&prefix="+prefix+"&source="+source;
tests[j].sort = true;
tests[j].n    = 2;
tests[j].md5  = "";

// Base test.
// These three files are served with random delay between 0 and 100 ms.
var source    = "03vmin.min%0A04vmin.min%0A05vmin.min";

j = j+1;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=true&streamFilterReadLines=10&prefix="+prefix+"&source="+source;
tests[j].sort = false;
tests[j].n    = 10;
tests[j].md5  = "";

j = j+1;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=false&streamFilterReadLines=10&prefix="+prefix+"&source="+source;
tests[j].sort = true;
tests[j].n    = 10;
tests[j].md5  = "";

j = j+1;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=true&streamFilterReadBytes=720&prefix="+prefix+"&source="+source;
tests[j].sort = false;
tests[j].n    = 10;
tests[j].md5  = "";

// Fails
j = j+1;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=false&streamFilterReadBytes=720&prefix="+prefix+"&source="+source;
tests[j].sort = true;
tests[j].n    = 10;
tests[j].md5  = "";


var fs      = require("fs");
var jsdiff  = require("diff");
var async   = require("async");
var logger  = require("./lib/logger")();
var request = require("request");
var md5     = require("./lib/util").md5;

var runner    = require("./lib/testRunner")();
var suite     = runner.suite;
var assertNot = runner.assertNot;

logger.i("streamTests.js tests started.");

var settings = {};

//runtest(0);
runtest(6);
var debug = false;

function runtest(i) {
	settings = tests[i];
	settings.i = i;
	console.log("Sequentially requesting " + tests[i].n + " times: " + tests[i].url);
	async.timesSeries(tests[i].n, testrun, testreport);
}

//console.log("Concurrently requesting " + settings.n + " times: " + settings.base + settings.com);
//async.times(settings.n, testrun, testreport);

function testrun(n, next) {
	suite("#" + n, function(test, testInfo, suiteDone){
		logger.i("test #" + n);
		
		request({
			uri: settings.url
		}, function(err, res, body){
			// Add info to runner.results
			testInfo("err", err);
			testInfo("res", res);
			testInfo("body", body);
			suiteDone();
			next();
		});
	});
}

function testreport(err) {
	// Generate report. Usually we can call a testReporter to generate report. 
	// But this case is very simple, so we can generate the report here directly. 
	var testReport = runner
		.results
		.suites
		.map(function(result){

			if (debug) console.log(settings);

			if (!fs.existsSync("data-stream/streamTests.out."+settings.i)) {
				if (debug) console.log("Writing "+"data-stream/streamTests.out."+settings.i);
				fs.writeFileSync("data-stream/streamTests.out."+settings.i,result.info.body);
				if (debug) console.log("Writing "+"data-stream/streamTests.md5."+settings.i);
				fs.writeFileSync("data-stream/streamTests.md5."+settings.i,md5(result.info.body));
			} else {
				if (debug) console.log("Reading "+"data-stream/streamTests.md5."+settings.i);
				var expectedmd5 = fs.readFileSync("data-stream/streamTests.md5."+settings.i).toString();
				if (settings.sort) {
					if (debug) {
						console.log("Sorting");
						console.log("Before sort")
						console.log(result.info.body);
						console.log("After sort")
					}
					if (result.info.body.match(/\n$/)) {
						if (debug) {
							console.log("File has trailing newline.");
							console.log(result.info.body.replace(/\n$/,"").split("\n").sort().join("\n")+"\n");
						}
						result.info.body = result.info.body.replace(/\n$/,"").split("\n").sort().join("\n")+"\n";
					} else {
						if (debug) { 
							console.log(result.info.body.split("\n").sort().join("\n"));
						}
						result.info.body = result.info.body.split("\n").sort().join("\n");
					}
				} else {
					if (debug) {
						console.log(result.info.body);
					}
				}
					  
				var resultmd5   = md5(result.info.body);
				if (expectedmd5 !== resultmd5) {
					console.log("Test failed.");
					console.log("--- Expected");
					console.log(fs.readFileSync("data-stream/streamTests.out."+settings.i).toString());
					console.log("--- Received");
					console.log(result.info.body);
					console.log("---");
					//var diffs = jsdiff.diffLines(fs.readFileSync("data-stream/streamTests.out."+settings.i).toString(), result.info.body);
					//console.log(diffs.added);
					//console.log(diffs.removed);
				} 
			}
			return resultmd5;
		})
		.join("\n");
	
	logger.i("\n" + testReport);
	logger.i("streamTests.js tests ended.");

	// Does not work.
	//if (tests[settings.i+1])
	//	runtest(settings.i+1);

}

