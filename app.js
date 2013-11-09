var request = require("request"),
	xml2js = require('xml2js'),
	parser = new xml2js.Parser(),
	express = require('express'),
	app = express(),
	server = require("http").createServer(app),
	io = require("socket.io"),
	sio = io.listen(server),
	crypto = require("crypto"),
	fs = require("fs"),
	hogan = require("hogan.js"),
	moment = require("moment"),
	whiskers = require("whiskers"),
	domain = require("domain");

var qs   = require('querystring');

var expandtemplate        = require("tsdset").expandtemplate;
var expandISO8601Duration = require("tsdset").expandISO8601Duration;

// Locking notes:
// Each time a file is being streamed, a stream counter is incremented for the file.
// If the stream counter is non-zero, forceUpdate=true will not work as expected.

// TODO: Indicate that the update failed in the HTTP headers?

// If a process tries to write a file that is being streamed, the write is aborted.
// TODO: Indicate this in the JSON and the HTTP headers (if stream request).

// TODO:
// Check if cache directory is writeable and readable.  If not, send 500 error.

//http://stackoverflow.com/questions/9768444/possible-eventemitter-memory-leak-detected
//Use this when in production.
//process.setMaxListeners(0);

process.on('exit', function () {
	console.log('Received exit signal.  Removing lock files.');
	// TODO: 
	// Remove partially written files by inspecting cache/locks/*.lck
	// Remove streaming locks by inspecting cache/locks/*.streaming
	console.log('Done.  Exiting.');
})
process.on('SIGINT', function () {
	process.exit();
});

var scheduler = require("./scheduler.js");
var util = require("./util.js");
var stream = require("./stream.js");
var logger = require("./logger.js");
app.use(express.limit('4mb')); // Max POST size

// Create cache dir if it does not exist.
if (!fs.existsSync(__dirname+"/cache")) {fs.mkdirSync(__dirname+"/cache");}
if (!fs.existsSync(__dirname+"/cache/locks")) {fs.mkdirSync(__dirname+"/cache/locks");}
if (!fs.existsSync(__dirname+"/log")) {fs.mkdirSync(__dirname+"/log");}

function s2b(str) {if (str === "true") {return true} else {return false}}
function s2i(str) {return parseInt(str)}

// Get port number from command line option.
var port          = s2i(process.argv[2] || 8000);
var debugapp      = s2b(process.argv[3] || "false");
var debugstream   = s2b(process.argv[4] || "false");
var debugplugin   = s2b(process.argv[5] || "false");
var debugtemplate = s2b(process.argv[6] || "false");

// Middleware
/* wrap app.VERB to handle exceptions: send 500 back to the client before crashing*/
["get", "post", "put"].forEach(function(verb){
	var old = app[verb];
	var params = arguments;
	app[verb] = function(route, callback){
		old.call(app, route, function(req, res){
			var d = domain.create();
			d.on('error', function(err){
				res.send(500, "");

				// TODO: needs a better error handling, like let other works
				// in the queue finish before closing the server. 

				// Re-throw the exception to crash the server.
				throw err;
			});
			d.run(function(){
				callback(req, res);
			})
		});
	}
})

//app.use(express.logger());
app.use(express.methodOverride());
app.use(express.bodyParser());

app.use("/cache", express.directory(__dirname+"/cache"));
app.use("/cache", express.static(__dirname + "/cache"));
app.use("/demo",  express.directory(__dirname+"/demo"));
app.use("/demo",  express.static(__dirname + "/demo"));
app.use("/test/data", express.static(__dirname + "/test/data"));
app.use("/test/data", express.directory(__dirname + "/test/data"));
app.use("/asset", express.static(__dirname + "/asset"));

// Rewrite /sync?return=report ... to /report ...
app.use(function (req, res, next) {
	ret = req.body.return || req.query.return;
	if (ret === "report") { 
		req.url = "/report";
	}
	next();
});

app.use(express.errorHandler({ showStack: true, dumpExceptions: true }));

app.get('/', function (req, res) {
	res.contentType("html");
	fs.readFile(__dirname+"/async.htm", "utf8", 
		function (err, data) {res.send(data);});
})

