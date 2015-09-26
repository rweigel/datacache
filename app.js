var request  = require("request")
var	xml2js   = require('xml2js')
var	parser   = new xml2js.Parser()
var express  = require('express')
var app      = express()
var server   = require("http").createServer(app)
var	crypto   = require("crypto")
var	fs       = require("fs")
var	moment   = require("moment")
var	whiskers = require("whiskers")
var	domain   = require("domain")
var qs       = require('querystring')
var clc      = require('cli-color')
var argv     = require('yargs')
					.default({
						'port': "7999",
						'debugall': "false",
						'debugconsole': "false",
						'debugapp': "false",
						'debugutil': "false",
						'debugstream': "false",
						'debugplugin': "false",
						'debugtemplate': "false",
						'debugscheduler': "false",
						'debuglineformatter': "false",
						'debuglinefilter': "false"
					})
					.argv

if (argv.help || argv.h) {
	console.log("Usage: node app.js [--port=number --debug{all,app,util,stream,plugin,template,scheduler,lineformatter}=true]")
	return
}

function s2b(str) {if (str === "true") {return true} else {return false}}
function s2i(str) {return parseInt(str)}

var debug = {}
for (key in argv) {
	if (key.search(/^debug/) != -1) {
		key2 = key.replace('debug',"")
		if (argv.debugall == "true") {
			debug[key2] = true
		} else {
			debug[key2] = s2b(argv[key])
		}
	}			
}

config = {}
config.TIMEOUT   = 60*1000*15
config.PORT      = argv.port
config.CLUSTER   = false
config.LOGHEADER = 'x-datacache-log'
config.APPNAME   = "datacache"
config.LOGDIR    = __dirname+"/log/"
config.LOGDIRRES = config.LOGDIR + "responses/"
config.LOGDIRAPPPRIVATE = config.LOGDIR + "application-private/"
config.LOGDIRAPPPUBLIC  = config.LOGDIR + "application-public/"

var util      = require('./util.js')
var scheduler = require("./scheduler.js")
var stream    = require("./stream.js")
var log       = require("./log.js")
var monitor   = require("./monitor.js")

if (fs.existsSync("../tsdset/lib/expandtemplate.js")) {
	var develtsdset = true;
	// Development
	var expandtemplate        = require("../tsdset/lib/expandtemplate.js").expandtemplate
	var expandISO8601Duration = require("../tsdset/lib/expandtemplate.js").expandISO8601Duration
} else {
	// Production
	var develtsdset = false;
	var expandtemplate        = require("./node_modules/tsdset/lib/expandtemplate").expandtemplate
	var expandISO8601Duration = require("./node_modules/tsdset/lib/expandtemplate").expandISO8601Duration
}

util.memCacheInit()
log.init(config)
monitor.init(config)

if (config.CLUSTER) {
	var cluster = require('cluster');

	if (cluster.isMaster) {
		var numWorkers = require('os').cpus().length;
		
		console.log('Master cluster setting up ' + numWorkers + ' workers...');
		
		for (var i = 0; i < numWorkers; i++) {
			cluster
				.fork()
				.on('message', function(msg) {
					console.log(msg)
					msg = msg.split(" ")
					if (msg[1].match("read")) {
						//util.writeCache[msg[0]][1] =+ s2b(msg[2]) : 1 ? -1
					} else {
						//util.writeCache[msg[0]][1] = s2b(msg[2])						
					}
				})
		}
		
		cluster.on('online', function(worker) {
			console.log('Worker ' + worker.id + ' (pid = ' + worker.process.pid + ') is online')
		});
		
		cluster.on('exit', function(worker, code, signal) {
			console.log('Worker ' + worker.process.pid +
						' died with code: ' + code +
						', and signal: ' + signal)
			console.log('Starting a new worker.')
			cluster.fork();
		})
		return
	}
}

// http://stackoverflow.com/questions/9768444/possible-eventemitter-memory-leak-detected
process.setMaxListeners(0)
server.setMaxListeners(0)

