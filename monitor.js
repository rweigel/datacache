var mkdirp = require("mkdirp")
var fs     = require("fs")

function init(config) {

	mkdirp.sync(config.LOGDIR + "memory/")
	var Nopen = "-1"
	// Monitor and log memory usage every 1000 ms.
	setInterval(function () {
		var tmp = new Date()
		mem = process.memoryUsage()
		var yyyymmdd = tmp.toISOString().substring(0,10)
		var file = config.LOGDIR + "memory/datacache_" + config.PORT + "_memory_"+yyyymmdd+".log"
		fs.appendFile(file, tmp.toISOString() + " " + mem.rss + " " + mem.heapTotal + " " + mem.heapUsed + " " + Nopen + "\n")
	},1000)

	// Count number of open files and pipes every 1000 ms.
	setInterval(function () {
			//var com = 'lsof -p ' + process.pid + ' | grep REG | grep datacache/cache'
			var com = 'lsof -p ' + process.pid
			require('child_process').exec(com,
				function (error,stdout,stderr) {
					var filelist = stdout.split("\n")
					Nopen = filelist.length
					return
					if (filelist.length > 0 && filelist[0] !== '') {
						console.log("Open files:")
						for (var i = 0; i < filelist.length; i++) {
							var file = filelist[i]
							console.log(file)
						}
					}
				}
			)
	},1000)

	if (0) {
		// sudo apt-get install inotify-tools
		var filemon = require('filemonitor');
		var onFileEvent = function (ev) {
			console.log("File " + ev.filename + " triggered event " + ev.eventId + " on " + ev.timestamp.toString());
		}
		var onFileCreation = function (ev) {
			console.log("File " + ev.filename + " was created on " + ev.timestamp.toString());
		}

		var options = {
			recursive: true,
			target: "./cache/",
			listeners: {
				all_events: onFileEvent,
				create: onFileCreation
			}
		}
		filemon.watch(options);
	}

	if (0) {
	fs.watch('somedir', function (event, filename) {
	  console.log('event is: ' + event);
	  if (filename) {
	    console.log('filename provided: ' + filename);
	  } else {
	    console.log('filename not provided');
	  }
	})
	}
}
exports.init = init