app.get('/log', function (req, res) {
	res.send(fs.readFileSync(__dirname+"/application.log", "utf8"));
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

app.get("/demo/changingfile.txt", function (req,res) {
	var date = new Date();
    var str = date.getFullYear() + " " + date.getMonth()   +  " " + date.getDate() +  " " + 
			  date.getHours()    + " " + date.getMinutes() +  " " + date.getSeconds();
	//console.log(str);
	res.send(str);
})

// Delay serving to test stream ordering. 
app.get("/test/data-stream/bou20130801vmin.min", function (req,res) {
	//setTimeout(function () {res.send(fs.readFileSync("test/data-stream/bou20130801vmin.min"))},Math.round(100*Math.random()));
	setTimeout(function () {res.send(fs.readFileSync("test/data-stream/bou20130801vmin.min"))},0);

})
app.get("/test/data-stream/bou20130802vmin.min", function (req,res) {
	//setTimeout(function () {res.send(fs.readFileSync("test/data-stream/bou20130802vmin.min"))},Math.round(100*Math.random()));
	setTimeout(function () {res.send(fs.readFileSync("test/data-stream/bou20130802vmin.min"))},0);
})
app.get("/test/data-stream/bou20130803vmin.min", function (req,res) {
	setTimeout(function () {res.send(fs.readFileSync("test/data-stream/bou20130803vmin.min"))},Math.round(100*Math.random()));
})
app.get("/test/data-stream/bou20130804vmin.min", function (req,res) {
	setTimeout(function () {res.send(fs.readFileSync("test/data-stream/bou20130804vmin.min"))},Math.round(100*Math.random()));
})
app.get("/test/data-stream/bou20130805vmin.min", function (req,res) {
	setTimeout(function () {res.send(fs.readFileSync("test/data-stream/bou20130805vmin.min"))},Math.round(100*Math.random()));
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
	if (debugapp) console.log("GET")
	handleRequest(req,res);
});

app.post("/sync", function (req, res) {
	if (debugapp) console.log("POST")
	handleRequest(req,res);
});

app.get("/plugins", function (req, res) {
	res.send(scheduler.plugins.map(function (p) {return p.name;}));
});

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
});

server.listen(port);
var clients = [];

sio.sockets.on("connection", function (socket) {
	clients.push(socket);
	socket.on("disconnect", function () {clients.remove(socket);});
});
sio.set("log level", 1);

// Need if running app behind apache server that does not support websockets.
sio.set('transports', ['xhr-polling']);
sio.set('polling duration',20);

logger.bindClientList(clients);

function syncsummary(source,options,res) {
		
		scheduler.addURLs(source, options, function (results) {
			// TODO: If forceUpdate=true and all updates failed, give error
			// with message that no updates could be performed.
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
				console.log("Unknown option");
				res.send("");
			}
		});
}

function handleRequest(req, res) {
	var options = parseOptions(req);
	var source  = parseSource(req);
	options.id  = Math.random().toString().substring(1) 

	// Compress response if headers accept it and streamGzip is not requested.
	if (!options.streamGzip) 	
		app.use(express.compress()); 
	
	// Return nothing if no urls were requested or if template did create any urls.
	if (source.length === 0) {
		res.end();
	    return;
	}

	if (options.debugapp || options.debugstream)
		console.log(options.id + " handleRequest called with source="+source);

	if (options.return === "stream") {
		stream.stream(source,options,res);
	} else {
		syncsummary(source,options,res);
	}
}