process.on('uncaughtException', function(err) {
	if (err.errno === 'EADDRINUSE') {
		console.log("[datacache] - Address already in use.")
	} else {
		console.log("[datacache] - Uncaught Exception:")
		console.log(err.stack)
	}
	process.exit(1)
})

process.on('exit', function () {
	console.log('[datacache] - Received exit signal.  Removing partially written files.');
	// TODO: 
	// Remove partially written files by inspecting cache/locks/*.lck
	// Remove streaming locks by inspecting cache/locks/*.streaming
	console.log('[datacache] - Done.  Exiting.')
})
process.on('SIGINT', function () {
	process.exit();
})

// Create cache dir if it does not exist.
if (!fs.existsSync(__dirname+"/cache")) {fs.mkdirSync(__dirname+"/cache")}

app.use(express.limit('4mb')); // Max POST size
app.use(express.methodOverride());
app.use(express.bodyParser());
app.use(express.errorHandler({ showStack: true, dumpExceptions: true }));
app.use("/cache", express.directory(__dirname+"/cache"));
app.use("/cache", express.static(__dirname + "/cache"));
app.use("/test/data", express.directory(__dirname + "/test/data"));
app.use("/test/data", express.static(__dirname + "/test/data"));
app.use("/asset", express.directory(__dirname + "/asset"));
app.use("/asset", express.static(__dirname + "/asset"));

// Test files
app.get("/test/changingfile.txt", function (req,res) {
	var date = new Date();
    var str = date.getFullYear() + " " + date.getMonth() + " " + 
    			date.getDate() + " " + date.getHours() + " " + 
    			date.getMinutes() + " " + date.getSeconds();
	res.send(str)
})

// Delay serving files to test stream ordering. 
for (var i = 0;i < 5; i++) {
	app.get("/test/data-stream/bou2013080"+i+"vmin.min", function (req,res) {
		setTimeout(function () {
			res.send(fs.readFileSync("test/data/bou2013080"+i+"vmin.min"))},
						Math.round(100*Math.random()));
	})
}

// Rewrite /sync?return=report ... to /report ...
app.use(function (req, res, next) {
	ret = req.body.return || req.query.return;
	if (ret === "report") {
		req.url = "/report"
	}
	next()
})

app.get('/', function (req, res) {
	res.contentType("html")
	res.send("DataCache")
})

app.get("/report", function (req,res) {
  	 fs.readFile(__dirname+"/report.htm", "utf8", 
  	 	function (err,data) {
  	 		var querystr = qs.stringify(req.query);
  	 		res.send(data.replace("__QUERYSTR__", querystr));
  	 	});
}) 

app.post("/report", function (req,res) {
  	 fs.readFile(__dirname+"/report.htm", "utf8", 
  	 	function (err,data) {
  	 		var querystr = qs.stringify(req.body).replace(/\r\n/g,'%0A');
  	 		res.send(data.replace("__QUERYSTR__",querystr));
  	 	})
}) 

app.get("/report.htm", function (req,res) {
	res.contentType("html");
	fs.readFile(__dirname+"/report.htm", "utf8", 
		function (err, data) {res.send(data);});
})

app.get("/async", function (req,res) {
	res.contentType("html");
	fs.readFile(__dirname+"/async.htm", "utf8", 
		function (err, data) {res.send(data);});
})

app.post("/async", function (req, res) {
	var options = parseOptions(req);
	var source  = parseSource(req);
	scheduler.addURLs(source, options);
	res.send(200);
})

app.get("/sync", function (req,res) {
	req.setTimeout(1000*60*15);
	handleRequest(req, res);
})
app.post("/sync", function (req, res) {
	if (argv.debugapp) console.log("POST")
	handleRequest(req,res)
})

app.get("/plugins", function (req, res) {
	res.send(scheduler.plugins.map(function (p) {return p.name}))
})

