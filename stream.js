var mkdirp     = require("mkdirp");
var lineReader = require('line-reader');
var exec       = require('child_process').exec;
var spawn      = require('child_process').spawn;
var zlib       = require('zlib');
var	fs 		   = require("fs");
var	crypto     = require("crypto");

// Object containing names of cached files that are being streamed.
stream.streaming = {};

function stream(source, options, res) {

	var scheduler     = require("./scheduler.js");
	var log        	  = require("./log.js");
	var util          = require("./util.js");

	var readFilterSignature = ""; 

	if (options.streamFilterReadLineFormatter.match(/formattedTime/) ||
		options.streamFilterReadTimeFormat || 
		options.streamFilterReadTimeColumns) {
		if (options.debugstream) {
			log.logres(options.loginfo+", Reading ./plugins/formattedTime.js", res)
		}
		if (options.debugstreamconsole) {
			log.logc(options.loginfo+" stream.js: Reading ./plugins/formattedTime.js", options.logcolor)
		}
		var lineFormatter = require(__dirname + "/plugins/formattedTime.js");
		// TODO: Add signature
	} else {
		if (options.debugstreamconsole) {
			log.logc(options.loginfo+" stream.js: No lineFormatter will be used.", options.logcolor)
		}
		var lineFormatter = ""
	}

	//res.setHeader('Transfer-Encoding', 'chunked');
	//res.setHeader('Content-Encoding','gzip');
	
	//console.log(options)
	var rnd        = options.loginfo;
	var logcolor   = options.logcolor;		

	var reqstatus  = {};
	reqstatus[rnd] = {};

	reqstatus[rnd].Nx       = 0; // Number of reads/processed URLs completed
	reqstatus[rnd].Nd       = 0; // Number of drained reads
	reqstatus[rnd].gzipping = 0;
	reqstatus[rnd].dt       = 0;
		
	if (options.streamFilterWriteComputeFunction.match(/stats|mean|max|min|std|Nvalid/)) {
		if (options.debugstream) {
			log.logres(options.loginfo+", Reading ./filters/stats.js",res);
		}
		if (options.debugstreamconsole) {
			log.logc(options.loginfo+" stream.js: Reading ./filters/stats.js",logcolor)
		}
		var statsfilter = require("./filters/stats.js");
		readFilterSignature = readFilterSignature + statsfilter.filterSignature(options);
	}

	if (options.streamFilterWriteComputeFunction.match(/regrid/)) {
		if (options.debugstream) {
			log.logres("Reading ./filters/regrid.js",res);
		}
		if (options.debugstreamconsole) {
			log.logc(options.loginfo+" stream.js: Reading ./filters/regrid.js", logcolor)
		}
		var regridfilter = require("./filters/regrid.js");
		readFilterSignature = readFilterSignature + regridfilter.filterSignature(options);
	}
	

	extractSignature = source.join(",");
	// TODO:
	// Technically, each element of source array could have different plug-in.
	// Below assumes that same plug-in is used for all elements of source array.
	// Modify this so assumption is not made.
	var plugin = scheduler.getPlugin(options,source[0])
	if (plugin.extractSignature) {
		extractSignature = extractSignature + plugin.extractSignature(options)
		if (options.debugstream) {
			log.logres("Plugin signature MD5: " + util.md5(extractSignature), res)
		}
	}

	var streamsignature   = util.md5(extractSignature + 
									readFilterSignature +
								    options.streamFilterReadStart +
									options.streamFilterReadBytes +
								    options.streamFilterReadLines + 
								    options.streamFilterReadTimeFormat +
								    options.streamFilterReadReadColumns);

	if (options.debugstreamconsole) {
		log.logc(options.loginfo+" stream.js: Stream signature: " + util.md5(streamsignature), logcolor)
	}

	var streamdir         = __dirname +"/cache/stream/"+source[0].split("/")[2]+"/"+streamsignature+"/";
	var streamfilecat     = streamdir + streamsignature + ".stream.gz";
	var streamfilecatlck  = streamfilecat.replace("stream.gz","lck");
	
	if (options.debugstream || options.debugstreamconsole) {
		if (!fs.existsSync(streamfilecat)) {
			if (options.debugstream) log.logres("streamfilecat does not exist at cache/stream/" + streamfilecat.replace(streamdir,""),res)
			if (options.debugstreamconsole) log.logc(options.loginfo+" stream.js: streamfilecat does not exist at cache/stream/" + streamfilecat.replace(streamdir,""),logcolor)
		} else {
			if (options.debugstream) log.logres("streamfilecat exists at cache/stream/" + streamfilecat.replace(streamdir,""),res)
			if (options.debugstreamconsole) log.logc(options.loginfo+" stream.js: streamfilecat exists at cache/stream/" + streamfilecat.replace(streamdir,""),logcolor)
		}
		if (!fs.existsSync(streamfilecatlck)) {
			if (options.debugstream) log.logres("streamfilecatlck does not exist at cache/stream/" + streamfilecatlck.replace(streamdir,""),res)
			if (options.debugstreamconsole) log.logc(options.loginfo+" stream.js: streamfilecatlck does not exist at cache/stream/" + streamfilecatlck.replace(streamdir,""),logcolor);
		} else {
			if (options.debugstream) log.logres("streamfilecatlck exists at cache/stream/" + streamfilecatlck.replace(streamdir,""),res)
			if (options.debugstreamconsole) log.logc(options.loginfo+" stream.js: streamfilecatlck does not exist at cache/stream/" + streamfilecatlck.replace(streamdir,""),logcolor);
		}
	}
	
	// This does not work because node.js does not handle concatenated gzip files.
	if (fs.existsSync(streamfilecat) && !fs.existsSync(streamfilecatlck) && !options.forceWrite && !options.forceUpdate) {
		if (options.debugstream) {
			log.logres("Ignoring existing streamfilecat because of bug in node.js with concateneated gzip files",res)
		}
		if (options.debugstreamconsole) {
			log.logc(options.loginfo+" stream.js: Ignoring existing streamfilecat because of bug in node.js with concateneated gzip files",logcolor)
		}
		//streamcat();
		//return;
	}
	
	var N = source.length;
	if (options.debugstream) {
		log.logres('Calling scheduler with ' + N + ' URL(s) and options.streamOrder = '+options.streamOrder,res)
	}
	if (options.debugstreamconsole) {
		log.logc(options.loginfo+' stream.js: Calling scheduler with ' + N + ' URL(s) and options.streamOrder = '+options.streamOrder,logcolor)
	}

	if (options.streamOrder) {
	    scheduler.addURL(source[0], options, function (work) {processwork(work,true)});
	} else {
	    for (var jj=0;jj<N;jj++) {
	    	if (options.debugstream) {
	    		log.logres("Adding to scheduler: " + source[jj],res)	    		
	    	}
			if (options.debugstreamconsole) {
				log.logc(options.loginfo+" stream.js: Adding to scheduler: " + source[jj],logcolor)
			}
			scheduler.addURL(source[jj], options, function (work) {processwork(work)});
	    }
	}

	function streamcat() {
		// http://stackoverflow.com/questions/16868052/concatenating-gzip-deflate-data-on-node-js-request
		// https://groups.google.com/forum/#!topic/nodejs/4qkRR867nZg
		// https://github.com/joyent/node/issues/6032
		// https://github.com/oorabona/node-liblzma/commit/684ec73beb7059b6e12d955ca3788547fabb98a0
		res.setHeader('Content-Disposition', streamfilecat.replace(/.*\/(.*)/,"$1"))

		if (fs.existsSync(streamfilecatlck)) {
			if (options.debugstream) {
				log.logres("Cached stream file is locked.", res)
			}
			if (options.debugstreamconsole) {
				log.logc(options.loginfo+" stream.streamcat(): Cached stream file is locked.",logcolor)
			}
		} else {
			if (options.debugstream) {
				log.logres("Streaming cached concatenated stream file: "+streamfilecat, res)				
			}
			if (options.debugstreamconsole) {
				log.logc(options.loginfo+" stream.streamcat(): Streaming cached concatenated stream file: "+streamfilecat,logcolor)
			}
			fs.writeFileSync(streamfilecatlck,"");
			if (options.streamGzip == false) {
				if (options.debugstream) {
					log.logres("Unzipping cached concatenated stream file: "+streamfilecat, res)
				}
				if (options.debugstreamconsole) {
					log.logc(options.loginfo+" stream.streamcat(): Unzipping cached concatenated stream file: "+streamfilecat,logcolor)
				}
				res.setHeader('Content-Disposition', streamfilecat.replace(/.*\/(.*)/,"$1").replace(".gz",""))
				// This does not handle concatenated stream files.
				var streamer = fs.createReadStream(streamfilecat).pipe(zlib.createGunzip());
			} else {
				res.setHeader('Content-Disposition', streamfilecat.replace(/.*\/(.*)/,"$1"))
				res.setHeader('Content-Encoding', 'gzip');
				var streamer = fs.createReadStream(streamfilecat);
			}
			streamer.on('end',function() {
				if (options.debugstream) {
					log.logres("Received streamer.on end event.",res)
					log.logres("Removing " + streamfilecatlck,res)
				}
				if (options.debugstreamconsole) {
					log.logc(options.loginfo+" stream.streamcat(): Received streamer.on end event.",logcolor)
					log.logc(options.loginfo+" stream.streamcat(): Removing " + streamfilecatlck,logcolor)
				}
				fs.unlink(streamfilecatlck)
				res.end();
			});
			streamer.pipe(res);
			return;
		}
	}

	function catstreamparts() {
		if (reqstatus[rnd].Nx == N) {
			if (options.debugstreamconsole) {
				log.logc(options.loginfo+" stream.readcallback.cachestream(): Not creating concatenated gzip stream file because of bug in node.js.", logcolor)
			}
			return

			var streamfile = streamdir.replace(streamsignature,"") + streamsignature + ".stream.gz";
			if (options.debugstream) {
				log.logres("Reading dir " + streamdir.replace(__dirname,""), res)
			}
			if (options.debugstreamconsole) {
				log.logc(options.loginfo+" stream.readcallback.cachestream(): Reading dir " + streamdir.replace(__dirname,"")+streamsignature,logcolor)
			}
			var files = fs.readdirSync(streamdir);
			var files2 = [];
			var k = 0;
			for (var z = 0;z<files.length;z++) {
				if (!files[z].match(".lck")) {
					files2[k] = ""+k+".stream.gz";
					k = k+1;
				}
			}
			if (options.debugstream) {
				log.logres("Found " + files2.length + " files", res)
			}
			if (options.debugstreamconsole) {
				log.logc(options.loginfo+" stream.readcallback.cachestream(): Found " + files2.length + " files", logcolor)
			}

			if (files2.length != N) {
				if (options.debugstreamconsole) {
					log.logc(options.loginfo+" stream.readcallback.cachestream(): Not creating concatenated gzip stream file all parts not ready.", logcolor)
				}
				return
			}


			if (files.length > 1) {
				if (options.debugstream) {
					log.logres("Concatenating " + files2.length + " stream parts into ../" + streamsignature + ".stream.gz", res)
				}
				if (options.debugstreamconsole) {
					log.logc(options.loginfo+" stream.readcallback.cachestream(): Concatenating " + files2.length + " stream parts into ../" + streamsignature + ".stream.gz",logcolor)
				}

				// TODO: Make this async
				// If part is being concatenated
				if (fs.existsSync("../" + streamsignature + ".lck")) {
					if (options.debugstreamconsole) {
						log.logc(options.loginfo+" stream.readcallback.cachestream(): Aborting write because lock on cat file exists: " + "../" + streamsignature + ".lck", logcolor)
					}
				}

				fs.writeFile("../" + streamsignature + ".lck", '', function () {
					var com = "cd " + streamdir + streamsignature + "; cat " + files2.join(" ") + " > ../" + streamsignature + ".stream.gz; rm ../"+streamsignature+".lck";
					if (options.debugstream) {
						log.logres("Evaluating: " + com, res)
					}
					if (options.debugstreamconsole) {
						log.logc(options.loginfo+" stream.readcallback.cachestream(): Evaluating: " + com,logcolor)
					}
					child = exec(com,function (error, stdout, stderr) {
						if (options.debugstream) {
							log.logres("Evaluated: " + com, res)
						}
						if (options.debugstreamconsole) {
							log.logc(options.loginfo+" stream.readcallback.cachestream(): Evaluated: " + com,logcolor)
						}
						if (error) {
							log.logres(JSON.stringify(error), res)
							log.logc(options.loginfo+" stream.readcallback.cachestream(): Error: " + JSON.stringify(error), 160)
							if (stderr) {
								log.logc(stderr, 160)
							}
						}
					})
				})
			} else {
				var com = "cd " + streamdir + streamsignature + "; touch ../" + streamsignature + ".lck" + "; ln -s " + streamsignature + files2[0] + " ../" + streamsignature + ".stream.gz; rm ../"+streamsignature+".lck";
				if (options.debugstream) {
					log.logres("Evaluating " + com, res)
				}
				if (options.debugstreamconsole) {
					log.logc(options.loginfo+" stream.readcallback.cachestream(): Evaluating " + com,logcolor)
				}
				child = exec(com,function (error, stdout, stderr) {
					if (options.debugstream) {
						log.logres("Evaluated  " + com, res)
					}
					if (options.debugstreamconsole) {
						log.logc(options.loginfo+" stream.readcallback.cachestream(): Evaluated  " + com,logcolor)
					}
					if (error) {
						log.logres(JSON.stringify(error), res)
						log.logc(options.loginfo+" stream.readcallback.cachestream(): Error: " + JSON.stringify(error), 160)
						if (stderr) {
							log.logc(stderr, 160)
						}
					}
				})								
			}
		}
	}

	function finished(inorder) {
		if (reqstatus[rnd].Nx == N) {
			log.logc(options.loginfo + " stream.finished(): N finished = N and finished() called.  Error?", 160)
		}
		if (options.debugstream) {
			log.logres("Incremening N finished from " + reqstatus[rnd].Nx + "/" + N + " to " + (reqstatus[rnd].Nx+1) + "/" + N,res)
		}
		if (options.debugstreamconsole) {
			log.logc(options.loginfo + " stream.finished(): Incremening N finished from " + reqstatus[rnd].Nx + "/" + N + " to " + (reqstatus[rnd].Nx+1) + "/" + N,logcolor)
		}
		reqstatus[rnd].Nx = reqstatus[rnd].Nx + 1;

		if ((reqstatus[rnd].Nx < N) && (inorder)) {
			if (options.debugstream) {
				log.logres("Processing next URL.",res)
			}
			if (options.debugstreamconsole) {
				log.logc(options.loginfo + " Processing next URL.",logcolor)
			}
			scheduler.addURL(source[reqstatus[rnd].Nx], options, function (work) {processwork(work,true)});
		}

		if (N == reqstatus[rnd].Nx) {
			if (options.debugstream) {
				log.logres("Sending res.end().", res)
			}
			if (options.debugstreamconsole) {
				log.logc(options.loginfo + " stream.finished(): Sending res.end().", logcolor)
			}
			res.end()
		}
	}

	function processwork(work, inorder) {
		//console.log(work)
		var fname = util.getCachePath(work);
		var streamfilepart = streamdir+work.urlMd5+".stream.gz";
		var streamfilepartlck = streamdir+work.urlMd5+".stream.lck";

		if (work.error && !work.isFromCache) {
			if (options.debugstream) {
				log.logres("work.error = '"+work.error+"' and no cached data. Calling finished(). Not sending data.", res)
			}
			if (options.debugstreamconsole) {
				log.logc(options.loginfo + " stream.processwork(): work.error = '"+work.error+"' and no cached data.  Calling finished() and not sending data.", logcolor)
			}
			//console.log(work)
			finished(inorder)
			return
		}

		// See if util.writeCache is writing the file.
		if (typeof(util.writeCache.memLock) != "undefined") {
			if (typeof(util.writeCache.memLock[fname]) != "undefined") {
				if (util.writeCache.memLock[fname] > 0) {
					//if (options.debugstream)
					if (options.debugstream) { 
						log.logres("File is locked by util.writeCache.  Trying again in 100 ms.",res)
						if (options.debugstreamconsole) {
							log.logc(options.loginfo + " stream.processwork():  File is locked by util.writeCache.  Trying again in 100 ms.",logcolor)
						}
					}
					setTimeout(function () {processwork(work,inorder)},100)
					return
				}
			}
		}

		if (!stream.streaming[fname]) {
			if (options.debugstream) {
				log.logres("Stream memory locking " + fname.replace(__dirname+"/",""), res);
			}
			if (options.debugstreamconsole) {
				log.logc(options.loginfo + " stream.processwork(): No stream memory locks found for " + fname.replace(__dirname+"/",""),logcolor)
				log.logc(options.loginfo + " stream.processwork(): Stream memory locking " + fname.replace(__dirname+"/",""),logcolor)
			}
			stream.streaming[fname] = 1;
		} else {
			if (options.debugstream) {
				log.logres("Increasing # of stream memory locks by from " + stream.streaming[fname] + " to " + (stream.streaming[fname]+1) + " on " + fname.replace(__dirname,""),res);
			}
			if (options.debugstreamconsole) {
				log.logc(options.loginfo + " Increasing # of stream memory locks by from " + stream.streaming[fname] + " to " + (stream.streaming[fname]+1) + " on " + fname.replace(__dirname+"/",""),logcolor)
			}
			stream.streaming[fname] = stream.streaming[fname] + 1;
		}

		if (fs.existsSync(streamfilepartlck)) {
			if (options.debugstream) {
				log.logres("streamfilepartlck exists: "+streamfilepartlck,res);
			}
			if (options.debugstreamconsole) {
				log.logc(options.loginfo+" stream.processwork(): streamfilepartlck exists: "+streamfilepartlck,logcolor)
			}
		}

		// Use cached version of part if exists and options allow it.
		if (!fs.existsSync(streamfilepartlck) && !options.forceWrite && !options.forceUpdate) {
			if (options.debugstream) {
				log.logres("Checking if stream part exists: " + streamfilepart.replace(__dirname+"/",""),res)
			}
			if (options.debugstreamconsole) {
				log.logc(options.loginfo+" stream.processwork(): Checking if stream part exists: " + streamfilepart.replace(__dirname+"/",""),logcolor)
			}

			if (fs.existsSync(streamfilepart)) {
				if (options.debugstream) {
					log.logres("It does.  Locking it.",res);
				}
				if (options.debugstreamconsole) {
					log.logc(options.loginfo+" stream.processwork(): It does.  Locking it.",logcolor)
				}
				fs.writeFileSync(streamfilepartlck,"")
				if (options.streamGzip == false) {
					if (options.debugstream) {
						log.logres("Unzipping it.",res)
					}
					if (options.debugstreamconsole) {
						log.logc(options.loginfo+" stream.processwork(): Unzipping it.",logcolor)
					}

					var streamer = fs.createReadStream(streamfilepart).pipe(zlib.createGunzip());
				} else {
					if (options.debugstream) {
						log.logres("Sending raw.",res);
					}
					if (options.debugstreamconsole) {
						log.logc(options.loginfo+" stream.processwork(): Sending raw.",logcolor)
					}
					var streamer = fs.createReadStream(streamfilepart);
				}
				streamer.on('end',function() {
					if (options.debugstream) {
						log.logres("Received streamer.on end event.",res);
					}
					if (options.debugstreamconsole) {
						log.logc(options.loginfo+" stream.processwork(): Received streamer.on end event.",logcolor)
					}

					if (options.debugstream) {
						log.logres("Removing " + streamfilepartlck.replace(__dirname+"/",""),res)
					}
					if (options.debugstreamconsole) {
						log.logc(options.loginfo+" stream.processwork(): Removing " + streamfilepartlck.replace(__dirname+"/",""),logcolor)
					}
					fs.unlink(streamfilepartlck)
					if (options.debugstreamconsole) {
						log.logc(options.loginfo + " stream.processwork(): Stream memory unlocking " + fname.replace(__dirname+"/",""),logcolor)
					}
				    stream.streaming[fname] = stream.streaming[fname] - 1
					finished(inorder)
				});
				streamer.on('error',function(err) {
					if (options.debugstreamconsole) {
						log.logc(options.loginfo+" stream.processwork(): streamer error event: " + JSON.stringify(err), 160)
					}
				})
				if (options.debugstream) {
					log.logres("Streaming it.",res)
				}
				if (options.debugstreamconsole) {
					log.logc(options.loginfo+" stream.processwork(): Streaming it.",logcolor)
				}
				streamer.pipe(res,{ end: false })
				return;
			} else {
				if (options.debugstream) {
					log.logres("It does not.",res)
				}
				if (options.debugstreamconsole) {
					log.logc(options.loginfo+" stream.processwork(): It does not.",logcolor)
				}
			}			
		}

		// Create new stream.
		if (options.streamFilterReadBytes > 0) {
		    if (options.debugstream) {
		    	log.logres("Reading Bytes of "+ fname.replace(__dirname,""),res);
		    	log.logres("Reading Bytes of "+ fname.replace(__dirname,""),res);
		    }
			if (options.debugstreamconsole) {
				log.logc(options.loginfo + " stream.processwork():  Reading Bytes of "+ fname.replace(__dirname+"/",""),logcolor)
				log.logc(options.loginfo + " stream.processwork():  Stream lock status " + stream.streaming[fname],logcolor)
			}

			var buffer = new Buffer(options.streamFilterReadBytes);
			if (options.debugstream) {
				log.logres("fs.exist: " + fs.existsSync(fname + ".data"),res);
			}
			if (options.debugstreamconsole) {
				log.logc(options.loginfo + " stream.processwork():  fs.exist: " + fs.existsSync(fname + ".data"),logcolor)
			}

			fs.open(fname + ".data", 'r', function (err,fd) {
				//logger.d("stream.processwork(): ", "error:", err, "fd:", fd, fd==undefined,  "readbytes:", options.streamFilterReadBytes, "readPosition:", options.streamFilterReadPosition);
			    fs.read(fd, buffer, 0, options.streamFilterReadBytes, options.streamFilterReadStart-1, 
			    		function (err, bytesRead, buffer) {
			    			readcallback(err,buffer);
			    			fs.close(fd);
			    		})})
		} else if (options.streamFilterReadStart > 1 ||
				   options.streamFilterReadLines > 0 || 
				   options.streamFilterReadLineRegExp !== "" ||
				   options.streamFilterReadLineFormatter !== "" ||
				   options.streamFilterReadColumns !== "" ||
				   options.streamFilterReadTimeColumns !== "" ||
				   options.streamFilterReadTimeStart !== "" ||
				   options.streamFilterReadTimeStop !== "") {
		    if (options.debugstream) {
		    	log.logres("Reading lines of "+ fname.replace(__dirname,"") + ".data",res)
		    }
	    	if (options.debugstreamconsole) {
	    		log.logc(options.loginfo + " stream.processwork(): Calling readlines() with "+ fname.replace(__dirname+"/","") + ".data",logcolor)
	    	}
			readlines(fname + ".data")
		} else {	
		    if (options.debugstream) {
		    	log.logres("Reading all of "+fname.replace(__dirname,""),res)
		    }
	    	if (options.debugstreamconsole) {
	    		log.logc(options.loginfo + " stream.processwork(): Reading all of "+fname.replace(__dirname+"/",""),logcolor)
	    	}
			// Should be no encoding if streamFilterBinary was given.
			fs.readFile(fname + ".data", "utf8", readcallback);
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
			if (options.debugstreamconsole) {
				log.logc(options.loginfo + " stream.processwork(): outcolumns "+outcolumns.join(","), logcolor)
			}
		}

		if ((options.streamFilterReadTimeColumns === "") && (options.streamFilterReadTimeFormat !== "")) {
			var timecolumnsStr = options.streamFilterReadTimeFormat.split(",")
			if (options.debugstreamconsole) {
				log.logc(options.loginfo + " stream.processwork(): No ReadTimeColumns given, but ReadTimeFormat given.", logcolor)
				log.logc(options.loginfo + " stream.processwork(): Assuming time columns are first " + timecolumnsStr.length + " columns.", logcolor)
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

			if (options.debugstreamconsole) {
				log.logc(options.loginfo+" stream.processwork(): streamFilterReadColumns          = " + options.streamFilterReadColumns, logcolor)
				log.logc(options.loginfo+" stream.processwork(): streamFilterLineFormatter        = " + options.streamFilterLineFormatter, logcolor)
			}

			//if (options.debugstreamconsole) log.logc(outcolumnsStr)
			for (var z = 0;z < outcolumnsStr.length;z++) {
				if (outcolumnsStr[z].match("-")) {					
					//if (options.debugstreamconsole) log.logc("FOUND HYPHEN")
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
			
			if (options.debugstream) {
				log.logres("streamFilterReadTimeColumns = " + options.streamFilterReadTimeColumns, res)
				log.logres("streamFilterWriteTimeFormat = " + options.streamFilterWriteTimeFormat, res)
				log.logres("outcolumns expanded         = " + outcolumnsStr, res)
			}
			if (options.debugstreamconsole) {
				log.logc(options.loginfo+" stream.processwork(): streamFilterReadTimeFormat       = " + options.streamFilterReadTimeFormat, logcolor)
				log.logc(options.loginfo+" stream.processwork(): streamFilterReadTimeColumns      = " + options.streamFilterReadTimeColumns, logcolor)
				log.logc(options.loginfo+" stream.processwork(): streamFilterWriteTimeFormat      = " + options.streamFilterWriteTimeFormat, logcolor)
				log.logc(options.loginfo+" stream.processwork(): outcolumns expanded              = " + outcolumnsStr, logcolor)
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

			if (options.debugstream) {
				log.logres("columns translated " + outcolumns.join(","),res)
			}
			if (options.debugstreamconsole) {
				log.logc(options.loginfo+" stream.processwork(): outcolumns translated            = " + outcolumns.join(","), logcolor)
			}
	
			function onlyUnique(value, index, self) { 
			    return self.indexOf(value) === index;
			}
			
			outcolumns = outcolumns.filter(onlyUnique);
	
			if (outcolumns[0] == 1 && options.streamFilterWriteTimeFormat == "2") {
				outcolumns.splice(0,1);
				outcolumns = [1,2,3,4,5,6].concat(outcolumns);
			}
			
			if (options.debugstream) {
				log.logres("Data columns after accounting for WriteTimeFormat = " + outcolumns.join(","), res)
			}
			if (options.debugstreamconsole) {
				log.logc(options.loginfo+" stream.processwork(): outcolumns given WriteTimeFormat = " + outcolumns.join(","), logcolor)
			}
		}

		if (options.debugstreamconsole) {
			log.logc(options.loginfo+" stream.processwork(): streamFilterReadLineRegExp = " + options.streamFilterReadLineRegExp, logcolor)
		}

		function readlines(fnamefull) {

			var line   = ''; 
			var lines  = ''; // Accumulated lines.
			var linesx = ''; // Modified kept lines.

			var lk = 0; // Lines kept.
			var lr = 1; // Lines read.
			
			var fnamesize = -1;

			if (options.debugstreamconsole) {
				log.logc(options.loginfo + " stream.processwork.readlines: Reading lines of " + fnamefull.replace(__dirname+"/",""), logcolor)
			}

			// https://github.com/nickewing/line-reader
			lineReader.eachLine(fnamefull, function(line, last) {

				if (false) {
					var stats = fs.statSync(fnamefull)
	 				var fnamesize = stats["size"]
	 				if (fnamesize != fnamesizelast && fnamesizelast != -1) {
						if (options.debugstreamconsole) {
							log.logc(options.loginfo + " stream.readlines(): writeCache lock status: " + util.writeCache.memLock[fname], 160)
	 						log.logc(options.loginfo + " stream.readlines(): Error: " + fname.replace(/.*\/(.*)/,"$1")+" size has changed while reading.", 160)
	 						log.logc(options.loginfo + " stream.readlines(): Current size: " + fnamesize, 160)
	 						log.logc(options.loginfo + " stream.readlines(): Last size   : " + fnamesizelast, 160)
	 					}	
	 				}
	 				fnamesizelast = fnamesize
 				}

 				if (options.debugstreamconsole) {
					//log.logc(options.loginfo + " stream.processwork.readlines.lineReader: Line: " + line, logcolor)
				}
				
				var stopline = options.streamFilterReadLines;
				if (options.streamFilterReadLines == 0) {
					stopline = Infinity;
				}

				if (lr >= options.streamFilterReadStart) {

					if (lk == stopline) {	
						if (options.debugstream) {
							log.logres("Reached stop line.",res)
						}
						if (options.debugstreamconsole) {
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
					if (options.debugstreamconsole) {
						//log.logc(options.loginfo + " stream.processwork.readlines.lineReader: Line after RegExp: " + line, logcolor)
					}

					if (lineFormatter !== "" && line !== "") {

						if (options.debugstreamconsole && (lr == options.streamFilterReadStart)) {
							log.logc(options.loginfo + " stream.processwork.readlines.lineReader: First processed line before calling formatLine:", logcolor)
							log.logc(options.loginfo + " " + line, logcolor)
						}
						if (options.debugstreamconsole && last) {
							log.logc(options.loginfo + " stream.processwork.readlines.lineReader: Last processed line before calling formatLine:", logcolor)
							log.logc(options.loginfo + " " + line, logcolor)
						}

						// lineformatter returns blank if line is before timerange.
						line = lineFormatter.formatLine(line,options);

						if (options.debugstreamconsole && (lr == options.streamFilterReadStart)) {
							log.logc(options.loginfo + " stream.processwork.readlines.lineReader: First processed line after calling formatLine:", logcolor)
							log.logc(options.loginfo + " " + line, logcolor)

						}
						if (options.debugstreamconsole && last) {
							log.logc(options.loginfo + " stream.processwork.readlines.lineReader: Last processed line after calling formatLine:", logcolor)
							log.logc(options.loginfo + " " + line, logcolor)

						}

						if (line == "END_OF_TIMERANGE") {	
							if (options.debugstream) {
								log.logres("Reached end of time range.", res)
							}
							if (options.debugstreamconsole) {
								log.logc(options.loginfo+" stream.processwork.readlines.lineReader: Reached end of time range.", logcolor)
							}
							// Done processing
							return false
						}

						if (options.debugstreamconsole) {
							//log.logc(options.loginfo + " stream.processwork.readlines.lineReader: Line after lineFormatter: " + line, logcolor)
						}

					}

					if (outcolumns.length > 0 && line !== "") {

						tmparr = line.split(/\s+/g)
						line = ""

						if (options.debugstreamconsole && (lr == options.streamFilterReadStart)) {
							log.logc(options.loginfo+" stream.processwork.readlines.lineReader: Extracting " + tmparr.length + " columns on first line.", logcolor)
						}
						if (options.debugstreamconsole && last) {
							log.logc(options.loginfo+" stream.processwork.readlines.lineReader: Extracting " + tmparr.length + " columns on last line.", logcolor)
						}
						for (var z = 0; z < outcolumns.length-1; z++) {
							line = line + tmparr[outcolumns[z]-1] + " ";
						}
						line = line + tmparr[outcolumns[z]-1];

						if (options.debugstreamconsole) {
							//log.logc(options.loginfo + " stream.processwork.readlines.lineReader: Line after outcolumns: " + line, logcolor)
						}

					}

					if (line !== "") {
						// lineReader only removes trailing \n.  Remove trailing \r.
						lines = lines + line.replace(/\r$/,"") + "\n";
						lk = lk + 1;
					} else {
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
				if (options.debugstreamconsole) {
					log.logc(options.loginfo+" stream.processwork.readlines.lineReader.then(): Called.", logcolor)
				}

				if (options.streamFilterWriteComputeFunction.match(/regrid/)) {
					// Not tested.
					if (options.debugstream) {
						log.logres("stream.js: Calling regrid()", res)
					}
					if (options.debugstreamconsole) {
						log.logc(options.loginfo + " stream.processwork.readlines.lineReader.then(): Calling regrid() with:", logcolor)
						console.log(lines)
					}
					lines = regridfilter.regrid(lines, options)
					if (options.debugstreamconsole) {
						log.logc(options.loginfo + " stream.processwork.readlines.lineReader.then(): regrid() returned:", logcolor)
						console.log(lines)
					}

					// If regrid is requested, stats were not computed.  Compute them here if requested.
					if (options.streamFilterWriteComputeFunction.match(/stats|mean|max|min|std|Nvalid/)) {
						var linesv = lines.join(/\n/)
						var h = options.streamWriteFilterComputeFunctionArgs
						var Nb = Math.floor(linesv.length/h)
						linesx = '';
						if (options.debugstreamconsole) {
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
						if (options.debugstream) {
							log.logres("Last window not full.", res)
						}
						if (options.debugstreamconsole) {
							log.logc(options.loginfo + " stream.processwork.readlines.lineReader.then(): Last window not full.", logcolor)
						}
						linesx = linesx + statsfilter.stats(lines.replace(/\n$/,""), options)
						readcallback("", linesx)
					}
				}
			})
		}
		
		function readcallback(err, data, cachepart) {

			if (options.debugstream) {
				log.logres("Called for " + fname.replace(__dirname+"/",""), res)
			}			
			if (options.debugstreamconsole) {
				log.logc(options.loginfo+" stream.processwork.readcallback(): Called for " + fname.replace(__dirname+"/",""),logcolor)
			}

			if (arguments.length < 3) cachepart = true;
			
			function cachestream(streamfilepart,data) {

				if (options.debugstream) {
					log.logres("Creating " + streamdir.replace(__dirname,""), res)
				}
				if (options.debugstreamconsole) {
					log.logc(options.loginfo+" stream.processwork.readcallback.cachestream(): Creating " + streamdir.replace(__dirname+"/","").replace("/cache/stream/",""), logcolor)
				}

				mkdirp(streamdir, function (err) {

					if (err) {
						log.logc(options.loginfo+" stream.processwork.readcallback.cachestream(): mkdirp error: " + JSON.stringify(err), 160)
					}
					if (options.debugstream) {
						log.logres("Created dir " + streamdir.replace(__dirname+"/","")+streamsignature, res)
					}
					if (options.debugstreamconsole) {
						log.logc(options.loginfo + " stream.processwork.readcallback.cachestream(): Created  " + streamdir.replace(__dirname+"/",""), logcolor)
					}

					if (fs.existsSync(streamfilepartlck)) {
						if (options.debugstreamconsole) {
							log.logc(options.loginfo + " stream.processwork.readcallback.cachestream(): Aborting write because exists: " + streamfilepartlck.replace(__dirname,"").replace("/cache/stream/",""), logcolor)
						}
						return
					}

					if (options.debugstream) {
						log.logres("Writing     " + streamfilepartlck.replace(__dirname,""), res)
					}
					if (options.debugstreamconsole) {
						log.logc(options.loginfo + " stream.processwork.readcallback.cachestream(): Writing  " + streamfilepartlck.replace(streamdir,""), logcolor)
					}
					fs.writeFile(streamfilepartlck,"",function (err) {
						if (options.debugstreamconsole) {
							log.logc(options.loginfo + " stream.processwork.readcallback.cachestream(): Wrote    " + streamfilepartlck.replace(streamdir,""), logcolor)
							log.logc(options.loginfo + " stream.processwork.readcallback.cachestream(): Writing  " + streamfilepart.replace(streamdir,""), logcolor)
						}
						if (options.debugstream) {
							log.logres("Wrote   " + streamfilepartlck.replace(streamdir,""), res)
							log.logres("Writing " + streamfilepart.replace(streamdir,""), res)
						}
						fs.writeFile(streamfilepart,data,function (err) {
							if (options.debugstream) {
								log.logres("Wrote   " + streamfilepart.replace(streamdir,""), res)
							}
							if (options.debugstreamconsole) {
								log.logc(options.loginfo + " stream.processwork.readcallback.cachestream(): Wrote    " + streamfilepart.replace(streamdir,""),logcolor)
							}
							if (options.debugstream) {
								log.logres("Removing    " + streamfilepartlck.replace(__dirname,""), res)
							}
							if (options.debugstreamconsole) {
								log.logc(options.loginfo + " stream.processwork.readcallback.cachestream(): Removing " + streamfilepartlck.replace(streamdir,""), logcolor)
							}								
							fs.unlink(streamfilepart.replace(".gz","")+".lck",function () { 
								if (options.debugstream) {
									log.logres("Removed     " + streamfilepartlck.replace(__dirname,""), res)
								}
								if (options.debugstreamconsole) {
									log.logc(options.loginfo + " stream.processwork.readcallback.cachestream(): Removed  " + streamfilepartlck.replace(streamdir,""), logcolor)
								}	
							})
						})
					})
				})
			}

			if (options.debugstream) {
				log.logres("Decreasing # of stream memory locks from " + stream.streaming[fname] + " to " + (stream.streaming[fname]-1), res)
			}			
			if (options.debugstreamconsole) {
				log.logc(options.loginfo + " stream.processwork.readcallback(): Decreasing # of stream memory locks from " + stream.streaming[fname] + " to " + (stream.streaming[fname]-1), logcolor)
			}
			stream.streaming[fname] = stream.streaming[fname] - 1;
								
			if (err) {
				if (options.debugstream) {
					log.logres("Error: " + err, res)
				}
				if (options.debugstreamconsole) {
					log.logc(options.loginfo + " stream..processwork.readcallback(): Error: " + err, logcolor)
				}
				return res.end()
			}

			if (options.streamFilter === "") {
				if (options.debugstream) {
					log.logres("Writing response.", res)
				}
				if (options.debugstreamconsole) {
					log.logc(options.loginfo + " stream.processwork.readcallback(): Writing response.", logcolor)
				}
				if (!options.streamGzip) {
					if (options.debugstream) {
						log.logres("Sending uncompressed data of length = "+data.length, res)
					}
					if (options.debugstreamconsole) {
						log.logc(options.loginfo + " stream.processwork.readcallback(): Sending uncompressed data of length = "+data.length, logcolor)
					}
					res.write(data)
					finished(inorder)
					zlib.createGzip({level: 1})
					zlib.gzip(data, function (err, buffer) {
						if (err) {
							log.logc(options.loginfo + " stream.processwork.readcallback(): gzip error: " + JSON.stringify(err), 160)
						}
						if (cachepart) {
							if (options.debugstreamconsole) {
								log.logc(options.loginfo + " stream.processwork.readcallback(): Calling cachestream()", logcolor)
							}
							cachestream(streamfilepart,buffer)
						}
					})
				} else {
					if (options.debugstream) {
						log.logres("Compressing buffer of length "+data.length, res)
					}
					if (options.debugstreamconsole) {
						log.logc(options.loginfo + " stream.processwork.readcallback(): Compressing buffer of length "+data.length, logcolor)
					}
					zlib.createGzip({level:1})
					zlib.gzip(data, function (err, buffer) {
						if (err) {
							log.logc(options.loginfo + " stream.processwork.readcallback(): gzip error: " + JSON.stringify(err), 160)
						}
						if (options.debugstream) {
							log.logres("Compression finished. Sending buffer of length "+buffer.length, res)
						}	
						if (options.debugstreamconsole) {
							log.logc(options.loginfo + " stream.processwork.readcallback(): Compression finished. Sending buffer of length "+buffer.length,logcolor)
						}	
						res.write(buffer);
						if (cachepart) {
							if (options.debugstreamconsole) {
								log.logc(options.loginfo + " stream.processwork.readcallback(): Calling cachestream()", logcolor)
							}
							cachestream(streamfilepart,buffer)
						}
						finished(inorder)
					})
				}

			} else {	
				try {
					eval("data = data.toString()."+options.streamFilter)
					if (!options.streamGzip) {
						res.write(data)
						if (cachepart) {
							cachestream(streamfilepart,data)
						}
						finished(inorder)
					} else {
						var tic = new Date()
						zlib.createGzip({level: 1})
						zlib.gzip(data, function (err, buffer) {
							reqstatus[rnd].dt = new Date()-tic
							if (options.debugstream) {
								log.logres("gzip callback event", res)
								log.logres("Writing compressed buffer", res)
							}
							if (options.debugstreamconsole) {
								log.logc(options.loginfo + " stream.processwork.readcallback(): gzip callback event", logcolor)
								log.logc(options.loginfo + " stream.processwork.readcallback(): Writing compressed buffer", logcolor)
							}
							res.write(buffer)
							reqstatus[rnd].gzipping = reqstatus[rnd].gzipping - 1
							if (cachepart) cachestream(streamfilepart,buffer)
							finished(inorder)
						})
					}
				} catch (err) {
					if (options.debugstream) {
						log.logres("Error when evaluating " + options.streamFilter, res)
					}
					if (options.debugstreamconsole) {
						log.logc(options.loginfo + " stream.processwork.readcallback(): Error when evaluating " + options.streamFilter, logcolor)
					}
					finished(inorder)
				}
			}
		}
	}
}
exports.stream = stream;
