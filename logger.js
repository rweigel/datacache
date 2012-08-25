var fs = require("fs");

var util = require("./util.js");

var clients = [];

function bindClientList(list){
	clients = list;
}
exports.bindClientList = bindClientList;

function log(msg, work){
	//write to application.log
	var file = __dirname + "/application.log";
	var entry = util.formatTime(new Date()) + "\t" + msg + "\n";
	fs.appendFile(file, entry);

	// write to stout
	console.log(entry);

	// write to clients
	clients.forEach(function(socket){
		socket.emit("log", {
			msg: msg,
			work: work ? {
				id: work.id,
				error: work.error,
				time: work.time,
				tries: work.tries,
				url: work.url,
				urlMd5: work.urlMd5,
				md5: work.md5,
				isFromCache: work.isFromCache
			} 
			: false
		})
	})
}
exports.log = log;