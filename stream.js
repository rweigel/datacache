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

function stream(source, options, res) {

	if (options.debugstreamconsole) {
		log.logc(options.loginfo + " stream.js: Called.", options.logcolor)
	}

	var loginfo  = options.loginfo
	var logcolor = options.logcolor
	var debugstream = options.debugstream
	var debugstreamconsole = options.debugstreamconsole

	var computeFunctionSignature = ""

	if (options.streamFilterReadLineFormatter.match(/formattedTime/) ||
		options.streamFilterReadTimeFormat || 
		options.streamFilterReadTimeColumns) {
		if (debugstream) {
			log.logres(loginfo + ", Reading ./plugins/formattedTime.js", res)
		}
		if (debugstreamconsole) {
			log.logc(loginfo
				+ " stream.js: Reading ./plugins/formattedTime.js", logcolor)
		}
		var lineFormatter = require(__dirname + "/plugins/formattedTime.js")
		// TODO: Add signature
	} else {
		if (debugstreamconsole) {
			log.logc(loginfo
				+ " stream.js: No lineFormatter will be used.", logcolor)
		}
		var lineFormatter = ""
	}

	//res.setHeader('Transfer-Encoding', 'chunked');
	//res.setHeader('Content-Encoding','gzip');
	
	//console.log(options)
	var rnd        = options.loginfo
	var reqstatus  = {};
	reqstatus[rnd] = {};

	reqstatus[rnd].Nx       = 0; // Number of reads/processed URLs completed
	reqstatus[rnd].Nd       = 0; // Number of drained reads
	reqstatus[rnd].gzipping = 0;
	reqstatus[rnd].dt       = 0;
		
	if (options.streamFilterWriteComputeFunction.match(/stats|mean|max|min|std|Nvalid/)) {
		if (debugstream) {
			log.logres(loginfo + ", Reading ./filters/stats.js", res);
		}
		if (debugstreamconsole) {
			log.logc(loginfo + " stream.js: Reading ./filters/stats.js", logcolor)
		}
		var statsfilter = require("./filters/stats.js");
		computeFunctionSignature = computeFunctionSignature + statsfilter.filterSignature(options)
	}

	if (options.streamFilterWriteComputeFunction.match(/regrid/)) {
		if (debugstream) {
			log.logres("Reading ./filters/regrid.js", res);
		}
		if (debugstreamconsole) {
			log.logc(loginfo + " stream.js: Reading ./filters/regrid.js", logcolor)
		}
		var regridfilter = require("./filters/regrid.js");
		computeFunctionSignature = computeFunctionSignature + regridfilter.filterSignature(options)
	}

	// TODO:
	// 	Technically, each element of source array could have different plug-in.
	// 	Below assumes that same plug-in is used for all elements of source array.
	// 	Modify this so assumption is not made.

	var extractSignature = source.join(",")
	var plugin = scheduler.getPlugin(options,source[0])
	if (plugin.extractSignature) {
		extractSignature = extractSignature + plugin.extractSignature(options)
		if (debugstream) {
			log.logres("Plugin signature MD5: " + util.md5(extractSignature), res)
		}
	}

	var streamFilterSignature = ""
	for (key in options) {
		if (key.match("streamFilter")) {
			streamFilterSignature = streamFilterSignature + options[key]
		}			
	}
	streamFilterSignature = streamFilterSignature + computeFunctionSignature

	var streamsignature   = util.md5(extractSignature + streamFilterSignature)

	if (debugstreamconsole) {
		log.logc(loginfo + " stream.js: Stream signature: " + streamsignature, logcolor)
	}

	var streamdir     = __dirname 
						+ "/cache/stream/" 
						+ source[0].split("/")[2] 
						+ "/" 
						+ streamsignature
	var streamfilecat = streamdir + ".stream.gz"
	
	if (debugstream || debugstreamconsole) {
		if (!fs.existsSync(streamfilecat)) {
			if (debugstream) {
				log.logres("streamfilecat does not exist: " + streamfilecat, res)
			}
			if (debugstreamconsole) {
				log.logc(loginfo 
							+ " stream.js: streamfilecat does not exist: "
							+ streamfilecat, logcolor)
			}
		} else {
			if (debugstream) {
				log.logres("streamfilecat exists at " + streamfilecat, res)
			}
			if (debugstreamconsole) {
				log.logc(loginfo 
							+ " stream.js: streamfilecat exists at " 
							+ streamfilecat, logcolor)
			}
		}
	}

	// This does not work because node.js does not handle concatenated gzip files.
	if (fs.existsSync(streamfilecat) && !options.forceWrite && !options.forceUpdate) {
		var vera  = process.version.split(".")
		var major = parseInt(vera[0].replace("v",""))
		var minor = parseInt(vera[1])
		var patch = parseInt(vera[2])
		if (debugstreamconsole) {
			log.logc(loginfo + " stream.js: Node.js version: " + process.version, logcolor)
		}
		if (minor < 12 || (minor == 12 && patch < 7)) {
			if (debugstream) {
				log.logres("Ignoring existing streamfilecat because of bug in node.js < 12.7 with concateneated gzip files", res)
			}
			if (debugstreamconsole) {
				log.logc(loginfo + " stream.js: Ignoring existing streamfilecat because of bug in node.js with concateneated gzip files", logcolor)
			}
		} else {
			streamcat()
			return
		}
	}
	
	var N = source.length;
	if (debugstream) {
		log.logres('Calling scheduler with ' + N + ' URL(s) and options.streamOrder = ' + options.streamOrder, res)
	}
	if (debugstreamconsole) {
		log.logc(loginfo + ' stream.js: Calling scheduler with ' + N + ' URL(s) and options.streamOrder = ' + options.streamOrder, logcolor)
	}

	if (debugstreamconsole) {
		if (options.forceUpdate == false && options.respectHeaders == false) {
			for (var jj = 0; jj < N; jj++) {
				xwork = scheduler.newWork(source[jj], options)
				part = streamdir + "/" + xwork.urlMd5 + ".stream.gz"
				if (fs.existsSync(part)) {
					// TODO: Account for this before adding URLs to scheduler.
					log.logc(loginfo
						+ ' stream.js: Stream cache for ' + source[jj] 
						+ ' found.  Did need to add to scheduler.', logcolor)
				}
			}
		}
	}

	if (options.streamOrder) {
	    scheduler.addURL(source[0], options,
	    					function (work) {processwork(work, true)})
	} else {
	    for (var jj=0;jj < N;jj++) {
	    	if (debugstream) {
	    		log.logres("Adding to scheduler: " + source[jj], res)	    		
	    	}
			if (debugstreamconsole) {
				log.logc(loginfo 
					+ " stream.js: Adding to scheduler: " + source[jj], logcolor)
			}
			scheduler.addURL(source[jj], options, 
								function (work) {processwork(work)})
	    }
	}

	function streamcat() {

		// http://stackoverflow.com/questions/16868052/concatenating-gzip-deflate-data-on-node-js-request
		// https://groups.google.com/forum/#!topic/nodejs/4qkRR867nZg
		// https://github.com/joyent/node/issues/6032
		// https://github.com/oorabona/node-liblzma/commit/684ec73beb7059b6e12d955ca3788547fabb98a0
		res.setHeader('Content-Disposition', streamfilecat.replace(/.*\/(.*)/,"$1"))

		if (debugstream) {
			log.logres("Streaming cached concatenated stream file: " 
							+ streamfilecat, res)				
		}
		if (debugstreamconsole) {
			log.logc(options.loginfo 
				+ " stream.streamcat(): Streaming cached concatenated stream file: "
				+ streamfilecat, logcolor)
		}
		if (options.streamGzip == false) {
			if (debugstream) {
				log.logres("Unzipping cached concatenated stream file: "
								+ streamfilecat, res)
			}
			if (debugstreamconsole) {
				log.logc(options.loginfo 
					+ " stream.streamcat(): Unzipping cached concatenated stream file: "
					+ streamfilecat, logcolor)
			}
			res.setHeader('Content-Disposition', 
				streamfilecat.replace(/.*\/(.*)/,"$1").replace(".gz",""))
			// This does not handle concatenated stream files.
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
			if (debugstream) {
				log.logres("Received streamer.on end event.", res)
			}
			if (debugstreamconsole) {
				log.logc(options.loginfo 
					+ " stream.streamcat(): Received streamer.on end event.", logcolor)
			}
			res.end()
		})
		streamer.pipe(res)
		return
	}

	function catstreamparts() {

		if (debugstream) {
			log.logres("Reading dir " + streamdir.replace(__dirname,""), res)
		}
		if (debugstreamconsole) {
			log.logc(options.loginfo+" stream.catstreamparts(): Reading dir " + streamdir.replace(__dirname,""), logcolor)
		}
		var files = fs.readdirSync(streamdir);
		if (debugstream) {
			log.logres("Found " + files.length + " files", res)
		}
		if (debugstreamconsole) {
			log.logc(options.loginfo+" stream.catstreamparts(): Found " + files.length + " files", logcolor)
		}

		if (files.length != N) {
			if (debugstreamconsole) {
				log.logc(options.loginfo+" stream.catstreamparts(): Not creating concatenated gzip stream file.  Did not find " + N + " files.", logcolor)
			}
			return
		}

		if (files.length > 1) {
			if (debugstream) {
				log.logres("Concatenating " + files.length + " stream parts into " + streamsignature + ".stream.gz", res)
			}
			if (debugstreamconsole) {
				log.logc(options.loginfo+" stream.catstreamparts(): Concatenating " + files.length + " stream parts into ../" + streamsignature + ".stream.gz",logcolor)
			}

			var com = "cd " + streamdir + "; cat " + files.join(" ") + " > ../" + streamsignature + ".stream.gz;"
			if (debugstream) {
				log.logres("Evaluating: " + com, res)
			}
			if (debugstreamconsole) {
				log.logc(options.loginfo+" stream.catstreamparts(): Evaluating: " + com,logcolor)
			}
			child = exec(com,function (error, stdout, stderr) {
				if (debugstream) {
					log.logres("Evaluated: " + com, res)
				}
				if (debugstreamconsole) {
					log.logc(options.loginfo+" stream.catstreamparts(): Evaluated: " + com,logcolor)
				}
				if (error) {
					log.logres(JSON.stringify(error), res)
					log.logc(options.loginfo+" stream.catstreamparts(): Error: " + JSON.stringify(error), 160)
					if (stderr) {
						log.logc(stderr, 160)
					}
				}
			})
		} else {
			var com = "cd " + streamdir + "/.. ; ln -s " + streamsignature + "/" + files[0] + " " + streamsignature + ".stream.gz;"
			if (debugstream) {
				log.logres("Evaluating " + com, res)
			}
			if (debugstreamconsole) {
				log.logc(options.loginfo+" stream.catstreamparts(): Evaluating " + com, logcolor)
			}
			child = exec(com,function (error, stdout, stderr) {
				if (debugstream) {
					log.logres("Evaluated  " + com, res)
				}
				if (debugstreamconsole) {
					log.logc(options.loginfo+" stream.catstreamparts(): Evaluated  " + com, logcolor)
				}
				if (error) {
					log.logres(JSON.stringify(error), res)
					log.logc(options.loginfo+" stream.catstreamparts(): Error: " + JSON.stringify(error), 160)
					if (stderr) {
						log.logc(stderr, 160)
					}
				}
			})								
		}
	}

	function finished(inorder) {
		if (reqstatus[rnd].Nx == N) {
			log.logc(options.loginfo + " stream.finished(): N finished = N and finished() called.  Error?", 160)
		}
		if (debugstream) {
			log.logres("Incremening N finished from " + reqstatus[rnd].Nx + "/" + N + " to " + (reqstatus[rnd].Nx+1) + "/" + N,res)
		}
		if (debugstreamconsole) {
			log.logc(options.loginfo + " stream.finished(): Incremening N finished from " + reqstatus[rnd].Nx + "/" + N + " to " + (reqstatus[rnd].Nx+1) + "/" + N,logcolor)
		}
		reqstatus[rnd].Nx = reqstatus[rnd].Nx + 1;

		if ((reqstatus[rnd].Nx < N) && (inorder)) {
			if (debugstream) {
				log.logres("Processing next URL.",res)
			}
			if (debugstreamconsole) {
				log.logc(options.loginfo + " Processing next URL.",logcolor)
			}
			scheduler.addURL(source[reqstatus[rnd].Nx], options, function (work) {processwork(work,true)});
		}

		if (N == reqstatus[rnd].Nx) {
			if (debugstream) {
				log.logres("Sending res.end().", res)
			}
			if (debugstreamconsole) {
				log.logc(options.loginfo + " stream.finished(): Sending res.end().", logcolor)
			}
			res.end()
		}
	}

	function processwork(work, inorder) {
 		
		if (debugstreamconsole) {
			log.logc(options.loginfo 
				+ " stream.processwork(): Called by " 
				+ arguments.callee.caller, logcolor)
		}

		var fname = util.getCachePath(work)

		Nx = reqstatus[rnd].Nx
		var n = 1+Math.floor(Math.log10(N))
		if ( Nx == 0) {
			var nx = 0
		} else {
			var nx = Math.floor(Math.log10(Nx))
		}
		str = Math.pow(10,n+1).toString()
		var ns = str.substring(1,1+n-nx-1) + Nx
				
		var streamfilepart = streamdir + "/" + ns + "." + work.urlMd5 + ".stream.gz"
		
		if (work.error && !work.isFromCache) {
			if (debugstream) {
				log.logres("work.error = " + work.error 
					+ " and no cached data. Calling finished(). Not sending data.", res)
			}
			if (debugstreamconsole) {
				log.logc(options.loginfo 
					+ " stream.processwork(): work.error = '" + work.error 
					+ "' and no cached data.  Calling finished() and not sending data.", 160)
			}
			finished(inorder)
			return
		}

		if (!fs.existsSync(streamfilepart)) {
			createstream()
			if (debugstreamconsole) {
				log.logc(options.loginfo + " stream.processwork(): Stream file part does not exist.", logcolor)
			}
			return
		} else {
			if (debugstreamconsole) {
				log.logc(options.loginfo + " stream.processwork(): Stream file part exists.", logcolor)
			}			
		}

		if (options.forceWrite || options.forceUpdate) {
			if (debugstreamconsole) {
				log.logc(options.loginfo + " stream.processwork(): Not using cached stream file part because forceWrite=true or forceUpdate=true.", logcolor)
			}			
			createstream()
		} else {
			if (debugstreamconsole) {
				log.logc(options.loginfo + " stream.processwork(): Using cached stream file part.", logcolor)
			}			
			util.readLockFile(streamfilepart, work, function (success) {
				if (!success) {
					if (debugstreamconsole) {
						log.logc(options.loginfo + " stream.processwork(): Failed to read lock cached stream file part.  Recreating stream.", logcolor)
					}			
					createstream()
					return
				}
				if (options.streamGzip == false) {
					if (debugstream) {
						log.logres("Unzipping it.", res)
					}
					if (debugstreamconsole) {
						log.logc(options.loginfo+" stream.processwork(): Unzipping it.", logcolor)
					}
					var streamer = fs.createReadStream(streamfilepart).pipe(zlib.createGunzip())
				} else {
					if (debugstream) {
						log.logres("Sending raw.", res)
					}
					if (debugstreamconsole) {
						log.logc(options.loginfo+" stream.processwork(): Sending raw.", logcolor)
					}
					var streamer = fs.createReadStream(streamfilepart)
				}
				streamer.on('end',function() {
					if (debugstream) {
						log.logres("Received streamer.on end event.",res);
					}
					if (debugstreamconsole) {
						log.logc(options.loginfo+" stream.processwork(): Received streamer.on end event.", logcolor)
					}
					util.readUnlockFile(streamfilepart, work, function () {
						finished(inorder)
					})
				})
				streamer.on('error',function (err) {
					if (debugstreamconsole) {
						log.logc(options.loginfo+" stream.processwork(): streamer error event: " + JSON.stringify(err), 160)
					}
					util.readUnlockFile(streamfilepart, work, function () {})
				})
				if (debugstream) {
					log.logres("Streaming it.", res)
				}
				if (debugstreamconsole) {
					log.logc(options.loginfo+" stream.processwork(): Streaming it.", logcolor)
				}
				streamer.pipe(res, {end: false})
				return
			})
		}
	
		function cachestreampart(streamfilepart, data) {

			if (debugstream) {
				log.logres("Creating " + streamdir.replace(__dirname,""), res)
			}
			if (debugstreamconsole) {
				log.logc(options.loginfo+" stream.processwork.readcallback.cachestreampart(): Creating " + streamdir.replace(__dirname+"/","").replace("/cache/stream/",""), logcolor)
			}

			mkdirp(streamdir, function (err) {

				if (err) {
					log.logc(options.loginfo+" stream.processwork.readcallback.cachestreampart(): mkdirp error: " + JSON.stringify(err), 160)
				}
				if (debugstream) {
					log.logres("Created dir " + streamdir.replace(__dirname+"/","")+streamsignature, res)
				}
				if (debugstreamconsole) {
					log.logc(options.loginfo + " stream.processwork.readcallback.cachestreampart(): Created  " + streamdir.replace(__dirname+"/",""), logcolor)
				}

				util.writeLockFile(streamfilepart, work, function (success) {
					if (!success) {
						if (debugstreamconsole) {
							log.logc(options.loginfo + " stream.processwork.readcallback.cachestreampart(): Could not lock streamfilepart file.", logcolor)
						}
						return							
					}
					fs.writeFile(streamfilepart, data, function (err) {
						if (debugstream) {
							log.logres("Wrote " + streamfilepart.replace(streamdir,""), res)
						}
						if (debugstreamconsole) {
							log.logc(options.loginfo + " stream.processwork.readcallback.cachestreampart(): Wrote " + streamfilepart.replace(streamdir,""),logcolor)
						}
						util.writeUnlockFile(streamfilepart, work, function () {
							if (reqstatus[rnd].Nx == N) {
								catstreamparts()
							}
						})

					})
				})
			})
		}

		function createstream() {

			// Create new stream.
			if (options.streamFilterReadBytes > 0) {
				if (debugstream) {
					log.logres("Reading Bytes of "+ fname.replace(__dirname,""), res);
				}
				if (debugstreamconsole) {
					log.logc(options.loginfo + " stream.processwork.createstream():  Reading Bytes of " + fname.replace(__dirname+"/",""), logcolor)
				}

				if (debugstream) {
					log.logres("fs.exist: " + fs.existsSync(fname + ".data"),res);
				}
				if (debugstreamconsole) {
					log.logc(options.loginfo + " stream.processwork.createstream(): fs.exist: " + fs.existsSync(fname + ".data"), logcolor)
				}

				fs.exists(fname + ".data", function (exists) {
					if (!exists) {
						if (debugstreamconsole) {
							log.logc(options.loginfo + " stream.processwork.createstream(): Error: .data file does not exist.", 160)
						}
					}
					util.readLockFile(fname + ".data", work, function (success) {
						if (!success) {
							if (debugstreamconsole) {
								log.logc(options.loginfo + " stream.processwork.createstream(): Could not lock file.  Try again in 100 ms", 160)
							}
							setTimeout(function () {createstream()}, 100)
							return
						}
						// TODO: Clear timeout
						var buffer = new Buffer(options.streamFilterReadBytes);
						fs.open(fname + ".data", 'r', function (err, fd) {
							fs.read(fd, buffer, 0, options.streamFilterReadBytes, options.streamFilterReadStart - 1, 
								function (err, bytesRead, buffer) {
									readcallback(err, buffer)
									fs.close(fd)
							})
						})
					})
				})
			} else if (
					options.streamFilterReadStart > 1 ||
					options.streamFilterReadLines > 0 || 
					options.streamFilterReadLineRegExp !== "" ||
					options.streamFilterReadLineFormatter !== "" ||
					options.streamFilterReadColumns !== "" ||
					options.streamFilterReadTimeColumns !== "" ||
					options.streamFilterReadTimeStart !== "" ||
					options.streamFilterReadTimeStop !== ""
					) {
				if (debugstream) {
					log.logres("Reading lines of "+ fname.replace(__dirname,"") + ".data", res)
				}
				if (debugstreamconsole) {
					log.logc(options.loginfo + " stream.processwork.createstream(): Calling readlines() with "+ fname.replace(__dirname+"/", "") + ".data", logcolor)
				}
				fs.exists(fname + ".data", function (exists) {
					if (!exists) {
						if (debugstreamconsole) {
							log.logc(options.loginfo + " stream.processwork.createstream(): Error: .data file does not exist.", 160)
						}
					}
					util.readLockFile(fname + ".data", work, function (success) {
						if (!success) {
							if (debugstreamconsole) {
								log.logc(options.loginfo + " stream.processwork.createstream(): Could not lock file.  Try again in 100 ms", 160)
							}
							setTimeout(function () {createstream()}, 100)
							return
						}
						readlines(fname + ".data")
					})
				})
			} else {	
				if (debugstream) {
					log.logres("Reading all of " + fname.replace(__dirname,""), res)
				}
				if (debugstreamconsole) {
					log.logc(options.loginfo + " stream.processwork.createstream(): Reading all of " + fname.replace(__dirname+"/",""), logcolor)
				}
				fs.exists(fname + ".data", function (exists) {
					if (!exists) {
						if (debugstreamconsole) {
							log.logc(options.loginfo + " stream.processwork.createstream(): Error: .data file does not exist.", 160)
						}
					}
					util.readLockFile(fname + ".data", work, function (success) {
						if (!success) {
							if (debugstreamconsole) {
								log.logc(options.loginfo + " stream.processwork.createstream(): Could not lock file.  Try again in 100 ms", 160)
							}
							setTimeout(function () {createstream()}, 100)
							return
						}
						// Should be no encoding if streamFilterBinary was given.
						fs.readFile(fname + ".data", "utf8", readcallback);
					})
				})
			}

			var outcolumns = [];

			if (options.streamFilterReadTimeColumns === "" && options.streamFilterReadColumns !== "") {
				var outcolumnsStr = options.streamFilterReadColumns.split(",")
				for (var z = 0;z < outcolumnsStr.length; z++) {
					if (lineFormatter !== "") {
						outcolumns[z] = lineFormatter.columnTranslator(parseInt(outcolumnsStr[z]), options)
					} else {
						outcolumns[z] = parseInt(outcolumnsStr[z])
					}
				}
				if (debugstreamconsole) {
					log.logc(options.loginfo + " stream.processwork.createstream(): outcolumns "+outcolumns.join(","), logcolor)
				}
			}

			if ((options.streamFilterReadTimeColumns === "") && (options.streamFilterReadTimeFormat !== "")) {
				var timecolumnsStr = options.streamFilterReadTimeFormat.split(",")
				if (debugstreamconsole) {
					log.logc(options.loginfo + " stream.processwork.createstream(): No ReadTimeColumns given, but ReadTimeFormat given.", logcolor)
					log.logc(options.loginfo + " stream.processwork.createstream(): Assuming time columns are first " + timecolumnsStr.length + " columns.", logcolor)
				}
				var timecolumns = []
				for (var z = 0;z < timecolumnsStr.length; z++) {
					timecolumns[z] = z+1
				}
				options.streamFilterReadTimeColumns = timecolumns.join(",")
			}

			if (options.streamFilterReadColumns !== "") {

				//var re = new RegExp(options.streamFilterReadColumnsDelimiter)
				var outcolumnsStr = options.streamFilterReadColumns.split(/,/);

				if (debugstreamconsole) {
					log.logc(options.loginfo+" stream.processwork.createstream(): streamFilterReadColumns          = " + options.streamFilterReadColumns, logcolor)
					log.logc(options.loginfo+" stream.processwork.createstream(): streamFilterLineFormatter        = " + options.streamFilterLineFormatter, logcolor)
				}

				//if (debugstreamconsole) log.logc(outcolumnsStr)
				for (var z = 0;z < outcolumnsStr.length;z++) {
					if (outcolumnsStr[z].match("-")) {					
						//if (debugstreamconsole) log.logc("FOUND HYPHEN")
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
				
				if (debugstream) {
					log.logres("streamFilterReadTimeColumns = " + options.streamFilterReadTimeColumns, res)
					log.logres("streamFilterWriteTimeFormat = " + options.streamFilterWriteTimeFormat, res)
					log.logres("outcolumns expanded         = " + outcolumnsStr, res)
				}
				if (debugstreamconsole) {
					log.logc(options.loginfo+" stream.processwork.createstream(): streamFilterReadTimeFormat       = " + options.streamFilterReadTimeFormat, logcolor)
					log.logc(options.loginfo+" stream.processwork.createstream(): streamFilterReadTimeColumns      = " + options.streamFilterReadTimeColumns, logcolor)
					log.logc(options.loginfo+" stream.processwork.createstream(): streamFilterWriteTimeFormat      = " + options.streamFilterWriteTimeFormat, logcolor)
					log.logc(options.loginfo+" stream.processwork.createstream(): outcolumns expanded              = " + outcolumnsStr, logcolor)
				}

				if (lineFormatter !== "") {
					for (var z = 0;z < outcolumnsStr.length; z++) {
						outcolumns[z] = lineFormatter.columnTranslator(parseInt(outcolumnsStr[z]), options)
					}
				} else {
					for (var z = 0;z < outcolumnsStr.length; z++) {
						outcolumns[z] = parseInt(outcolumnsStr[z])
					}				
				}

				if (debugstream) {
					log.logres("columns translated " + outcolumns.join(","),res)
				}
				if (debugstreamconsole) {
					log.logc(options.loginfo+" stream.processwork.createstream(): outcolumns translated            = " + outcolumns.join(","), logcolor)
				}

				function onlyUnique(value, index, self) { 
					return self.indexOf(value) === index;
				}
				
				outcolumns = outcolumns.filter(onlyUnique);

				if (outcolumns[0] == 1 && options.streamFilterWriteTimeFormat == "2") {
					outcolumns.splice(0,1);
					outcolumns = [1,2,3,4,5,6].concat(outcolumns);
				}
				
				if (debugstream) {
					log.logres("Data columns after accounting for WriteTimeFormat = " + outcolumns.join(","), res)
				}
				if (debugstreamconsole) {
					log.logc(options.loginfo+" stream.processwork.createstream(): outcolumns given WriteTimeFormat = " + outcolumns.join(","), logcolor)
				}
			}

			function readlines(fnamefull) {

				var line   = ''; 
				var lines  = ''; // Accumulated lines.
				var linesx = ''; // Modified kept lines.

				var lk = 0; // Lines kept.
				var lr = 1; // Lines read.
				
				var fnamesize = -1;

				if (debugstreamconsole) {
					log.logc(options.loginfo + " stream.processwork.readlines(): Reading lines of " + fnamefull.replace(__dirname+"/",""), logcolor)
					log.logc(options.loginfo + " stream.processwork.readlines(): streamFilterReadLineRegExp = " + options.streamFilterReadLineRegExp, logcolor)
				}

				// https://github.com/nickewing/line-reader
				lineReader.eachLine(fnamefull, function(line, last) {

	 				if (debugstreamconsole) {
						//log.logc(options.loginfo + " stream.processwork.readlines.lineReader: Line: " + line, logcolor)
					}
					
					var stopline = options.streamFilterReadLines;
					if (options.streamFilterReadLines == 0) {
						stopline = Infinity;
					}

					if (lr >= options.streamFilterReadStart) {

						if (lk == stopline) {	
							if (debugstream) {
								log.logres("Reached stop line.",res)
							}
							if (debugstreamconsole) {
								log.logc(options.loginfo + " stream.processwork.readlines.lineReader: Reached stop line.", logcolor)
							}
							// Done processing
							return false
						}

						if (options.streamFilterReadLineRegExp !== "") {
							var re = new RegExp(options.streamFilterReadLineRegExp)
							if (line.match(re) === null) {
								line = "";
								// Process next line
								return true
							}
						}
						if (debugstreamconsole) {
							//log.logc(options.loginfo + " stream.processwork.readlines.lineReader: Line after RegExp: " + line, logcolor)
						}

						if (lineFormatter !== "" && line !== "") {

							if (debugstreamconsole && (lr == options.streamFilterReadStart)) {
								log.logc(options.loginfo + " stream.processwork.readlines.lineReader: First processed line before calling formatLine:", logcolor)
								log.logc(options.loginfo + " " + line, logcolor)
							}
							if (debugstreamconsole && last) {
								log.logc(options.loginfo + " stream.processwork.readlines.lineReader: Last processed line before calling formatLine:", logcolor)
								log.logc(options.loginfo + " " + line, logcolor)
							}

							// lineformatter returns blank if line is before timerange.
							line = lineFormatter.formatLine(line, options);

							if (debugstreamconsole && (lr == options.streamFilterReadStart)) {
								log.logc(options.loginfo + " stream.processwork.readlines.lineReader: First processed line after calling formatLine:", logcolor)
								log.logc(options.loginfo + " " + line, logcolor)

							}
							if (debugstreamconsole && last) {
								log.logc(options.loginfo + " stream.processwork.readlines.lineReader: Last processed line after calling formatLine:", logcolor)
								log.logc(options.loginfo + " " + line, logcolor)

							}

							if (line == "END_OF_TIMERANGE") {	
								if (debugstream) {
									log.logres("Reached end of time range.", res)
								}
								if (debugstreamconsole) {
									log.logc(options.loginfo+" stream.processwork.readlines.lineReader: Reached end of time range.", logcolor)
								}
								// Done processing
								return false
							}

							if (debugstreamconsole) {
								//log.logc(options.loginfo + " stream.processwork.readlines.lineReader: Line after lineFormatter: " + line, logcolor)
							}

						}

						if (outcolumns.length > 0 && line !== "") {

							tmparr = line.split(/\s+/g)
							line = ""

							if (debugstreamconsole && (lr == options.streamFilterReadStart)) {
								log.logc(options.loginfo+" stream.processwork.readlines.lineReader: Extracting " + tmparr.length + " columns on first line.", logcolor)
							}
							if (debugstreamconsole && last) {
								log.logc(options.loginfo+" stream.processwork.readlines.lineReader: Extracting " + tmparr.length + " columns on last line.", logcolor)
							}
							for (var z = 0; z < outcolumns.length-1; z++) {
								line = line + tmparr[outcolumns[z]-1] + " ";
							}
							line = line + tmparr[outcolumns[z]-1];

							if (debugstreamconsole) {
								//log.logc(options.loginfo + " stream.processwork.readlines.lineReader: Line after outcolumns: " + line, logcolor)
							}

						}

						if (line !== "") {
							// lineReader only removes trailing \n.  Remove trailing \r.
							lines = lines + line.replace(/\r$/,"") + "\n";
							lk = lk + 1;
						} else {
							//log.logc(options.loginfo + " stream.processwork.readlines.lineReader: Error: line is undefined.", 160)
						}

						if (typeof(line) === "undefined") {
							log.logc(options.loginfo + " stream.processwork.readlines.lineReader: Error: line is undefined.", 160)
						}

						if (options.streamFilterWriteComputeFunction.match(/stats|mean|max|min|std|Nvalid/)) {
							if (!options.streamFilterWriteComputeFunction.match(/regrid/)) {
								if (lk % options.streamFilterWriteComputeFunctionWindow == 0) {
									//console.log(lines)
									linesx = linesx + statsfilter.stats(lines.replace(/\n$/,""), options)
									lines = ''
								}
							}
						}
						
					}
					lr = lr+1;
				}).then(function () {
					if (debugstreamconsole) {
						log.logc(options.loginfo+" stream.processwork.readlines.lineReader.then(): Called.", logcolor)
					}

					if (options.streamFilterWriteComputeFunction.match(/regrid/)) {
						// Not tested.
						if (debugstream) {
							log.logres("stream.js: Calling regrid()", res)
						}
						if (debugstreamconsole) {
							log.logc(options.loginfo + " stream.processwork.readlines.lineReader.then(): Calling regrid() with:", logcolor)
							console.log(lines)
						}
						lines = regridfilter.regrid(lines, options)
						if (debugstreamconsole) {
							log.logc(options.loginfo + " stream.processwork.readlines.lineReader.then(): regrid() returned:", logcolor)
							console.log(lines)
						}

						// If regrid is requested, stats were not computed.  Compute them here if requested.
						if (options.streamFilterWriteComputeFunction.match(/stats|mean|max|min|std|Nvalid/)) {
							var linesv = lines.join(/\n/)
							var h = options.streamWriteFilterComputeFunctionArgs
							var Nb = Math.floor(linesv.length/h)
							linesx = '';
							if (debugstreamconsole) {
								log.logc(options.loginfo + " stream.processwork.readlines.lineReader.then(): Nblocks = " + Nb, logcolor)
								log.logc(options.loginfo + " stream.processwork.readlines.lineReader.then(): Block height = " + h, logcolor)
							}
							for (var b = 0; b < Nb-1;b++) {
								linesx = linesx + statsfilter.stats(linesv.slice(b*h,(b+1)*h).join(/\n/).replace(/\n$/,""), options)
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
							if (debugstream) {
								log.logres("Last window not full.", res)
							}
							if (debugstreamconsole) {
								log.logc(options.loginfo + " stream.processwork.readlines.lineReader.then(): Last window not full.", logcolor)
							}
							linesx = linesx + statsfilter.stats(lines.replace(/\n$/,""), options)
							readcallback("", linesx)
						}
					}
				})
			}
		
			function readcallback(err, data) {

				util.readUnlockFile(fname + ".data", work, function () {})

				if (debugstream) {
					log.logres("Called for " + fname.replace(__dirname+"/",""), res)
				}			
				if (debugstreamconsole) {
					log.logc(options.loginfo+" stream.processwork.readcallback(): Called for " + fname.replace(__dirname+"/",""),logcolor)
				}
					
				if (err) {
					if (debugstream) {
						log.logres("Error: " + err, res)
					}
					if (debugstreamconsole) {
						log.logc(options.loginfo + " stream.processwork.readcallback(): Error: " + err, logcolor)
					}
					return res.end()
				}

				if (options.streamFilter === "") {
					if (debugstream) {
						log.logres("Writing response.", res)
					}
					if (debugstreamconsole) {
						log.logc(options.loginfo + " stream.processwork.readcallback(): Writing response.", logcolor)
					}
					if (!options.streamGzip) {
						if (debugstream) {
							log.logres("Sending uncompressed data of length = " + data.length, res)
						}
						if (debugstreamconsole) {
							log.logc(options.loginfo + " stream.processwork.readcallback(): Sending uncompressed data of length = " + data.length, logcolor)
						}
						res.write(data)
						finished(inorder)
						zlib.createGzip({level: 1})
						zlib.gzip(data, function (err, buffer) {
							if (err) {
								log.logc(options.loginfo + " stream.processwork.readcallback(): gzip error: " + JSON.stringify(err), 160)
							}
							if (debugstreamconsole) {
								log.logc(options.loginfo + " stream.processwork.readcallback(): Calling cachestreampart()", logcolor)
							}
							cachestreampart(streamfilepart, buffer)
						})
					} else {
						if (debugstream) {
							log.logres("Compressing buffer of length " + data.length, res)
						}
						if (debugstreamconsole) {
							log.logc(options.loginfo + " stream.processwork.readcallback(): Compressing buffer of length "+data.length, logcolor)
						}
						zlib.createGzip({level:1})
						zlib.gzip(data, function (err, buffer) {
							if (err) {
								log.logc(options.loginfo + " stream.processwork.readcallback(): gzip error: " + JSON.stringify(err), 160)
							}
							if (debugstream) {
								log.logres("Compression finished. Sending buffer of length "+buffer.length, res)
							}	
							if (debugstreamconsole) {
								log.logc(options.loginfo + " stream.processwork.readcallback(): Compression finished. Sending buffer of length "+buffer.length,logcolor)
							}	
							res.write(buffer)
							if (debugstreamconsole) {
								log.logc(options.loginfo + " stream.processwork.readcallback(): Calling cachestreampart()", logcolor)
							}
							finished(inorder)
							cachestreampart(streamfilepart, buffer)
						})
					}

				} else {	
					try {
						eval("data = data.toString()."+options.streamFilter)
						if (!options.streamGzip) {
							res.write(data)
							cachestreampart(streamfilepart, data)
							finished(inorder)
						} else {
							var tic = new Date()
							zlib.createGzip({level: 1})
							zlib.gzip(data, function (err, buffer) {
								reqstatus[rnd].dt = new Date()-tic
								if (debugstream) {
									log.logres("gzip callback event", res)
									log.logres("Writing compressed buffer", res)
								}
								if (debugstreamconsole) {
									log.logc(options.loginfo + " stream.processwork.readcallback(): gzip callback event", logcolor)
									log.logc(options.loginfo + " stream.processwork.readcallback(): Writing compressed buffer", logcolor)
								}
								res.write(buffer)
								reqstatus[rnd].gzipping = reqstatus[rnd].gzipping - 1
								cachestreampart(streamfilepart, buffer)
								finished(inorder)
							})
						}
					} catch (err) {
						if (debugstream) {
							log.logres("Error when evaluating " + options.streamFilter, res)
						}
						if (debugstreamconsole) {
							log.logc(options.loginfo + " stream.processwork.readcallback(): Error when evaluating " + options.streamFilter, logcolor)
						}
						finished(inorder)
					}
				}
			}
		}
	}
}
exports.stream = stream
