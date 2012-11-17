var request = require("request"),
	util = require("../util.js");

exports.match = function(url){
	return false;
}

exports.preprocess = function(work, callback){
	var err = false;
	callback(err, work);
};

exports.process = function(work, callback){
	var headers = work.options.acceptGzip ? {"accept-encoding" : "gzip, deflate"} : {};
	util.get(work.url, function(error, response, body){
		if(error || response.statusCode!==200){
			work.error = "Can't fetch data";
			callback(true, work);
		} else {
			work.body = body || "";
			work.data = work.extractData(work.body);
			work.dataJson = work.extractDataJson(work.body);
			work.datax = work.extractRem(work.body);
			work.meta = work.extractMeta(work.body);
			work.metaJson = work.extractMetaJson(work.body);
			work.md5 =  util.md5(work.data);
			work.header = response.headers;
			util.writeCache(work, function(){
				callback(false, work);
			});
		}
	})
	.on("data", function(data){
		if(!work.responseTime) {
			work.responseTime = new Date();
		}
	});
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

