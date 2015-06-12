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
	
	if (options.streamFilterComputeFunction.match(/stats|mean|max|min|std|Nvalid/)) {
		if (options.debugstream) {
			log.logres(options.loginfo+", Reading ./filters/stats.js",res);
		}
		if (options.debugstreamconsole) {
			log.logc(options.loginfo+" stream.js: Reading ./filters/stats.js",logcolor)
		}
		var filter = require("./filters/stats.js");
	}

	if (options.streamFilterComputeFunction.match(/regrid/)) {
		if (options.debugstream) {
			log.logres("Reading ./filters/regrid.js",res);
		}
		if (options.debugstreamconsole) {
			log.logc(options.loginfo+" stream.js: Reading ./filters/regrid.js",logcolor)
		}

		var filter = require("./filters/regrid.js");
	}
	
	extractSignature = source.join(",");	
	if (plugin.extractSignature) extractSignature = extractSignature + plugin.extractSignature(options);
	if (options.debugstream) {
		log.logres("plugin signature md5: " + util.md5(extractSignature), res)
	}
	if (options.debugstreamconsole) {
		log.logc(options.loginfo+" stream.js: plugin signature: " + util.md5(extractSignature),logcolor)
	}

	filterSignature = ""; 
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

	var streamdir         = __dirname +"/cache/stream/"+source[0].split("/")[2]
							+"/"+streamsignature+"/";
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
				log.logc(rnd+ "Processing next URL.",logcolor)
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

	function processwork(work,inorder) {
		var fname = util.getCachePath(work);

		//TODO: Check if part exists. 
		if (work.error) {
			//if (options.debugstreamconsole) log.logc(rnd+ " Sending res.end() because of work.error: ", work.error);
			//return res.end();
			//readcallback("","")
			if (options.debugstream) {
				log.logres("work.error.  Calling finished().",res)
			}
			if (options.debugstreamconsole) {
				log.logc(rnd+ " stream.processwork():  work.error.  Calling finished().",logcolor)
			}
			finished(inorder);
			return;
		}

		//console.log(typeof(util.writeCache.memLock[fname]))
		// See if util.writeCache is writing the file.
		if (typeof(util.writeCache.memLock) != "undefined") {
			if (typeof(util.writeCache.memLock[fname]) != "undefined") {
				if (util.writeCache.memLock[fname] > 0) {
					//if (options.debugstream)
					if (options.debugstream) { 
						log.logres("File is locked.  Trying again in 100 ms.",res);
						if (options.debugstreamconsole) {
							log.logc(rnd+" stream.processwork():  File is locked.  Trying again in 100 ms.",logcolor)
						}
					}
					setTimeout(function () {processwork(work,inorder)},100);
					return;
				}
			}
		}

		if (!stream.streaming[fname]) {
			if (options.debugstream) {
				log.logres("Stream locking " + fname.replace(__dirname,""),res);
			}
			if (options.debugstreamconsole) {
				log.logc(rnd+" stream.processwork():  Stream locking " + fname.replace(__dirname,""),logcolor)
			}
			stream.streaming[fname] = 1;
		} else {
			if (options.debugstream) {
				log.logres("Stream locking " + fname.replace(__dirname,""),res);
			}
			if (options.debugstreamconsole) {
				log.logc(rnd+" stream.processwork():  Stream locking " + fname.replace(__dirname,""),logcolor)
			}
			stream.streaming[fname] = stream.streaming[fname] + 1;
		}

		var streamfilepart = streamdir+streamsignature+"/"+reqstatus[rnd].Nx+".stream.gz";
		var streamfilepartlck = streamdir+streamsignature+"/"+reqstatus[rnd].Nx+".stream.lck";

		if (fs.existsSync(streamfilepartlck)) {
			if (options.debugstream) {
				log.logres("streamfilepartlck exists: "+streamfilepartlck,res);
			}
			if (options.debugstreamconsole) {
				log.logc(options.loginfo+" stream.processwork():  streamfilepartlck exists: "+streamfilepartlck,logcolor)
			}
		}

		// Use cached version of part if exists and options allow it.
		if (!fs.existsSync(streamfilepartlck) && !options.forceWrite && !options.forceUpdate) {
			if (options.debugstream) {
				log.logres("Checking if stream part exists: " + streamfilepart.replace(__dirname,""),res)
			}
			if (options.debugstreamconsole) {
				log.logc(options.loginfo+" stream.processwork():  Checking if stream part exists: " + streamfilepart.replace(__dirname,""),logcolor)
			}

			if (fs.existsSync(streamfilepart)) {
				if (options.debugstream) {
					log.logres("It does.  Locking it.",res);
				}
				if (options.debugstreamconsole) {
					log.logc(options.loginfo+" stream.processwork():  It does.  Locking it.",logcolor)
				}
				fs.writeFileSync(streamfilepartlck,"")
				if (options.streamGzip == false) {
					if (options.debugstream) {
						log.logres("Unzipping it.",res)
					}
					if (options.debugstreamconsole) {
						log.logc(options.loginfo+" stream.processwork():  Unzipping it.",logcolor)
					}

					var streamer = fs.createReadStream(streamfilepart).pipe(zlib.createGunzip());
				} else {
					if (options.debugstream) {
						log.logres("Sending raw.",res);
					}
					if (options.debugstreamconsole) {
						log.logc(options.loginfo+" stream.processwork():  Sending raw.",logcolor)
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
					log.logc(options.loginfo+" stream.processwork():  Streaming it.",logcolor)
				}
				streamer.pipe(res,{ end: false })
				return;
			} else {
				if (options.debugstream) {
					log.logres("It does not.",res)
				}
				if (options.debugstreamconsole) {
					log.logc(options.loginfo+" stream.processwork():  It does not.",logcolor)
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
		    	log.logres("Reading lines of "+ fname.replace(__dirname,""),res)
		    }
	    	if (options.debugstreamconsole) {
	    		log.logc(rnd+" stream.processwork():  Reading lines of "+ fname.replace(__dirname,""),logcolor)
	    	}
			readline(fname + ".data")
		} else {	
		    if (options.debugstream) {
		    	log.logres("Reading all of "+fname.replace(__dirname,""),res)
		    }
	    	if (options.debugstreamconsole) {
	    		log.logc(rnd+" stream.processwork():  Reading all of "+fname.replace(__dirname,""),logcolor)
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
				log.logc(options.loginfo+" stream.processwork():  columns translated " + outcolumns.join(","),logcolor)
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

		var line   = '';
		var lines  = '';
		var linesx = ''; // Modified kept lines.
		var linesa = ''; // Accumulated lines.

		var lr = 0; // Lines kept.
		var k = 1;  // Lines read.
		
		var done = false;
		var fnamesize = -1;

		function readline(fnamefull) {	
			lineReader.eachLine(fnamefull, function(line, last) {

				if (false) {
					var stats = fs.statSync(fnamefull);
	 				var fnamesize = stats["size"];
	 				if (fnamesize != fnamesizelast && fnamesizelast != -1) {
						if (options.debugstreamconsole) {
							log.logc(options.loginfo + " stream.readline(): writeCache lock status: " + util.writeCache.memLock[fname],logcolor)
	 						log.logc(options.loginfo + " stream.readline(): Error: "+fname.replace(/.*\/(.*)/,"$1")+" size has changed while reading.",logcolor)
	 						log.logc(options.loginfo + " stream.readline(): Current size: "+fnamesize,logcolor)
	 						log.logc(options.loginfo + " stream.readline(): Last size   : "+fnamesizelast,logcolor)
	 					}	
	 				}
	 				fnamesizelast = fnamesize;
 				}

				if (done) {
					return "";
				}
				
				var stopline = options.streamFilterReadLines;
				if (options.streamFilterReadLines == 0) {
					stopline = Infinity;
				}

				if (k >= options.streamFilterReadPosition) {				  		
					if (lr == stopline) {	
						if (options.debugstream) {
							log.logres("Callback due to reaching stop line",res)
						}
						if (options.debugstreamconsole) {
							log.logc(options.loginfo+" stream.readline(): Callback due to reaching stop line",logcolor)
						}
						readcallback("",lines);
						lines = "";
						done = true;
					}
					
					if (options.streamFilterReadColumns !== "0") {
						
						//if (options.debugstream) if (options.debugstreamconsole) log.logc("Before " + line)
						line = lineFormatter.formatLine(line,options);
						//if (options.debugstream) if (options.debugstreamconsole) log.logc("After " + line)
						
						if (line == "END_OF_TIMERANGE") {	
							if (options.debugstream) {
								log.logres("Callback due to end of time range",res)
							}
							if (options.debugstreamconsole) {
								log.logc(options.loginfo+" stream.readline(): Callback due to end of time range",logcolor)
							}
							readcallback("",lines)
							lines = ""
							done = true
							return;
						}

						tmparr = line.split(/\s+/g);
						line = "";

						for (var z = 0;z < outcolumns.length; z++) {
							line = line + tmparr[outcolumns[z]-1] + " ";
						}							
					}

					line = line.substring(0,line.length-1);

					if (!line.match("undefined")) {
						lines = lines + line + "\n";
						linesa = linesa + line + "\n";
					}

					lr = lr + 1;

					if (options.streamFilterComputeFunction.match(/stats|mean|max|min|std|Nvalid/)) {
						if (lr % options.streamFilterComputeWindow == 0) {
							linesx = linesx + filter.stats(linesa.replace(/\n$/,""),options)
							linesa = ''
						}
					}
					
				}
				k = k+1;
			}).then(function () {
				if (!done) {
					if (options.streamFilterComputeFunction.match(/stats|mean|max|min|std|Nvalid/) && linesx !== '') {
						if (options.debugstream) {
							log.logres("Last window not full.", res)
						}
						if (options.debugstreamconsole) {
							log.logc(options.loginfo+" stream.readline(): Last window not full.", logcolor)
						}
						linesx = linesx + filter.stats(linesa.replace(/\n$/,""), options)
						readcallback("",linesx)
					} else {
						if (options.streamFilterComputeFunction.match(/regrid/) && lines !== '') {
							if (options.debugstream) {
								log.logres("stream.js: Calling regrid()", res)
							}
							if (options.debugstreamconsole) {
								log.logc(options.loginfo + " stream.readline(): stream.js: Calling regrid()", logcolor)
							}
							lines = filter.regrid(lines, options)
						}
						readcallback("", lines);
					}
				}
			});
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
					log.logres("Creating " + streamdir.replace(__dirname,"")+streamsignature, res)
				}
				if (options.debugstreamconsole) {
					log.logc(options.loginfo+" stream.readcallback(): Creating " + streamdir.replace(__dirname,"")+streamsignature, logcolor)
				}

				mkdirp(streamdir+streamsignature, function (err) {
					if (err) log.logc(options.loginfo+" stream.readcallback(): mkdirp error: " + JSON.stringify(err), 160)
					if (options.debugstream) {
						log.logres("Created " + streamdir.replace(__dirname,"")+streamsignature, res)
					}
					if (options.debugstreamconsole) {
						log.logc(options.loginfo+" stream.readcallback(): Created " + streamdir.replace(__dirname,"")+streamsignature, logcolor)
					}
					// TODO: Check if 0.stream.lck,etc. exists.
					if (options.debugstream) {
						log.logres("Writing "+streamfilepart.replace(".gz","").replace(__dirname,"")+".lck", res)
					}
					if (options.debugstreamconsole) {
						log.logc(options.loginfo+" stream.readcallback(): Writing "+streamfilepart.replace(".gz","").replace(__dirname,"")+".lck", logcolor)
					}
					fs.writeFile(streamfilepart.replace(".gz","")+".lck","",function (err) {
						if (options.debugstream) {
							log.logc("Wrote   "+streamfilepart.replace(".gz","").replace(__dirname,"")+".lck", logcolor)
							log.logc("Writing " + streamfilepart.replace(__dirname,""),logcolor)
						}
						if (options.debugstreamconsole) {
							log.logc(options.loginfo+" stream.readcallback(): Wrote   "+streamfilepart.replace(".gz","").replace(__dirname,"")+".lck", logcolor)
							log.logc(options.loginfo+" stream.readcallback(): Writing " + streamfilepart.replace(__dirname,""),logcolor)
						}
						fs.writeFile(streamfilepart,data,function (err) {
							if (options.debugstream) {
								log.logres("Wrote    "+streamfilepart.replace(__dirname,""), res)
								log.logres("Removing "+streamfilepart.replace(".gz","").replace(__dirname,"")+".lck", res)
							}
							if (options.debugstreamconsole) {
								log.logc(options.loginfo+" stream.readcallback(): Wrote    "+streamfilepart.replace(__dirname,""),logcolor)
								log.logc(options.loginfo+" stream.readcallback(): Removing "+streamfilepart.replace(".gz","").replace(__dirname,"")+".lck",logcolor)
							}
							fs.unlink(streamfilepart.replace(".gz","")+".lck",function () { 
								if (options.debugstream) {
									log.logres("Removed   "+streamfilepart.replace(".gz","").replace(__dirname,"")+".lck", res)
								}
								if (options.debugstreamconsole) {
									log.logc(options.loginfo+" stream.readcallback(): Removed   "+streamfilepart.replace(".gz","").replace(__dirname,"")+".lck", logcolor)
								}
								if (reqstatus[rnd].Nx == N) {
									var streamfile = streamdir.replace(streamsignature,"") + streamsignature + ".stream.gz";
									if (options.debugstream) {
										log.logres("Reading directory " + streamdir.replace(__dirname,"")+streamsignature, res)
									}
									if (options.debugstreamconsole) {
										log.logc(options.loginfo+" stream.readcallback(): Reading directory " + streamdir.replace(__dirname,"")+streamsignature,logcolor)
									}
									var files = fs.readdirSync(streamdir+streamsignature);
									var files2 = [];
									var k = 0;
									for (var z = 0;z<files.length;z++) {
										if (!files[z].match(".lck")) {
											files2[k] = ""+k+".stream.gz";
											k = k+1;
										}
									}
									if (options.debugstream) {
										log.logres("Found files: " + files2.join(","), res)
									}
									if (options.debugstreamconsole) {
										log.logc(options.loginfo+" stream.readcallback(): Found files: " + files2.join(","), logcolor)
									}
									//TODO: Lock these files before calling exec. 
									// 		Before exec is called, files can be written.
									//TODO: Check if streamsignature.lck exists.
									//TODO: This may not be needed if one of the parts was locked.
									if (files.length > 1) {
										if (options.debugstream) {
											log.logres("Concatenating " + files2.length + " stream parts into ../" + streamsignature + ".stream.gz", res)
										}
										if (options.debugstreamconsole) {
											log.logc(options.loginfo+" stream.readcallback(): Concatenating " + files2.length + " stream parts into ../" + streamsignature + ".stream.gz",logcolor)
										}
										var com = "cd " + streamdir + streamsignature + "; touch " + files2.join(" ").replace(/\.gz/g,".lck") + ";touch ../" + streamsignature + ".lck" + ";cat " + files2.join(" ") + " > ../" + streamsignature + ".stream.gz; rm ../"+streamsignature+".lck"+ ";rm " + files2.join(" ").replace(/\.gz/g,".lck");
										if (options.debugstream) {
											log.logres("Evaluating: " + com, res)
										}
										if (options.debugstreamconsole) {
											log.logc(options.loginfo+" stream.readcallback(): Evaluating: " + com,logcolor)
										}
										child = exec(com,function (error, stdout, stderr) {
											if (options.debugstream) {
												log.logres("Evaluated: " + com, res)
											}
											if (options.debugstreamconsole) {
												log.logc(options.loginfo+" stream.readcallback(): Evaluated: " + com,logcolor)
											}
										})
									} else {
										var com = "cd " + streamdir + streamsignature + "; touch " + files2[0].replace(".gz",".lck") + ";touch ../" + streamsignature + ".lck" + ";ln -s " + streamsignature + files2[0] + " ../" + streamsignature + ".stream.gz; rm ../"+streamsignature+".lck"+";rm " + files2[0].replace(".gz",".lck");
										if (options.debugstream) {
											log.logres("Evaluating " + com, res)
										}
										if (options.debugstreamconsole) {
											log.logc(options.loginfo+" stream.readcallback(): Evaluating " + com,logcolor)
										}
										child = exec(com,function (error, stdout, stderr) {
											if (options.debugstream) {
												log.logres("Evaluated  " + com, res)
											}
											if (options.debugstreamconsole) {
												log.logc(options.loginfo+" stream.readcallback(): Evaluated  " + com,logcolor)
											}
											if (error) {
												log.logres(JSON.stringify(error), res)
												log.logc(JSON.stringify(error), 160)
											}
										})								
									}
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
					log.logres("Passed error: " + err, res)
				}
				if (options.debugstreamconsole) {
					log.logc(rnd+" stream.readcallback(): Passed error: " + err,logcolor)
				}
				return res.end()
			}

			var streamfilepart = streamdir+streamsignature+"/"+reqstatus[rnd].Nx+".stream.gz";

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
