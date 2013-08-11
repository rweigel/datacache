var server = process.argv[4] || "http://localhost:8000/";
//var server = process.argv[4] || "http://datacache.org/dc/";

var fs      = require("fs");
var jsdiff  = require("diff");
var async   = require("async");
var logger  = require("./lib/logger")();
var request = require("request");
var md5     = require("./lib/util").md5;
var zlib    = require('zlib');

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

// Not working reliably.
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

j = j+1;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=true&streamFilterReadBytes=720&streamGzip=true&prefix="+prefix+"&source="+source;
tests[j].n    = 10;
tests[j].md5  = "4dcc638a9d40bdf4f4c1c6d38ecfa979";

j = parseInt(process.argv[2]) || 0;

if (process.argv[3]) { 
	var async = s2b(process.argv[3]);
} else {
	var async = false;
}

function s2b(str) {if (str === "true") {return true} else {return false}}

if (1) {
		var child, sys = require('sys'), exec = require('child_process').exec;

		if (!async) {
			checkmd5(0,true);
		} else {
			for (k = 0;k < tests[j].n;k++) {
				checkmd5(k,false);
			}
		}		
		return;
}
function command(k) {
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
function checkmd5(k,sync) {
			child = exec(command(k), function (error, stdout, stderr) {
				console.log(k + " " + stdout.replace(/\n$/,""));
				if (tests[j].md5 !== stdout.replace(/\n$/,"")) {
					console.log("Error")
					//diff(fname,"data-stream/out." + j + ".0");
				}
				if (sync == true && k < tests[j].n-1) {					
					checkmd5(k+1,true);
				}
			});
}
function diff(f1,f2) {
		child = exec('diff ' + f1 + ' ' + f2, function (error, stdout, stderr) {
			console.log("difference between " + f1 + " and " + f2 + ": ");
			console.log(stdout);
		});
}

if (0) {
	// Why is a.out.gz and b.out.gz different from c.out.gz created with curl?
	// (curl gives the correct result).
	// curl -g "http://localhost:8000/sync?return=stream&forceUpdate=true&forceWrite=true&lineRegExp=^[0-9]&streamOrder=true&streamFilterReadBytes=720&streamGzip=true&prefix=http://localhost:8000/test/data-stream/bou201308&source=03vmin.min" > c.out.gz

	var http = require('http');
	
	var options = {
	    host: 'localhost',
	    path: '/sync?return=stream&forceUpdate=true&forceWrite=true&lineRegExp=^[0-9]&streamOrder=true&streamFilterReadBytes=720&streamGzip=true&prefix=http://localhost:8000/test/data-stream/bou201308&source=03vmin.min%0A04vmin.min',
	    port: 8000,
	    encoding: null
	}
	var request = http.request(options, function (res) {
	    var data = '';
	    res.on('data', function (chunk) {
	        data += chunk;
	    });
	    res.on('end', function () {
	    		console.log(data.length);
			fs.writeFileSync("a.out.gz",data);
	        //console.log(data);
	    });
	});
	request.on('error', function (e) {
	    console.log(e.message);
	});
	request.end();

	var request = require('request');
	request({url: tests[j].url, encoding: null}, function (error, response, body) {
	  if (!error && response.statusCode == 200) {
	  	console.log(body.length);
	    fs.writeFileSync("b.out.gz",body);
		zlib.gunzip(body, function (err, buffer) {
			console.log('node.js gunzip');
			console.log(buffer.toString());
		});
	    // http://nodejs.org/api.html#_child_processes
		var sys = require('sys')
		var exec = require('child_process').exec;
		var child;		
		child = exec("gunzip -c b.out.gz", function (error, stdout, stderr) {
		  console.log('command line gunzip: ');
		  console.log(stdout);
		});
	  }
	})
	return;
}
logger.i("streamTests.js tests started.");

var settings = {};

//runtest(0);
runtest(9);
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
			uri: settings.url,
			encoding: null
		}, function(err, res, body){
			// Add info to runner.results
			testInfo("err", err);
			testInfo("res", res);
			console.log(body.length);
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

			//console.log(result.info.body.length);
			if (debug) console.log(settings);
			if (!fs.existsSync("data-stream/streamTests.out."+settings.i)) {
				if (settings.gunzip) {

					// This does not work when two gzipped files are concatenated.  It
					// only returns first gzip file.  Even if it did work, we would need
					// a sync version of this.
					//zlib.gunzip(result.info.body, function (err, buffer) {
					//	resultmd5 = write(buffer.toString());
					//});
					
				} else {
					resultmd5 = write(result.info.body);
				}
				function write(data) {
					if (debug) console.log("Writing "+"data-stream/streamTests.out."+settings.i);
					fs.writeFileSync("data-stream/streamTests.out."+settings.i,data,'binary');					
					resultmd5 = md5(data);
					if (debug) console.log("Writing "+"data-stream/streamTests.md5."+settings.i);
					fs.writeFileSync("data-stream/streamTests.md5."+settings.i,resultmd5,'binary');
					console.log(fs.readFileSync("data-stream/streamTests.md5."+settings.i).toString());
				}
			} else {
				if (debug) console.log("Reading "+"data-stream/streamTests.md5."+settings.i);
				var expectedmd5 = fs.readFileSync("data-stream/streamTests.md5."+settings.i,'binary').toString();
				console.log(fs.readFileSync("data-stream/streamTests.md5."+settings.i).toString());
				if (settings.gunzip) {

					//zlib.gunzip(result.info.body, function (err, buffer) {
					//	resultmd5 = checkresults(buffer.toString);
					//});

				} else {
					resultmd5 = checkresults(result.info.body.toString());
				}
				
				function checkresults(data) {
					if (settings.sort) {
						//if (debug) {
							console.log("Sorting");
							console.log("Before sort")
							console.log(data);
							console.log("After sort")
						//}
						if (data.match(/\n$/)) {
							//if (debug) {
								console.log("File has trailing newline.");
								console.log(data.replace(/\n$/,"").split("\n").sort().join("\n")+"\n");
							//}
							data = data.replace(/\n$/,"").split("\n").sort().join("\n")+"\n";
						} else {
							//if (debug) { 
								console.log(data.split("\n").sort().join("\n"));
							//}
							data = data.split("\n").sort().join("\n");
						}
					} else {
						if (debug) {
							console.log(data);
						}
					}
						  
					resultmd5 = md5(data);
					console.log("expected md5: " + expectedmd5);
					console.log("received md5: " + resultmd5);
					if (expectedmd5 !== resultmd5) {
						console.log("Test failed.  Showing diff.");
						//console.log("--- Expected");
						//console.log(fs.readFileSync("data-stream/streamTests.out."+settings.i).toString());
						//console.log("--- Received");
						//console.log(data);
						//console.log("---");
						var fname = "/tmp/"+Math.random().toString().substring(1);
						console.log(fname);
						fs.writeFileSync(fname,data,'binary');
						var child, sys = require('sys'), exec = require('child_process').exec;
						
						child = exec("diff " + fname + " " + "data-stream/streamTests.out."+settings.i, function (error, stdout, stderr) {
			  				console.log('diff: ');
			  				console.log(stdout);
						});
						
						//var diffs = jsdiff.diffLines(fs.readFileSync("data-stream/streamTests.out."+settings.i).toString(), result.info.body);
						//console.log(diffs.added);
						//console.log(diffs.removed);
					} 
				}
			}
		})
	
	//logger.i("\n" + testReport);
	logger.i("streamTests.js tests ended.");

	// Does not work.
	//if (tests[settings.i+1])
	//	runtest(settings.i+1);

}

