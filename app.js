var request  = require("request")
var	xml2js   = require('xml2js')
var	parser   = new xml2js.Parser()
var express  = require('express')
var app      = express()
var server   = require("http").createServer(app)
var	crypto   = require("crypto")
var	fs       = require("fs")
var	hogan    = require("hogan.js")
var	moment   = require("moment")
var	whiskers = require("whiskers")
var	domain   = require("domain")
var qs       = require('querystring')
var mmm      = require('mmmagic')
var clc      = require('cli-color')
var argv     = require('yargs')
					.default({
						'port': "7999",
						'debugall': "false",
						'debugapp': "false",
						'debugappconsole': "false",
						'debugutil': "false",
						'debugutilconsole': "false",
						'debugstream': "false",
						'debugstreamconsole': "false",
						'debugplugin': "false",
						'debugpluginconsole': "false",
						'debugtemplate': "false",
						'debugtemplateconsole': "false",
						'debugscheduler': "false",
						'debugschedulerconsole': "false",
						'debuglineformatter': "false",
						'debuglineformatterconsole': "false",
						'debuglinefilter': "false",
						'debuglinefilterconsole': "false"
					})
					.argv

if (argv.help || argv.h) {
	console.log("Usage: node app.js [--port=number --debug{all,app,util,stream,plugin,template,scheduler,lineformatter}=true.]")
	return
}

for (key in argv) {
	if (key.match("debug")) {
		argv[key] = s2b(argv[key])
	}			
}
if (argv.debugall) {
	for (key in argv) {
		//if (key.match("debug") && !key.match("lineformatter")) {
		if (key.match("debug")) {
			argv[key] = argv[key]
		}			
	}
}

var util      = require('./util.js')
var scheduler = require("./scheduler.js")
var stream    = require("./stream.js")
var log       = require("./log.js")

util.memCacheInit()

function s2b(str) {if (str === "true") {return true} else {return false}}
function s2i(str) {return parseInt(str)}

if (0) {
	// sudo apt-get install inotify-tools
	var filemon = require('filemonitor');
	var onFileEvent = function (ev) {
		console.log("File " + ev.filename + " triggered event " + ev.eventId + " on " + ev.timestamp.toString());
	}
	var onFileCreation = function (ev) {
		console.log("File " + ev.filename + " was created on " + ev.timestamp.toString());
	}

	var options = {
		recursive: true,
		target: "./cache/",
		listeners: {
			all_events: onFileEvent,
			create: onFileCreation
		}
	}
	filemon.watch(options);
}

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


// http://stackoverflow.com/questions/9768444/possible-eventemitter-memory-leak-detected
process.setMaxListeners(0)

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
if (!fs.existsSync(__dirname+"/cache")) {fs.mkdirSync(__dirname+"/cache");}
if (!fs.existsSync(__dirname+"/cache/locks")) {fs.mkdirSync(__dirname+"/cache/locks");}
if (!fs.existsSync(__dirname+"/log")) {fs.mkdirSync(__dirname+"/log");}

// Monitor and log memory usage every 1000 ms.
setInterval(function () {
	var tmp = new Date()
	mem = process.memoryUsage()
	var yyyymmdd = tmp.toISOString().substring(0,10)
	// Write to requests.log
	var file = __dirname + "/log/datacache_" + argv.port + "_memory_"+yyyymmdd+".log"
	fs.appendFile(file, tmp.toISOString() + " " + mem.rss + " " + mem.heapTotal + " " + mem.heapUsed + "\n")
},1000);

if (0) {
// Middleware
// Wrap app.VERB to handle exceptions: send 500 back to the client before crashing
["get", "post", "put"].forEach(function (verb) {
	var old = app[verb]
	var params = arguments
	app[verb] = function (route, callback) {
		old.call(app, route, function (req, res) {
			var d = domain.create();
			d.on('error', function (err) {
				console.log('[datacache] - Error: ');
				console.log(err.stack)
				res.send(500, "")

				// TODO: needs a better error handling, like let other works
				// in the queue finish before closing the server. 

				// Re-throw the exception to crash the server.
				throw err
			});
			d.run(function () {
				callback(req, res)
			})
		})
	}
})
}

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
  	 	});
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
	handleRequest(req,res);
})

app.post("/sync", function (req, res) {
	if (argv.debugapp) console.log("POST")
	handleRequest(req,res)
})

app.get("/plugins", function (req, res) {
	res.send(scheduler.plugins.map(function (p) {return p.name}))
})

Magic = mmm.Magic;
var magic = new Magic(mmm.MAGIC_MIME_TYPE);
app.use(function(req, res, next) {
	fs.exists(__dirname + req.path, function (exists) {
		if (!exists) {
			next()
			return
		}
		magic.detectFile(__dirname + req.path, function (err, result) {
			if (!err) {
				res.contentType(result)
			} else {
				console.log(new Date().toISOString() + " [datacache] Could not determine content type of " + req.path)
			}
			next()
		})
	})
})

