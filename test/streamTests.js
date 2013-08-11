// node streamTests.js
//   runs all tests with sync=true
// node streamTests.js false
//   runs all tests with sync=false (each test is run N times async, then next test is run).
// node streamTests.js {true,false} #
//   runs test number # only.

tn = parseInt(process.argv[3]) || 0; // Test Number

var all   = true;  if (process.argv[3]) { all  = false; }
var sync  = true;  if (process.argv[2]) { sync = s2b(process.argv[2]); }

function s2b(str) {if (str === "true") {return true} else {return false}}

var server = process.argv[4] || "http://localhost:8000/";
//var server = process.argv[4] || "http://datacache.org/dc/";

var fs      = require("fs");
var jsdiff  = require("diff");
var async   = require("async");
var logger  = require("./lib/logger")();
var request = require("request");
var md5     = require("./lib/util").md5;
var zlib    = require('zlib');
sys         = require('sys');
exec        = require('child_process').exec;
var child;

var runner    = require("./lib/testRunner")();
var suite     = runner.suite;
var assertNot = runner.assertNot;

// Testing streamOrder, streamFilterReadLines, and streamFilterReadBytes 

//var prefix    = "http://magweb.cr.usgs.gov/data-stream/magnetometer/BOU/OneMinute/bou201308";
var prefix    = server + "test/data-stream/bou201308";
var args      = server + "sync?return=stream&forceUpdate=true&forceWrite=true&lineRegExp=^[0-9]";
//var args      = server + "sync?return=stream&lineRegExp=^[0-9]";
// Base test.

// These two files are served without delay
var source    = "01vmin.min%0A02vmin.min";
var tests     = [];

var j = 0;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=true&streamFilterReadLines=10&prefix="+prefix+"&source="+source;
tests[j].n    = 50;
tests[j].md5  = "651f75d088a29b4a0a95e97a1bcccd48";

// Stream order = false.  Sorted stream should have same md5 as previous.
j = j+1;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=false&streamFilterReadLines=10&prefix="+prefix+"&source="+source;
tests[j].n    = 50;
tests[j].md5  = "651f75d088a29b4a0a95e97a1bcccd48";

// The following two should be the same as the above, but the line reader
// does not preserve the newline character - it replaces it with \n.
j = j+1;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=true&streamFilterReadBytes=720&prefix="+prefix+"&source="+source;
tests[j].sort = false;
tests[j].n    = 50;
tests[j].md5  = "8ee474572d7118be2a842fb140337cd9";

j = j+1;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=false&streamFilterReadBytes=720&prefix="+prefix+"&source="+source;
tests[j].sort = true;
tests[j].n    = 50;
tests[j].md5  = "8ee474572d7118be2a842fb140337cd9";

// Base test.
// These three files are served with random delay between 0 and 100 ms.
var source    = "03vmin.min%0A04vmin.min%0A05vmin.min";

j = j+1;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=true&streamFilterReadLines=10&prefix="+prefix+"&source="+source;
tests[j].n    = 50;
tests[j].md5  = "cef9e50efae894c42293ed5922af2b8e";

j = j+1;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=false&streamFilterReadLines=10&prefix="+prefix+"&source="+source;
tests[j].n    = 50;
tests[j].md5  = "cef9e50efae894c42293ed5922af2b8e";

j = j+1;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=true&streamFilterReadBytes=720&prefix="+prefix+"&source="+source;
tests[j].n    = 50;
tests[j].md5  = "4dcc638a9d40bdf4f4c1c6d38ecfa979";

j = j+1;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=false&streamFilterReadBytes=720&prefix="+prefix+"&source="+source;
tests[j].sort = true;
tests[j].n    = 50;
tests[j].md5  = "4dcc638a9d40bdf4f4c1c6d38ecfa979";

j = j+1;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=true&streamFilterReadLines=10&streamFilter=replace('2013','2013')&prefix="+prefix+"&source="+source;
tests[j].n    = 50;
tests[j].md5  = "cef9e50efae894c42293ed5922af2b8e";

j = j+1;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=false&streamFilterReadBytes=720&streamFilter=replace('2013','2013')&prefix="+prefix+"&source="+source;
tests[j].n    = 50;
tests[j].md5  = "4dcc638a9d40bdf4f4c1c6d38ecfa979";

// Not working reliably for sync = false.
j = j+1;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=true&streamFilterReadBytes=720&streamGzip=true&prefix="+prefix+"&source="+source;
tests[j].n    = 50;
tests[j].md5  = "4dcc638a9d40bdf4f4c1c6d38ecfa979";

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
		com = com + " | md5";
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