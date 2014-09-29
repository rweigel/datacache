// To run a single test, use
// node streamTests.js true 20 false 1 http://localhost:7999/

var fs      = require("fs");
var md5     = require("./lib/util").md5;
var process = require("process");
var sys     = require('sys');
var exec    = require('child_process').exec;
var spawn   = require('child_process').spawn;

var port = 7999;

function s2b(str) {if (str === "true") {return true} else {return false}}
function s2i(str) {return parseInt(str)}

var sync    = s2b(process.argv[2] || "true");  				   	// Do runs for test sequentially
var tn      = s2i(process.argv[3] || "0");     				   	// Start test Number
var all     = s2b(process.argv[4] || "true");  				   	// Run all tests after start number
var n       = s2i(process.argv[5] || "10");     				// Number of runs per test
var server  = process.argv[6]     || "http://localhost:"+port+"/"; // DataCache server to test
var server2 = s2i(process.argv[7] || "1");                     // Remote server to get data from

var testsuite = [
                 "streamTests.js true 0 true " + n + " http://localhost:"+port+"/ 1", 
                 "streamTests.js false 0 true " + n + " http://localhost:"+port+"/ 1",
                 "streamTests.js true 0 true " + n + " http://localhost:"+port+"/ 2",
                 "streamTests.js false 0 true " + n + " http://localhost:"+port+"/ 2"
                 ];

var testsuite2 = ["streamTests.js true 0 true " + n + " http://datacache.org/dc/ 1",
                 "streamTests.js false 0 true " + n + " http://datacache.org/dc/ 1",
                 "streamTests.js true 0 true " + n + " http://datacache.org/dc/ 2",
                 "streamTests.js false 0 true " + n + " http://datacache.org/dc/ 2"
                 ];


if (process.argv.length == 2) {
	runsuite(0);
	return;
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

////////////////////////////////////////////////////////////////////////////
// Local server
if (server2 == 1) var prefix = server;

// Mirror of real server (served through apache2)
if (server2 == 2) var prefix = "http://mag.gmu.edu/datacache/";

// Remote production server (served through node.js)
// Not currently tested.
if (server2 == 3) var prefix = "http://datacache.org/dc/";
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
				console.log("Error.  Response md5 changed from reference response.  Diff:")
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
				console.log("Writing to stdout");
				console.error("difference between " + f1 + " and " + f2 + ":");
				console.error(stdout);
			}
		});
}