server.setTimeout(config.TIMEOUT,
	function(obj) {
		//console.log("DataCache server timeout ("+(config.TIMEOUT/(1000*60))+" minutes).");
		//if (obj) console.log(obj);
	})

// Start the server
server.listen(s2i(argv.port))

var msg = ""
if (develtsdset) {msg = "; Using devel version of:"}
if (develtsdset) {msg = msg + " tsdset"}

var workerids = ""
if (config.CLUSTER) {
	workerid  = cluster.worker.id
	workerids = " w" + cluster.worker.id
}

console.log((new Date()).toISOString() 
	+ " [datacache]" 
	+ workerids
	+ " Listening on port "
	+ argv.port 
	+ "; pid=" 
	+ process.pid 
	+ "; node " 
	+ process.version 
	+ clc.blue(msg))

function syncSummary(source, res) {

	// http://codereview.stackexchange.com/questions/20069/monkey-patching-extra-events-in-node-js-http-express
	var end = res.end
	res.end = function () {
		log.logres("Response end event.", res.options)
		res.end = end
		res.emit('end')
		res.end.apply(this, arguments)
	}

	if (res.options.return === "urilistflat") {

		res.contentType("text/plain");
		var ret = [];
		for (var j = 0; j < source.length; j++) {
			ret[j] = source[j]
		}
		res.send(ret.join("\n"));
		
	}
	return
	
	scheduler.addURLs(source, options, function (results) {

		// TODO: If forceUpdate=true and all updates failed, give error
		// with message that no updates could be performed.
		if (options.debugappconsole) {
			log.logres("app.syncSummary(): scheduler.addURLs() callback.  Sending result.", options.logcolor)
		}
		if (options.return === "json") {
			res.contentType('application/json');
			res.send(results);
		} else if (options.return === "urilistflat") {
			res.contentType("text/plain");
			var ret = [];
			for (var j = 0; j < results.length; j++) {
				ret[j] = results[j].url;
			}
			res.send(ret.join("\n"));
		} else if (options.return === "urilist") {
			res.contentType("text/json");
			var ret = [];
			for (var j = 0; j < results.length; j++) {
				ret[j] = results[j].url;
			}
			res.send(JSON.stringify(ret));
		} else if (options.return === "xml") {
			res.contentType("text/xml");
			var ret = '<array>';
			for (var j = 0; j < results.length; j++) {
				ret = ret + whiskers.render("<element><url>{url}</url><urlMd5>{urlMd5}</urlMd5><dataLength>{dataLength}</dataLength><error>{error}</error></element>", results[j]);
			}
			ret = ret + "</array>";
			res.send(ret);
		} else if (options.return === "jsons") {
			res.contentType('application/json');
			res.send(JSON.stringify(results));			
		} else {
			console.log("Unknown option for return.");
			res.send("");
		}
	})
}

