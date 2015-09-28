// To run all tests
// node test.js --suite true --type stream
// node test.js --suite true --type api

// To run a single test (test 2), use
// node test.js --n 1 --start 2 --all false --type stream
// node test.js --n 1 --start 2 --all false --type api

var fs      = require("fs")
var crypto  = require("crypto");
var sys     = require('sys')
var exec    = require('child_process').exec;
var spawn   = require('child_process').spawn
var clc     = require('cli-color')
var argv    = require('yargs')
					.default({
						'suite': "false",
						'sync': "false",
						'start': 0,
						'all': "true",
						'n': 10,
						'server': "http://localhost:7999/",
						'serverdata': "http://localhost:7999/",
						'type': "stream",
						'showdiffs': "true"
					})
					.argv;

function md5(str) {return crypto.createHash("md5").update(str).digest("hex")}
function logc(str,color) {var msg = clc.xterm(color); console.log(msg(str))}
function s2b(str) {if (str === "true") {return true} else {return false}}
function s2i(str) {return parseInt(str)}
var ll = "_____________________________________________________________________"

var suite      = s2b(argv.suite);
var sync       = s2b(argv.sync);		// Do runs for test sequentially
var tn         = s2i(argv.start);  		// Start test number
var all        = s2b(argv.all);			// Run all tests after start number
var n          = s2i(argv.n);     		// Number of runs per test
var server     = argv.server;			// DataCache URL to test
var serverdata = argv.serverdata;		// URL to get test data from
var showdiffs  = s2b(argv.showdiffs);
var type       = argv.type;

var t1 = "test.js --type " + type + " --sync true --start " + argv.start 
			 + " --all " + argv.all + " --n " + n 
			 + " --server " + server + " --serverdata " + server

var testsuite = [t1,t1.replace("--sync true","--sync false")]

eval(fs.readFileSync(__dirname + '/' + type + 'TestsInput.js', 'utf8'))

if (fs.existsSync("/usr/bin/md5sum")) {
	md5com = "/usr/bin/md5sum"; // Linux
} else {
	md5com = "/sbin/md5"; // OS-X
}

if (suite) {
	console.log("Running test suite.")
	runsuite(0)
} else {
	runtest(tn)
}

function runsuite(s) {
	logc(ll+ll, 10)
	logc("Executing node " + testsuite[s], 10)
	logc(ll+ll, 10)

	ecode = 0

	var child = spawn("node", testsuite[s].split(" "), {cwd:process.env.PWD})

	child.on('exit', 
				function (code) {
					console.log("Exit code for suite " + s + ": " + code)
					ecode = ecode || code
					logc(ll+ll, 10)
					if (s < testsuite.length-1) {
						runsuite(s+1)
					} else {
						console.log("Exit code for suites: " + ecode)
						process.exit(ecode)
					}
				}
			)

	child.stderr.on('data', function (data) {console.log(data.toString())})

	child.stdout
		.on('data',
				function (data) {
					console.log(data.toString().replace(/\n$/, ""))
				}
			)
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

	// j is index of test if TestsInput.js file
	// k is number of times to repeat test
	// if all = true, start test j+1 after test j is complete

	if (k == 1) { // If first iteration of test number j
		if (!checkmd5.completed) {
			checkmd5.completed = [];
			checkmd5.error = [];
		}
		checkmd5.completed[j] = 0;	// Number of completed tests.
		checkmd5.error[j] = 0;		// Number of errors per test
		tic = (new Date()).getTime();
	}

	child = exec(command(j,k,sync), function (error, stdout, stderr) {
		console.log(k + "\t" + stdout.substring(0,32))
		checkmd5.completed[j] = checkmd5.completed[j] + 1
		var f1 = "data-"+type+"/out." + j + ".0"
		var f2 = "data-"+type+"/out." + j + "." + k
		if (tests[j].md5 === "") {
			if (fs.existsSync(f1)) {
				console.log("MD5 not given.  Computing from reference file " + f1 + ".")
				var str = fs.readFileSync(f1).toString()
				tests[j].md5 = crypto.createHash("md5").update(str).digest("hex")
			} else {
				logc("Error.  MD5 not given and reference file " + f1 + " not found.", 9)
			}
		}

		if (tests[j].md5 !== stdout.substring(0,32)) {
			checkmd5.error[j] = checkmd5.error[j] + 1
			logc("Error.  Response md5 changed from reference response.", 9)
			if (showdiffs) {
				logc("Diff of " + f1 + " " + f2 + ":", 9);
				diff(f1, f2);
			}
		}

		if (sync && k < tests[j].n) {
			// Repeat test.				
			checkmd5(j, k + 1, true, all)
		}

		// All repeats of test completed
		if (checkmd5.completed[j] == tests[j].n) {
			var toc = new Date();
			var elapsed = (new Date()).getTime() - tic;
			Estr = checkmd5.error[j] + " errors."
			logc(elapsed + " ms; " + elapsed/tests[j].n + " ms per request. "+Estr,13);
			if (all) {
				if (j+1 < tests.length) {
					// Start next test
					runtest(j+1);
				} else {
					if (checkmd5.error[j] > 0) {
						console.log("Sending exit signal 1")
						process.exit(1)
					} else {
						console.log("Sending exit signal 0")
						process.exit(0)
					}
				}
			}
		}	

	})
}

function command(j,k,sync) {
		var fnameo  = "data-"+type+"/out." + j + "." + k;
		var fnameh = "data-"+type+"/head." + j + "." + k;

		if (tests[j].url.match("streamGzip=true")) {
			var com = 'curl -D ' + fnameh + ' -s -g "' + tests[j].url + '" | gunzip ';
		} else {
			var com = 'curl -D ' + fnameh + ' -s -g "' + tests[j].url + '" ';
		}
		if (tests[j].url.match("streamOrder=false")) {
			com = com + "| sort | tee " + fnameo;
		} else {
			com = com + "| tee " + fnameo;
		}
		com = com + " | " + md5com;
		com2 = "node test.js --type " + type + " --sync "+sync+" --start "+j+" --all false --n " + n + " --server " + server + " --serverdata "+serverdata
		if (k == 1) {
			logc(ll+ll, 11);
			logc(com2, 11);
			logc(com, 12);
			tests[j].com = com2;		
		}
		return com;
}

function diff(f1,f2) {
		if (!fs.existsSync(f1)) {
			console.log("Reference file " + f1 + " not found. Aborting diff.")
		}
		child = exec('diff ' + f1 + ' ' + f2, 
			function (error, stdout, stderr) {
				if (stdout.length > 0) {
					//console.log("Writing to stdout");
					logc("difference between " + f1 + " and " + f2 + ":",9)
					logc(stdout, 9)
				}
			})
}