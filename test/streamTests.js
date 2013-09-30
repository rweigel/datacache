
// Local server
// Production server
// Both servers using data from original data source 

var testsuite = [
                 "streamTests.js true 0 false 10 http://localhost:8000/ 1", 
                 "streamTests.js false 0 false 10 http://localhost:8000/ 1",
                 "streamTests.js true 0 false 10 http://localhost:8000/ 2",
                 "streamTests.js false 0 false 10 http://localhost:8000/ 2",
                 "streamTests.js true 0 true 10 http://datacache.org/dc/ 1",
                 "streamTests.js false 0 true 10 http://datacache.org/dc/ 1",
                 "streamTests.js true 0 true 10 http://datacache.org/dc/ 2",
                 "streamTests.js false 0 true 10 http://datacache.org/dc/ 2"
                 ];

var fs      = require("fs");
var logger  = require("./lib/logger")();
var md5     = require("./lib/util").md5;
sys         = require('sys');
exec        = require('child_process').exec;
spawn       = require('child_process').spawn;

var runner    = require("./lib/testRunner")();
var suite     = runner.suite;
var assertNot = runner.assertNot;

if (process.argv.length == 2) {
	runsuite(0);
	return
}

function runsuite(j) {
	console.log("Executing " + testsuite[j])
	var child = spawn("node",testsuite[j].split(" "),{cwd:process.env.PWD});
	child.stdout.on('data',function (data) {console.log(data.toString().replace(/\n$/,""))});
	child.stderr.on('data',function (data) {console.log(data.toString())});
	child.stdout.on('close',function () {
		console.log("Done.");
		console.log("___________________________________________________________");
		if (j < testsuite.length-1) runsuite(j+1);
	});
	
}

function s2b(str) {if (str === "true") {return true} else {return false}}
function s2i(str) {return parseInt(str)}

var sync    = s2b(process.argv[2] || "true");  				   // Do runs for test sequentially
var tn      = s2i(process.argv[3] || "0");     				   // Start test Number
var all     = s2b(process.argv[4] || "true");  				   // Run all tests after start number
var n       = s2i(process.argv[5] || "5");     				   // Number of runs per test
var server  = process.argv[6]     || "http://localhost:8000/"; // DataCache server to test
var server2 = s2i(process.argv[7] || "1");                     // Remote server to get data from

////////////////////////////////////////////////////////////////////////////
// Simulated server
// First two files are served without delay from 
// Next three files are served with random delay between 0 and 100 ms.

if (server2 == 1) var prefix = server + "test/data-stream/bou201308";

// Mirror of real server.
if (server2 == 2) var prefix = "http://mag.gmu.edu/tmp/magweb.cr.usgs.gov/data/magnetometer/BOU/OneMinute/bou201308";

// Real server
if (server2 == 3) var prefix = "http://magweb.cr.usgs.gov/data/magnetometer/BOU/OneMinute/bou201308";
////////////////////////////////////////////////////////////////////////////

eval(fs.readFileSync(__dirname + '/streamTestsInput.js','utf8'))

if (fs.existsSync("/usr/bin/md5sum")) {
	md5com = "/usr/bin/md5sum"; // Linux
} else {
	md5com = "/sbin/md5"; // OS-X
}
	
runtest(tn);

function runtest(j) {

		if (sync) {
			checkmd5(j,1,true,all);
		} else {
			for (k = 1;k < tests[j].n+1;k++) {
				checkmd5(j,k,false,all);
			}
		}		
		
}

function checkmd5(j,k,sync,all) {
		if (k == 1) {
			checkmd5.completed = [];
			checkmd5.completed[j] = 0;
			tic = (new Date()).getTime();
			//console.log(tic);
		}
		child = exec(command(j,k), function (error, stdout, stderr) {
			checkmd5.completed[j] = checkmd5.completed[j]+1;
			console.log(k + " " + stdout.substring(0,32));
			
			if (tests[j].md5 !== stdout.substring(0,32)) {
				console.log("Error.  Response changed from last request.")
				diff("data-stream/out." + j + ".0","data-stream/out." + j + "." + k);
			}
			if (sync == true && k < tests[j].n) {					
				checkmd5(j,k+1,true,all);
			}
			if (checkmd5.completed[j] == tests[j].n) {
				var toc = new Date();
				var elapsed = (new Date()).getTime() - tic;
				console.log(elapsed + " ms; " + elapsed/tests[j].n + " ms per request.");
				// console.log("Done!");
				if (all) {
					if (j+1 < tests.length) {
						runtest(j+1);
					}
				}
			}
			
		});
}

function command(j,k) {
		var fname = "data-stream/out." + j + "." + k;
		if (tests[j].url.match("streamGzip=true")) {
			var com = 'curl -s -g "' + tests[j].url + '" | gunzip';
		} else {
			var com = 'curl -s -g "' + tests[j].url + '" ';
		}
		if (tests[j].url.match("streamOrder=false")) {
			com = com + "| sort | tee " + fname;
		} else {
			com = com + "| tee " + fname;
		}
		com = com + " | " + md5com;
		if (k == 1) 
			console.log(com);		
		return com;
}

function diff(f1,f2) {
		child = exec('diff ' + f1 + ' ' + f2, function (error, stdout, stderr) {
			if (stdout.length > 0) {
				console.log("difference between " + f1 + " and " + f2 + ": ");
				console.log(stdout);
			}
		});
}