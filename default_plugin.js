var request = require("request"),
	util = require("./util.js");

var TIMEOUT = 20000;
var MAXCONNECTION = 10000;

exports = module.exports = {};

exports.match = function(url){
	return true;
}

exports.preWorkProcess = function(work, callback){
	callback(work);
};

exports.process = function(work, callback){
	var start = new Date;
	var headers = work.options.acceptGzip ? {"accept-encoding" : "gzip, deflate"} : {};
	work.requestSentTime = new Date();
	request.get({uri: work.url, timeout: TIMEOUT,  pool: {maxSockets : MAXCONNECTION}, headers:headers, encoding: null}, function(error, response, body){
		if(error || response.statusCode!==200){
			work.error = "Can't fetch data";
			callback(work);
		} else {
			var end = +new Date();
			work.time = (end -start);
			work.body = body;
			work.data = exports.extractData(body);
			work.md5 =  util.md5(work.data);
			work.header = response.headers;
			work.responseFinshedTime = new Date();
			util.writeCache(work, function(){
				callback(work);
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

exports.postWorkProcess = function(work, callback){
	callback(work);
};

