var request = require("request");
var zlib    = require('zlib');

var util    = require("../util.js");

var logger = require("../logger.js");

var localeval = require("localeval");
var jsdom = require("jsdom");
var jquery = require("jquery");

exports.name  = "default";
exports.version = "1.0.0";

exports.match = function (url) {return false;}

exports.preprocess = function (work, callback) {callback(false, work)};

exports.process = function (work, callback) {

	// TODO: If work.urlMd5base exists, set work.body to be urlMd5base.out, work.dataBinary to be urlMd5base.bin, etc. and return.
	
	console.log("default.js: process() called.")
	if (work.url.match(/^http/)) {
		var headers = work.options.acceptGzip ? {"accept-encoding" : "gzip, deflate"} : {};
		var sz = 0;
		util.get(work.url, function (error, response, body) {
			if (error || response.statusCode!==200){
				work.error = "Can't fetch data";
				console.log("Error when attempting to GET " + work.url)
				callback(true, work);
			} else {
				
				console.log("Done.")
				if (response.headers["content-type"] === "application/x-gzip") {
					//console.log("Content-Type is application/x-gzip")
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
	
					util.writeCache(work, function () {callback(false, work);});
				}
			}
		})
		.on("error", function(data){
			console.log("default.js: Error.")
		})
		.on("end", function(data){
			console.log("default.js: End.")
			if (!work.getEndTime) {
			    work.getEndTime = new Date();
			}
		})
		.on("data", function(data){
			sz = sz + data.length;
			
			if (!work.getFirstChunkTime) {
				console.log("default.js: Got first chunk of size [bytes] " + data.length);
				//console.log("default.js: Got first chunk.")
			    work.getFirstChunkTime = new Date();
			}
		});
	} else if (work.url.match(/^ftp/)) {
		var FtpClient  = require("ftp");
		var conn = new FtpClient();
		var host = work.url.split("/")[2];
		var filepath = work.url.split("/").slice(3).join("/");

		logger.d("ftp connecting... ");
		logger.d("host: " + host);
		logger.d("connect func: " + conn.connect);
		conn.on("ready", function(){
				
				// TODO: Write .header file.
				//conn.list(filepath, function(err,list) {
				//	console.log(err);
				//	console.log(list);
				//})
			
				conn.get(filepath, function(err, stream){
					if(err){
						work.error=err;callback(true, work);conn.end();
					} else{
						var buff = "";
						stream.on("data", function(data){
							if(!work.responseTime) {
							    //work.responseTime = new Date();
							}
							buff+=data.toString();
						})
						.on("error", function(e){work.error=e;callback(true, work);conn.end();})
						.on("end", function(){
							work.body = buff;
							work.data = work.extractData(work.body, work.options);
							work.dataMd5 =  util.md5(work.data);
							work.header = "";
							util.writeCache(work, function(){
								callback(false, work);
							});
						});
					}
				});
		})
		.on("error", function(e){
			logger.d("ftp error: " + e);

			work.error=e;
			callback(true, work);
			conn.end();
		})
		conn.connect({host: host});
	} else {
		console.log("Error.  Protocol" + work.url.replace(/^(.*)\:.*/,"$1") + " is not supported.");
	}
};

exports.extractDataBinary = function (body, options) {return "";};

exports.extractSignature = function (options) {
	if (options.lineFormatter !== "") {
	    var lineFormatter = require(__dirname + "/" + options.lineFormatter + ".js");
		return lineFormatter.extractSignature(options);
	} else {
		return "";
	}
}

exports.extractData = function (body, options) {

	var lineRegExp = options.lineRegExp;

	//console.log(lineRegExp)
	//if (lineRegExp === ".") return body.toString();

	if (options.lineFormatter !== "") {
		var lineFormatter = require(__dirname + "/" + options.lineFormatter + ".js");
	}
	
	if (options.unsafeEval) {
	    //console.log("Using unsafe eval");
	    return eval(options.extractData);
	}

	var window
	var $;
	try {
		window = jsdom.jsdom(body).createWindow();
		$ = jquery.create(window);	
	} catch(e) {
		logger.d("Error when trying to parse data as html, probably it is not in valid html format.");
	}
	
	try {
	    //console.log("Using safe eval");
		return localeval(options.extractData.replace(/jQuery/g,"\$"), {
			$: $,
			document: window.document,
			out: body,
			body: body,
	        lineRegExp: new RegExp(options.lineRegExp),
		    lineFormatter: lineFormatter,
		    options: options
		});
	} catch(e) {
		console.log("Error in trying to eval options.extractData: ", e, options.extractData);
		logger.d("Error in trying to eval options.extractData: ", e, options.extractData);
		return "Error occurred while extracting data\n";
	}
};

exports.extractDataJson = function(body, options) {return {};};

exports.dataToJson = function(data, options) {return {};}

exports.extractMeta = function(body, options) {return "";}

exports.extractMetaJson = function (body, options) {return {};}

exports.metaToJson = function (meta){return {};}

exports.extractRem = function(body, options){return "";}

exports.postprocess = function(work, callback){callback(false, work);};