app.get("/api/presets", function (req,res) {
	fs.readdir(__dirname+"/presets", function (err, files) {
		if (err) {return res.send("");}
		var results = [];
		files.forEach(function (file) {
			fs.readFile(__dirname+"/presets/"+file, "utf8", function (err, data) {
				if (file.split(".")[1].toLowerCase()==="js"){
					try {
						data = eval(data);
					} catch (err) {

					}
				}
				results.push({
						name : file.split(".").slice(0, -1).join("."),
						urls : data});
				if (results.length === files.length) {
					results.sort(function (a,b) {return a.name > b.name;});
					res.contentType("js");
					res.send(results);
				}
			}); // fs.readFile()
		}); // files.forEach()
	}); // fs.readdir()
})

app.get("/test/changingfile.txt", function (req,res) {
	var date = new Date();
    var str = date.getFullYear() + " " + date.getMonth() + " " + 
    			date.getDate() + " " + date.getHours() + " " + 
    			date.getMinutes() + " " + date.getSeconds();
	res.send(str)
})

// Delay serving files to test stream ordering. 
app.get("/test/data-stream/bou20130801vmin.min", function (req,res) {
	setTimeout(function () {
		res.send(fs.readFileSync("test/data-stream/bou20130801vmin.min"))},0);
})
app.get("/test/data-stream/bou20130802vmin.min", function (req,res) {
	setTimeout(function () {
		res.send(fs.readFileSync("test/data-stream/bou20130802vmin.min"))},0);
})
app.get("/test/data-stream/bou20130803vmin.min", function (req,res) {
	setTimeout(function () {
		res.send(fs.readFileSync("test/data-stream/bou20130803vmin.min"))},Math.round(100*Math.random()));
})
app.get("/test/data-stream/bou20130804vmin.min", function (req,res) {
	setTimeout(function () {
		res.send(fs.readFileSync("test/data-stream/bou20130804vmin.min"))},Math.round(100*Math.random()));
})
app.get("/test/data-stream/bou20130805vmin.min", function (req,res) {
	setTimeout(function () {
		res.send(fs.readFileSync("test/data-stream/bou20130805vmin.min"))},Math.round(100*Math.random()));
})

config = {};
config.TIMEOUT = 60*1000*15;
config.LOGDIR = __dirname+"/log/";
config.LOGHEADER = 'x-datacache-log';

// Create directories if needed.
config = log.init(config)

server.setTimeout(config.TIMEOUT,
	function(obj) {
		//console.log("DataCache server timeout ("+(config.TIMEOUT/(1000*60))+" minutes).");
		//if (obj) console.log(obj);
	})

// Start the server
server.listen(s2i(argv.port))

var msg = "";
if (develtsdset) {
	var msg = "; Using devel version of:"
}
if (develtsdset) {
	msg = msg + " tsdset"
}

console.log((new Date()).toISOString() + " [datacache] Listening on port "+argv.port + clc.blue(msg))