function handleRequest(req, res) {

	if (req.headers['x-forwarded-for']) {
		var ip = req.headers['x-forwarded-for'].replace(/\s+/g,"")
	} else {
		var ip = req.connection.remoteAddress
	}

	var workerids = ""
	var workerid  = -1
	if (cluster) {
		workerid  = cluster.worker.id
		workerids = " w" + parseInt(cluster.worker.id)
	}

	var addr = req.headers['x-forwarded-for'] || req.connection.remoteAddress
	console.log((new Date()).toISOString() + " [datacache]" + workerids + " Request from " + addr + " for " + req.originalUrl)

	// Create detailed log file name based on current time, originalUrl, and request IP address
	var logsig = crypto
					.createHash("md5")
					.update((new Date()).toISOString() + ip + req.originalUrl)
					.digest("hex")
					.substring(0,4)

	var options = parseOptions(req, res)
	var source  = parseSource(req, options)

	res.source              = JSON.parse(JSON.stringify(source))
	res.options             = JSON.parse(JSON.stringify(options))
	res.options.logfile     = config.LOGDIRRES + logsig
	res.options.logcolor    = Math.round(255*parseFloat(Math.random().toString().substring(1)));
	res.options.logsig      = logsig
	res.options.workerid    = workerid

	log.logapp(ip + " " + logsig + " " + req.originalUrl, config, "app")
				
	if (0) {//if (argv.debugapp) {
		//log.logres("Configuration file = "+JSON.stringify(config.CONFIGFILE), res)
		log.logres("Configuration = "+JSON.stringify(config), res.config)
		log.logres("req.headers = " + JSON.stringify(req.headers), res.config)
		log.logres("req.connection.remoteAddress = " + JSON.stringify(req.connection.remoteAddress), res.config)
		log.logres("req.originalUrl = " + JSON.stringify(req.originalUrl), res.config)
		log.logres("options = " + JSON.stringify(options), res.config)
	}

	// Set log file name as response header
	res.header(config.LOGHEADER, logsig)

	// Compress response if headers accept it and streamGzip is not requested.
	//if (!options.streamGzip) {	
		//app.use(express.compress())
	//}
	
	// Return nothing if no URLs were requested or if template did create any urls.
	if (source.length == 0) {
		if (argv.debugapp) {
			log.logres("source.length = 0.  Sending res.end().", options)
		}
		res.end()
	    return
	}

	if (options.return === "stream") {
		stream.stream(source, res)
	} else {
		syncSummary(source, res)
	}
}

