var request = require("request");
var util    = require("../util.js");

var logger = require("../logger.js");

var localeval = require("localeval");
var jsdom = require("jsdom");
var jquery = require("jquery");

exports.name  = "_httpdemo";
exports.match = function (url) {return false;}

exports.preprocess = function (work, callback) {callback(false, work)};

exports.process = function (work, callback) {

	if (work.url.match(/^http/)) {
		var headers = work.options.acceptGzip ? {"accept-encoding" : "gzip, deflate"} : {};
		util.get(work.url, function (error, response, body) {
			if (error || response.statusCode!==200){
				work.error = "Can't fetch data";
				callback(true, work);
			} else {
				work.body       = body || "";
				work.dataBinary = work.extractDataBinary(work.body, "bin");
				work.data       = work.extractData(work.body, work.options);
				work.dataMd5    = util.md5(work.data);
				work.dataJson   = work.extractDataJson(work.body, work.options);
				work.datax      = work.extractRem(work.body, work.options);
				work.meta       = work.extractMeta(work.body, work.options);
				work.metaJson   = work.extractMetaJson(work.body, work.options);
				work.header     = response.headers;
				//console.log(work.header);
				util.writeCache(work, function () {callback(false, work);});
			}
		})
		.on("end", function(data){
			if (!work.getEndTime) {
			    work.getEndTime = new Date();
			}
		})
		.on("data", function(data){
			if (!work.getFirstChunkTime) {
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
				conn.get(filepath, function(err, stream){
					if(err){
						callback(true, work);
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

exports.extractData = function (body, options) {
	var window
	var $;
	try {
		window = jsdom.jsdom(body).createWindow();
		$ = jquery.create(window);	
	} catch(e){
		logger.d("Error in trying to parse data as html, probably it is not in valid html format");
	}

	try {
		return localeval(options.extractData, {
			$: $,
			document: window.document,
			out: body,
			body: body,
			lineRegExp: new RegExp(options.lineRegExp)
		});
	} catch(e) {
		logger.d("Error in trying to eval options.extractData: ", e, options.extractData);
		return "Error occurred while extracting data";
	}
};

exports.extractDataJson = function(body, options) {return {};};

exports.dataToJson = function(data, options) {return {};}

exports.extractMeta = function(body, options) {return "";}

exports.extractMetaJson = function (body, options) {return {};}

exports.metaToJson = function (meta){return {};}

exports.extractRem = function(body, options){return "";}

exports.postprocess = function(work, callback){callback(false, work);};
