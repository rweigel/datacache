var fs        = require("fs")
var request   = require("request")
var zlib      = require('zlib')
var localeval = require("localeval")
var jsdom     = require("jsdom")
var jquery    = require("jquery")
var url       = require('url');
var http      = require('http');
var mkdirp    = require("mkdirp");

var util      = require("../util.js")
var log       = require("../log.js")

var Magic = require('mmmagic').Magic
var magic = new Magic()
exports.name    = "default"
exports.version = "1.0.0"

exports.match = function (url) {return false}

exports.extractSignature = function (options) {
	var tmp = ""
	if (options.lineFormatter !== "") {
	    var lineFormatter = require(__dirname + "/" + options.lineFormatter + ".js")
			var tmp = lineFormatter.extractSignature(options)
	}
	var tmp2 = exports.extractData.toString()
	var ret = "\n-----\n" + tmp + "\n-----\n" + tmp2 + "\n-----\n" + options.lineRegExp + "\n-----\n" + options.lineFilter + "\n-----\n" + options.extractData + "\n-----\n"
	return ret.replace(/\s+/g,"")
}

exports.preprocess = function (work, callback) {callback(false, work)}

exports.process = function (work, callback) {

	// TODO: If work.urlMd5base.out symlink exists, read work.body from
	// urlMd5base.out and finish("",filecontents);return
	// Will need to handle fact that symlink exists when writing cache.
	
	var debug        = work.options.debugplugin
	var debugconsole = work.options.debugpluginconsole
	var logcolor     = work.options.logcolor

	var dir = util.getCacheDir(work)
	var outfiletmp =  dir + work.urlMd5base + "." + work.id + ".out"
	var outfile = dir + work.urlMd5base + ".out"


	if (work.options.forceWrite && work.options.forceUpdate) {
		mkdirp(dir, doget)
	} else {
		if (work.options.debugutilconsole) {
			log.logc(work.options.loginfo + " default.process(): Looking for .out file.", work.options.logcolor)
		}

		fs.exists(outfile, function (exist) {
			if (!exist) {
				if (work.options.debugutilconsole) {
					log.logc(work.options.loginfo + " default.process(): .out file does not exist. Calling doget().", work.options.logcolor)
				}
				mkdirp(dir, doget)
				return
			}
			if (work.options.debugutilconsole) {
				log.logc(work.options.loginfo + " default.process(): .out file exists.", work.options.logcolor)
			}

			util.readLockFile(outfile, work, function (success) {
				if (!success) {
					if (work.options.debugutilconsole) {
						log.logc(work.options.loginfo + " default.process(): .out file is locked.  Calling doget().", work.options.logcolor)
					}
					doget()
					return
				}
				if (work.options.debugutilconsole) {
					log.logc(work.options.loginfo + " default.process(): Reading .out file.", work.options.logcolor)
				}
				fs.readFile(outfile, "utf8", function (err, body) {
					if (err) {
						if (work.options.debugutilconsole) {
							log.logc(work.options.loginfo + " default.process(): Error when reading .out file.  Calling doget().", work.options.logcolor)
						}
						doget()
						return
					}
					if (work.options.debugutilconsole) {
						log.logc(work.options.loginfo + " default.process(): Read .out file.  Unlocking and calling finish().", work.options.logcolor)
					}
					util.readUnlockFile(outfile, work, function () {
						finish("", body)
					})
				})
			})
		})
	}

	function finish(err, res) {

		if (err) {
			log.logc(work.options.loginfo + " default.process.util.get.finish(): " + err, 160)
			work.error = err
			callback(true, work)
		}

		// TODO: The extraction here should be of form
		// 
		// work.extractData(work, finished)
		// work.extractDataBinary(work, finished)
		// work.extractDataJson(work, finished)
		// work.extractRem(work, finished)
		// work.extractMeta(work, finished)
		// work.extractMetaJson(work, finished)
		// 
		// var ndone = 0
		// function finished(err) {
		//      if (!err) {ndone = ndone + 1} else {work.error = err; callback(true, work)}
		//      if (ndone == 6) util.writeCache(work, function () {callback(false, work)}) }
		// }
		work.body = res || "";

		if (work.options.debugschedulerconsole) {
			log.logc(work.options.loginfo + " default.process.util.get.finish(): Extracting data from work.body.", logcolor)
		}
		work.data = work.extractData(work.body, work.options)

		if (work.options.debugschedulerconsole) {
			log.logc(work.options.loginfo + " default.process.util.get.finish(): Computing MD5 of work.body.", logcolor)
		}
		work.dataMd5 = util.md5(work.data);

		if (work.options.debugschedulerconsole) {
			log.logc(work.options.loginfo + " default.process.util.get.finish(): Extracting binary from work.body.", logcolor)
		}

		work.dataBinary = work.extractDataBinary(work.body, "bin");
		if (work.options.debugschedulerconsole) {
			log.logc(work.options.loginfo + " default.process.util.get.finish(): Extracting metadata from work.body.", logcolor)
		}
		work.dataJson   = work.extractDataJson(work.body, work.options);
		work.datax      = work.extractRem(work.body, work.options);
		work.meta       = work.extractMeta(work.body, work.options);
		work.metaJson   = work.extractMetaJson(work.body, work.options);
		if (work.options.debugschedulerconsole) {
			log.logc(work.options.loginfo + " default.process.util.get.finish(): Calling util.writeCache.", logcolor)
		}
		util.writeCache(work, function (work) {callback(false, work)})
	}

	function doget() {
		if (work.url.match(/^http/)) {
			if (debugconsole) {
				log.logc(work.options.loginfo + " default.process(): Called with work.url = " + work.url, logcolor)
			}
			var headers = work.options.acceptGzip ? {"accept-encoding": "gzip, deflate"} : {};
			
			var sz = 0;
			var body;

			if (debugconsole) {
				log.logc(work.options.loginfo + " default.process(): Getting: " + work.url, logcolor)
			}

			var options = {
							method: 'GET',
							host: url.parse(work.url).hostname,
							port: url.parse(work.url).port || 80,
							encoding: null,
							path: url.parse(work.url).pathname
						}

			var outfiletmpstream = fs.createWriteStream(outfiletmp)

			outfiletmpstream.on('finish', function () {
				if (debugconsole) {
					log.logc(work.options.loginfo + " default.process.util.get(): Finished writing .out.tmp file.", logcolor)
					// TODO: If forceWrite = false and md5 has not changed, just delete tmp file.
					util.writeLockFile(outfile, work, function (success) {
						if (!success) {
							return
						}
						fs.rename(outfiletmp, outfile, function (err) {
							if (err) {
								log.logc(work.options.loginfo + " default.process.util.get(): Error when trying to rename .out.tmp file.", logcolor)
							} else {
								log.logc(work.options.loginfo + " default.process.util.get(): Renamed .out.tmp file.", logcolor)
								util.writeUnlockFile(outfile, work, function () {})
							}
						})

					})
				}
			})
			// Will need to move code for unzipping to extractData in default.js

			work.getStartTime = new Date()

			util.get(work.url, function (error, response, body) {

				if (error) {
					work.error = error;
					if (debugconsole) {
						log.logc(work.options.loginfo + " default.process.util.get(): Error when attempting GET: " + error, logcolor)
					}
					callback(true, work)
					return
				}

				if (response.statusCode !== 200) {
					work.error = "HTTP Error " + response.statusCode;
					if (debugconsole) {
						log.logc(work.options.loginfo + " default.process.util.get(): Non-200 status code when attempting to GET: " + response.statusCode, logcolor)
					}
					callback(true, work)
					return
				} else {
					work.header = response.headers;
					if (debugconsole)  {
						log.logc(work.options.loginfo + " default.process.util.get(): Got " + work.url, logcolor)
						log.logc(work.options.loginfo + " default.process.util.get(): Headers: " + JSON.stringify(response.headers), logcolor)
					}
					if (response.headers["content-encoding"] === "gzip" || response.headers["content-type"] === "application/x-gzip") {
						if (debugconsole) {
							log.logc(work.options.loginfo + " default.process.util.get(): Content-Type is application/x-gzip", logcolor)
						}
					    zlib.gunzip(body, finish)
					} else {
						magic.detect(body, function(err, result) {
							if (result.match(/^gzip/)) {
								if (debugconsole) {
									log.logc(work.options.loginfo + " default.process.util.get(): Content-Encoding is not gzip and Content-Type is not application/x-gzip, but buffer is gzipped.", logcolor)
								}
								if (err) throw err;
								zlib.gunzip(body, finish)
							} else {
								if (debugconsole) {
									log.logc(work.options.loginfo + " default.process.util.get(): Calling finish().", logcolor)
								}
								finish("",body)
							}
						})
					}
				}

			})
			// Not needed.  Caught by callback to util.get.
			//.on("error", function (err) {
			//	if (debugconsole) {
			//		log.logc(work.options.loginfo + " default.process(): On error event." + err, logcolor)
			//	}
			//	console.log(err)
			//})
			 .on('connect', function(res, socket, head) {
	    		// This is not emitted by request (https://github.com/request/request)
	    		console.log(work.options.loginfo + " ---- default.process.util.get(): Connected.  Header: "+head, logcolor)
	    	})
			.pipe(outfiletmpstream)
			.on("data", function (data) {
				// TODO: If file size is found to be large, stop reading into memory and use
				// outfile as work.body and set work.bodyfile = work.urlMd5base + ".tmp".
				sz = sz + data.length;
				
				if (debugconsole) {
					log.logc(work.options.loginfo + " default.process.util.get(): Got first chunk of size [bytes] " + data.length, logcolor)
				}
				work.getFirstChunkTime = new Date();
			})
			.on("end", function () {
				if (debugconsole) {
					log.logc(work.options.loginfo + " default.process.util.get(): On end event.  Size [bytes]     " + sz, logcolor)
				}
				if (!work.getEndTime) {
				    work.getFinishedTime = new Date();
				}
			})

		} else if (work.url.match(/^ftp/)) {
			var FtpClient  = require("ftp");
			var conn = new FtpClient();
			var host = work.url.split("/")[2];
			var filepath = work.url.split("/").slice(3).join("/");

			//console.log("Connecting to "+host)
			//logger.d("ftp connecting... ");
			//logger.d("host: " + host);
			//logger.d("connect func: " + conn.connect);
			conn.on("ready", function(){
				//console.log("Ready event from "+host)
					
					// TODO: Write .header file.
					//conn.list(filepath, function(err,list) {
					//	console.log(err);
					//	console.log(list);
					//})
				
					conn.get(filepath, function(err, stream){
						if (err) {
							work.error = err;
							callback(true, work);
							conn.end();
						} else {
							var buff = "";
							stream.on("data", function(data){
								if(!work.responseTime) {
								    //work.responseTime = new Date();
								}
								buff+=data.toString();
							})
							.on("error", function(e){
								work.error = e
								log.logc(work.options.loginfo + " default.process(): Error event in conn.get from "+host, 160)
								log.logc(JSON.stringify(e), 160)
								callback(true, work)
								conn.end()
							})
							.on("end", function(){
								work.body = buff
								work.data = work.extractData(work.body, work.options)
								work.dataMd5 = util.md5(work.data)
								work.header = ""
								util.writeCache(work, function (work) {callback(false, work)})
							});
						}
					});
			})
			.on("error", function(e){

				if (!e.toString().match("No transfer timeout")) {
					// FTP servers send this "error" if no tranfer after a certain amount of time.
					// It is really just a signal to close the connection.
					log.logc(work.options.loginfo + " default.extractData(): Error event in conn.ready from " + host, logcolor)
					log.logc(JSON.stringify(e))
					work.error = e
					callback(true, work)
					conn.end()
				}
			})
			conn.connect({host: host})
		} else {
			log.logc(work.options.loginfo + " default.js: Error.  Protocol" + work.url.replace(/^(.*)\:.*/,"$1") + " is not supported.", 160)
		}
	}
}

