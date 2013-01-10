var request = require("request");
var util = require("../util.js");

exports.match = function(url){
	return false;
}

exports.name = "_httpdemo";

exports.preprocess = function(work, callback){
	var err = false;
	callback(err, work);
};

exports.process = function(work, callback){
	
	if (work.url.match(/^http/)) {
		var headers = work.options.acceptGzip ? {"accept-encoding" : "gzip, deflate"} : {};
		util.get(work.url, function(error, response, body){
			if(error || response.statusCode!==200){
				work.error = "Can't fetch data";
				callback(true, work);
			} else {
				work.body = body || "";
				work.data = work.extractData(work.body);
				work.dataMd5 = util.md5(work.data);
				work.dataJson = work.extractDataJson(work.body);
				work.datax = work.extractRem(work.body);
				work.meta = work.extractMeta(work.body);
				work.metaJson = work.extractMetaJson(work.body);
				work.header = response.headers;
				util.writeCache(work, function(){
					callback(false, work);
				});
			}
		})
		.on("end", function(data){
			if(!work.getEndTime) {
			    work.getEndTime = new Date();
			}
		})
		.on("data", function(data){
			if(!work.getFirstChunkTime) {
			    work.getFirstChunkTime = new Date();
			}
		});
	} else if (work.url.match(/^ftp/)) {
		var FtpClient  = require("ftp");
		var conn = new FtpClient({host: work.url.split("/")[2]});
		conn.on("connect", function(){
			conn.auth(function(err){
				conn.get(work.url.split("/").slice(3).join("/"), function(err, stream){
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
							work.data = work.extractData(work.body);
							work.dataMd5 =  util.md5(work.data);
							work.header = "";
							util.writeCache(work, function(){
								callback(false, work);
							});
						});
					}
				});
			})
		})
		.connect();
	} else {
		console.log("Error.  Protocol" + work.url.replace(/^(.*)\:.*/,"$1") + " is not supported.");
	}
};

exports.extractData = function(body){
	return body;
};

exports.extractDataJson = function(body){
	return {};
};

exports.dataToJson = function(data){
	return {};
}

exports.extractMeta = function(body){
	return "";
}

exports.extractMetaJson = function(body){
	return {};
}

exports.metaToJson = function(meta){
	return {};
}

exports.extractRem = function(body){
	return "";
}

exports.postprocess = function(work, callback){
	var err = false;
	callback(err, work);
};
