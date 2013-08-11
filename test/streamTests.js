// node streamTests.js
//   runs all tests with sync=true
// node streamTests.js false
//   runs all tests with sync=false (each test is run N times async, then next test is run).
// node streamTests.js {true,false} #
//   runs test number # only (0-10)

tn = parseInt(process.argv[3]) || 0; // Test Number

var all    = true;  if (process.argv[3]) { all  = false; }
var sync   = true;  if (process.argv[2]) { sync = s2b(process.argv[2]); }
var server = process.argv[4] || "http://localhost:8000/";

function s2b(str) {if (str === "true") {return true} else {return false}}

var fs      = require("fs");
var logger  = require("./lib/logger")();
var md5     = require("./lib/util").md5;
sys         = require('sys');
exec        = require('child_process').exec;
var child;

var runner    = require("./lib/testRunner")();
var suite     = runner.suite;
var assertNot = runner.assertNot;

eval(fs.readFileSync('./streamTestsInput.js','utf8'))

if (fs.existsSync("/usr/bin/md5sum")) {
	md5com = "/usr/bin/md5sum"; // Linux
} else {
	md5com = "/sbin/md5"; // OS-X
}
	
runtest(tn);

function runtest(j) {

		if (sync) {
			checkmd5(j,0,true,all);
		} else {
			for (k = 0;k < tests[j].n;k++) {
				checkmd5(j,k,false,all);
			}
		}		
		
}
function checkmd5(j,k,sync,all) {
		if (k == 0) {
			checkmd5.completed = [];
			checkmd5.completed[j] = 0;
			tic = (new Date()).getTime();
			//console.log(tic);
		}
		child = exec(command(j,k), function (error, stdout, stderr) {
			checkmd5.completed[j] = checkmd5.completed[j]+1;
			console.log(k + " " + stdout.replace(/\n$/,""));
			if (tests[j].md5 !== stdout.replace(/\n$/,"")) {
				console.log("Error")
				//diff(fname,"data-stream/out." + j + ".0");
			}
			if (sync == true && k < tests[j].n-1) {					
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
			var com = 'curl -s -g "' + tests[j].url + '" | gunzip | tee ' + fname;
		} else {
			var com = 'curl -s -g "' + tests[j].url + '" | tee ' + fname;
		}
		if (tests[j].url.match("streamOrder=false")) {
			com = com + " | sort";
		}
		com = com + " | " + md5com;
		if (k == 0) 
			console.log(com);		
		return com;
}
function diff(f1,f2) {
		child = exec('diff ' + f1 + ' ' + f2, function (error, stdout, stderr) {
			console.log("difference between " + f1 + " and " + f2 + ": ");
			console.log(stdout);
		});
}