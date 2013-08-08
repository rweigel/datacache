var server = process.argv[2] || "http://localhost:8000/";
//var server = process.argv[2] || "http://datacache.org/dc/";

var tests     = [];
tests[0]      = {};
tests[0].com  = "streamOrder=true&return=stream&forceUpdate=true&forceWrite=true&inOrder=true&prefix="+server+"demo/file&source=1.txt%0A2.txt";
tests[0].sort = false;
tests[0].n    = 5;

// The following four should give the same result.
// The files are served with a random delay between 0 and 100 ms.

//var prefix    = "http://magweb.cr.usgs.gov/data-stream/magnetometer/BOU/OneMinute/bou201308";
var prefix    = server + "test/data-stream/bou201308";
var source    = "01vmin.min%0A02vmin.min%0A03vmin.min"; // Not working.
var source    = "01vmin.min%0A02vmin.min";

tests[1]      = {};
tests[1].com  = "forceUpdate=true&forceWrite=true&lineRegExp=^[0-9]&streamOrder=true&return=stream&streamFilterReadLines=10&prefix="+prefix+"&source="+source;
tests[1].sort = false;
tests[1].n    = 5;
tests[1].md5  = "09b7aee72d91499b00b7858e099fae4c";

// Should fail because sort is not implemented.
tests[2]      = {};
tests[2].com  = "forceUpdate=true&forceWrite=true&lineRegExp=^[0-9]&streamOrder=false&return=stream&streamFilterReadLines=10&prefix="+prefix+"&source="+source;
tests[2].sort = true;
tests[2].n    = 5;
tests[2].md5  = tests[1].md5;

tests[3]      = {};
tests[3].com  = "forceUpdate=true&forceWrite=true&lineRegExp=^[0-9]&streamOrder=true&return=stream&streamFilterReadBytes=710&prefix="+prefix+"&source="+source;
tests[3].sort = false;
tests[3].n    = 5;
tests[3].md5  = tests[1].md5;

tests[4]      = {};
tests[4].com  = "forceUpdate=true&forceWrite=true&lineRegExp=^[0-9]&streamOrder=false&return=stream&streamFilterReadBytes=710&prefix="+prefix+"&source="+source;
tests[4].sort = true;
tests[4].n    = 5;
tests[4].md5  = tests[1].md5;

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
runtest(2);

function runtest(i) {
	settings = {base: server + "sync?", com: tests[i].com, n: tests[i].n, i:i};
	console.log("Sequentially requesting " + settings.n + " times: " + settings.base + settings.com);
	async.timesSeries(settings.n, testrun, testreport);
}

//console.log("Concurrently requesting " + settings.n + " times: " + settings.base + settings.com);
//async.times(settings.n, testrun, testreport);

function testrun(n, next) {
	suite("#" + n, function(test, testInfo, suiteDone){
		logger.i("test #" + n);
		
		request({
			uri: settings.base + settings.com
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
			if (!fs.existsSync("data-stream/streamTests.out."+settings.i)) {
				console.log("Writing "+"data-stream/streamTests.out."+settings.i);
				fs.writeFileSync("data-stream/streamTests.out."+settings.i,result.info.body);
				console.log("Writing "+"data-stream/streamTests.md5."+settings.i);
				fs.writeFileSync("data-stream/streamTests.md5."+settings.i,md5(result.info.body));
			} else {
				console.log("Reading "+"data-stream/streamTests.md5."+settings.i);
				var expectedmd5 = fs.readFileSync("data-stream/streamTests.md5."+settings.i).toString();
				// TODO:
				// if (settings.sort)
				// 	  result.info.body = sort(result.info.body)
				var resultmd5   = md5(result.info.body);
				if (expectedmd5 !== resultmd5) {
					console.log("Test failed.  Showing diffs.");
					//console.log("--- Expected");
					//console.log(fs.readFileSync("data-stream/streamTests.out."+settings.i).toString());
					//console.log("--- Received");
					//console.log(result.info.body);
					//console.log("---");
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

