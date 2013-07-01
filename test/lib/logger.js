var fs = require("fs");

var logDir = __dirname + "/../log"
/*
	A factory function to create a logger. 
	fileName is the name of the log file without suffix. If 
	it is omitted logs will be written to "main.log".
*/
module.exports = function(fileName){
	// Create the "log" directory if it doesn't exist
	try {
		fs.mkdirSync(logDir);
	} catch(e){}

	return new Logger(fileName);
}

function Logger(fileName){
	fileName = fileName || "main";
	this.file = logDir + "/" + fileName + ".log";
}

// log a message with level INFO
Logger.prototype.i = Logger.prototype.log = function(msg){
	this.write("INFO", msg);
}

// log a message with level ERROR
Logger.prototype.e = function(msg){
	this.write("ERROR", msg);
}

Logger.prototype.write = function(level, msg){
	var entry = format(level, msg);
	console.log(entry);
	fs.appendFileSync(this.file, entry + "\n");
}

// return a formatted entry without newline
function format(level, msg){
	return ["[", level, "]", new Date, msg].join(" ");
}