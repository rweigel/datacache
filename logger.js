var fs   = require("fs") ;
var util = require("./util.js");

var clients = [];

function bindClientList(list) {clients = list;}
exports.bindClientList = bindClientList;

function log(type, work){

	// Write to requests.log
	var file = __dirname + "/log/datacache.log";
	//console.log(file);
	var entry = util.formatTime(new Date()) + "\t" + type + "\t" +work.url+"\n";
	fs.appendFile(file, entry, function(err){if (err) console.log(err);});

	// Write to STDOUT
	var entry0 = util.formatTime(new Date()) + "\t" + type + "\t" +work.url;
	//console.log(entry0);

	// Write to clients
	clients.forEach(function(socket){
		socket.emit("log", {
			type: type,
			work: work ? {
				id: work.id,
				error: work.error,
				time: new Date() - work.jobStartTime,
				tries: work.tries,
				url: work.url,
				urlMd5: work.urlMd5,
				dataMd5: work.dataMd5,
				dataLength: work.dataLength,
				isFromCache: work.isFromCache
			} 
			: false
		})
	})
}
exports.log = log;