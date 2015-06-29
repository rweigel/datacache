var fs     = require("fs");
var clc    = require('cli-color');
var mkdirp = require("mkdirp");
var crypto = require("crypto");
var geoip  = require('geoip-lite');

// Create directories, add absolute paths if needed.
function init(config) {

	// Base log directory
	if (!config.LOGDIR.match(/^\//)) {
		// If relative path given for LOGDIR, prepend with __dirname.
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

	var tmp = arguments.callee.caller.toString().match(/function ([^\(]+)/) || ''
	var callfn = 'main'

	if (tmp.length > 1) {
		callfn = tmp[1]
	}

	if (!res) {
		console.error("logres() function requires two arguments.")
	}

	var entry = (new Date()).toISOString() + ","+callfn+"," + message + "\n"

	fs.appendFile(res.config.LOGDIRRES+res._headers[res.config.LOGHEADER], entry, 
		function (err) {
			if (err) {
				console.log("log.js: Error when attempting to append to response log: ")
				console.log(err)
			}
		})
}
exports.logres = logres;

// Log application information to file
function logapp(message, config) {

	if (!logapp.nwriting) logapp.nwriting = 0;
	if (!logapp.entriespublic) logapp.entriespublic = "";
	if (!logapp.entriesprivate) logapp.entriesprivate = "";

	logapp.nwriting = logapp.nwriting + 1;


	var now   = (new Date()).toISOString()

	// Create MD5 hash of IP address.  Use only first 8 bytes.  	
	var entrypublic  = message.split(" ");

	if (!entrypublic[0].match("127.0.0.1")) {
		//console.log("Looking up " + entrypublic[0].split(",")[0])
		var ip = geoip.lookup(entrypublic[0].split(",")[0])
		//console.log(ip)
		var ips = ip.country + "," + ip.region + "," + ip.city.replace(/\s+/g,"_") + "," + ip.ll[0] + "," + ip.ll[1]
	} else {
		var ips = "localhost"
	}

	var appname = config.APPNAME || "null"
	
	entrypublic[0]   = crypto.createHash("md5").update(entrypublic[0]).digest("hex").substring(0,8)

	logapp.entriespublic  = logapp.entriespublic  + now + " " + entrypublic.join(" ")  +              "\n"
	logapp.entriesprivate = logapp.entriesprivate + now + " " +        message         + " " + ips + "\n"

	// Prevent too many files from being open at the same time.
	if (logapp.nwriting < 10) {

		var tmp = new Date();
		var yyyymmdd = tmp.toISOString().substring(0,10);
		
		// Write to requests.log
		var fileprivate = config.LOGDIRAPPPRIVATE + appname + "_"+yyyymmdd + ".log";
		var filepublic  = config.LOGDIRAPPPUBLIC  + appname + "_"+yyyymmdd + ".log";

		fs.appendFile(fileprivate, logapp.entriesprivate, 
			function(err){
				logapp.entriesprivate = ""
				logapp.nwriting = logapp.nwriting - 1
				if (err) console.log(err)
			});
		fs.appendFile(filepublic, logapp.entriespublic, 
			function (err) {
				logapp.entriespublic = ""
				logapp.nwriting = logapp.nwriting - 1
				if (err) {
					console.log("log.js: Error when attempting to append to response log: ")
					console.log(err)
				}
			})
	}
}
exports.logapp = logapp;