function parseOptions(req) {

 	var options = {}
	
	options.forceUpdate           = s2b(req.query.forceUpdate           || req.body.forceUpdate           || "false")
	options.forceWrite            = s2b(req.query.forceWrite            || req.body.forceWrite            || "false")
	options.maxTries              = s2i(req.query.maxTries              || req.body.maxTries              || "2")
	options.respectHeaders        = s2b(req.query.respectHeaders        || req.body.respectHeaders        || "true")
	options.respectHeadersTimeout = s2i(req.query.respectHeadersTimeout || req.body.respectHeadersTimeout || "300")

	options.includeData    = s2b(req.query.includeData    || req.body.includeData    || "false");
	options.includeMeta    = s2b(req.query.includeMeta    || req.body.includeMeta    || "false");
	options.includeHeader  = s2b(req.query.includeHeader  || req.body.includeHeader  || "false");
	options.includeLstat   = s2b(req.query.includeLstat   || req.body.includeLstat   || "false");
	options.includeVers    = s2b(req.query.includeVers    || req.body.includeVers    || "false");

	options.return         =     req.query.return         || req.body.return         || "json";
	options.dir            =     req.query.dir            || req.body.dir            || "/cache/";
    options.prefix         =     req.body.prefix          || req.query.prefix        || "";

	options.plugin         = req.query.plugin        || req.body.plugin        || "";
	options.lineRegExp     = req.query.lineRegExp    || req.body.lineRegExp    || ".";	
	options.lineFormatter  = req.query.lineFormatter || req.body.lineFormatter || "";

	if (options.lineFormatter === "") {
		options.lineFilter  = req.query.lineFilter   || req.body.lineFilter    || "function(line){return line.search(lineRegExp)!=-1}";
		options.extractData = req.query.extractData  || req.body.extractData   || 'body.toString().split("\\n").filter('+options.lineFilter+').join("\\n") + "\\n"';	
	} else {
		options.lineFilter  = req.query.lineFilter   || req.body.lineFilter    || "function(line){if (line.search(options.lineRegExp) != -1) return lineFormatter.formatLine(line,options);}"
		options.extractData = '(body.toString().split("\\n").map(function(line){if (line.search(options.lineRegExp) != -1) {return lineFormatter.formatLine(line,options)}}).join("\\n")+"\\n").replace(/^\\n+/,"").replace(/\\n\\n+/g,"\\n")';
	}

	if (req.query.extractData || req.body.extractData || req.query.lineFilter || req.body.lineFilter) {
		options.unsafeEval = false;
	} else {
		options.unsafeEval = true;
	}

	if (options.dir) {
	    if (options.dir[0] !== '/') {
			options.dir = '/' + options.dir
	    }
	    if (options.dir[options.dir.length-1] !== '/') {
			options.dir = options.dir + '/'
	    }
	}

    options.timeRange = req.body.timeRange || req.query.timeRange || "";
	if (options.timeRange !== "") {
		options.timeRangeExpanded = expandISO8601Duration(options.timeRange,{debug:options.debugtemplate})
	} else {
		options.timeRangeExpanded = options.timeRange
	}

	options.debug = {}

	options.debug["app"]       = req.query.debugapp       || req.body.debugapp
	options.debug["stream"]    = req.query.debugstream    || req.body.debugstream
	options.debug["util"]      = req.query.debugutil      || req.body.debugutil
	options.debug["plugin"]    = req.query.debugplugin    || req.body.debugplugin
	options.debug["template"]  = req.query.debugtemplate  || req.body.debugtemplate
	options.debug["scheduler"] = req.query.debugscheduler || req.body.debugscheduler

	options.debug["lineformatter"] = s2b(req.query.debuglineformatter || req.body.debuglineformatter)

	// Over-ride true debug option if command line debug option is not true.
	for (key in debug) {
		if (debug[key] && options.debug[key] === "true") {
			options.debug[key] = true
		} else {
			options.debug[key] = debug[key]
		}
	}

	// Stream options
	options.streamGzip     = s2b(req.query.streamGzip   || req.body.streamGzip   || "false");
	options.acceptGzip     = s2b(req.query.acceptGzip   || req.body.acceptGzip   || "true");
	options.streamOrder    = s2b(req.query.streamOrder  || req.body.streamOrder  || "true");
	options.streamFilter   =     req.query.streamFilter || req.body.streamFilter || "";

	//options.streamFilterBinary   = req.query.streamFilterBinary        || req.body.streamFilterBinary        || "";

	// Bytes or lines to start at
	options.streamFilterReadStart         = s2i(req.query.streamFilterReadStart       || req.body.streamFilterReadStart      || "1");

	// Read bytes into memory (and pass to streamFilterWriteComputeFunction - not implemented)
	options.streamFilterReadBytes         = s2i(req.query.streamFilterReadBytes       || req.body.streamFilterReadBytes      || "0");

	// Read this number of lines after streamFilterReadStart into memory
	// (provided they match streamFilterReadLineRegExp) and format each line
	// with streamFilterReadLineFormatter.
	// Pass formatted line block to ComputeFunction.
	options.streamFilterReadLines         = s2i(req.query.streamFilterReadLines       || req.body.streamFilterReadLines      || "0");
	options.streamFilterReadLineRegExp    =     req.query.streamFilterReadLineRegExp  || req.body.streamFilterReadLineRegExp || "."; 
	options.streamFilterReadLineFormatter =     req.query.streamFilterLineFormatter   || req.body.streamFilterLineFormatter  || ""; 

	options.streamFilterReadColumnsDelimiter = req.query.streamFilterReadColumnsDelimiter || req.body.streamFilterReadColumnsDelimiter || "\\s+";

	// If streamFilterReadLineFormatter + streamFilterReadLineFilter gives columns,
	// read these columns.
	options.streamFilterReadColumns     = req.query.streamFilterReadColumns || req.body.streamFilterReadColumns || "";
	
	// If columns after streamFilterReadLineFormatter + streamFilterReadLineFilter
	// contain time information
	options.streamFilterReadTimeFormat  = req.query.streamFilterReadTimeFormat  || req.body.streamFilterReadTimeFormat  || "";
	options.streamFilterReadTimeColumns = req.query.streamFilterReadTimeColumns || req.body.streamFilterReadTimeColumns || "";

	// If streamFilterReadColumns + streamFilterReadTimeFormat + streamFilterReadTimeColumns
	// valid, allow output format to be 0, 1, or 2. 
	options.streamFilterWriteTimeFormat = req.query.streamFilterWriteTimeFormat || req.body.streamFilterWriteTimeFormat      || "0";

	// Read while time >= TimeStart and time < TimeStop
	options.streamFilterReadTimeStart   = req.query.streamFilterReadTimeStart || req.body.streamFilterReadTimeStart || ""
	options.streamFilterReadTimeStop    = req.query.streamFilterReadTimeStop  || req.body.streamFilterReadTimeStop  || ""

	if (options.timeRangeExpanded !== "" && options.streamFilterReadTimeStart === "") {
		options.streamFilterReadTimeStart = options.timeRangeExpanded.split("/")[0]
	}
	if (options.timeRangeExpanded !== "" && options.streamFilterReadTimeStop === "") {
		options.streamFilterReadTimeStop = options.timeRangeExpanded.split("/")[1]
	}

	// ComputeFunction is applied to block of lines resulting from above.
	options.streamFilterWriteComputeFunction          =     req.query.streamFilterWriteComputeFunction         || req.body.streamFilterWriteComputeFunction               || ""
	//options.streamFilterWriteComputeFunctionArgs      = req.query.streamFilterComputeFunctionArgs            || req.body.streamFilterComputeFunctionArgs                || ""
	options.streamFilterWriteComputeFunctionExcludes  =     req.query.streamFilterWriteComputeFunctionExcludes || req.body.streamFilterWriteComputeFunctionExcludes       || ""
	options.streamFilterWriteComputeFunctionWindow    = s2i(req.query.streamFilterWriteComputeFunctionWindow   || req.body.streamFilterWriteComputeFunctionWindow         || "1")
	options.streamFilterWriteComputeFunctionDt        = s2i(req.query.streamFilterWriteComputeFunctionDt	   || req.body.streamFilterWriteComputeFunctionDt             || "0")
	options.streamFilterWriteComputeFunctionTimeRange = s2i(req.query.streamFilterWriteFunctionTimeRange       || req.body.streamFilterWriteComputeFunctionTimeRange)     || ""
    	
	if (argv.debugapp) {
		//log.logres("options after parseOptions:" + JSON.stringify(options), argv)
	}
	
	return options
}

