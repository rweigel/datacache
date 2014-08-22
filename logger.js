var fs   = require("fs") ;
var util = require("./util.js");

var clients = [];

// speicfy current logging level. 
// Possbile values: 0 (DEBUG), 1 (INFO), 2 (ERROR)
// Only message with level >= current settings will be print to the screen. 
// For example, if level =1, logger.e("err") will prints to console, 
// while logger.d("a message") will not print to console.
// This variable can be set through environment variable: export dc_log_level=[all|debug|info|error]
// By default it is set to 2 and only prints errors.
var level;
var levelsetting = process.env.dc_log_level && process.env.dc_log_level.toLowerCase().trim();
if( levelsetting === "all"){
	level = -1;
} else if( levelsetting === "debug" ){
	level = 0;
} else if( levelsetting === "info" ){
	level = 1;
} else {
	level = 2;
}

function formatLogEntry(msgs){
	return new Date() + " " + Array.prototype.slice.call(msgs, 0).join(" ");
}

// print an error
exports.e = e;
function e(){
	if(level <=2){
		console.log("[ERROR] "+ formatLogEntry(arguments));
	}
} 

// print an info
exports.i = i;
function i(){
	if(level <=1){
		console.log("[INFO] "+ formatLogEntry(arguments));
	}
} 

// print a debug
exports.d = d;
function d(){
	if(level <=0){
		console.log("[DEBUG] "+ formatLogEntry(arguments));
	}
} 

function bindClientList(list) {clients = list;}
exports.bindClientList = bindClientList;

function log(type, work){

	if (!log.nwriting) log.nwriting = 0;
	if (!log.entries) log.entries = "";

	log.nwriting = log.nwriting + 1;

	var entry = util.formatTime(new Date()) + "\t" + type + "\t" +work.url+"\n";


	log.entries = log.entries + entry;

	// This is to prevent too many files from being open at the same time.
	if (log.nwriting < 10) {

		//Write to STDOUT
		//console.log(entry.replace(/\n\n$/,"\n"));

		var tmp = new Date();
		var yyyymmdd = tmp.toISOString().substring(0,10);
		// Write to requests.log
		var file = __dirname + "/log/datacache_"+yyyymmdd+".log";

		fs.appendFile(file, log.entries, 
			function(err){
				log.entries = "";
				log.nwriting = log.nwriting - 1;
				if (err) console.log(err);
			});
	}

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