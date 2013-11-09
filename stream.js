var mkdirp     = require("mkdirp");
var lineReader = require('line-reader');
var exec       = require('child_process').exec;
var spawn      = require('child_process').spawn;
var zlib       = require('zlib');
var	fs 		   = require("fs");
var	crypto     = require("crypto");

function streaminfo(results) {
	var l = 0;
	for (var i = 0; i < results.length; i++) {
			l = l + results[i]["dataLength"];
	}
	sresults = new Object();
	sresults["dataLength"] = l;
	return sresults;
}
exports.stream   = stream;
stream.streaming = {};

function stream(source, options, res) {

	var scheduler  = require("./scheduler.js");
	var logger     = require("./logger.js");
	var util       = require("./util.js");

	res.setHeader('Transfer-Encoding', 'chunked');

	var lineFormatter = require(__dirname + "/plugins/formattedTime.js");

	var rnd        = options.id;		
	var reqstatus  = {};
	reqstatus[rnd] = {};
	
	reqstatus[rnd].Nx       = 0; // Number of reads/processed URLs completed
	reqstatus[rnd].Nd       = 0; // Number of drained reads
	reqstatus[rnd].gzipping = 0;
	reqstatus[rnd].dt       = 0;
	
	var plugin = scheduler.getPlugin(options,source[0])
	
	extractSignature = source.join(",");
	if (plugin.extractSignature) extractSignature = plugin.extractSignature(options);
	if (options.debugapp) console.log("plugin extractSignature: " + extractSignature);

	var streamsignature   = util.md5(extractSignature + options.streamFilterReadBytes  + options.streamFilterReadLines  + options.streamFilterReadPosition  + options.streamFilterReadColumns  + options.streamFilterTimeFormat + options.streamFilterComputeWindow + options.streamFilterComputeFunction +  + options.streamFilterTimeRangeExpanded);
	var streamdir         = __dirname +"/cache/stream/"+source[0].split("/")[2]+"/"+streamsignature+"/";
	var streamfilecat     = streamdir + streamsignature + ".stream.gz";
	var streamfilecatlck  = streamfilecat.replace("stream.gz","lck");

	if (options.debugstream) console.log("streamdir         : " + streamdir);
	if (options.debugstream) console.log("streamfilecat     : " + streamfilecat);
	if (options.debugstream) console.log("streamfilecatlck  : " + streamfilecatlck);


	if (!fs.existsSync(streamfilecat)) {
		if (options.debugstream) console.log("streamfilecat does not exist.")
	}
	if (fs.existsSync(streamfilecatlck)) {
		if (options.debugstream) console.log("streamfilecatlck exists.");
	}

	if (fs.existsSync(streamfilecat) && !fs.existsSync(streamfilecatlck) && !options.forceWrite && !options.forceUpdate) {
		streamcat();
		return;
	}

	var N = source.length;
	if (options.debugstream) console.log(options.id+' stream called with ' + N + ' urls and options.streamOrder = '+options.streamOrder);
	if (options.streamOrder) {
	    scheduler.addURL(source[0], options, function (work) {processwork(work,true)});
	} else {
	    for (var jj=0;jj<N;jj++) {
	    	if (options.debugstream) console.log("Adding to scheduler: " + source[jj]);
			scheduler.addURL(source[jj], options, function (work) {processwork(work)});
	    }
	}

	function streamcat() {
					
		res.setHeader('Content-Encoding', 'gzip');
		res.setHeader('Content-disposition', streamfilecat.replace(/.*\/(.*)/,"$1"))

		if (fs.existsSync(streamfilecatlck)) {
			if (options.debugstream) console.log("Cached stream file is locked.")
		} else {
			if (options.debugstream) console.log("Streaming cached concatenated stream file: "+streamfilecat);
			fs.writeFileSync(streamfilecatlck,"");
			if (options.streamGzip == false) {
				if (options.debugstream) console.log("and unzipping cached concatenated stream file: "+streamfilecat);
				var streamer = fs.createReadStream(streamfilecat).pipe(zlib.createGunzip());
			} else {
				var streamer = fs.createReadStream(streamfilecat);
			}
			streamer.on('end',function() {
				if (options.debugstream) console.log("Received streamer.on end event.");
				if (options.debugstream) console.log("Removing " + streamfilecatlck)
				fs.unlink(streamfilecatlck)
				res.end();
			});
			streamer.pipe(res);
			return;
		}
		
	}

	function finished(inorder) {
		if (options.debugstream) console.log(rnd+ " Incremening Nx from " + reqstatus[rnd].Nx + " to " + (reqstatus[rnd].Nx+1));
		reqstatus[rnd].Nx = reqstatus[rnd].Nx + 1;

		if ((reqstatus[rnd].Nx < N) && (inorder)) {
			scheduler.addURL(source[reqstatus[rnd].Nx], options, function (work) {processwork(work,true)});
		}

		if (N == reqstatus[rnd].Nx) {
			if (options.debugstream) console.log(rnd+" N == reqstatus[rnd].Nx; Sending res.end().");
			res.end();
		}
	}

	function processwork(work,inorder) {
		var fname = util.getCachePath(work);

		// TODO: Check if part exists. 
		if (work.error) {
			console.log(rnd+ " Sending res.end() because of work.error: ", work.error);
			return res.end();
		}

		if (options.debugstream) console.log(rnd+" Stream locking " + fname.replace(__dirname,""));

		if (!stream.streaming[fname]) {
			stream.streaming[fname] = 1;
		} else {
			stream.streaming[fname] = stream.streaming[fname] + 1;
		}

		var streamfilepart = streamdir+streamsignature+"/"+reqstatus[rnd].Nx+".stream.gz";
		var streamfilepartlck  = streamdir+streamsignature+"/"+reqstatus[rnd].Nx+".lck";

		if (!fs.existsSync(streamfilepartlck) && !options.forceWrite && !options.forceUpdate) {
			if (options.debugstream) console.log("Checking if stream part exists: " + streamfilepart);
			if (fs.existsSync(streamfilepart)) {
				if (options.debugstream) console.log("It does.  Locking it.")
				fs.writeFileSync(streamfilepartlck,"");
				if (options.streamGzip == false) {
					if (options.debugstream) console.log("and unzipping first");
					var streamer = fs.createReadStream(streamfilepart).pipe(zlib.createGunzip());
				} else {
					if (options.debugstream) console.log("and sending raw");
					var streamer = fs.createReadStream(streamfilepart);
				}
				streamer.on('end',function() {
					if (options.debugstream) console.log("Received streamer.on end event.");
					if (options.debugstream) console.log("Removing " + streamfilepartlck);
					fs.unlink(streamfilepartlck);
					
					if (options.debugstream) {
						if (options.debugstream) console.log(rnd+" readcallback() called.  Un-stream locking " + fname.replace(__dirname,""));
				    }		    
				    stream.streaming[fname] = stream.streaming[fname] - 1;
					finished(inorder);
				});
				if (options.debugstream) console.log("Streaming it.")
				streamer.pipe(res);
				return;
			}
		}

		if (options.streamFilterReadBytes > 0) {
		    if (options.debugstream) console.log(rnd+" Reading Bytes of "+ fname.replace(__dirname,""));
		    if (options.debugstream) console.log(rnd+" Stream lock status " + stream.streaming[fname]);
			var buffer = new Buffer(options.streamFilterReadBytes);
			if (options.debugstream) console.log(rnd+" fs.exist: " + fs.existsSync(fname + ".data"));
			fs.open(fname + ".data", 'r', function (err,fd) {
				logger.d("processwork: ", "error:", err, "fd:", fd, fd==undefined,  "readbytes:", options.streamFilterReadBytes, "readPosition:", options.streamFilterReadPosition);
			    fs.read(fd, buffer, 0, options.streamFilterReadBytes, options.streamFilterReadPosition-1, 
			    		function (err, bytesRead, buffer) {readcallback(err,buffer);fs.close(fd);})});
		} else if (options.streamFilterReadLines > 0 || options.streamFilterReadColumns !== "0" ) {
		    if (options.debugstream) console.log(rnd+" Reading Lines of "+ fname.replace(__dirname,""));
			if (options.debugstream) console.log(rnd+" fs.exist: " + fs.existsSync(fname + ".data"));
			readline(fname + ".data");
		} else {	
		    if (options.debugstream) console.log(rnd+" Reading File");	
			// Should be no encoding if streamFilterBinary was given.
			fs.readFile(fname + ".data", "utf8", readcallback);
		}

		var line   = '';
		var lines  = '';
		var linesx = ''; // Modified kept lines.
		var linesa = ''; // Accumulated lines.

		var lr = 0; // Lines kept.
		var k = 1;  // Lines read.
		
		var done = false;
		
		if (options.streamFilterReadColumns !== "0") {
			//console.log("New column: " + work.plugin.columnTranslator(1))
			var outcolumnsStr = options.streamFilterReadColumns.split(/,/);
			var outcolumns = [];
			
			if (options.debugstream) {console.log("outformat requested");console.log(options.streamFilterTimeFormat);}
			if (options.debugstream) {console.log("timecolumns");console.log(options.req.query.timecolumns);}
			if (options.debugstream) {console.log("columns requested");console.log(outcolumnsStr);}
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
			if (options.debugstream) {console.log("columns translated");console.log(outcolumns);}
	
			function onlyUnique(value, index, self) { 
			    return self.indexOf(value) === index;
			}
			
			// Remove non-unique columns (plugin may define all time columns to be the first column). 
			outcolumns = outcolumns.filter(onlyUnique);
	
			if (outcolumns[0] == 1 && options.streamFilterTimeFormat == "2") {
				outcolumns.splice(0,1);
				//for (var i=0;i<outcolumns.length;i++) {outcolumns[i] = 6+outcolumns[i];}
				outcolumns = [1,2,3,4,5,6].concat(outcolumns);
			}
			
			if (options.debugstream) {console.log("columns final");console.log(outcolumns);}
		}

		if (options.streamFilterComputeFunction) {
			if (options.debugstream) console.log("Reading filter")
			var math = require("./filters/"+options.streamFilterComputeFunction+".js");
		}
		
		function readline(fname) {	
			lineReader.eachLine(fname, function(line, last) {

				if (done) return "";
				
				var stopline = options.streamFilterReadLines;
				if (options.streamFilterReadLines == 0) {
					stopline = Infinity;
				}

				if (k >= options.streamFilterReadPosition) {				  		
					if (lr == stopline) {	
						if (options.debugstream) console.log("readline: Callback");
						readcallback("",lines);
						lines = "";
						done = true;
					}
					
					if (options.streamFilterReadColumns !== "0") {
						
						if (options.debugstream) console.log("Before " + line)
						line = lineFormatter.formatLine(line,options);
						if (options.debugstream) console.log("After " + line)
						linea = line.split(/\s+/g);
						line = "";
						if (options.debugstream) console.log(linea)
						if (options.debugstream) console.log(outcolumns)
						for (var z = 0;z < outcolumns.length; z++) {
							line = line + linea[outcolumns[z]-1] + " ";
						}							
						if (options.debugstream) console.log(line)

					}

					line = line.substring(0,line.length-1);
					
					// TODO: Only return data if in time range given.
					//if (options.streamFilterTimeRange !== "") {
					//	line = lineFormatter.formatLine(line,options);
					//}

					if (!line.match("undefined")) {
						lines = lines + line + "\n";
						linesa = linesa + line + "\n";
					}

					lr = lr + 1;

					if (options.streamFilterComputeFunction) {
						if (lr % options.streamFilterComputeWindow == 0) {
							//console.log(linesa)
							linesx = linesx + math.mean(linesa.replace(/\n$/,""));
							//console.log(linesx)
							linesa = '';
						}
					}
					
				}
				k = k+1;
			}).then(function () {
				if (!done) {
					if (options.streamFilterComputeFunction && linesx !== '') {
						readcallback("",linesx);//.replace(/\n$/,""));
					} else {
						readcallback("",lines);//.replace(/\n$/,""));
					}
				}
				
			});
		}
		
		function readcallback(err, data, cachepart) {

			if (arguments.length < 3) cachepart = true;
			
			function cachestream(streamfilepart,data) {
				console.log("Creating " + streamdir+streamsignature);

				mkdirp(streamdir+streamsignature, function (err) {
					if (err) console.log(err)
					console.log("Created " + streamdir+streamsignature);

					// TODO: Check if 0.stream.lck,etc. exists.
					fs.writeFile(streamfilepart+".lck","",function (err) {
						console.log("Wrote   "+streamfilepart+".lck");
						console.log("Writing " + streamfilepart);
						fs.writeFile(streamfilepart,data,function (err) {
							console.log("Wrote   "+streamfilepart);
							fs.unlink(streamfilepart+".lck",function () { 
								if (reqstatus[rnd].Nx == N) {
									var streamfile = streamdir.replace(streamsignature,"") + streamsignature + ".stream.gz";
									console.log("Reading " + streamdir+streamsignature);
									var files = fs.readdirSync(streamdir+streamsignature);
									var files2 = [];
									for (var z = 0;z<files.length;z++) {
										files2[z] = ""+z+".stream.gz";
									}
									console.log(files2)
									//TODO: Check if streamsignature.lck exists.
									if (files.length > 1) {
										console.log("Concatenating " + files2.length + " stream parts into ../" + streamsignature + ".stream.gz");
										var com = "cd " + streamdir + streamsignature + "; touch ../" + streamsignature + ".lck" + ";cat " + files2.join(" ") + " > ../" + streamsignature + ".stream.gz; rm ../"+streamsignature+".lck";
										console.log("Evaluating: " + com);
										child = exec(com,function (error, stdout, stderr) {
											console.log("Concatenation finished.");
										});
									} else {
										var com = "cd " + streamdir + streamsignature + "; touch ../" + streamsignature + ".lck" + ";ln -s " + streamsignature + files2[0] + " ../" + streamsignature + ".stream.gz; rm ../"+streamsignature+".lck";
										console.log("Evaluating " + com);
										child = exec(com,function (error, stdout, stderr) {
											console.log("Evaluated  " + com);
											if (error) console.log(error)
											console.log("Symlink finished.");
										});									
									}

								}
							})

						});
					});
				});

			}
			
			if (options.debugstream) {
				console.log(rnd+" readcallback() called.  Un-stream locking " + fname.replace(__dirname,""));
		    }		    
		    stream.streaming[fname] = stream.streaming[fname] - 1;

								
			if (err) {
				if (options.debugstream) console.log(rnd+" readcallback was passed err: " + err);
				return res.end();
			}

			var streamfilepart = streamdir+streamsignature+"/"+reqstatus[rnd].Nx+".stream.gz";

			if (options.streamFilter === "") {
				if (options.debugstream) console.log(rnd+" Writing response.");
				if (!options.streamGzip) {
					console.log("Sending uncompressed data of length = "+data.length)
					res.write(data);
					finished(inorder);
					zlib.createGzip({level:1});
					zlib.gzip(data, function (err, buffer) {
						if (err) console.log(err);
						if (cachepart) cachestream(streamfilepart,buffer);
					});
				} else {
					console.log("Compressing.")
					zlib.createGzip({level:1});
					zlib.gzip(data, function (err, buffer) {
						if (err) console.log(err);
						console.log("Compression finished. Sending buffer of length "+buffer.length)
						res.write(buffer);
						if (cachepart) cachestream(streamfilepart,buffer);
						finished(inorder);
					});
				}

			} else {	
				try {
					eval("data = data.toString()."+options.streamFilter);
					if (!options.streamGzip) {
						res.write(data);
						if (cachepart) cachestream(streamfilepart,data)
						finished(inorder);
					} else {
						zlib.createGzip({level:1});
						zlib.gzip(data, function (err, buffer) {
							reqstatus[rnd].dt = new Date()-tic;
							if (options.debugstream) console.log(rnd+' gzip callback event');
							if (options.debugstream) console.log(rnd+ " Writing compressed buffer");
							res.write(buffer);
							reqstatus[rnd].gzipping=reqstatus[rnd].gzipping-1;
							if (cachepart) cachestream(streamfilepart,buffer)
							finished(inorder);
						});
					}
				} catch (err) {
					console.log(rnd+" Error when evaluating " + options.streamFilter);
					finished(inorder);
				}
			}

		}

	}

}