function syncSummary(source, options, res) {

	// http://codereview.stackexchange.com/questions/20069/monkey-patching-extra-events-in-node-js-http-express
	var end = res.end
	res.end = function () {
		if (options.debugappconsole) {
			log.logc(options.loginfo + " app.syncSummary(): Response end event.", options.logcolor)
		}
		res.end = end
		res.emit('end')
		res.end.apply(this, arguments)
	}
	
	scheduler.addURLs(source, options, function (results) {

		// TODO: If forceUpdate=true and all updates failed, give error
		// with message that no updates could be performed.
		if (options.debugappconsole) {
			log.logc(options.loginfo + " app.syncSummary(): scheduler.addURLs() callback.  Sending result.", options.logcolor)
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

	var message = req.connection.remoteAddress + "," + req.originalUrl;		
	if (req.headers['X-Forwarded-For']) {
		var message = req.headers['X-Forwarded-For'].replace(",",";") + req.originalUrl + ",";
	} 

	// Create detailed log file name based on current time, originalUrl, and request IP address
	var loginfo = crypto
					.createHash("md5")
					.update((new Date()).toISOString() + message)
					.digest("hex")
					.substring(0,4)

	// Set log file name as response header
	res.header(config.LOGHEADER,loginfo)

	res.config = config;

	log.logapp(loginfo + "," + message, res)

	var options  = parseOptions(req, res);
	var source   = parseSource(req, res);
	var logcolor = Math.round(255*parseFloat(Math.random().toString().substring(1)));

	options.loginfo  = loginfo;
	options.logcolor = logcolor;

	if (argv.debugapp) {
		//log.logres("Configuration file = "+JSON.stringify(config.CONFIGFILE), res)
		log.logres("Configuration = "+JSON.stringify(config), res)
		log.logres("req.headers = " + JSON.stringify(req.headers), res)
		log.logres("req.connection.remoteAddress = " + JSON.stringify(req.connection.remoteAddress), res)
		log.logres("req.originalUrl = " + JSON.stringify(req.originalUrl), res)
		log.logres("options = " + JSON.stringify(options), res)
	}
	if (options.debugappconsole) {
		log.logc((new Date()).toISOString() + " [datacache] Request: " + JSON.stringify(req.originalUrl), logcolor)
	}
	if (options.debugappconsole) {
		log.logc(options.loginfo + " app.handleRequest(): parseSource() returned source = " + source.toString().replace(/,/g,"\n\t"),logcolor)
	}

	// Compress response if headers accept it and streamGzip is not requested.
	if (!options.streamGzip) {	
		app.use(express.compress())
	}
	
	// Return nothing if no URLs were requested or if template did create any urls.
	if (source.length === 0) {
		if (argv.debugapp) {
			log.logres("source.length = 0.  Sending res.end().", res)
		}
		if (argv.debugappconsole) {
			log.logc(options.loginfo + " app.handleRequest(): source.length == 0.  Sending res.end().", logcolor)
		}
		res.end()
	    return
	}

	if (options.return === "stream") {
		stream.stream(source,options,res)
	} else {
		syncSummary(source,options,res)
	}
}

function parseOptions(req, res) {

 	var options = {}

 	// TODO: Copy req.body to req.query when req.query === "" and request.body !== ""
	options.req            = {}
	options.req.query      = req.query
	
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

	options.debugall       = s2b(req.query.debugall      || req.body.debugall)      || argv.debugall;
	options.debugapp       = s2b(req.query.debugapp      || req.body.debugapp)      || argv.debugapp;
	options.debugstream    = s2b(req.query.debugstream   || req.body.debugstream)   || argv.debugstream;
	options.debugutil      = s2b(req.query.debugutil     || req.body.debugutil)     || argv.debugutil;
	options.debugplugin    = s2b(req.query.debugplugin   || req.body.debugplugin)   || argv.debugplugin;
	options.debugtemplate  = s2b(req.query.debugtemplate || req.body.debugtemplate) || argv.debugtemplate;
	options.debuglineformatter = s2b(req.query.debuglineformatter || req.body.debuglineformatter) || argv.debuglineformatter;
	options.debugscheduler     = s2b(req.query.debugscheduler     || req.body.debugscheduler)     || argv.debugscheduler;

	for (key in argv) {
		if (key.match("debugconsole")) {
			options[key] = argv[key]
		}			
	}
	
	if (options.debugall) {
		for (key in argv) {
			if (key.match("debug")) {
				options[key] = true
			}			
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

	// ComputeFunction is applied to block of lines resulting from above.
	options.streamFilterWriteComputeFunction          =     req.query.streamFilterWriteComputeFunction         || req.body.streamFilterWriteComputeFunction               || ""
	//options.streamFilterWriteComputeFunctionArgs      = req.query.streamFilterComputeFunctionArgs            || req.body.streamFilterComputeFunctionArgs                || ""
	options.streamFilterWriteComputeFunctionExcludes  =     req.query.streamFilterWriteComputeFunctionExcludes || req.body.streamFilterWriteComputeFunctionExcludes       || ""
	options.streamFilterWriteComputeFunctionWindow    = s2i(req.query.streamFilterWriteComputeFunctionWindow   || req.body.streamFilterWriteComputeFunctionWindow         || "1")
	options.streamFilterWriteComputeFunctionDt        = s2i(req.query.streamFilterWriteComputeFunctionDt	   || req.body.streamFilterWriteComputeFunctionDt             || "0")
	options.streamFilterWriteComputeFunctionTimeRange = s2i(req.query.streamFilterWriteFunctionTimeRange       || req.body.streamFilterWriteComputeFunctionTimeRange)     || ""
    	
	if (argv.debugapp) {
		log.logres("options after parseOptions:" + JSON.stringify(options), res)
	}
	
	return options
}

function parseSource(req, res) {

	options = parseOptions(req, res);
	
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
				log.logres("expandtemplate.js: "+ret.log, res)
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
		log.logres("options after parseSource: " + JSON.stringify(options), res)
	}

	if ((sourcet.length > 0) && (source.length > 0)) {
		source = source.concat(sourcet);
	}
	if (sourcet.length > 0) {
		source = sourcet
	}

	if (prefix)		    			
		for (i = 0; i < source.length; i++) {source[i] = prefix + source[i];}

	if (options.debugapp) { 
		log.logres("source = "+JSON.stringify(source), res)
	}
	
	return source;
}
