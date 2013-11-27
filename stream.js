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

	//console.log("-----" + options.timeRangeExpanded)
	var streamsignature   = util.md5(extractSignature + options.timeRangeExpanded + options.streamFilterReadBytes  + options.streamFilterReadLines  + options.streamFilterReadPosition  + options.streamFilterReadColumns  + options.streamFilterTimeFormat + options.streamFilterComputeWindow + options.streamFilterComputeFunction);
	var streamdir         = __dirname +"/cache/stream/"+source[0].split("/")[2]+"/"+streamsignature+"/";
	var streamfilecat     = streamdir + streamsignature + ".stream.gz";
	var streamfilecatlck  = streamfilecat.replace("stream.gz","lck");

	if (options.debugstream) console.log(options.id+" streamdir         : " + streamdir);
	if (options.debugstream) console.log(options.id+" streamfilecat     : " + streamfilecat);
	if (options.debugstream) console.log(options.id+" streamfilecatlck  : " + streamfilecatlck);


	if (!fs.existsSync(streamfilecat)) {
		if (options.debugstream) console.log(options.id+" streamfilecat does not exist.")
	}
	if (fs.existsSync(streamfilecatlck)) {
		if (options.debugstream) console.log(options.id+" streamfilecatlck exists.");
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
					
		res.setHeader('Content-Disposition', streamfilecat.replace(/.*\/(.*)/,"$1"))

		if (fs.existsSync(streamfilecatlck)) {
			if (options.debugstream) console.log(options.id+" Cached stream file is locked.")
		} else {
			if (options.debugstream) console.log(options.id+" Streaming cached concatenated stream file: "+streamfilecat);
			fs.writeFileSync(streamfilecatlck,"");
			if (options.streamGzip == false) {
				if (options.debugstream) console.log(options.id+" Unzipping cached concatenated stream file: "+streamfilecat);
				res.setHeader('Content-Disposition', streamfilecat.replace(/.*\/(.*)/,"$1").replace(".gz",""))
				// This does not handle concatenated stream files.
				var streamer = fs.createReadStream(streamfilecat).pipe(zlib.createGunzip());
			} else {
				res.setHeader('Content-Disposition', streamfilecat.replace(/.*\/(.*)/,"$1"))
				res.setHeader('Content-Encoding', 'gzip');
				var streamer = fs.createReadStream(streamfilecat);
			}
			streamer.on('end',function() {
				if (options.debugstream) console.log(options.id+" streamcat(): Received streamer.on end event.");
				if (options.debugstream) console.log(options.id+" streamcat(): Removing " + streamfilecatlck)
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
			if (options.debugstream) console.log(rnd+ " Processing next URL.")
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

		// TODO: Don't delete lock file if another process is streaming.
		if (!stream.streaming[fname]) {
			stream.streaming[fname] = 1;
		} else {
			stream.streaming[fname] = stream.streaming[fname] + 1;
		}

		var streamfilepart = streamdir+streamsignature+"/"+reqstatus[rnd].Nx+".stream.gz";
		var streamfilepartlck  = streamdir+streamsignature+"/"+reqstatus[rnd].Nx+".stream.lck";

		if (fs.existsSync(streamfilepartlck)) {
			if (options.debugstream) console.log(options.id+"******************streamfilepartlck exists: "+streamfilepartlck);
		}

		if (!fs.existsSync(streamfilepartlck) && !options.forceWrite && !options.forceUpdate) {
			if (options.debugstream) console.log(options.id+" Checking if stream part exists: " + streamfilepart);
			if (fs.existsSync(streamfilepart)) {
				if (options.debugstream) console.log(options.id+" It does.  Locking it.");
				fs.writeFileSync(streamfilepartlck,"");
				if (options.streamGzip == false) {
					if (options.debugstream) console.log(options.id+"Unzipping it.");
					var streamer = fs.createReadStream(streamfilepart).pipe(zlib.createGunzip());
				} else {
					if (options.debugstream) console.log(options.id+" Sending raw.");
					var streamer = fs.createReadStream(streamfilepart);
				}
				streamer.on('end',function() {
					if (options.debugstream) console.log(options.id+" processwork() Received streamer.on end event.");
					if (options.debugstream) console.log(options.id+" processwork() Removing " + streamfilepartlck);
					fs.unlink(streamfilepartlck);
				    stream.streaming[fname] = stream.streaming[fname] - 1;
					finished(inorder);
				});
				streamer.on('error',function(err) {
					console.log(err)
				});
				if (options.debugstream) console.log(options.id+" Streaming it.");
				streamer.pipe(res,{ end: false });
				return;
			}
		}

		if (options.debugstream) console.log(rnd+" Stream locking " + fname.replace(__dirname,""));

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
		    if (options.debugstream) console.log(rnd+" Reading "+fname);	
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

		if (options.streamFilterComputeFunction.match(/stats|mean|max|min|std|Nvalid/)) {
			if (options.debugstream) console.log("Reading filter")
			var stats = require("./filters/stats.js");
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

					if (options.streamFilterComputeFunction.match(/stats|mean|max|min|std|Nvalid/)) {
						if (lr % options.streamFilterComputeWindow == 0) {
							linesx = linesx + stats.stats(linesa.replace(/\n$/,""),options);
							linesa = '';
						}
					}
					
				}
				k = k+1;
			}).then(function () {
				if (!done) {
					if (options.streamFilterComputeFunction && linesx !== '') {
						if (options.debugstream) console.log("Last window not full.");
						linesx = linesx + stats.stats(linesa.replace(/\n$/,""),options);
						readcallback("",linesx);
					} else {
						readcallback("",lines);
					}
				}
				
			});
		}
		
		function readcallback(err, data, cachepart) {

			if (arguments.length < 3) cachepart = true;
			
			function cachestream(streamfilepart,data) {
				if (options.debugstream) console.log(options.id+" Creating " + streamdir+streamsignature);

				mkdirp(streamdir+streamsignature, function (err) {
					if (err) console.log(err)
					if (options.debugstream) console.log(options.id+" Created " + streamdir+streamsignature);

					// TODO: Check if 0.stream.lck,etc. exists.
					if (options.debugstream) console.log(options.id+" Writing "+streamfilepart.replace(".gz","")+".lck");
					fs.writeFile(streamfilepart.replace(".gz","")+".lck","",function (err) {
						if (options.debugstream) console.log(options.id+" Wrote   "+streamfilepart.replace(".gz","")+".lck");
						if (options.debugstream) console.log(options.id+" Writing " + streamfilepart);
						fs.writeFile(streamfilepart,data,function (err) {
							if (options.debugstream) console.log(options.id+" Wrote   "+streamfilepart);
							if (options.debugstream) console.log(options.id+" Removing   "+streamfilepart.replace(".gz","")+".lck");
							fs.unlink(streamfilepart.replace(".gz","")+".lck",function () { 
								if (options.debugstream) console.log(options.id+" Removed   "+streamfilepart.replace(".gz","")+".lck");
								if (reqstatus[rnd].Nx == N) {
									var streamfile = streamdir.replace(streamsignature,"") + streamsignature + ".stream.gz";
									if (options.debugstream) console.log(options.id+" Reading directory " + streamdir+streamsignature);
									var files = fs.readdirSync(streamdir+streamsignature);
									var files2 = [];
									var k = 0;
									for (var z = 0;z<files.length;z++) {
										if (!files[z].match(".lck")) {
											files2[k] = ""+k+".stream.gz";
											k = k+1;
										}
									}
									if (options.debugstream) {console.log(options.id+" Found files: "); console.log(files2)}
									//TODO: Lock these files
									//TODO: Check if streamsignature.lck exists.
									//TODO: This may not be needed if one of the parts was locked.
									if (files.length > 1) {
										if (options.debugstream) console.log(options.id+" Concatenating " + files2.length + " stream parts into ../" + streamsignature + ".stream.gz");
										var com = "cd " + streamdir + streamsignature + "; touch " + files2.join(" ").replace(/\.gz/g,".lck"); + ";touch ../" + streamsignature + ".lck" + ";cat " + files2.join(" ") + " > ../" + streamsignature + ".stream.gz; rm ../"+streamsignature+".lck"+ ";rm " + files2.join(" ").replace(/\.gz/g,".lck");
										if (options.debugstream) console.log(options.id+" Evaluating: " + com);
										child = exec(com,function (error, stdout, stderr) {
											if (options.debugstream) console.log(options.id+" Concatenation finished.");
										});
									} else {
										var com = "cd " + streamdir + streamsignature + "; touch " + files2[0].replace(".gz",".lck") + ";touch ../" + streamsignature + ".lck" + ";ln -s " + streamsignature + files2[0] + " ../" + streamsignature + ".stream.gz; rm ../"+streamsignature+".lck"+";rm " + files2[0].replace(".gz",".lck");
										if (options.debugstream) console.log(options.id+" Evaluating " + com);
										child = exec(com,function (error, stdout, stderr) {
											if (options.debugstream) console.log(options.id+" Evaluated  " + com);
											if (error) console.log(error)
											if (options.debugstream) console.log(options.id+" Symlink finished.");
										});									
									}

								}
							})

						});
					});
				});

			}
			
			if (options.debugstream) {
				//console.log(rnd+" readcallback() called.  Un-stream locking " + fname.replace(__dirname,""));
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
					if (options.debugstream) console.log(rnd+" Sending uncompressed data of length = "+data.length)
					res.write(data);
					finished(inorder);
					zlib.createGzip({level:1});
					zlib.gzip(data, function (err, buffer) {
						if (err) console.log(err);
						if (cachepart) cachestream(streamfilepart,buffer);
					});
				} else {
					if (options.debugstream) console.log(options.id+" Compressing.")
					zlib.createGzip({level:1});
					zlib.gzip(data, function (err, buffer) {
						if (err) console.log(err);
						if (options.debugstream) console.log(options.id+" Compression finished. Sending buffer of length "+buffer.length)
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
						var tic = new Date();
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