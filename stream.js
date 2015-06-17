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
	var lineFormatter = require(__dirname + "/plugins/formattedTime.js");

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
	
	var plugin = scheduler.getPlugin(options,source[0])
	var filterSignature = ""; 
	
	if (options.streamFilterComputeFunction.match(/stats|mean|max|min|std|Nvalid/)) {
		if (options.debugstream) {
			log.logres(options.loginfo+", Reading ./filters/stats.js",res);
		}
		if (options.debugstreamconsole) {
			log.logc(options.loginfo+" stream.js: Reading ./filters/stats.js",logcolor)
		}
		var statsfilter = require("./filters/stats.js");
		filterSignature = filterSignature + statsfilter.filterSignature(options);
	}

	if (options.streamFilterComputeFunction.match(/regrid/)) {
		if (options.debugstream) {
			log.logres("Reading ./filters/regrid.js",res);
		}
		if (options.debugstreamconsole) {
			log.logc(options.loginfo+" stream.js: Reading ./filters/regrid.js",logcolor)
		}
		var regridfilter = require("./filters/regrid.js");
		filterSignature = filterSignature + regridfilter.filterSignature(options);
	}
	
	extractSignature = source.join(",");	
	if (plugin.extractSignature) extractSignature = extractSignature + plugin.extractSignature(options);
	if (options.debugstream) {
		log.logres("plugin signature md5: " + util.md5(extractSignature), res)
	}
	if (options.debugstreamconsole) {
		log.logc(options.loginfo+" stream.js: plugin signature: " + util.md5(extractSignature),logcolor)
	}

	//if (filter.filterSignature) filterSignature = filter.filterSignature(options);
	//if (options.debugapp) if (options.debugstreamconsole) log.logc(options.loginfo+" filter signature: " + filterSignature);

	var streamsignature   = util.md5(extractSignature + 
									filterSignature +
									options.timeRangeExpanded + 
									options.streamFilterReadBytes +
								    options.streamFilterReadLines + 
								    options.streamFilterReadPosition +
								    options.streamFilterTimeFormat +
								    options.streamFilterReadColumns);

	var streamdir         = __dirname +"/cache/stream/"+source[0].split("/")[2]+"/"+streamsignature+"/";
	var streamfilecat     = streamdir + streamsignature + ".stream.gz";
	var streamfilecatlck  = streamfilecat.replace("stream.gz","lck");
	
	if (options.debugstream || options.debugstreamconsole) {
		if (!fs.existsSync(streamfilecat)) {
			if (options.debugstream) log.logres("streamfilecat !exists /cache/stream/" + streamfilecat.replace(streamdir,""),res)
			if (options.debugstreamconsole) log.logc(options.loginfo+" stream.js: streamfilecat !exists /cache/stream/" + streamfilecat.replace(streamdir,""),logcolor)
		} else {
			if (options.debugstream) log.logres("streamfilecat exists /cache/stream/" + streamfilecat.replace(streamdir,""),res)
			if (options.debugstreamconsole) log.logc(options.loginfo+" stream.js: streamfilecat exists /cache/stream/" + streamfilecat.replace(streamdir,""),logcolor)
		}
		if (!fs.existsSync(streamfilecatlck)) {
			if (options.debugstream) log.logres("streamfilecatlck !exists /cache/stream/" + streamfilecatlck.replace(streamdir,""),res)
			if (options.debugstreamconsole) log.logc(options.loginfo+" stream.js: streamfilecatlck !exists /cache/stream/" + streamfilecatlck.replace(streamdir,""),logcolor);
		} else {
			if (options.debugstream) log.logres("streamfilecatlck exists /cache/stream/" + streamfilecatlck.replace(streamdir,""),res)
			if (options.debugstreamconsole) log.logc(options.loginfo+" stream.js: streamfilecatlck exists /cache/stream/" + streamfilecatlck.replace(streamdir,""),logcolor);
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
		if (options.debugstream) {
			log.logres("Incremening Nx from " + reqstatus[rnd].Nx + " to " + (reqstatus[rnd].Nx+1),res)
		}
		if (options.debugstreamconsole) {
			log.logc(rnd+ " stream.finished(): Incremening Nx from " + reqstatus[rnd].Nx + " to " + (reqstatus[rnd].Nx+1),logcolor)
		}
		reqstatus[rnd].Nx = reqstatus[rnd].Nx + 1;

		if ((reqstatus[rnd].Nx < N) && (inorder)) {
			if (options.debugstream) {
				log.logres("Processing next URL.",res)
			}
			if (options.debugstreamconsole) {
				log.logc(rnd+ " Processing next URL.",logcolor)
			}
			scheduler.addURL(source[reqstatus[rnd].Nx], options, function (work) {processwork(work,true)});
		}

		if (N == reqstatus[rnd].Nx) {
			if (options.debugstream) {
				log.logres("Sending res.end().",res)
			}
			if (options.debugstreamconsole) {
				log.logc(rnd+" stream.finished(): Sending res.end().",logcolor)
			}
			res.end();
		}
	}

	function processwork(work, inorder) {
		//console.log(work)
		var fname = util.getCachePath(work);
		var streamfilepart = streamdir+work.urlMd5+".stream.gz";
		var streamfilepartlck = streamdir+work.urlMd5+".stream.lck";

		if (work.error) {
			if (options.debugstream) {
				log.logres("work.error.  Calling finished() and not sending data.",res)
			}
			if (options.debugstreamconsole) {
				log.logc(rnd+ " stream.processwork():  work.error.  Calling finished() and not sending data.",logcolor)
			}
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
							log.logc(rnd+" stream.processwork():  File is locked by util.writeCache.  Trying again in 100 ms.",logcolor)
						}
					}
					setTimeout(function () {processwork(work,inorder)},100)
					return
				}
			}
		}

		if (!stream.streaming[fname]) {
			if (options.debugstream) {
				log.logres("Stream locking " + fname.replace(__dirname,""), res);
			}
			if (options.debugstreamconsole) {
				log.logc(rnd+" stream.processwork(): Stream locking " + fname.replace(__dirname,""),logcolor)
			}
			stream.streaming[fname] = 1;
		} else {
			if (options.debugstream) {
				log.logres("Stream locking " + fname.replace(__dirname,""),res);
			}
			if (options.debugstreamconsole) {
				log.logc(rnd+" stream.processwork(): Stream locking " + fname.replace(__dirname,""),logcolor)
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
				log.logres("Checking if stream part exists: " + streamfilepart.replace(__dirname,""),res)
			}
			if (options.debugstreamconsole) {
				log.logc(options.loginfo+" stream.processwork(): Checking if stream part exists: " + streamfilepart.replace(__dirname,""),logcolor)
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
						log.logres("Removing " + streamfilepartlck.replace(__dirname,""),res)
					}
					if (options.debugstreamconsole) {
						log.logc(options.loginfo+" stream.processwork(): Removing " + streamfilepartlck.replace(__dirname,""),logcolor)
					}
					fs.unlink(streamfilepartlck)
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
				log.logc(rnd+" stream.processwork():  Reading Bytes of "+ fname.replace(__dirname,""),logcolor)
				log.logc(rnd+" stream.processwork():  Stream lock status " + stream.streaming[fname],logcolor)
			}

			var buffer = new Buffer(options.streamFilterReadBytes);
			if (options.debugstream) {
				log.logres("fs.exist: " + fs.existsSync(fname + ".data"),res);
			}
			if (options.debugstreamconsole) {
				log.logc(rnd+" stream.processwork():  fs.exist: " + fs.existsSync(fname + ".data"),logcolor)
			}

			fs.open(fname + ".data", 'r', function (err,fd) {
				//logger.d("stream.processwork(): ", "error:", err, "fd:", fd, fd==undefined,  "readbytes:", options.streamFilterReadBytes, "readPosition:", options.streamFilterReadPosition);
			    fs.read(fd, buffer, 0, options.streamFilterReadBytes, options.streamFilterReadPosition-1, 
			    		function (err, bytesRead, buffer) {
			    			readcallback(err,buffer);
			    			fs.close(fd);
			    		})})
		} else if (options.streamFilterReadLines > 0 || options.streamFilterReadColumns !== "0" ) {
		    if (options.debugstream) {
		    	log.logres("Reading lines of "+ fname.replace(__dirname,"") + ".data",res)
		    }
	    	if (options.debugstreamconsole) {
	    		log.logc(rnd+" stream.processwork(): Calling readlines() with "+ fname.replace(__dirname,"") + ".data",logcolor)
	    	}
			readlines(fname + ".data")
		} else {	
		    if (options.debugstream) {
		    	log.logres("Reading all of "+fname.replace(__dirname,""),res)
		    }
	    	if (options.debugstreamconsole) {
	    		log.logc(rnd+" stream.processwork(): Reading all of "+fname.replace(__dirname,""),logcolor)
	    	}
			// Should be no encoding if streamFilterBinary was given.
			fs.readFile(fname + ".data", "utf8", readcallback);
		}

		if (options.streamFilterReadColumns !== "0") {

			var outcolumnsStr = options.streamFilterReadColumns.split(/,/);
			var outcolumns = [];

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
				log.logres("outformat requested " + options.streamFilterTimeFormat,res)
				log.logres("timecolumns " + options.req.query.timecolumns,res)
				log.logres("columns requested " + outcolumnsStr,res)
			}
			if (options.debugstreamconsole) {
				log.logc(options.loginfo+" stream.processwork(): outformat requested " + options.streamFilterTimeFormat,logcolor)
				log.logc(options.loginfo+" stream.processwork(): timecolumns " + options.req.query.timecolumns,logcolor)
				log.logc(options.loginfo+" stream.processwork(): columns requested " + outcolumnsStr,logcolor)				
			}
		
			if (work.plugin.columnTranslator) {
				// The plugin may have changed the number of columns by reformatting time.
				for (var z = 0;z < outcolumnsStr.length; z++) {
					outcolumns[z] = work.plugin.columnTranslator(parseInt(outcolumnsStr[z]),options);
				}		
			} else {
				for (var z = 0;z < outcolumnsStr.length; z++) {
					outcolumns[z] = lineFormatter.columnTranslator(parseInt(outcolumnsStr[z]),options);
				}
			}
			if (options.debugstream) {
				log.logres("columns translated " + outcolumns.join(","),res)
			}
			if (options.debugstreamconsole) {
				log.logc(options.loginfo+" stream.processwork(): columns translated " + outcolumns.join(","),logcolor)
			}
	
			function onlyUnique(value, index, self) { 
			    return self.indexOf(value) === index;
			}
			
			// Remove non-unique columns (plugin may define all time columns to be the first column). 
			outcolumns = outcolumns.filter(onlyUnique);
	
			if (outcolumns[0] == 1 && options.streamFilterTimeFormat == "2") {
				outcolumns.splice(0,1);
				outcolumns = [1,2,3,4,5,6].concat(outcolumns);
			}
			
			if (options.debugstream) {
				log.logres("columns final " + outcolumns.join(","),res)
			}
			if (options.debugstreamconsole) {
				log.logc(options.loginfo+" stream.processwork(): columns final " + outcolumns.join(","),logcolor)
			}
		}


		function readlines(fnamefull) {

			var line   = ''; 
			var lines  = ''; // Accumulated lines.
			var linesx = ''; // Modified kept lines.

			var lk = 0; // Lines kept.
			var lr = 1; // Lines read.
			
			var fnamesize = -1;

			if (options.debugstreamconsole) {
				log.logc(options.loginfo + " Reading lines of " + fnamefull.replace(__dirname,""), logcolor)
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
					if (lr == 1) {
						log.logc(options.loginfo + " First line: " + line, logcolor)
					} else if (last) {
						log.logc(options.loginfo + " Last line: " + line, logcolor)
					} else {
						log.logc(options.loginfo + " Line: " + line, logcolor)
					}
				}
				
				var stopline = options.streamFilterReadLines;
				if (options.streamFilterReadLines == 0) {
					stopline = Infinity;
				}

				if (lr >= options.streamFilterReadPosition) {

					if (lk == stopline) {	
						if (options.debugstream) {
							log.logres("Reached stop line.",res)
							log.logres(options.loginfo + " stream.readlines(): Line: " + line, res)
						}
						if (options.debugstreamconsole) {
							log.logc(options.loginfo+" stream.readlines(): Reached stop line.",logcolor)
							log.logc(options.loginfo + " stream.readlines(): Line: " + line, logcolor)
						}
						return false
					}
					
					if (options.streamFilterReadColumns !== "0") {

						if (options.debugstream && (lr == 1 || last)) {
							log.logres("Before calling formatLine: " + line, res)
						}
						if (options.debugstreamconsole && lr == 1) {
							log.logc(options.loginfo + " Before calling formatLine: " + line, logcolor)
						}

						line = lineFormatter.formatLine(line,options);

						if (options.debugstream && (lr == 1 || last)) {
							log.logres("After calling formatLine: " + line, res)
						}						
						if (options.debugstreamconsole && (lr == 1 || last)) {
							log.logc(options.loginfo + " After calling formatLine: " + line, logcolor)
						}

						if (line == "END_OF_TIMERANGE") {	
							if (options.debugstream) {
								log.logres("Reached end of time range.", res)
							}
							if (options.debugstreamconsole) {
								log.logc(options.loginfo+" stream.readlines(): Reached end of time range.", logcolor)
							}
							return false
						}

						if (options.debugstreamconsole && (lr == 1 || last)) {
							log.logc(options.loginfo+" stream.readlines(): Splitting line on \\s+", logcolor)
						}
						
						tmparr = line.split(/\s+/g)
						line = ""

						if (options.debugstreamconsole && (lr == 1 || last)) {
							log.logc(options.loginfo+" stream.readlines(): Line has " + tmparr.length + " elements.", logcolor)
						}
						if (options.debugstreamconsole && (lr == 1 || last)) {
							log.logc(options.loginfo+" stream.readlines(): Extracting outcolumns.", logcolor)
						}
						for (var z = 0;z < outcolumns.length-1; z++) {
							line = line + tmparr[outcolumns[z]-1] + " ";
						}

						line = line + tmparr[outcolumns[z]-1];

					}

					// lineReader only removes trailing \n.  Remove trailing \r.
					line = line.replace(/\r$/,"")
					if (!line.match("undefined")) {
						lines = lines + line + "\n";
					} else {
						console.log("line is undefined.")
					}

					lk = lk + 1;

					if (options.streamFilterComputeFunction.match(/stats|mean|max|min|std|Nvalid/)) {
						if (!options.streamFilterComputeFunction.match(/regrid/)) {
							if (lk % options.streamFilterComputeWindow == 0) {
								linesx = linesx + statsfilter.stats(lines.replace(/\n$/,""),options)
								lines = ''
							}
						}
					}
					
				}
				lr = lr+1;
			}).then(function () {
				if (options.debugstreamconsole) {
					log.logc(options.loginfo+" stream.readlines(): lineReader.eachLine.then() called.", logcolor)
				}

				if (options.streamFilterComputeFunction.match(/regrid/)) {
					// Not tested.
					if (options.debugstream) {
						log.logres("stream.js: Calling regrid()", res)
					}
					if (options.debugstreamconsole) {
						log.logc(options.loginfo + " stream.readlines(): stream.js: Calling regrid() with:", logcolor)
						console.log(lines)
					}
					lines = regridfilter.regrid(lines, options)
					if (options.debugstreamconsole) {
						log.logc(options.loginfo + " stream.readlines(): stream.js: regrid() returned:", logcolor)
						console.log(lines)
					}

					// If regrid is requested, stats were not computed.  Compute them here if requested.
					if (options.streamFilterComputeFunction.match(/stats|mean|max|min|std|Nvalid/)) {
						var linesv = lines.join(/\n/)
						var h = options.streamFilterComputeWindow
						var Nb = Math.floor(linesv.length/h)
						linesx = '';
						if (options.debugstreamconsole) {
							log.logc(options.loginfo + " stream.readlines(): stream.js: Nblocks = " + Nb, logcolor)
							log.logc(options.loginfo + " stream.readlines(): stream.js: Block height = " + h, logcolor)
						}
						for (var b = 0; b < Nb-1;b++) {
							linesx = linesx + statsfilter.stats(linesv.slice(b*h,(b+1)*h).join(/\n/).replace(/\n$/,""),options)
						}
						readcallback("", linesx);
					} else {
						readcallback("", lines);
					}
					return
				}

				if (linesx === '') {
					readcallback("",lines)
				} else {
					if (lines === '') {
						readcallback("",linesx)
					} else {
						if (options.debugstream) {
							log.logres("Last window not full.", res)
						}
						if (options.debugstreamconsole) {
							log.logc(options.loginfo+" stream.readlines(): Last window not full.", logcolor)
						}
						linesx = linesx + statsfilter.stats(lines.replace(/\n$/,""), options)
						readcallback("",linesx)
					}
				}
			})
		}
		
		function readcallback(err, data, cachepart) {

			if (options.debugstream) {
				log.logres("Called for " + fname.replace(__dirname,""), res)
			}			
			if (options.debugstreamconsole) {
				log.logc(options.loginfo+" stream.readcallback(): Called for " + fname.replace(__dirname,""),logcolor)
			}

			if (arguments.length < 3) cachepart = true;
			
			function cachestream(streamfilepart,data) {

				if (options.debugstream) {
					log.logres("Creating " + streamdir.replace(__dirname,""), res)
				}
				if (options.debugstreamconsole) {
					log.logc(options.loginfo+" stream.readcallback.cachestream(): Creating    " + streamdir.replace(__dirname,""), logcolor)
				}

				mkdirp(streamdir, function (err) {

					//var streamfilepartlck = streamfilepart.replace(".gz","")+".lck"

					if (err) {
						log.logc(options.loginfo+" stream.readcallback.cachestream(): mkdirp error: " + JSON.stringify(err), 160)
					}
					if (options.debugstream) {
						log.logres("Created dir " + streamdir.replace(__dirname,"")+streamsignature, res)
					}
					if (options.debugstreamconsole) {
						log.logc(options.loginfo+" stream.readcallback.cachestream(): Created     " + streamdir.replace(__dirname,""), logcolor)
					}

					if (fs.existsSync(streamfilepartlck)) {
						if (options.debugstreamconsole) {
							log.logc(options.loginfo+" stream.readcallback.cachestream(): Aborting write because exists: " + streamfilepartlck.replace(__dirname,""), logcolor)
						}
						return
					}

					if (options.debugstream) {
						log.logres("Writing     " + streamfilepartlck.replace(__dirname,""), res)
					}
					if (options.debugstreamconsole) {
						log.logc(options.loginfo+" stream.readcallback.cachestream(): Writing     " + streamfilepartlck.replace(__dirname,""), logcolor)
					}
					fs.writeFile(streamfilepartlck,"",function (err) {
						if (options.debugstreamconsole) {
							log.logc(options.loginfo+" stream.readcallback.cachestream(): Wrote       " + streamfilepartlck.replace(__dirname,""), logcolor)
							log.logc(options.loginfo+" stream.readcallback.cachestream(): Writing     " + streamfilepart.replace(__dirname,""), logcolor)
						}
						if (options.debugstream) {
							log.logres("Wrote       " + streamfilepartlck.replace(__dirname,""), res)
							log.logres("Writing     " + streamfilepart.replace(__dirname,""), res)
						}
						fs.writeFile(streamfilepart,data,function (err) {
							if (options.debugstream) {
								log.logres("Wrote       "+streamfilepart.replace(__dirname,""), res)
							}
							if (options.debugstreamconsole) {
								log.logc(options.loginfo+" stream.readcallback.cachestream(): Wrote       " + streamfilepart.replace(__dirname,""),logcolor)
							}
							if (options.debugstream) {
								log.logres("Removing    " + streamfilepartlck.replace(__dirname,""), res)
							}
							fs.unlink(streamfilepart.replace(".gz","")+".lck",function () { 
								if (options.debugstream) {
									log.logres("Removed     " + streamfilepartlck.replace(__dirname,""), res)
								}
								if (options.debugstreamconsole) {
									log.logc(options.loginfo+" stream.readcallback.cachestream(): Removed     " + streamfilepartlck.replace(__dirname,""), logcolor)
								}								
							})
						})
					})
				})
			}

			if (options.debugstream) {
				log.logres("Decreasing # of stream locks on " + fname.replace(__dirname,"") + " from " + stream.streaming[fname] + " to " + (stream.streaming[fname]-1), res)
			}			
			if (options.debugstreamconsole) {
				log.logc(options.loginfo+" stream.readcallback(): Decreasing # of stream locks on " + fname.replace(__dirname,"") + " from " + stream.streaming[fname] + " to " + (stream.streaming[fname]-1),logcolor)
			}
			stream.streaming[fname] = stream.streaming[fname] - 1;
								
			if (err) {
				if (options.debugstream) {
					log.logres("Error: " + err, res)
				}
				if (options.debugstreamconsole) {
					log.logc(rnd+" stream.readcallback(): Error: " + err,logcolor)
				}
				return res.end()
			}

			//var streamfilepart = streamdir+reqstatus[rnd].Nx+".stream.gz";

			if (options.streamFilter === "") {
				if (options.debugstream) {
					log.logres("Writing response.", res)
				}
				if (options.debugstreamconsole) {
					log.logc(rnd+" stream.readcallback(): Writing response.",logcolor)
				}
				if (!options.streamGzip) {
					if (options.debugstream) {
						log.logres("Sending uncompressed data of length = "+data.length, res)
					}
					if (options.debugstreamconsole) {
						log.logc(rnd+" stream.readcallback(): Sending uncompressed data of length = "+data.length, logcolor)
					}
					res.write(data)
					finished(inorder)
					zlib.createGzip({level:1})
					zlib.gzip(data, function (err, buffer) {
						if (err) {
							log.logc(rnd+" stream.readcallback(): gzip error: " + JSON.stringify(err), 160)
						}
						if (cachepart) {
							if (options.debugstreamconsole) {
								log.logc(rnd+" stream.readcallback(): Calling cachestream()", logcolor)
							}
							cachestream(streamfilepart,buffer)
						}
					})
				} else {
					if (options.debugstream) {
						log.logres("Compressing buffer of length "+data.length, res)
					}
					if (options.debugstreamconsole) {
						log.logc(options.loginfo+" stream.readcallback(): Compressing buffer of length "+data.length, logcolor)
					}
					zlib.createGzip({level:1})
					zlib.gzip(data, function (err, buffer) {
						if (err) {
							log.logc(options.loginfo+" stream.readcallback(): gzip error: " + JSON.stringify(err), 160)
						}
						if (options.debugstream) {
							log.logres("Compression finished. Sending buffer of length "+buffer.length, res)
						}	
						if (options.debugstreamconsole) {
							log.logc(options.loginfo+" stream.readcallback(): Compression finished. Sending buffer of length "+buffer.length,logcolor)
						}	
						res.write(buffer);
						if (cachepart) {
							if (options.debugstreamconsole) {
								log.logc(rnd+" stream.readcallback(): Calling cachestream()", logcolor)
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
								log.logc(rnd+ " stream.readcallback(): gzip callback event", logcolor)
								log.logc(rnd+ " stream.readcallback(): Writing compressed buffer", logcolor)
							}
							res.write(buffer)
							reqstatus[rnd].gzipping = reqstatus[rnd].gzipping - 1;
							if (cachepart) cachestream(streamfilepart,buffer)
							finished(inorder)
						})
					}
				} catch (err) {
					if (options.debugstream) {
						log.logres("Error when evaluating " + options.streamFilter, res)
					}
					if (options.debugstreamconsole) {
						log.logc(rnd+" stream.readcallback(): Error when evaluating " + options.streamFilter, logcolor)
					}
					finished(inorder);
				}
			}
		}
	}
}
exports.stream = stream;
