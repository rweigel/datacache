var mkdirp     = require("mkdirp");
var lineReader = require('line-reader');
var exec       = require('child_process').exec;
var spawn      = require('child_process').spawn;
var zlib       = require('zlib');
var	fs 		   = require("fs");
var	crypto     = require("crypto");

var scheduler  = require("./scheduler.js")
var log        = require("./log.js")
var util       = require("./util.js")

var reqstatus = {}

function stream(source, res) {

	log.logres("Called.", res.options)

	if (res.options.streamFilterReadLineFormatter.match(/formattedTime/) ||
		res.options.streamFilterReadTimeFormat || 
		res.options.streamFilterReadTimeColumns) {
		
		log.logres("Reading ./plugins/formattedTime.js", res.options, "stream")
		var lineFormatter = require(__dirname + "/plugins/formattedTime.js")
		// TODO: Add signature
	} else {
		log.logres("No lineFormatter will be used.", res.options, "stream")
		var lineFormatter = ""
	}
	
	log.logres("Response sig = " + res.options.logsig, res.options, "stream")

	reqstatus[res.options.logsig]            = {}
	reqstatus[res.options.logsig].N          = source.length;
	reqstatus[res.options.logsig].Nx         = 0; // Number of URLs processed and sent
	reqstatus[res.options.logsig].Nc         = 0; // Number of stream parts cached
	reqstatus[res.options.logsig].Nd         = 0; // Number of drained reads
	reqstatus[res.options.logsig].gzipping   = 0;
	reqstatus[res.options.logsig].dt         = 0;
	reqstatus[res.options.logsig].lastsent   = -1;
	reqstatus[res.options.logsig].aborted    = false;
	reqstatus[res.options.logsig].writequeue = [];

	var computeFunctionSignature = ""
	if (res.options.streamFilterWriteComputeFunction.match(/stats|mean|max|min|std|Nvalid/)) {
		log.logres("Reading ./filters/stats.js", res.options, "stream");

		var statsfilter = require("./filters/stats.js");
		computeFunctionSignature = computeFunctionSignature 
									+ statsfilter.filterSignature(res.options)
	}

	if (res.options.streamFilterWriteComputeFunction.match(/regrid/)) {
		log.logres("Reading ./filters/regrid.js", res.options, "stream")

		var regridfilter = require("./filters/regrid.js");
		computeFunctionSignature = computeFunctionSignature 
									+ regridfilter.filterSignature(res.options)
	}

	// TODO:
	// 	Technically, each element of source array could have different plug-in.
	// 	Below assumes that same plug-in is used for all elements of source array.
	// 	Modify this so assumption is not made.

	var extractSignature = source.join(",")
	var plugin = scheduler.getPlugin(res.options,source[0])
	if (plugin.extractSignature) {
		extractSignature = extractSignature + plugin.extractSignature(res.options)
		log.logres("Plugin signature MD5: " 
					+ util.md5(extractSignature), res.options, "stream")
	}

	var streamFilterSignature = ""
	for (key in res.options) {
		if (key.match("streamFilter")) {
			streamFilterSignature = streamFilterSignature + res.options[key]
		}			
	}
	streamFilterSignature = streamFilterSignature + computeFunctionSignature

	var streamsignature   = util.md5(extractSignature + streamFilterSignature)

	log.logres("Stream signature: " + streamsignature, res.options, "stream")

	var streamdir     = __dirname 
						+ "/cache/stream/" 
						+ source[0].split("/")[2] 
						+ "/" 
						+ streamsignature
	var streamfilecat = streamdir + ".stream.gz"
	
	if (!fs.existsSync(streamfilecat)) {
		log.logres("streamfilecat does not exist: " 
					+ streamfilecat, res.options, "stream")
	} else {
		log.logres("streamfilecat exists at " 
					+ streamfilecat, res.options, "stream")
	}

	if (fs.existsSync(streamfilecat) && !res.options.forceWrite && !res.options.forceUpdate) {
		var vera  = process.version.split(".")
		var major = parseInt(vera[0].replace("v",""))
		var minor = parseInt(vera[1])
		var patch = parseInt(vera[2])
		log.logres("Node.js version: " + process.version, res.options, "stream")
		if (minor < 12 || (minor == 12 && patch < 7)) {
			log.logres("Ignoring existing streamfilecat because of bug "
						+ " in node.js < 12.7 with concateneated gzip files",
						  res.options, "stream")
		} else {
			util.readLockFile(streamdir, res.options, function (success) {
				if (!success) {
					log.logc("Could not read lock streamdir.  Try again in 100 ms", 160)
					setTimeout(function () {stream(source, res)}, 100)
					return
				}
				streamcat(res, streamfilecat, function () {
					util.readUnlockFile(streamdir, res.options, function () {})
				})
			})
			return
		}
	}
	
	var N = source.length
	log.logres('Calling scheduler with ' 
				+ N 
				+ ' URL(s) and work.options.streamOrder = ' 
				+ res.options.streamOrder, res.options, "stream")

	//for (var jj=N-1;jj > -1;jj--) { // For testing inorder
	for (var jj = 0;jj < N;jj++) {
		log.logres("Adding to scheduler: " + source[jj], res.options, "stream")	    		
		scheduler.addURL(source[jj], jj, res, function (work) { processwork(work) })
	}

	function streamcat(res, streamfilecat, cb) {

		res.setHeader('Content-Disposition', 
						streamfilecat.replace(/.*\/(.*)/,"$1"))

		log.logres("Streaming cached concatenated stream file: " 
						+ streamfilecat, res.options, "stream")				
		if (res.options.streamGzip == false) {
			log.logres("Unzipping cached concatenated stream file: "
							+ streamfilecat, res.options, "stream")

			res.setHeader('Content-Disposition', 
				streamfilecat.replace(/.*\/(.*)/,"$1").replace(".gz",""))

			//This does not handle concatenated stream files.
			//var streamer = fs.createReadStream(streamfilecat).pipe(zlib.createGunzip())
			var child = require('child_process')
			var streamer = child.spawn('gunzip',['--stdout',streamfilecat]).stdout
		} else {
			res.setHeader('Content-Disposition',
							streamfilecat.replace(/.*\/(.*)/, "$1"))
			res.setHeader('Content-Encoding', 'gzip')
			var streamer = fs.createReadStream(streamfilecat)
		}
		streamer.on('end',function() {
			log.logres("Received streamer.on end event.", res.options, "stream")
			res.end()
			cb()
		})
		streamer.pipe(res)
	}

	function processwork(work) {

 		if (work.error !== "" && !work.isFromCache) {
			log.logres("work.error = " + work.error 
					+ " and no cached data. Calling finish().",
					   work.options, "stream")
			finish(work,"")
			return
		}
	
		log.logres("Called for work.partnum = " + work.partnum, work.options, "stream")

		// Zero pad filenames.
		var Np = work.partnum
		var N = reqstatus[work.options.logsig].N
		var n = 1+Math.floor(Math.log(N)/Math.LN10)
		if (Np == 0) {
			var npad = 0
		} else {
			var npad = Math.floor(Math.log(Np)/Math.LN10)
		}
		str = Math.pow(10,n+1).toString()
		var ps = str.substring(1,1+n-npad-1) + Np
				
		var streamfilepart = streamdir + "/" + ps + "." + work.urlMd5 + ".stream.gz"
		

		if (!fs.existsSync(streamfilepart)) {
			log.logres("Stream file part does not exist.", work.options, "stream")
			createstream(work)
			return
		} else {
			log.logres("Stream file part exists.", work.options, "stream")
		}

		if (work.options.forceWrite || work.options.forceUpdate) {
			log.logres("Not using cached stream file part because "
						+ " forceWrite=true or forceUpdate=true.",
							work.options, "stream")
			createstream(work)
		} else {
			log.logres("Using cached stream file part.", work.options, "stream")
			util.readLockFile(streamfilepart, work, function (success) {
				if (!success) {
					log.logres("Failed to read lock cached stream file part."
								+ "  Recreating stream.", work.options, "stream")
					createstream(work)
					return
				}
				if (options.streamGzip == false) {
					log.logres("Unzipping it.", work.options, "stream")
					var streamer = fs
									.createReadStream(streamfilepart)
									.pipe(zlib.createGunzip())
				} else {
					log.logres("Sending raw.", work.options, "stream")
					var streamer = fs.createReadStream(streamfilepart)
				}
				streamer.on('end',function() {
					log.logres("Received streamer.on end event.",
								work.options, "stream")
					util.readUnlockFile(streamfilepart, work, function () {})
				})
				streamer.on('error',function (err) {
					log.logc("streamer error event: " 
								+ JSON.stringify(err), 160)
					util.readUnlockFile(streamfilepart, work, function () {})
				})
				log.logres("Streaming it.", work.options, "stream")
				finish(work, streamer)
				return
			})
		}

		function finish(work, data) {

			if (work.error) {
				if (work.error.code) {
					// Express 3.x returns unusual error object of form:
					// { [Error: connect EADDRNOTAVAIL] code: 'EADDRNOTAVAIL', errno: 'EADDRNOTAVAIL', syscall: 'connect' }
					var msg = work.error.code
					work.errorcode = 404
				} else {
					var msg = work.error
				}
			}

			if (work.errorcode == 500) {
				if (reqstatus[work.options.logsig].aborted) {
					// TODO: Remove running works with this logsig?
					log.logres("500 error already sent.", work.options, "stream")
					return
				} else {
					log.logres("Sending 500 error.", work.options, "stream")
					reqstatus[work.options.logsig].aborted = true
					res.send(500, { error: msg })
					return
				}
			} 

			var so = work.options.streamOrder
			if (!so || reqstatus[work.options.logsig].lastsent == work.partnum - 1) {
				log.logres("Sending part " + (work.partnum+1) + " immediately.",
							work.options, "stream")

				if (typeof(data) === "object" && !(data instanceof Buffer)) {
					//console.log("Readable stream")

					// Data is a readable stream
					// See also 
					// http://stackoverflow.com/questions/17009975/how-to-test-if-an-object-is-a-stream-in-nodejs
					data.on('end', 
							function () {
								reqstatus[work.options.logsig].writequeue[work.partnum] = null
								reqstatus[work.options.logsig].lastsent = work.partnum
								done(work)
							}) 
					data.pipe(res, {end: false})
				} else {
					if (data.length == 0) {
						reqstatus[work.options.logsig].writequeue[work.partnum] = null
						reqstatus[work.options.logsig].lastsent = work.partnum
						done(work)						
					} else {
						res.write(data,
							function (err) {
								if (err) console.log(err)
								reqstatus[work.options.logsig].writequeue[work.partnum] = null
								reqstatus[work.options.logsig].lastsent = work.partnum
								done(work)
							})
					}
				}
			} else {

				log.logres("Queuing " + (work.partnum+1), work.options, "stream")
				work.data = data
				reqstatus[work.options.logsig].writequeue[work.partnum] = work
			}

			function queuecheck(lastwork) {

				var pn     = lastwork.partnum + 1
				var logsig = lastwork.options.logsig

				var work   = reqstatus[logsig].writequeue[pn]

				log.logres("Checking stream queue for part " + (pn+1), lastwork.options, "stream")
				if (typeof(work) === "undefined") {
					log.logres("No stream queue for part " + (pn+1), lastwork.options, "stream")
					return
				}
				if (work === null) {
					log.logres("Queued stream part already sent for part " + (pn+1), lastwork.options, "stream")
					return
				}

				log.logres("Sending queued part " + (pn+1), work.options, "stream")
				if (typeof(work.data) === "object" && !(work.data instanceof Buffer)) {
					work.data.on('end', 
						function () {
							reqstatus[work.options.logsig].writequeue[pn] = null
							reqstatus[work.options.logsig].lastsent = pn
							done(work)
						}) 
					work.data.pipe(res, {end: false})
				} else {
					if (work.data.length == 0) {
							reqstatus[work.options.logsig].writequeue[pn] = null
							reqstatus[work.options.logsig].lastsent = pn
							done(work)						
					} else {
						//console.log(data.split("\n")[0])
						res.write(work.data,
							function () {
								reqstatus[work.options.logsig].writequeue[pn] = null
								reqstatus[work.options.logsig].lastsent = pn
								done(work)
							}
						)
					}
				}
			}

			function done(work) {

				if (reqstatus[work.options.logsig].Nx == reqstatus[work.options.logsig].N ) {
					log.logc("N finished = N and done() called for " + work.options.logsig + ". logsig duplicate?", 160)
				}

				log.logres("Done called with work.partnum = " + work.partnum, work.options, "stream")

				log.logres("Incremening N finished from " 
							+ reqstatus[work.options.logsig].Nx + "/" + reqstatus[work.options.logsig].N 
							+ " to " 
							+ (reqstatus[work.options.logsig].Nx+1) + "/" + reqstatus[work.options.logsig].N, 
							work.options, "stream")
				reqstatus[work.options.logsig].Nx = reqstatus[work.options.logsig].Nx + 1

				if (reqstatus[work.options.logsig].N == reqstatus[work.options.logsig].Nx) {
					log.logres("Sending res.end().", work.options, "stream")
					res.end()
				} else {
					if (work.options.streamOrder) {
						queuecheck(work)
					}
				}
			}
		}
	
		function cachestreampart(streamfilepart, data) {

			log.logres("Creating " + streamdir, work.options, "stream")

			mkdirp(streamdir, function (err) {

				if (err) {
					log.logc("mkdirp error: " + JSON.stringify(err), 160)
				}
				log.logres("Created dir if it did not exist: " + streamdir, work.options, "stream")

				//work.finishQueueCallback = function () {cachestreampart(streamfilepart, data)}
				work.finishQueueCallback = false
				util.writeLockFile(streamdir, work, function (success) {
					if (!success) {
						log.logres("Could not lock streamdir.", work.options, "stream")
						return							
					}
					util.writeLockFile(streamfilepart, work, function (success) {
						if (!success) {
							log.logres("Could not lock streamfilepart file.", work.options, "stream")
							util.writeUnlockFile(streamdir, work, function () {});
							return							
						}
						fs.writeFile(streamfilepart, data, function (err) {
							log.logres("Wrote " + streamfilepart, work.options, "stream")
							log.logres("Incremening Nc from " 
										+ reqstatus[work.options.logsig].Nc + "/" + reqstatus[work.options.logsig].N 
										+ " to " 
										+ (reqstatus[work.options.logsig].Nc+1) + "/" + reqstatus[work.options.logsig].N, 
										work.options, "stream")
							reqstatus[work.options.logsig].Nc = reqstatus[work.options.logsig].Nc + 1

							util.writeUnlockFile(streamdir, work, function () {
								util.writeUnlockFile(streamfilepart, work, function () {
									if (reqstatus[work.options.logsig].Nc == reqstatus[work.options.logsig].N) {
										catstreamparts()
									}
								})
							})
						})
					})
				})
			})
		}

		function catstreamparts() {

			log.logres("Reading dir " + streamdir, res.options, "stream")

			var files = fs.readdirSync(streamdir)

			log.logres("Found " + files.length + " files", res.options, "stream")

			if (files.length != N) {
				log.logres("Not creating concatenated gzip stream file."
							+ " Did not find " + N + " files."
							, res.options, "stream")
				return
			}

			work.finishQueueCallback = false
			work.options.partnum = ""
			util.writeLockFile(streamdir, work, function (success) {
				if (files.length > 1) {
					log.logres("Concatenating " 
									+ files.length 
									+ " stream parts into " 
									+ streamsignature 
									+ ".stream.gz"
									, res.options, "stream")

					var com = "cd " + streamdir 
									+ "; cat " 
									+ files.join(" ") 
									+ " > ../" 
									+ streamsignature 
									+ ".stream.gz;"

					log.logres("Evaluating: " + com, res.options, "stream")
					child = exec(com, function (error, stdout, stderr) {
						log.logres("Evaluated: " + com, res.options, "stream")
						if (error) {
							log.logres("Error: " + JSON.stringify(error),
											res.options, "stream")
						}	
						if (stderr) {
							log.logres("Error: " + JSON.stringify(error),
											res.options, "stream")
						}
						util.writeUnlockFile(streamdir, work, function () {})
					})
				} else {
					fs.exists(streamdir + "/../" + streamsignature + ".stream.gz",
						function (exists) {
							if (exists) {
								log.logres("Symlink from single stream part to cat file exists.  Not re-creating", work.options, "stream")
								return
							}

							var com = "cd " + streamdir 
											+ "/.. ; ln -s " 
											+ streamsignature 
											+ "/" 
											+ files[0] 
											+ " " 
											+ streamsignature 
											+ ".stream.gz;"
							log.logres("Evaluating " + com, work.options, "stream")
							child = exec(com, function (error, stdout, stderr) {
								log.logres("Evaluated  " + com, work.options, "stream")
								if (error) {
									log.logc("Error: " + JSON.stringify(error), 160)
								}
								if (stderr) {
									log.logc(stderr, 160)
								}				
								util.writeUnlockFile(streamdir, work, function () {})
							})
						}
					)
				}
			})
		}

		function createstream(work) {

			var fname = util.getCachePath(work)

			// Create new stream.
			if (work.options.streamFilterReadBytes > 0) {
				log.logres("Reading bytes of "+ fname, work.options, "stream")
				log.logres("fs.exist: " + fs.existsSync(fname + ".data"), work.options, "stream")
				fs.exists(fname + ".data", function (exists) {
					if (!exists) {
						log.logc("createstream: Error: .data file does not exist.", 160)
					}
					work.finishQueueCallback = function () {createstream(work)}
					util.readLockFile(fname, work, function (success) {
						if (!success) {
							return
						}
						work.finishQueueCallback = false
						var buffer = new Buffer(work.options.streamFilterReadBytes)
						fs.open(fname + ".data", 'r', function (err, fd) {
							fs.read(fd, buffer, 0, work.options.streamFilterReadBytes, work.options.streamFilterReadStart - 1, 
								function (err, bytesRead, buffer) {
									readcallback(err, buffer)
									fs.close(fd)
							})
						})
					})
				})
			} else if (
					work.options.streamFilterReadStart > 1 ||
					work.options.streamFilterReadLines > 0 || 
					work.options.streamFilterReadLineRegExp !== "" ||
					work.options.streamFilterReadLineFormatter !== "" ||
					work.options.streamFilterReadColumns !== "" ||
					work.options.streamFilterReadTimeColumns !== "" ||
					work.options.streamFilterReadTimeStart !== "" ||
					work.options.streamFilterReadTimeStop !== ""
					) {

				log.logres("Reading lines of " + fname, work.options, "stream")
				fs.exists(fname + ".data", function (exists) {
					if (!exists) {
						log.logc("Error: .data file does not exist.", 160)
					}
					work.finishQueueCallback = function () {createstream(work)}
					util.readLockFile(fname, work, function (success) {
						if (!success) {
							return
						}
						work.finishQueueCallback = false
						readlines(fname + ".data")
					})
				})
			} else {
				log.logres("Reading all of " + fname, work.options, "stream")
				fs.exists(fname + ".data", function (exists) {
					if (!exists) {
						log.logc("Error: .data file does not exist.", 160)
					}
					work.finishQueueCallback = function () {createstream(work)}
					util.readLockFile(fname, work, function (success) {
						if (!success) {
							return
						}
						work.finishQueueCallback = false
						// Should be no encoding if streamFilterBinary was given.
						fs.readFile(fname, "utf8", readcallback)
					})
				})
			}

			function readlines(fnamefull) {

				var outcolumns = [];

				if (work.options.streamFilterReadTimeColumns === "" && work.options.streamFilterReadColumns !== "") {
					var outcolumnsStr = work.options.streamFilterReadColumns.split(",")
					for (var z = 0;z < outcolumnsStr.length; z++) {
						if (lineFormatter !== "") {
							outcolumns[z] = lineFormatter.columnTranslator(parseInt(outcolumnsStr[z]), work.options)
						} else {
							outcolumns[z] = parseInt(outcolumnsStr[z])
						}
					}
					log.logres("outcolumns "+outcolumns.join(","), work.options, "stream")
				}

				if ((work.options.streamFilterReadTimeColumns === "") && (work.options.streamFilterReadTimeFormat !== "")) {
					var timecolumnsStr = work.options.streamFilterReadTimeFormat.split(",")
					log.logres("No ReadTimeColumns given, but ReadTimeFormat given.", work.options, "stream")
					log.logres("Assuming time columns are first " + timecolumnsStr.length + " columns.", work.options, "stream")
					var timecolumns = []
					for (var z = 0;z < timecolumnsStr.length; z++) {
						timecolumns[z] = z+1
					}
					work.options.streamFilterReadTimeColumns = timecolumns.join(",")
				}

				if (work.options.streamFilterReadColumns !== "") {

					//var re = new RegExp(options.streamFilterReadColumnsDelimiter)
					var outcolumnsStr = work.options.streamFilterReadColumns.split(/,/);

					log.logres("streamFilterReadColumns          = " + work.options.streamFilterReadColumns, work.options, "stream")
					log.logres("streamFilterReadLineFormatter    = " + work.options.streamFilterLineFormatter, work.options, "stream")

					for (var z = 0;z < outcolumnsStr.length;z++) {
						if (outcolumnsStr[z].match("-")) {
							var start = parseInt(outcolumnsStr[z].split("-")[0]);
							var stop  = parseInt(outcolumnsStr[z].split("-")[1]);
							var newstr = start;
							for (var zz = 1;zz < stop-start+1; zz++) {
								newstr = newstr + "," +(start+zz);
							}
							outcolumnsStr[z] = newstr;
						}
					}
					outcolumnsStr = outcolumnsStr.join(",").split(",");
					
					log.logres("streamFilterReadTimeColumns = " + work.options.streamFilterReadTimeColumns, work.options, "stream")
					log.logres("streamFilterWriteTimeFormat = " + work.options.streamFilterWriteTimeFormat, work.options, "stream")
					log.logres("outcolumns expanded         = " + outcolumnsStr, work.options, "stream")

					if (lineFormatter !== "") {
						for (var z = 0;z < outcolumnsStr.length; z++) {
							outcolumns[z] = lineFormatter.columnTranslator(parseInt(outcolumnsStr[z]), work.options)
						}
					} else {
						for (var z = 0;z < outcolumnsStr.length; z++) {
							outcolumns[z] = parseInt(outcolumnsStr[z])
						}				
					}
					log.logres("columns translated " + outcolumns.join(","), work.options, "stream")

					function onlyUnique(value, index, self) { 
						return self.indexOf(value) === index;
					}
					
					outcolumns = outcolumns.filter(onlyUnique);

					if (outcolumns[0] == 1 && work.options.streamFilterWriteTimeFormat == "2") {
						outcolumns.splice(0,1);
						outcolumns = [1,2,3,4,5,6].concat(outcolumns);
					}
					
					log.logres("Data columns after accounting for WriteTimeFormat = " + outcolumns.join(","), work.options, "stream")
				}

				var line   = ''; 
				var lines  = ''; // Accumulated lines.
				var linesx = ''; // Modified kept lines.

				var lk = 0; // Lines kept.
				var lr = 1; // Lines read.
				
				var fnamesize = -1;

				log.logres("Reading lines of " + fnamefull.replace(__dirname+"/cache/",""), work.options, "stream")
				log.logres("streamFilterReadLineRegExp = " + work.options.streamFilterReadLineRegExp, work.options, "stream")

				// https://github.com/nickewing/line-reader
				lineReader.eachLine(fnamefull, function(line, last) {
					
					var stopline = work.options.streamFilterReadLines;
					if (work.options.streamFilterReadLines == 0) {
						stopline = Infinity;
					}

					if (lr >= work.options.streamFilterReadStart) {

						if (lk == stopline) {
							log.logres("Reached stop line.  Returning false.", work.options, "stream")
							// Done processing
							return false
						}

						if (work.options.streamFilterReadLineRegExp !== "") {
							var re = new RegExp(work.options.streamFilterReadLineRegExp)
							if (line.match(re) === null) {
								line = "";
								// Process next line
								return true
							}
						}

						//log.logres("readlines.lineReader: Line after RegExp: " + line, work.options, "stream")

						if (lineFormatter !== "" && line !== "") {

							if (lr == work.options.streamFilterReadStart) {
								log.logres("First processed line before calling formatLine:", work.options, "stream")
								log.logres(" " + line, work.options, "stream")
							}
							if (last) {
								log.logres("Last processed line before calling formatLine:", work.options, "stream")
								log.logres(" " + line, work.options, "stream")
							}

							// lineformatter returns blank if line is before timerange.
							line = lineFormatter.formatLine(line, work.options);

							if (lr == work.options.streamFilterReadStart) {
								log.logres("First processed line after calling formatLine:", work.options, "stream")
								log.logres(" " + line, work.options, "stream")

							}
							if (last) {
								log.logres("Last processed line after calling formatLine:", work.options, "stream")
								log.logres(" " + line, work.options, "stream")
							}

							if (line == "END_OF_TIMERANGE") {	
								// Done processing
								log.logres("Reached end of time range.", work.options, "stream")
								return false
							}

							//log.logres("Line after lineFormatter: " + line, work.options, "stream")

						}

						if (outcolumns.length > 0 && line !== "") {

							tmparr = line.split(/\s+/g)
							line = ""

							if (lr == work.options.streamFilterReadStart) {
								log.logres("Extracting " + tmparr.length + " columns on first line.", work.options, "stream")
							}
							if (last) {
								log.logres("Extracting " + tmparr.length + " columns on last line.", work.options, "stream")
							}
							for (var z = 0; z < outcolumns.length-1; z++) {
								line = line + tmparr[outcolumns[z]-1] + " ";
							}
							line = line + tmparr[outcolumns[z]-1];

							//log.logres("Line after outcolumns: " + line, work.options, "stream")

						}

						if (line !== "") {
							// lineReader only removes trailing \n.  Remove trailing \r.
							lines = lines + line.replace(/\r$/,"") + "\n";
							lk = lk + 1;
						} else {
							//log.logres("Error: line is undefined.", 160)
						}

						if (typeof(line) === "undefined") {
							log.logc("Error: line is undefined.", 160)
						}

						if (work.options.streamFilterWriteComputeFunction.match(/stats|mean|max|min|std|Nvalid/)) {
							if (!work.options.streamFilterWriteComputeFunction.match(/regrid/)) {
								if (lk % work.options.streamFilterWriteComputeFunctionWindow == 0) {
									//console.log(lines)
									linesx = linesx + statsfilter.stats(lines.replace(/\n$/,""), work.options)
									lines = ''
								}
							}
						}
						
					}
					lr = lr+1;
				}).then(function () {

					log.logres("lineReader.then(): Called.", work.options, "stream")

					if (work.options.streamFilterWriteComputeFunction.match(/regrid/)) {
						// Not tested.
						log.logres("stream.js: Calling regrid()", work.options, "stream")
						lines = regridfilter.regrid(lines, work.options)

						log.logres("lineReader.then(): regrid() returned:", work.options, "stream")
						console.log(lines)

						// If regrid is requested, stats were not computed.  Compute them here if requested.
						if (work.options.streamFilterWriteComputeFunction.match(/stats|mean|max|min|std|Nvalid/)) {
							var linesv = lines.join(/\n/)
							var h = work.options.streamWriteFilterComputeFunctionArgs
							var Nb = Math.floor(linesv.length/h)
							linesx = ''
							log.logres("lineReader.then(): Nblocks = " + Nb, work.options, "stream")
							log.logres("lineReader.then(): Block height = " + h, work.options, "stream")
							for (var b = 0; b < Nb-1;b++) {
								linesx = linesx + statsfilter.stats(linesv.slice(b*h,(b+1)*h).join(/\n/).replace(/\n$/,""), work.options)
							}
							readcallback("", linesx);
						} else {
							readcallback("", lines);
						}
						return
					}

					if (linesx === '') {
						readcallback("", lines)
					} else {
						if (lines === '') {
							readcallback("", linesx)
						} else {
							log.logres("Last window not full.", work.options, "stream")
							linesx = linesx + statsfilter.stats(lines.replace(/\n$/,""), work.options)
							readcallback("", linesx)
						}
					}
					return false
				})
			}
		
			function readcallback(err, data) {

				util.readUnlockFile(fname, work, function () {})

				log.logres("Called for " + fname.replace(__dirname+"/cache/",""), work.options, "stream")
					
				if (err) {
					log.logres("Error: " + err, work.options, "stream")
					return res.end()
				}

				if (work.options.streamFilter === "") {
					log.logres("Writing response.", work.options, "stream")


					log.logres("Uncompressed buffer has length = " + data.length, work.options, "stream")
					if (!work.options.streamGzip) {
						log.logres("Calling finish with uncompressed buffer.", work.options, "stream")
						//res.write(data)
						finish(work, data)
						zlib.createGzip({level: 1})
						zlib.gzip(data, function (err, buffer) {
							if (err) {
								log.logc("gzip error: " + JSON.stringify(err), 160)
							}
							cachestreampart(streamfilepart, buffer)
						})
					} else {
						log.logres("Compressing buffer.", work.options, "stream")
						zlib.createGzip({level:1})
						zlib.gzip(data, function (err, buffer) {
							if (err) {
								log.logc("gzip error: " + JSON.stringify(err), 160)
							}
							log.logres("Calling finished with compressed buffer of length "+buffer.length, work.options, "stream")

							finish(work, buffer)

							log.logres("Calling cachestreampart()", work.options, "stream")
							cachestreampart(streamfilepart, buffer)
						})
					}

				} else {	
					try {
						eval("data = data.toString()."+work.options.streamFilter)
						if (!work.options.streamGzip) {
							finish(work, data)
							cachestreampart(streamfilepart, data)
						} else {
							var tic = new Date()
							zlib.createGzip({level: 1})
							zlib.gzip(data, function (err, buffer) {
								reqstatus[work.options.logsig].dt = new Date()-tic

								log.logres("gzip callback event", work.options, "stream")
								log.logres("Writing compressed buffer", work.options, "stream")

								finish(work, buffer)
								reqstatus[work.options.logsig].gzipping = reqstatus[work.options.logsig].gzipping - 1
								cachestreampart(streamfilepart, buffer)								
							})
						}
					} catch (err) {
						log.logres("Error when evaluating " + work.options.streamFilter, work.options, "stream")
						finish(work,"")
					}
				}
			}
		}
	}
}
exports.stream = stream
