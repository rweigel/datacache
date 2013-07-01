var request = require("request"),
	crypto = require("crypto");

function get(url, callback){
    var opts = {	
		uri: url,
		// timeout: 20000,
		encoding: null,
		pool: {maxSockets : 1000}
    };
    
    return request.get(opts, callback);
}
exports.get = get;

function md5(str){
	return crypto.createHash("md5").update(str).digest("hex");
}
exports.md5 = md5;