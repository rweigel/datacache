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

var lineReader = require('line-reader');
var zlib = require('zlib');
var qs = require('querystring');
xutil = require('util');

var expandtemplate = require("tsdset").expandtemplate;

var debug = true;
var debugstream = true;

// Locking notes:
// Each time a file is being streamed, a stream counter is incremented for the file.
// If the stream counter is non-zero, forceUpdate=true will not work as expected (and
// the old version of the file will not be kept).
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
var logger = require("./logger.js");
app.use(express.limit('4mb')); // Max POST size

// Create cache dir if it does not exist.
if (!fs.existsSync(__dirname+"/cache")) {fs.mkdirSync(__dirname+"/cache");}
if (!fs.existsSync(__dirname+"/cache/locks")) {fs.mkdirSync(__dirname+"/cache/locks");}

// Get port number from command line option.
var port = process.argv[2] || 8000;

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

				//TODO: needs a better error handling, like let other works in the queue finish before closing the server. 

				/* Re-throw the exception to crash the server. */
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

// Set default content-type to "text".  Not needed?
//app.use(function (req, res, next) {res.contentType("text");next();});

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
			//console.log(querystr);
  	 		res.send(data.replace("__QUERYSTR__", querystr));
  	 	});
}) 

app.post("/report", function (req,res) {
  	 fs.readFile(__dirname+"/report.htm", "utf8", 
  	 	function (err,data) {
  	 		var querystr = qs.stringify(req.body).replace(/\r\n/g,'%0A');
  	 		//console.log(querystr);
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

function handleRequest(req, res) {
	var options = parseOptions(req);
	var source  = parseSource(req);
	options.id  = Math.random().toString().substring(1) 

	// Compress response if headers accept it and streamGzip is not requested.
	if (!options.streamGzip) 	
		app.use(express.compress()); 
	
	if (source.length === 0) {
	    res.contentType("html");
	    fs.readFile(__dirname+"/sync.htm", "utf8", function (err, data) {res.send(data);});
	    return;
	}
	//console.log('sync called');
	if (debug || debugstream) console.log(options.id + " handleRequest called with source="+source);

	if (options.return === "stream") {
		stream(source,options,res);
	} else {
		syncsummary(source,options,res);
	}
}

app.get("/sync", function (req,res) {
	if (debug) console.log("GET")
	handleRequest(req,res);
});

app.post("/sync", function (req, res) {
	if (debug) console.log("POST")
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

function streaminfo(results) {
	var l = 0;
	for (var i = 0; i < results.length; i++) {
			l = l + results[i]["dataLength"];
	}
	sresults = new Object();
	sresults["dataLength"] = l;
	return sresults;
}

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



var reader = require ("buffered-reader");

exports.stream = stream;
stream.streamdebug   = debugstream;
stream.streaming = {};

function stream(source, options, res) {

	var rnd        = options.id;		
	var reqstatus  = {};
	reqstatus[rnd] = {};
	
	reqstatus[rnd].Nx       = 0; // Number of reads/processed URLs completed
	reqstatus[rnd].Nd       = 0; // Number of drained reads
	reqstatus[rnd].gzipping = 0;
	reqstatus[rnd].dt       = 0;

	var N = source.length;
	if (debugstream) console.log(options.id+' stream called with ' + N + ' urls and options.streamOrder = '+options.streamOrder);
	if (options.streamOrder) {
	    scheduler.addURL(source[0], options, function (work) {processwork(work,true)});
	} else {
	    for (var jj=0;jj<N;jj++) {
	    		if (debugstream) console.log("Adding to scheduler: " + source[jj]);
			scheduler.addURL(source[jj], options, function (work) {processwork(work)});
	    }
	}
		
	function processwork(work,inorder) {
		var fname = util.getCachePath(work);

		if (work.error) {
			console.log(rnd+ " Sending res.end() because of work.error: ", work.error);
			return res.end();
		}

		if (debugstream) console.log(rnd+" Stream locking " + fname.replace(__dirname,""));

		if (!stream.streaming[fname]) {
			stream.streaming[fname] = 1;
		} else {
			stream.streaming[fname] = stream.streaming[fname] + 1;
		}
		
		if (options.streamFilterReadBytes > 0) {
		    if (debugstream) console.log(rnd+" Reading Bytes of "+ fname.replace(__dirname,""));
		    if (debugstream) console.log(rnd+" Stream lock status " + stream.streaming[fname]);
			var buffer = new Buffer(options.streamFilterReadBytes);
			if (debugstream) console.log(rnd+" fs.exist: " + fs.existsSync(fname + ".data"));
			fs.open(fname + ".data", 'r', function (err,fd) {
				logger.d("processwork: ", "error:", err, "fd:", fd, fd==undefined,  "readbytes:", options.streamFilterReadBytes, "readPosition:", options.streamFilterReadPosition);
			    fs.read(fd, buffer, 0, options.streamFilterReadBytes, options.streamFilterReadPosition-1, 
			    		function (err, bytesRead, buffer) {readcallback(err,buffer);fs.close(fd);})});
		} else if ( options.streamFilterReadLines > 0 || options.streamFilterReadColumns !== "0" ) {
		    if (debugstream) console.log(rnd+" Reading Lines of "+ fname.replace(__dirname,""));
			if (debugstream) console.log(rnd+" fs.exist: " + fs.existsSync(fname + ".data"));
			readline(fname + ".data");

		} else {	
		    if (debugstream) console.log(rnd+" Reading File");	
			// Should be no encoding if streamFilterBinary was given.
			fs.readFile(fname + ".data", "utf8", readcallback);
		}

		var line   = '';
		var lines  = '';
		var lr = 0; // Lines read.
		var k = 1;  // Lines kept.
		var done = false;
		
		function readline(fname) {	
			lineReader.eachLine(fname, function(line, last) {

				if (done) return "";
				
				var stopline = options.streamFilterReadLines;
				if (options.streamFilterReadLines == 0) {
					stopline = Infinity;
				}
				//var startline = options.streamFilterReadPosition;
				//if (startline == 0) {startline = 1}
				//console.log("here")
				if (k >= options.streamFilterReadPosition) {				  		
					if (lr == stopline) {	
						if (debugstream) console.log("readline: Callback");
						readcallback("",lines);
						lines = "";
						done = true;
					}
					//if (debugstream) console.log("Lines: ");
					//if (debugstream) console.log("lr = " + lr);
					//if (debugstream) console.log(line);

					if (options.streamFilterReadColumns !== "0") {
						var outcolumns = options.streamFilterReadColumns.split(/,/);
						//console.log(outcolumns)
						linea = line.split(" ");
						//console.log(linea)
						line = "";
						for (var z = 0;z < outcolumns.length; z++) {
							line = line + linea[parseInt(outcolumns[z])-1] + " ";
						}
					}

					line = line.substring(0,line.length-1);
					lines = lines + line + "\n";
					lr = lr + 1;
				}
				k = k+1;
			}).then(function () {if (!done) readcallback("",lines)});
		}
		
		function readcallback(err, data) {
		
			if (debugstream) {
				console.log(rnd+" readcallback() called.  Un-stream locking " + fname.replace(__dirname,""));
		    }		    
		    stream.streaming[fname] = stream.streaming[fname] - 1;

			function finished() {
				if (debugstream) console.log(rnd+ " Incremening Nx from " + reqstatus[rnd].Nx + " to " + (reqstatus[rnd].Nx+1));
				reqstatus[rnd].Nx = reqstatus[rnd].Nx + 1;

				if ((reqstatus[rnd].Nx < N) && (inorder)) {
					scheduler.addURL(source[reqstatus[rnd].Nx], options, function (work) {processwork(work,true)});
				}

				if (N == reqstatus[rnd].Nx) {
					if (debugstream) console.log(rnd+" N == reqstatus[rnd].Nx; Sending res.end().");
					res.end();
				}
			}
								
			if (err) {
				if (debugstream) console.log(rnd+" readcallback was passed err: " + err);
				return res.end();
			}

			if (!options.streamGzip) {
				if (options.streamFilter === "") {
					if (debugstream) console.log(rnd+" Writing response");
					res.write(data);
				} else {	
					try {
						//console.log(typeof(data));
						//console.log(data[0]);
						// This assumes the filter applies to ASCII.
						eval("res.write(data.toString()."+options.streamFilter+")");
					} catch (err) {
						console.log(rnd+" Error when evaluating " + options.streamFilter);
						console.log(err);
						console.log(rnd+" Sending res.end()");
						res.end();
					}							
										
				}

				finished();
				
			}
						
			if (options.streamGzip) {												
				reqstatus[rnd].gzipping = reqstatus[rnd].gzipping + 1;
				var tic = new Date();
				zlib.createGzip({level:1});
				if (options.streamFilter === "") {
					zlib.gzip(data, function (err, buffer) {
						reqstatus[rnd].dt = new Date()-tic;
						if (debugstream) console.log(rnd+' gzip callback event');
						if (debugstream) console.log(rnd+ " Writing compressed buffer");
						res.write(buffer);
						reqstatus[rnd].gzipping=reqstatus[rnd].gzipping-1;
						finished();
					});
				} else {
					// Not implemented.
					var com = "data = " + data + "." + options.streamFilter;
					//if (debugstream) console.log("Evaluating " + com);
					try {
						//eval(com);
					} catch (err) {
						//console.log(err);
						//res.send("500",err);
					}
					zlib.gzip(data, function (err,buffer) {
						reqstatus[rnd].dt = new Date()-tic;
						console.log(rnd+' gzip callback event');
						console.log(rnd+" Writing compressed buffer");
						res.write(buffer);
						reqstatus[rnd].gzipping=reqstatus[rnd].gzipping-1;
					});
				}
			}						


		}


	}

}

function parseOptions(req) {

 	var options = {};
        
	function s2b(str) {if (str === "true") {return true} else {return false}}
	function s2i(str) {return parseInt(str)}

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

	options.plugin         = req.query.plugin        || req.body.plugin        || "";
	options.lineRegExp     = req.query.lineRegExp    || req.body.lineRegExp    || ".";	
	options.lineFormatter  = req.query.lineFormatter || req.body.lineFormatter || "";
	
	if (options.lineFormatter === "") {
		options.lineFilter  = req.query.lineFilter   || req.body.lineFilter    || "function(line){return line.search(lineRegExp)!=-1;}";
		options.extractData = req.query.extractData  || req.body.extractData   || 'body.toString().split("\\n").filter('+options.lineFilter+').join("\\n") +"\\n"';	
	} else {
		options.lineFilter  = req.query.lineFilter   || req.body.lineFilter    || "function(line){if (line.search(lineRegExp) != -1) return lineFormatter.formatLine(line,options);}"
		options.extractData = '(body.toString().split("\\n").map(function(line){if (line.search(lineRegExp) != -1) {return lineFormatter.formatLine(line,options);}}).join("\\n")+"\\n").replace(/^\\n+/,"").replace(/\\n\\n+/g,"\\n")';
	}

	if (req.query.extractData || req.body.extractData || req.query.LineFilter || req.body.LineFilter) {
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

	options.streamFilterReadBytes    = s2i(req.query.streamFilterReadBytes)    || s2i(req.body.streamFilterReadBytes)    || 0;
	options.streamFilterReadLines    = s2i(req.query.streamFilterReadLines)    || s2i(req.body.streamFilterReadLines)    || 0;
	options.streamFilterReadPosition = s2i(req.query.streamFilterReadPosition) || s2i(req.body.streamFilterReadPosition) || 1;
	options.streamFilterReadColumns  = req.query.streamFilterReadColumns       || req.body.streamFilterReadColumns       || "0";
	
	if (options.dir) {
	    if (options.dir[0] !== '/') {
			options.dir = '/'+options.dir;
	    }
	    if (options.dir[options.dir.length-1] !== '/'){
			options.dir = options.dir + '/';
	    }
	}
	
	if (debug) console.log(options);
	
	return options;
}

function parseSource(req) {

    var source = req.body.source || req.query.source || "";
    var prefix = req.body.prefix || req.query.prefix;

    var template   = req.body.template || req.query.template;
    
    if (debug) console.log("template: " + template);
    if (debug) console.log("source: " + source);

    var timeRange  = req.body.timeRange  || req.query.timeRange;
	var indexRange = req.body.indexRange || req.query.indexRange;
        
    if (!source && !template) return "";
	
	var sourcet = [];
	
	if (template) {	
	    var options          = {};
	    options.template = template;
		options.check    = false;
		options.debug    = debug;
		options.side     = "server";
		if (timeRange) {
			options.type  = "strftime";
			options.start = timeRange.split("/")[0];
			options.stop  = timeRange.split("/")[1];
			options.debug = debug;
			if (debug) console.log(options);
			sourcet = expandtemplate(options);
			if (debug) {
				console.log("sourcet = ");
			    console.log(sourcet);
			}
		}
		if (indexRange) {
			options.type  = "sprintf";
			console.log(indexRange)
			options.start = indexRange.split("/")[0];
			options.stop  = indexRange.split("/")[1];
			options.debug = debug;
			if (debug) console.log(options);
			sourcet = sourcet.concat(expandtemplate(options));
		}
	}

	if (source) {
		source = source.trim().replace("\r", "").split(/[\r\n]+/).filter(function (line) {return line.trim() != "";});
	}
	
	if (debug) console.log(sourcet);
	if (debug) console.log(source);

	if ((sourcet.length > 0) && (source.length > 0)) {
		source = source.concat(sourcet);
	}
	if (sourcet.length > 0) {
		source = sourcet;
	}

	if (prefix)		    			
		for (i = 0; i < source.length; i++) {source[i] = prefix + source[i];}

	if (debug)
	    console.log(source);
	
	return source;
}