function parseSource(req, options) {
	
    var source     = req.body.source || req.query.source || "";
    var prefix     = req.body.prefix || req.query.prefix;

    var template   = req.body.template   || req.query.template;
    var timeRange  = req.body.timeRange  || req.query.timeRange;
	var indexRange = req.body.indexRange || req.query.indexRange;
        
    if (!source && !template) return "";
	
	var sourcet = [];
	
    var opts = {};

    if (template) {	
	    opts.template = template
		opts.check    = false
		opts.debug    = options.debugtemplate
		opts.side     = "server"	
		if (timeRange) {
			opts.type       = "strftime"
			opts.timeRange  = timeRange
			opts.indexRange = null
			opts.debug      = options.debugtemplate
			opts.log        = true
			ret             = expandtemplate(opts)
			sourcet         = ret.files
			if (options.debugtemplate) {
				log.logres("expandtemplate.js: "+ret.log, res.config)
			}
		}
		if (indexRange) {
			opts.type       = "sprintf";
			opts.timeRange  = null;
			opts.indexRange = indexRange;
			opts.template   = template;
			opts.debug      = options.debugtemplate;
			sourcet         = sourcet.concat(expandtemplate(opts));
		}
	}

	if (source) {
		source = source.trim().replace("\r", "").split(/[\r\n]+/).filter(function (line) {return line.trim() != ""})
	}
	
	if (options.debugtemplate) {
		//log.logres("options after parseSource: " + JSON.stringify(options), res.config)
	}

	if ((sourcet.length > 0) && (source.length > 0)) {
		source = source.concat(sourcet);
	}
	if (sourcet.length > 0) {
		source = sourcet
	}

	if (prefix)	{	    			
		for (i = 0; i < source.length; i++) {
			source[i] = prefix + source[i]
		}
	}

	if (options.debugapp) { 
		//log.logres("source = "+JSON.stringify(source), argv)
	}
	
	return source
}
