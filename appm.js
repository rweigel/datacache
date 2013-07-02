var cluster = require('cluster');
var http = require('http');
var numCPUs = require('os').cpus().length;
var i;
var worker;
var numReqs = 0;
var fs = require("fs");

// Runs one datacache instance per CPU found on machine.  Each CPU has its
// own cache directory.  No sharing of cache directories.  
// TODO: Re-use locking code for single instance to allow sharing of cache
// directories.

// Get port number from command line option.
var port = process.argv[2] || 8000;

process.stdin.resume();

// Based on http://dailyjs.com/2012/03/22/unix-node-processes/
if (cluster.isMaster) {
 	console.log('Master PID:', process.pid);
 	
	var cachedirs = new Array();	
	for (var j=0;j<numCPUs-1;j++) {
		var cachedir     = __dirname+"/cache-"+j;
		var cachedirlock = __dirname+"/cache-"+j+".lck";
		if (!fs.existsSync(cachedir) && fs.existsSync(cachedirlock)) {
			// No cachedir but cachedir.lck
			console.log("Lock file found with no associated directory.  Deleting lock file.");
			// Overwrite lock file.
			fs.writeFileSync(cachedirlock, process.pid);
			// Create cache directory.
			fs.mkdirSync(cachedir);
			cachedirs[j] = cachedir;
			//console.log('Worker ' + j + " will use " + cachedirs[j]);
		} else if (fs.existsSync(cachedir) && !fs.existsSync(cachedirlock)) {
			// Found cachedir with no cachedir.lck.
			// Create lock file.
			fs.writeFileSync(cachedirlock, process.pid);
			cachedirs[j] = cachedir;
			//console.log('Worker ' + j + " will use " + cachedirs[j]);
		} else {
			// TODO: See if process is actually running using kill -0.
			// If not, delete lock file.
			throw new Error('Lock file found for directory ' + cachedir);
		}
	}
	
	// Start a set of workers based on the number of CPUs less one for the master.
	for (i = 0; i < numCPUs-1; i++) {
		var worker = cluster.fork({cpu:i,cachedir:cachedirs[i]});

		worker.on('message', function(msg) {
			if (msg.cmd && msg.cmd == 'exitNotice') {
				console.log('Worker ' + msg.id + ' exiting');
				console.log('Launching a new worker.');
				//var worker = cluster.fork({cpu:i,cachedir:cachedirs[i]});
			}
			if (msg.cmd && msg.cmd == 'notifyRequest') {
				numReqs++;
				console.log('Total requests:', numReqs);
			}});
	}

	process.on('exit', function () {
		console.log('Master: Cluster received exit signal.');
		for (i = 0; i < numCPUs-1; i++) {
			
			console.log('Master: Removing lock file for directory ', cachedirs[i]);
			if (fs.existsSync(cachedirs[i] + ".lck")) {
				fs.unlinkSync(cachedirs[i] + ".lck");
				console.log('Master: Removed '+ cachedirs[i] + ".lck");
			} else {
				console.log('Master: Lock file ' + cachedirs[i] + ".lck" + ' not found');
			}
		}
		console.log('Master: Cluster exiting.');
	})
	process.on('SIGINT', function () {
		process.exit();
	});
	 

} else {
  
	process.on('exit', function () {
		process.send({ cmd: 'exitNotice', id: process.env.cpu});
	})
	process.on('SIGINT', function () {
		process.exit();
	});
  
	http.Server(function(req, res) {
		res.writeHead(200);
		res.end('Hello from ' + process.pid + '\n');	
		process.send({ cmd: 'notifyRequest' });
	}).listen(8000);

	console.log('Worker #' + process.env.cpu + ' with PID ' + process.pid + ' is listening on port 8000 using cachedir:', process.env.cachedir);
}