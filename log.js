var fs     = require("fs") ;
var clc    = require('cli-color');
var mkdirp = require("mkdirp");
var crypto = require("crypto");

// Create directories, add absolute paths if needed.
function init(config) {

	// Base log directory
	if (!config.LOGDIR.match(/^\//)) {
		// If relative path given for CACHEDIR, prepend with __dirname.
		config.LOGDIR   = __dirname+"/log/"
	}
	config.LOGDIRAPPPRIVATE = config.LOGDIR + "application-private/";

	// Log directory for application
	if (!fs.existsSync(config.LOGDIRAPPPRIVATE)) {
		// Create log directory if not found
		mkdirp.sync(config.LOGDIRAPPPRIVATE)
	}
	config.LOGDIRAPPPUBLIC = config.LOGDIR + "application-public/";
	// Log directory for application
	if (!fs.existsSync(config.LOGDIRAPPPUBLIC)) {
		// Create log directory if not found
		mkdirp.sync(config.LOGDIRAPPPUBLIC)
	}

	// Log directory for responses
	config.LOGDIRRES = config.LOGDIR + "responses/";
	if (!fs.existsSync(config.LOGDIRRES)) {
		// Create log directory if not found
		mkdirp.sync(config.LOGDIRRES)
	}
	return config
}
exports.init = init;

// Log to console with color
function logc(str,color) {
	var msg = clc.xterm(color)
	console.log(msg(str));
}
exports.logc = logc;

// Log request information to file
function logres(message, res) {

	var tmp = arguments.callee.caller.toString().match(/function ([^\(]+)/) || '';
	callfn = 'main';
	if (tmp.length > 1) {
		callfn = tmp[1];
	}
	if (!res) {
		console.error("logres() function requires two arguments.")
	}

	var entry = (new Date()).toISOString() + ","+callfn+"," + message + "\n";
	//console.log(res.config.LOGDIRRES+res._headers[res.config.LOGHEADER])
	fs.appendFile(res.config.LOGDIRRES+res._headers[res.config.LOGHEADER], entry, 
			function (err) {
				if (err) console.log(err);
			})
}
exports.logres = logres;

// Log application information to file
function logapp(message, res) {

	if (!logapp.nwriting) logapp.nwriting = 0;
	if (!logapp.entriespublic) logapp.entriespublic = "";
	if (!logapp.entriesprivate) logapp.entriesprivate = "";

	logapp.nwriting = logapp.nwriting + 1;

	var entry = (new Date()).toISOString() + "," + message + "\n";

	var entrypublic = entry.split(",");
	// Create MD5 hash of IP address.  Use only first 8 bytes.  
	entrypublic[2] = crypto.createHash("md5").update(entrypublic[2]).digest("hex").substring(0,8)

	logapp.entriespublic = logapp.entriespublic + entrypublic
	logapp.entriesprivate = logapp.entriesprivate + entry;

	// Prevent too many files from being open at the same time.
	if (logapp.nwriting < 10) {

		var tmp = new Date();
		var yyyymmdd = tmp.toISOString().substring(0,10);
		
		// Write to requests.log
		var fileprivate = res.config.LOGDIRAPPPRIVATE + "tsdsfe_"+yyyymmdd+".log";
		var filepublic = res.config.LOGDIRAPPPUBLIC + "tsdsfe_"+yyyymmdd+".log";

		fs.appendFile(fileprivate, logapp.entriesprivate, 
			function(err){
				logapp.entriesprivate = "";
				logapp.nwriting = logapp.nwriting - 1;
				if (err) console.log(err);
			});
		fs.appendFile(filepublic, logapp.entriespublic, 
				function(err){
					logapp.entriespublic = "";
					logapp.nwriting = logapp.nwriting - 1;
					if (err) console.log(err);
				});

	}
}
exports.logapp = logapp;
