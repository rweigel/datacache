var fs = require("fs");

var util = require("./util.js");

var clients = [];

function bindClientList(list){
	clients = list;
}
exports.bindClientList = bindClientList;

function log(type, work){
	//write to application.log
	var file = __dirname + "/application.log";
	var entry = util.formatTime(new Date()) + "\t" + type + "\t" +work.url+"\n";
	fs.appendFile(file, entry, function(err){
		// console.log(err);
	});

	// write to stout
	console.log(entry);

	// write to clients
	clients.forEach(function(socket){
		socket.emit("log", {
			type: type,
			work: work ? {
				id: work.id,
				error: work.error,
				time: work.time,
				tries: work.tries,
				url: work.url,
				urlMd5: work.urlMd5,
				dataMd5: work.dataMd5,
				isFromCache: work.isFromCache
			} 
			: false
		})
	})
}
exports.log = log;