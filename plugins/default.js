var request   = require("request");
var zlib      = require('zlib');
var localeval = require("localeval");
var jsdom     = require("jsdom");
var jquery    = require("jquery");

var util      = require("../util.js");
var log       = require("../log.js");

exports.name  = "default";
exports.version = "1.0.0";

exports.match = function (url) {return false}

exports.preprocess = function (work, callback) {callback(false, work)}

exports.process = function (work, callback) {

	// TODO: If work.urlMd5base exists, set work.body to be
	// urlMd5base.out, work.dataBinary to be urlMd5base.bin, etc. and return.
	
	debug = work.options.debugplugin;
	debugconsole = work.options.debugpluginconsole;

	var logcolor   = work.options.logcolor;

	if (work.url.match(/^http/)) {
		if (debugconsole) {
			log.logc(work.options.loginfo + " default.process(): Called with work.url = " + work.url,logcolor)
		}
		var headers = work.options.acceptGzip ? {"accept-encoding" : "gzip, deflate"} : {};
		var sz = 0;
		if (debugconsole) {
			log.logc(work.options.loginfo + " default.process(): Getting: " + work.url,logcolor)
		}
		util.get(work.url, function (error, response, body) {
			if (error || response.statusCode !== 200) {
				work.error = "Can't fetch data";
				if (debugconsole) {
					log.logc(work.options.loginfo + " default.process(): Error when attempting to GET " + work.url, logcolor)
				}
				callback(true, work);
			} else {
				if (debugconsole)  {
					log.logc(work.options.loginfo + " default.process(): Got " + work.url,logcolor)				
					log.logc(work.options.loginfo + " default.process(): Headers: " + JSON.stringify(response.headers),logcolor)
				}
				if (response.headers["content-encoding"] === "gzip" || response.headers["content-type"] === "application/x-gzip") {
				    if (debugconsole) {
				    	console.log("Content-Type is application/x-gzip")
				    }
				    zlib.gunzip(body,cb);
				} else {
					//console.log("Content-Type is not application/x-gzip")
					cb("",body);
				}
					
				function cb(err,res) {
					if (err) console.log(err);
					work.body       = res || "";
					work.data       = work.extractData(work.body, work.options);
					work.dataMd5    = util.md5(work.data);
					work.dataBinary = work.extractDataBinary(work.body, "bin");
					work.dataJson   = work.extractDataJson(work.body, work.options);
					work.datax      = work.extractRem(work.body, work.options);
					work.meta       = work.extractMeta(work.body, work.options);
					work.metaJson   = work.extractMetaJson(work.body, work.options);
					work.header     = response.headers;
	
					util.writeCache(work, function () {callback(false, work)})
				}
			}
		})
		.on("error", function(data){
			if (debugconsole) {
				log.logc(work.options.loginfo + " default.process(): On error event.", logcolor)
			}
		})
		.on("end", function(data){
			if (debugconsole) {
				log.logc(work.options.loginfo + " default.process(): On end event.  Size [bytes]     " + sz, logcolor)
			}
			if (!work.getEndTime) {
			    work.getEndTime = new Date();
			}
		})
		.on("data", function(data){
			sz = sz + data.length;
			
			if (!work.getFirstChunkTime) {
				if (debugconsole) {
					log.logc(work.options.loginfo + " default.process(): Got first chunk of size [bytes] " + data.length, logcolor)
				}
			    work.getFirstChunkTime = new Date();
			}
		});
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
							util.writeCache(work, function(){callback(false, work)})
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

exports.extractDataBinary = function (body, options) {return ""}

exports.extractSignature = function (options) {
	if (options.lineFormatter !== "") {
	    var lineFormatter = require(__dirname + "/" + options.lineFormatter + ".js")
		return lineFormatter.extractSignature(options)
	} else {
		return ""
	}
}

exports.extractData = function (body, options) {

	var logcolor   = work.options.logcolor
	var lineRegExp = options.lineRegExp

	if (options.lineFormatter !== "") {
		var lineFormatter = require(__dirname + "/" + options.lineFormatter + ".js")
	}
	
	if (options.unsafeEval) {
		log.logc(work.options.loginfo + " default.extractData(): Using unsafe eval", logcolor)
	    return eval(options.extractData)
	}

	var window
	var $;
	try {
		window = jsdom.jsdom(body).createWindow()
		$ = jquery.create(window)
	} catch(e) {
		log.logc(work.options.loginfo + " default.extractData(): Error when trying to parse data as html, probably it is not in valid html format.", 160)
	}
	
	try {
		log.logc(work.options.loginfo + " default.extractData(): Using safe eval", logcolor)
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
		log.logc(work.options.loginfo + " default.extractData(): Error in trying to eval options.extractData: " + JSON.stringify(e), logcolor)
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
