var server = process.argv[2] || "http://localhost:8000/";
//var server = process.argv[2] || "http://datacache.org/dc/";
var fs      = require("fs");
var JsDiff  = require("diff");

var async = require("async"),
	logger = require("./lib/logger")(),
	request = require("request"),
	md5 = require("./lib/util").md5;

var runner = require("./lib/testRunner")(),
	suite = runner.suite,
	assertNot =  runner.assertNot;

logger.i("streamTests.js tests started.");

var settings = {
	base: server + "sync?",
	com: "streamOrder=true&return=stream&forceUpdate=true&forceWrite=true&inOrder=true&prefix="+server+"demo/file&source=1.txt%0A2.txt",
	n: 1
};

var url = settings.base + settings.com;

// Concurrently repeat execution n times
//async.times(settings.n, function(n, next){

console.log("Requesting " + settings.base + settings.com);
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
		//console.log(result.info.body);
		if (!fs.existsSync("streamTests.out")) {
			fs.writeFileSync("streamTests.out",result.info.body);
		} else {
			var diffs = JsDiff.diffLines(fs.readFileSync("streamTests.out").toString(), result.info.body);
			console.log(diffs.added)
			console.log(diffs.removed) 
		}
		return md5(result.info.body);
	})
	.join("\n");

	logger.i("\n" + testReport);

	logger.i("streamTests.js tests ended.");
});