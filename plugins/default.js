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

	var dir        = util.getCacheDir(work)
	var outfiletmp = dir + work.urlMd5base + ".out" + "." + work.id
	var outfile    = dir + work.urlMd5base + ".out"

	if (work.options.forceWrite && work.options.forceUpdate) {
		mkdirp(dir, doget)
	} else {

		log.logres("Looking for .out file.", work.options, "plugin")

		fs.exists(outfile, function (exist) {

			if (!exist) {
				log.logres(".out file does not exist. Calling doget().",
								work.options, "plugin")
				mkdirp(dir, doget)
				return
			}
			log.logres(".out file exists.", work.options, "plugin")

			util.readLockFile(outfile, work, function (success) {
				if (!success) {
					log.logres(".out file is locked.  Calling doget().",
									work.options, "plugin")
					doget()
					return
				}
				log.logres("Reading .out file.", work.options, "plugin")
				fs.readFile(outfile, "utf8", function (err, body) {
					if (err) {
						log.logres("Error when reading .out file.  Calling doget().",
										work.options, "plugin")
						doget()
						return
					}
					log.logres("Read .out file.  Unlocking and calling finish().",
									work.options, "plugin")
					util.readUnlockFile(outfile, work, function () {
						finish("", body)
					})
				})
			})
		})
	}

	function finish(err, res) {

		if (err) {
			log.logc(err, 160)
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
		work.body = res || ""

		log.logres("Extracting data from work.body.", work.options, "plugin")
		work.data = work.extractData(work.body, work.options)

		log.logres("Computing MD5 of work.body.", work.options, "plugin")
		work.dataMd5 = util.md5(work.data);

		log.logres("Extracting binary from work.body.", work.options, "plugin")
		work.dataBinary = work.extractDataBinary(work.body, "bin")

		log.logres("Extracting metadata from work.body.", work.options, "plugin")
		work.dataJson = work.extractDataJson(work.body, work.options)
		work.datax    = work.extractRem(work.body, work.options)
		work.meta     = work.extractMeta(work.body, work.options)
		work.metaJson = work.extractMetaJson(work.body, work.options)
		
		log.logres("Calling util.writeCache.",  work.options, "plugin")
		util.writeCache(work, function (work) {callback(false, work)})
	}

	function doget() {

		if (work.url.match(/^http/)) {

			log.logres("Called with work.url = " + work.url, work.options, "plugin")
			
			var sz = 0
			var body

			log.logres("Getting: " + work.url, work.options, "plugin")

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
				log.logres("Finished writing ." + work.id + ".out file", work.options, "plugin")
				function rmfile() {
					// No lock will ever exist on tmp file as it depends on job id.
					fs.unlink(outfiletmp, function (err) {
						if (err) {
							log.logres("Could not remove .out." + work.id + " file", work.options, "plugin")
						}				
					})
				}

				if (work.error !== "") { 
					log.logres("Removing .out." + work.id + " file because of error getting file: " + work.error, work.options, "plugin")
					rmfile()
					return
				}

				// Locks are placed on work file name, not file extension.
				util.writeLockFile(outfile.replace(".out",""), work, function (success) {
					if (!success) {
						log.logres("Could not rename "+outfiletmp.replace(__dirname+"/cache/",""), work.options, "plugin")
						rmfile()
						return
					}
					// TODO: If forceWrite = false and MD5 has not changed, delete tmp file?
					fs.rename(outfiletmp, outfile, function (err) {
						if (err) {
							// This should never occur.
							log.logc("Error when trying to rename .out." + work.id + " file.", 160)
						} else {
							log.logres("Renamed " + outfiletmp + " to " + outfile, work.options, "plugin")
							util.writeUnlockFile(outfile.replace(".out",""), work, function () {})
						}
					})
				})
			})
			// Will need to move code for unzipping to extractData in default.js

			work.getStartTime = new Date()

			util.get(work.url, function (error, response, body) {

				if (error) {
					work.error = error
					log.logres("Error when attempting GET: " + error, work.options, "plugin")
					callback(true, work)
					return
				}

				if (response.statusCode !== 200) {
					work.error = "HTTP Error " + response.statusCode
					log.logres("Non-200 status code when attempting to GET: " + response.statusCode, work.options, "plugin")
					work.statusCode = response.statusCode
					callback(true, work)
					return
				} else {
					work.header = response.headers
					log.logres("Got " + work.url, work.options, "plugin")
					log.logres("Headers: " + JSON.stringify(response.headers), work.options, "plugin")

					if (!body) {
						log.logres("Body is empty. Calling finish().", work.options, "plugin")
						finish("","")
						return								
					}

					if (response.headers["content-encoding"] === "gzip" || response.headers["content-type"] === "application/x-gzip") {
						log.logres("Content-Type is application/x-gzip", work.options, "plugin")
					    zlib.gunzip(body, finish)
					} else {
						magic.detect(body, function(err, result) {
							if (error) {
								log.logres("magic.detect threw error.  Calling finish().", work.options, "plugin")
								finish("",body)
								return								
							}
							if (!result) {
								log.logres("Calling finish().", work.options, "plugin")
								finish("",body)
								return
							}
							if (result.match(/^gzip/)) {
								log.logres("Content-Encoding is not gzip and Content-Type is not application/x-gzip, but buffer is gzipped.", work.options, "plugin")
								if (err) throw err
								zlib.gunzip(body, finish)
							} else {
								log.logres("Calling finish().", work.options, "plugin")
								finish("",body)
							}
						})
					}
				}

			})
			.pipe(outfiletmpstream)
			.on("data", function (data) {
				// TODO: If file size is found to be large, stop reading into memory and use
				// outfile as work.body and set work.bodyfile = work.urlMd5base + ".tmp".
				sz = sz + data.length;
				log.logres("Got first chunk of size [bytes] " + data.length, work.options, "plugin")
				work.getFirstChunkTime = new Date();
			})
			.on("end", function () {
				log.logres("On end event.  Size [bytes]     " + sz, work.options, "plugin")
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
								log.logc(" default.process(): Error event in conn.get from "+host, 160)
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
					log.logc("Error event in conn.ready from " + host, 160)
					log.logc(JSON.stringify(e), 160)
					work.error = e
					callback(true, work)
					conn.end()
				}
			})
			conn.connect({host: host})
		} else {
			// TODO: Don't retry
			var msg = " URL must start with http or ftp."
			//log.logc(" default.js: Error. " + msg, 160)
			work.abort = true
			work.error = msg
			callback(true, work)
			return
		}
	}

}

