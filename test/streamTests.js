// To run a single test, use
// node streamTests.js true 20 false 1 http://localhost:7999/

var fs      = require("fs");
var md5     = require("./lib/util").md5;
var sys     = require('sys');
var exec    = require('child_process').exec;
var spawn   = require('child_process').spawn;
var clc     = require('cli-color');
var argv    = require('yargs')
					.default({
						'sync':"false",
						'start':0,
						'all':"true",
						'n':10,
						'server':"http://localhost:7998/",
						'serverdata':"http://mag.gmu.edu/datacache/",
					})
					.argv;


function logc(str,color) {var msg = clc.xterm(color); console.log(msg(str));};

function s2b(str) {if (str === "true") {return true} else {return false}}
function s2i(str) {return parseInt(str)}

var sync       = s2b(argv.sync);			   	// Do runs for test sequentially
var tn         = argv.start;     				// Start test Number
var all        = s2b(argv.all);					// Run all tests after start number
var n          = argv.n;     					// Number of runs per test
var server     = argv.server;					// DataCache server to test
var serverdata = argv.serverdata;				// Remote server to get data from

var testsuite = [
                 "streamTests.js --sync=true  --start=0 --all=true --n=" + n + " --server=" + argv.server + " --serverdata="+argv.server, 
                 "streamTests.js --sync=false --start=0 --all=true --n=" + n + " --server=" + argv.server + " --serverdata="+argv.serverdata, 
                 "streamTests.js --sync=true  --start=0 --all=true --n=" + n + " --server=" + argv.server + " --serverdata="+argv.server, 
                 "streamTests.js --sync=false --start=0 --all=true --n=" + n + " --server=" + argv.server + " --serverdata="+argv.serverdata, 
                 ];

eval(fs.readFileSync(__dirname + '/streamTestsInput.js','utf8'))

if (fs.existsSync("/usr/bin/md5sum")) {
	md5com = "/usr/bin/md5sum"; // Linux
} else {
	md5com = "/sbin/md5"; // OS-X
}

if (process.argv.length == 2) {
	runsuite(0);
	return;
}
	
runtest(tn);

function runsuite(j) {
	logc("_____________________________________________________________________________________________________________________________________",10);
	logc("Executing node " + testsuite[j],10)
	logc("_____________________________________________________________________________________________________________________________________",10);
	var child = spawn("node",testsuite[j].split(" "),{cwd:process.env.PWD});
	child.stdout.on('data',function (data) {console.log(data.toString().replace(/\n$/,""))});
	child.stderr.on('data',function (data) {console.log(data.toString())});
	child.stdout.on('close',function () {
		logc("_____________________________________________________________________________________________________________________________________",10);
		if (j < testsuite.length-1) runsuite(j+1);
	});
	
}

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
			console.log(k + "\t" + stdout.substring(0,32));
			
			if (tests[j].md5 !== stdout.substring(0,32)) {
				logc("Error.  Response md5 changed from reference response.  Diff of " + "data-stream/out." + j + ".0" + " data-stream/out." + j + "." + k + ":",9);
				diff("data-stream/out." + j + ".0","data-stream/out." + j + "." + k);
				fs.appendFile("streamTests.txt", tests[j].com + "\n", 
				function(err){
					if (err) console.log(err);
				});

			}
			if (sync == true && k < tests[j].n) {					
				checkmd5(j,k+1,true,all);
			}
			if (checkmd5.completed[j] == tests[j].n) {
				var toc = new Date();
				var elapsed = (new Date()).getTime() - tic;
				logc(elapsed + " ms; " + elapsed/tests[j].n + " ms per request.",13);
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
		com2 = "node streamTests.js --sync=true  --start="+j+" --all=false --n=" + n + " --server=" + argv.server + " --serverdata="+argv.serverdata;
		if (k == 1) {
			logc("_____________________________________________________________________________________________________________________________________",11);
			logc(com2,11);
			logc(com,12);
			tests[j].com = com2;		
		}
		return com;
}

function diff(f1,f2) {
		child = exec('diff ' + f1 + ' ' + f2, function (error, stdout, stderr) {
			if (stdout.length > 0) {
				//console.log("Writing to stdout");
				logc("difference between " + f1 + " and " + f2 + ":",9);
				logc(stdout,9);
			}
		});
}