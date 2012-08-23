var request = require("request"),
	util = require("./util.js");

var logger = require("./logger.js");

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
			work.body = body;
			work.data = work.extractData(body);
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

exports.extractData = function(data){
	return data;
};

exports.postprocess = function(work, callback){
	var err = false;
	callback(err, work);
};

