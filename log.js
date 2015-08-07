var fs     = require("fs")
var clc    = require("cli-color")
var mkdirp = require("mkdirp")
var crypto = require("crypto")
var geoip  = require("geoip-lite")

// Create directories, add absolute paths if needed.
function init(config) {
	// Base log directory
	if (!config.LOGDIR.match(/^\//)) {
		// If relative path given for LOGDIR, prepend with __dirname.
		config.LOGDIR = __dirname + "/log/"
		mkdirp.sync(config.LOGDIR)
	}
	if (!config.LOGDIRAPPPRIVATE) {
		config.LOGDIRAPPPRIVATE = config.LOGDIR + "application-private/"
	}
	if (!config.LOGDIRAPPPUBLIC) {
		config.LOGDIRAPPPUBLIC = config.LOGDIR + "application-public/"
	}
	// Log directory for application
	if (!fs.existsSync(config.LOGDIRAPPPRIVATE)) {
		// Create log directory if not found
		mkdirp.sync(config.LOGDIRAPPPRIVATE)
	}
	// Log directory for application
	if (!fs.existsSync(config.LOGDIRAPPPUBLIC)) {
		mkdirp.sync(config.LOGDIRAPPPUBLIC)
	}
	// Log directory for responses
	if (!config.LOGDIRRES) {
		config.LOGDIRRES = config.LOGDIR + "responses/"
	}
	if (!fs.existsSync(config.LOGDIRRES)) {
		mkdirp.sync(config.LOGDIRRES)
	}
	return config
}
exports.init = init

// Log to console with color
function logc(str, options) {

	if (typeof(options) === "number") {
		var color = options
	} else {
		var color = options.logcolor || 0
	}
	var sig    = options.logsig
	var appstr = options.appname || ""

	if (!logc.timers) logc.timers = {}
	if (!logc.timers[sig]) logc.timers[sig] = (new Date()).getTime()
	var now = (new Date()).getTime()
	var dt = now - logc.timers[sig]
	logc.timers[sig] = now

	// Pad times assuming largest value will be 999
	var dtp = ""
	if (dt < 10) {dtp = "  "}
	if (dt < 100 && dt > 9) {dtp = " "}

	var msgfn = clc.xterm(color)
	console.log(appstr + msgfn(dtp + dt + " " + str))
}
exports.logc = logc

// Log request information to file
function logres(message, options, context) {

	if (!context) context = "app"
	
	var logtofile    = options.debug[context]
	var logtoconsole = logtofile

	if (!logtofile && !logtoconsole) return

	//var stack = new Error().stack
	//console.log( stack.split("\n") )

	if (!options) {
		console.error("logres() function requires two arguments.")
	}

	// Extract calling function name.
	var tmp = arguments.callee.caller
					.toString()
					.match(/function ([^\(]+)/) || ''

	if (tmp.length > 1) {
		context = tmp[1]
	}

	var pn = ""
	if (typeof(options.partnum) === "number") {
		pn = " p" + (options.partnum + 1)
	}
	var id = ""
	if (options.workerid > 0) {
		id = "w" + options.workerid + " "
	}
	if (logtoconsole) {
		logc(id + options.logsig + pn + " " + context + ": " + message, options)
	}

	if (!logtofile) return

	var entry = (new Date()).toISOString() 
					+ ","
					+ context
					+ "," 
					+ message + "\n"


	fs.appendFile(options.logfile, entry, 
		function (err) {
			if (err) {
				console.log(
					"log.js: Error when attempting to append to response log: ")
				console.log(err)
			}
		})
}
exports.logres = logres

// Log application information to file
function logapp(message, config) {

	if (!logapp.nwriting) logapp.nwriting = 0
	if (!logapp.entriespublic) logapp.entriespublic = ""
	if (!logapp.entriesprivate) logapp.entriesprivate = ""

	logapp.nwriting = logapp.nwriting + 1;

	var now   = (new Date()).toISOString()

	var entrypublic  = message.split(" ");
	var ips = "localhost"
	if (!entrypublic[0].match("127.0.0.1") && !entrypublic[0].match("::1")) {
		var ip = geoip.lookup(entrypublic[0].split(",")[0])
		if (!ip) {
			var ips = ip.country 
						+ "," + ip.region
						+ "," + ip.city.replace(/\s+/g,"_")
						+ "," + ip.ll[0]
						+ "," + ip.ll[1]
		} else {
			var ips = "unknown"
		}
	}

	var appname = config.APPNAME || "null"

	// Create MD5 hash of IP address.  Use only first 8 bytes.	
	entrypublic[0] = crypto.createHash("md5").update(entrypublic[0]).digest("hex").substring(0,8)

	logapp.entriespublic  = logapp.entriespublic  + now + " " + entrypublic.join(" ")  +             "\n"
	logapp.entriesprivate = logapp.entriesprivate + now + " " +        message         + " " + ips + "\n"

	// Prevent too many files from being open at the same time.
	if (logapp.nwriting < 10) {

		var tmp = new Date()
		var yyyymmdd = tmp.toISOString().substring(0,10)
		
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
exports.logapp = logapp