exports.extractDataBinary = function (body, options) {return ""}

exports.extractData = function (body, options) {

	var lineRegExp   = options.lineRegExp

	if (options.lineFormatter !== "") {
		log.logres(" default.extractData(): Reading " + __dirname + "/" + options.lineFormatter + ".js", options, "plugin")
		var lineFormatter = require(__dirname + "/" + options.lineFormatter + ".js")
	}
	
	if (options.unsafeEval) {
		log.logres("Using unsafe eval because extractData and lineRegExp are default values.", options, "plugin")
		log.logres("Evaluating " + options.extractData, options, "plugin")
		log.logres("lineRegExp = " + lineRegExp, options, "plugin")
		return eval(options.extractData)
	}

	log.logres("Using safe eval because extractData or lineRegExp are not default values.", options, "plugin")
	log.logres("Evaluating " + options.extractData, options, "plugin")
	log.logres("lineRegExp = " + lineRegExp, options, "plugin")

	//Not needed, even though body is a buffer.
	//body = body.toString()

	var window
	var $
	try {
		window = jsdom.jsdom(body).createWindow()
		$ = jquery.create(window)
	} catch(e) {
		log.logc("Error when trying to parse data as html, probably it is not in valid html format.", 160)
	}
	
	try {
		log.logres("Using safe eval because extractData or lineRegExp specified as input.", options, "plugin")
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
		log.logc("Error in trying to eval options.extractData: " + JSON.stringify(e), 160)
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