exports.extractDataBinary = function (body, options) {return ""}

exports.extractData = function (body, options) {

	var debug        = options.debugplugin
	var debugconsole = options.debugpluginconsole
	var logcolor     = options.logcolor
	var lineRegExp   = options.lineRegExp

	if (options.lineFormatter !== "") {
		if (debugconsole) {
			log.logc(options.loginfo + " default.extractData(): Reading " + __dirname + "/" + options.lineFormatter + ".js", logcolor)
		}
		var lineFormatter = require(__dirname + "/" + options.lineFormatter + ".js")
	}
	
	if (options.unsafeEval) {
		if (debugconsole) {
			log.logc(options.loginfo + " default.extractData(): Using unsafe eval because extractData and lineRegExp are default values.", logcolor)
			log.logc(options.loginfo + " default.extractData(): Evaluating " + options.extractData, logcolor)
			log.logc(options.loginfo + " default.extractData(): lineRegExp = " + lineRegExp, logcolor)
		}
		return eval(options.extractData)
	}

	if (debugconsole) {
		log.logc(options.loginfo + " default.extractData(): Using safe eval because extractData or lineRegExp are not default values.", logcolor)
		log.logc(options.loginfo + " default.extractData(): Evaluating " + options.extractData, logcolor)
		log.logc(options.loginfo + " default.extractData(): lineRegExp = " + lineRegExp, logcolor)
	}

	//Not needed, even though body is a buffer.
	//body = body.toString()

	var window
	var $
	try {
		window = jsdom.jsdom(body).createWindow()
		$ = jquery.create(window)
	} catch(e) {
		log.logc(options.loginfo + " default.extractData(): Error when trying to parse data as html, probably it is not in valid html format.", 160)
	}
	
	try {
		if (debugconsole) {
			log.logc(options.loginfo + " default.extractData(): Using safe eval because extractData or lineRegExp specified as input.", logcolor)
		}
		return localeval(options.extractData.replace(/jQuery/g,"\$"), {
			$: $,
			document: window.document,
			out: body,
			body: body,
	        lineRegExp: new RegExp(options.lineRegExp),
		    lineFormatter: lineFormatter,
		    options: options
		})
	} catch(e) {
		log.logc(options.loginfo + " default.extractData(): Error in trying to eval options.extractData: " + JSON.stringify(e), 160)
		return "Error occurred while extracting data\n";
	}
}

exports.extractDataJson = function (body, options) {return {}}

exports.dataToJson = function (data, options) {return {}}

exports.extractMeta = function (body, options) {return ""}

exports.extractMetaJson = function (body, options) {return {}}

exports.metaToJson = function (meta) {return {}}

exports.extractRem = function (body, options) {return ""}

exports.postprocess = function (work, callback) {callback(false, work)}
