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

	var debug        = work.options.debugplugin
	var debugconsole = work.options.debugpluginconsole
	var logcolor     = work.options.logcolor
	var loginfo      = work.options.loginfo + " default.process(): "

	var dir        = util.getCacheDir(work)
	var outfiletmp = dir + work.urlMd5base + ".out" + "." + work.id
	var outfile    = dir + work.urlMd5base + ".out"

	if (work.options.forceWrite && work.options.forceUpdate) {
		mkdirp(dir, doget)
	} else {

		if (work.options.debugutilconsole) {
			log.logc(loginfo + "Looking for .out file.", logcolor)
		}

		fs.exists(outfile, function (exist) {

			if (!exist) {
				if (debugconsole) {
					log.logc(loginfo + ".out file does not exist. Calling doget().", logcolor)
				}
				mkdirp(dir, doget)
				return
			}
			if (debugconsole) {
				log.logc(loginfo + ".out file exists.", logcolor)
			}

			util.readLockFile(outfile, work, function (success) {
				if (!success) {
					if (debugconsole) {
						log.logc(loginfo + ".out file is locked.  Calling doget().", logcolor)
					}
					doget()
					return
				}
				if (debugconsole) {
					log.logc(loginfo + "Reading .out file.", logcolor)
				}
				fs.readFile(outfile, "utf8", function (err, body) {
					if (err) {
						if (debugconsole) {
							log.logc(loginfo + "Error when reading .out file.  Calling doget().", logcolor)
						}
						doget()
						return
					}
					if (debugconsole) {
						log.logc(loginfo + "Read .out file.  Unlocking and calling finish().", logcolor)
					}
					util.readUnlockFile(outfile, work, function () {
						finish("", body)
					})
				})
			})
		})
	}

	function finish(err, res) {

		var loginfo = work.options.loginfo + " default.process.util.get.finish(): "

		if (err) {
			log.logc(loginfo + err, 160)
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

		if (work.options.debugconsole) {
			log.logc(loginfo + "Extracting data from work.body.", logcolor)
		}
		work.data = work.extractData(work.body, work.options)

		if (work.options.debugconsole) {
			log.logc(loginfo + "Computing MD5 of work.body.", logcolor)
		}
		work.dataMd5 = util.md5(work.data);

		if (work.options.debugconsole) {
			log.logc(loginfo + "Extracting binary from work.body.", logcolor)
		}
		work.dataBinary = work.extractDataBinary(work.body, "bin");
		
		if (work.options.debugconsole) {
			log.logc(loginfo + "Extracting metadata from work.body.", logcolor)
		}
		work.dataJson = work.extractDataJson(work.body, work.options);
		work.datax    = work.extractRem(work.body, work.options);
		work.meta     = work.extractMeta(work.body, work.options);
		work.metaJson = work.extractMetaJson(work.body, work.options);
		
		if (work.options.debugconsole) {
			log.logc(loginfo + "Calling util.writeCache.", logcolor)
		}
		util.writeCache(work, function (work) {callback(false, work)})
	}

	function doget() {

		var loginfo = work.options.loginfo + " default.process.doget(): "

		if (work.url.match(/^http/)) {

			if (debugconsole) {
				log.logc(loginfo + "Called with work.url = " + work.url, logcolor)
			}
			
			var sz = 0
			var body

			if (debugconsole) {
				log.logc(loginfo + "Getting: " + work.url, logcolor)
			}

			var headers = work.options.acceptGzip ? {"accept-encoding": "gzip, deflate"} : {}

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
					log.logc(loginfo + "Finished writing tmp .out file.", logcolor)
				}
				function rmfile() {
					// No lock will ever exist on this file as it depends on job id.
					log.logc(loginfo + "Removing tmp .out file because of error getting file.", logcolor)
					fs.unlink(outfiletmp, function (err) {
						if (err) {
							log.logc(loginfo + "Could not remove tmp .out file.", 160)
						}						
					})
				}

				if (work.error !== "") { rmfile(); return }

				util.writeLockFile(outfile, work, function (success) {
					if (!success) {
						log.logc(loginfo + "Could not rename tmp .out file.", 160)
						rmfile()
						return
					}
					// TODO: If forceWrite = false and MD5 has not changed, delete tmp file?
					fs.rename(outfiletmp, outfile, function (err) {
						if (err) {
							log.logc(loginfo + "Error when trying to rename tmp .out file.", logcolor)
						} else {
							if (debugconsole) {
								log.logc(loginfo + "Renamed tmp .out file.", logcolor)
							}
							util.writeUnlockFile(outfile, work, function () {})
						}
					})
				})
			})
			// Will need to move code for unzipping to extractData in default.js

			work.getStartTime = new Date()

			util.get(work.url, function (error, response, body) {

				var loginfo = work.options.loginfo + " default.process.doget.util.get(): "

				if (error) {
					work.error = error
					if (debugconsole) {
						log.logc(loginfo + "Error when attempting GET: " + error, logcolor)
					}
					callback(true, work)
					return
				}

				if (response.statusCode !== 200) {
					work.error = "HTTP Error " + response.statusCode;
					if (debugconsole) {
						log.logc(loginfo + "Non-200 status code when attempting to GET: " + response.statusCode, logcolor)
					}
					callback(true, work)
					return
				} else {
					work.header = response.headers;
					if (debugconsole)  {
						log.logc(loginfo + "Got " + work.url, logcolor)
						log.logc(loginfo + "Headers: " + JSON.stringify(response.headers), logcolor)
					}
					if (response.headers["content-encoding"] === "gzip" || response.headers["content-type"] === "application/x-gzip") {
						if (debugconsole) {
							log.logc(loginfo + "Content-Type is application/x-gzip", logcolor)
						}
					    zlib.gunzip(body, finish)
					} else {
						magic.detect(body, function(err, result) {
							if (result.match(/^gzip/)) {
								if (debugconsole) {
									log.logc(loginfo + "Content-Encoding is not gzip and Content-Type is not application/x-gzip, but buffer is gzipped.", logcolor)
								}
								if (err) throw err;
								zlib.gunzip(body, finish)
							} else {
								if (debugconsole) {
									log.logc(loginfo + "Calling finish().", logcolor)
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
			// .on('connect', function(res, socket, head) {
	    		// This is not emitted by request (https://github.com/request/request)
	    	//	console.log(work.options.loginfo + " ---- default.process.util.get(): Connected.  Header: "+head, logcolor)
	    	//})
			.pipe(outfiletmpstream)
			.on("data", function (data) {
				// TODO: If file size is found to be large, stop reading into memory and use
				// outfile as work.body and set work.bodyfile = work.urlMd5base + ".tmp".
				sz = sz + data.length;
				
				if (debugconsole) {
					log.logc(loginfo + "Got first chunk of size [bytes] " + data.length, logcolor)
				}
				work.getFirstChunkTime = new Date();
			})
			.on("end", function () {
				if (debugconsole) {
					log.logc(loginfo + "On end event.  Size [bytes]     " + sz, logcolor)
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
	var lineRegExp   = options.lineRegExp
	var logcolor     = options.logcolor
	var loginfo      = options.loginfo + " default.extractData(): "

	if (options.lineFormatter !== "") {
		if (debugconsole) {
			log.logc(options.loginfo + " default.extractData(): Reading " + __dirname + "/" + options.lineFormatter + ".js", logcolor)
		}
		var lineFormatter = require(__dirname + "/" + options.lineFormatter + ".js")
	}
	
	if (options.unsafeEval) {
		if (debugconsole) {
			log.logc(loginfo + "Using unsafe eval because extractData and lineRegExp are default values.", logcolor)
			log.logc(loginfo + "Evaluating " + options.extractData, logcolor)
			log.logc(loginfo + "lineRegExp = " + lineRegExp, logcolor)
		}
		return eval(options.extractData)
	}

	if (debugconsole) {
		log.logc(loginfo + "Using safe eval because extractData or lineRegExp are not default values.", logcolor)
		log.logc(loginfo + "Evaluating " + options.extractData, logcolor)
		log.logc(loginfo + "lineRegExp = " + lineRegExp, logcolor)
	}

	//Not needed, even though body is a buffer.
	//body = body.toString()

	var window
	var $
	try {
		window = jsdom.jsdom(body).createWindow()
		$ = jquery.create(window)
	} catch(e) {
		log.logc(loginfo + "Error when trying to parse data as html, probably it is not in valid html format.", 160)
	}
	
	try {
		if (debugconsole) {
			log.logc(loginfo + "Using safe eval because extractData or lineRegExp specified as input.", logcolor)
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
		log.logc(loginfo + "Error in trying to eval options.extractData: " + JSON.stringify(e), 160)
		return "Error occurred while extracting data\n"
	}
}

exports.extractDataJson = function (body, options) {return {}}

exports.dataToJson = function (data, options) {return {}}

exports.extractMeta = function (body, options) {return ""}

exports.extractMetaJson = function (body, options) {return {}}

exports.metaToJson = function (meta) {return {}}

exports.extractRem = function (body, options) {return ""}

exports.postprocess = function (work, callback) {callback(false, work)}