function parseOptions(req) {

 	var options = {};
        
	// TODO: Copy req.body to req.query.
	options.req = {};
	options.req.query      = req.query;
	
	options.forceUpdate    = s2b(req.query.forceUpdate)    || s2b(req.body.forceUpdate)    || false
	options.forceWrite     = s2b(req.query.forceWrite)     || s2b(req.body.forceWrite)     || false
	options.maxTries       = s2i(req.query.maxTries)       || s2i(req.body.maxTries)       || 2;
	options.includeData    = s2b(req.query.includeData)    || s2b(req.body.includeData)    || false;
	options.includeMeta    = s2b(req.query.includeMeta)    || s2b(req.body.includeMeta)    || false;
	options.includeHeader  = s2b(req.query.includeHeader)  || s2b(req.body.includeHeader)  || false;
	options.includeLstat   = s2b(req.query.includeLstat)   || s2b(req.body.includeLstat)   || false;
	options.includeVers    = s2b(req.query.includeVers)    || s2b(req.body.includeVers)    || false;
	options.return         = req.query.return              || req.body.return              || "json";
	options.dir            = req.query.dir                 || req.body.dir                 || "/cache/";
    options.prefix         = req.body.prefix 			   || req.query.prefix			   || "";

	options.plugin         = req.query.plugin        || req.body.plugin        || "";
	options.lineRegExp     = req.query.lineRegExp    || req.body.lineRegExp    || ".";	
	options.lineFormatter  = req.query.lineFormatter || req.body.lineFormatter || "";

	options.debugapp       = req.query.debugapp      || req.body.debugapp      || debugapp;
	options.debugstream    = req.query.debugstream   || req.body.debugstream   || debugstream;
	options.debugplugin    = req.query.debugplugin   || req.body.debugplugin   || debugplugin;
	options.debugtemplate  = req.query.debugtemplate || req.body.debugtemplate || debugtemplate;
	
	if (options.lineFormatter === "") {
		options.lineFilter  = req.query.lineFilter   || req.body.lineFilter    || "function(line){return line.search(lineRegExp)!=-1;}";
		options.extractData = req.query.extractData  || req.body.extractData   || 'body.toString().split("\\n").filter('+options.lineFilter+').join("\\n") +"\\n"';	
	} else {
		options.lineFilter  = req.query.lineFilter   || req.body.lineFilter    || "function(line){if (line.search(options.lineRegExp) != -1) return lineFormatter.formatLine(line,options);}"
		options.extractData = '(body.toString().split("\\n").map(function(line){if (line.search(options.lineRegExp) != -1) {return lineFormatter.formatLine(line,options);}}).join("\\n")+"\\n").replace(/^\\n+/,"").replace(/\\n\\n+/g,"\\n")';
	}

	if (req.query.extractData || req.body.extractData || req.query.lineFilter || req.body.lineFilter) {
		options.unsafeEval = false;
	} else {
		options.unsafeEval = true;
	}

	//console.log("lineRegExp: " + options.lineRegExp)
	options.streamGzip     = s2b(req.query.streamGzip)     || s2b(req.body.streamGzip)     || false;
	options.streamFilter   = req.query.streamFilter        || req.body.streamFilter        || "";

	options.streamOrder    = req.query.streamOrder         || req.body.streamOrder         || "true";
	options.streamOrder    = s2b(options.streamOrder);

	options.acceptGzip     = req.query.acceptGzip         || req.body.acceptGzip          || "true";
	options.acceptGzip     = s2b(options.acceptGzip);

	//options.respectHeaders = s2b(req.query.respectHeaders) || s2b(req.body.respectHeaders) || true;
	//options.streamFilterBinary   = req.query.streamFilterBinary        || req.body.streamFilterBinary        || "";

	options.streamFilterReadBytes       = s2i(req.query.streamFilterReadBytes)     || s2i(req.body.streamFilterReadBytes)    || 0;
	options.streamFilterReadLines       = s2i(req.query.streamFilterReadLines)     || s2i(req.body.streamFilterReadLines)    || 0;
	options.streamFilterReadPosition    = s2i(req.query.streamFilterReadPosition)  || s2i(req.body.streamFilterReadPosition) || 1;
	options.streamFilterReadColumns     = req.query.streamFilterReadColumns        || req.body.streamFilterReadColumns       || "0";
	options.streamFilterTimeFormat      = req.query.streamFilterTimeFormat         || req.body.streamFilterTimeFormat        || "0";
	options.streamFilterComputeWindow   = s2i(req.query.streamFilterComputeWindow  || req.query.streamFilterComputeWindow    || "1"); 
	options.streamFilterComputeFunction = req.query.streamFilterComputeFunction    || req.query.streamFilterComputeFunction  || ""; 

    options.timeRange          = req.body.timeRange  || req.query.timeRange || "";

	if (options.timeRange !== "") {
		options.timeRangeExpanded  = expandISO8601Duration(options.timeRange,{debug:debugtemplate})
	}
	if (options.dir) {
	    if (options.dir[0] !== '/') {
			options.dir = '/'+options.dir;
	    }
	    if (options.dir[options.dir.length-1] !== '/'){
			options.dir = options.dir + '/';
	    }
	}
	
	if (debugapp) {
		console.log("\noptions after parseOptions:")
		console.log(options);
	}
	
	return options;
}

function parseSource(req) {


	options = parseOptions(req);
	
    var source     = req.body.source || req.query.source || "";
    var prefix     = req.body.prefix || req.query.prefix;

    var template   = req.body.template || req.query.template;
    var timeRange  = req.body.timeRange  || req.query.timeRange;
	var indexRange = req.body.indexRange || req.query.indexRange;
        
    if (!source && !template) return "";
	
	var sourcet = [];
	
    var opts          = {};

    if (template) {	
	    opts.template = template;
		opts.check    = false;
		opts.debug    = opts.debugtemplate;
		opts.side     = "server";	
		if (timeRange) {
			opts.type       = "strftime";
			opts.timeRange  = timeRange;
			opts.indexRange = null;
			opts.debug      =  opts.debugtemplate;
			sourcet = expandtemplate(opts);
			if (opts.debugtemplate) {
				console.log("sourcet = ");
			    console.log(sourcet);
			}

		}
		if (indexRange) {
			opts.type       = "sprintf";
			opts.timeRange  = null;
			opts.indexRange = indexRange;
			opts.template   = template;
			opts.debug      = opts.debugtemplate;
			sourcet         = sourcet.concat(expandtemplate(opts));
		}
	}

    if (debugapp) console.log(sourcet)
	if (source) {
		source = source.trim().replace("\r", "").split(/[\r\n]+/).filter(function (line) {return line.trim() != "";});
	}
	
	if (options.debugtemplate) {
		console.log("\noptions after parseSource:")
		console.log(options);
	}

	if (options.debugapp) console.log(sourcet);
	if (options.debugapp) console.log(source);

	if ((sourcet.length > 0) && (source.length > 0)) {
		source = source.concat(sourcet);
	}
	if (sourcet.length > 0) {
		source = sourcet;
	}

	if (prefix)		    			
		for (i = 0; i < source.length; i++) {source[i] = prefix + source[i];}

	if (options.debugapp)
	    console.log(source);
	
	return source;
}
