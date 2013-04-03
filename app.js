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
	whiskers = require("whiskers");

var zlib = require('zlib');
var qs = require('querystring');
xutil = require('util');

eval(require('fs').readFileSync('../expandtemplate/deps/strftime.js', 'utf8'));
eval(require('fs').readFileSync('../expandtemplate/deps/date.js', 'utf8'));	 
eval(require('fs').readFileSync('../expandtemplate/deps/sprintf-0.7-beta1.js', 'utf8'));
eval(require('fs').readFileSync('../expandtemplate/expandtemplate.js', 'utf8'));

// Locking notes:
// When md5url.data is being read for streaming, an empty file named md5url.stream is placed
// in cache/hostname.  A file named md5url.stream is placed in cache/locks containing the string
// hostname.
//
// If the .stream file exists when forceUpdate=true, the scheduler treats this as a failed attempt and
// another request is made to download the file.
//
// TODO: Recognize the difference between a failed download and a failed write attempt because of
// a stream lock and don't re-download data.  Instead write md5url-1.data and rename file when the
// job is tried again and the .stream file does not exist.  Will need to handle case that md5url-1.data
// already exists and will need to add option "waitForStream" to continue to wait for streaming to
// finish when forceUpdate=true.


// TODO:
// Check if cache directory is writeable and readable.  If not, send 500 error.
// Remove partially written files by inspecting cache/locks/*.lck
// Remove streaming locks by inspecting cache/locks/*.streaming

process.on('exit', function () {
	console.log('Received exit signal.  Removing lock files.');
	// Remove partially written files by inspecting cache/locks/*.lck
	// Remove streaming locks by inspecging cache/locks/*.streaming
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
//app.use(express.logger());
app.use(express.methodOverride());
app.use(express.bodyParser());

app.use("/cache", express.directory(__dirname+"/cache"));
app.use("/demo",  express.directory(__dirname+"/demo"));
app.use("/cache", express.static(__dirname + "/cache"));
app.use("/demo",  express.static(__dirname + "/demo"));
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

app.get("/servers", function (req,res) {
	 // servers.txt is a list of other known DC servers
	 // Reduce list by doing HEAD request to each server?
	 var servers = __dirname+"/servers.txt";
	 fs.exists(servers, function (exists) {
		if (exists) {
	  	 	fs.readFile(servers, "utf8", 
				function (err, data) {res.send(data.split('\n'))});
		} else {
			res.send("[]");
		}
	});
}) 

app.get("/demo/changingfile.txt", function (req,res) {
	var date = new Date();
    var str = date.getFullYear() + " " + date.getMonth()   +  " " + date.getDate() +  " " + 
			  date.getHours()    + " " + date.getMinutes() +  " " + date.getSeconds();
	//console.log(str);
	res.send(str);
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
	var options = parseOptions(req);
	var source  = parseSource(req);

	// Compress response if headers accept it and streamGzip is not requested.
	if (!options.streamGzip) 	
		app.use(express.compress()); 
	
	if (source.length === 0) {
	    res.contentType("html");
	    fs.readFile(__dirname+"/sync.htm", "utf8", function (err, data) {res.send(data);});
	    return;
	}
	console.log('sync called');
	if (options.return === "stream") {
		stream(source,options,res);
	} else {
		syncsummary(source,options,res);
	}
});

app.post("/sync", function (req, res) {
	var options = parseOptions(req);
	var source  = parseSource(req);
	if (source.length === 0) {
	    return res.send(400, "At least one URL must be provided.");
	}
	stream(source,options,res);
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

		function sendit(ret) {
			res.send(ret);
		}
		scheduler.addURLs(source, options, function (results) {
			// TODO: If foreUpdate=true and all updates failed, give error
			// with message that no updates could be performed.
			if (options.return === "json") {
			    sendit(results);
			} else if (options.return === "xml") {
				res.contentType("text/xml");
				var ret = '<array>';
				for (j = 0; j < results.length; j++) {
					ret = ret + whiskers.render("<element><url>{url}</url><urlMd5>{urlMd5}</urlMd5><dataLength>{dataLength}</dataLength><error>{error}</error></element>", results[j]);
				}
				ret = ret + "</array>";
				sendit(ret);
			} else if (options.return === "jsons") {
				sendit(streaminfo(results));
			} else {
				console.log("Unknown option");
			}
		});
}

var reader = require ("buffered-reader");
function stream(source, options, res) {

	var N = source.length;
	console.log('stream called with ' + N + ' urls');
	res.socket.on('drain', function () {
		console.log('res.write drain event.  gzipping = '+gzipping+' Nx = '+Nx);
        if (Nx == N) {
        	    if (gzipping == 0) {
        	    		res.end();
        	    	} else {
        	    		console.log("Will check every " + dt + " ms for gzip completion");
	        		var checker = setInterval(function () {        			
	        			if (gzipping > 0) {
		        			console.log('Gzipping not done.');
		        		} else {
		        			res.end();
		        			clearInterval(checker);
		        		}
	        		},dt);
	        	}
        	}
    });
	
	Nx = 0;
	gzipping = 0;
	draining = 0;
	dt = 0;
	function processwork(work,inorder) {
	
		var fname = util.getCachePath(work);
		console.log("Stream locking " + fname);
		fs.writeFileSync(fname+".streaming", "");
		fs.writeFileSync(__dirname+"/cache/locks/"+work.urlMd5+".streaming",work.dir);
		
		if (options.streamFilterReadBytes > 0) {
			console.log("Reading Bytes");
			var buffer = new Buffer(options.streamFilterReadBytes);
			fs.open(fname + ".data", 'r', function (err,fd) {
			    fs.read(fd, buffer, 0, options.streamFilterReadBytes, options.streamFilterReadPosition-1, 
			    		function (err, bytesRead, buffer) {readcallback(err,buffer);fs.close(fd);})});
		} else if (options.streamFilterReadLines > 0) {
			console.log("Reading Lines");
			var LineReader = reader.DataReader;
			var k = 1;
			var lr = 0;
			var lines = "";
			new LineReader (fname + ".data", { encoding: "utf8" })
			    .on("error", function (error) {
			        console.log ("error: " + error);
			    })
			    .on("line", function (line) {
			        if (k >= options.streamFilterReadPosition) {
				        	if (lr == options.streamFilterReadLines) { 
				        		console.log("dumped lines");
				        		console.log(lines);
				        		readcallback("",lines);
				        		this.interrupt();
				        	}
				        	console.log("read line");
			        		lines = lines + line + "\n";
			        		lr = lr+1;

			        	}
			        	k = k+1;
			    })
			    .on("end", function () {
			        console.log("EOF");
			    })
			    .read();
		} else {	
			console.log("Reading File");	
			// Should be no encoding if streamFilterBinary was given.
			fs.readFile(fname + ".data", "utf8", readcallback);
		}
		
		function readcallback(err, data) {
		
				console.log('readFile callback event');
				console.log("Un-stream locking " + fname);
				fs.unlinkSync(fname +".streaming", "");
				fs.unlinkSync(__dirname+"/cache/locks/"+work.urlMd5+".streaming");
				
				Nx = Nx + 1;
				if (!options.streamGzip) {
					if (options.streamFilter === "") {
						res.write(data);
					} else {	
						try {
							eval("res.write(data."+options.streamFilter+")");
						} catch (err) {
							console.log("Error when evaluating " + options.streamFilter);
							consoel.log(err);
							res.end();
						}							
											
					}
				}
				
				if ((Nx < N) && (inorder)) {
					scheduler.addURL(source[Nx], options, function (work) {processwork(work,true)});
				}
				
				if (options.streamGzip) {												
					gzipping = gzipping + 1;
					var tic = new Date();
					zlib.createGzip({level:1});
					if (options.streamFilter === "") {
						zlib.gzip(data, function (err, buffer) {dt=new Date()-tic;console.log('gzip callback event');res.write(buffer);gzipping=gzipping-1;});
					} else {
						var com = "data = " + data + "." + options.streamFilter;
						console.log("Evaluating " + com);
						try {
							//eval(com);
						} catch (err) {
							//console.log(err);
							//res.send("500",err);
						}
						zlib.gzip(data, function (err,buffer) {dt=new Date()-tic;console.log('gzip callback event');res.write(buffer);gzipping=gzipping-1;});
					}
				}						
		}


	}

	if (options.inOrder) {
		scheduler.addURL(source[0], options, function (work) {processwork(work,true)});
	} else {
		for (var jj=0;jj<N;jj++) {
			scheduler.addURL(source[jj], options, function (work) {processwork(work)});
		}
	}
}

function parseOptions(req) {

 	var options = {};
        
	function s2b(str) {if (str === "true") {return true} else {return false}}
	function s2i(str) {return parseInt(str)}

	options.forceUpdate    = s2b(req.query.forceUpdate)    || s2b(req.body.forceUpdate)    || false
	options.forceWrite     = s2b(req.query.forceWrite)     || s2b(req.body.forceWrite)     || false
	options.maxTries       = s2i(req.query.maxTries)       || s2i(req.body.maxTries)       || 2;
	options.includeData    = s2b(req.query.includeData)    || s2b(req.body.includeData)    || false;
	options.includeMeta    = s2b(req.query.includeMeta)    || s2b(req.body.includeMeta)    || false;
	options.includeHeader  = s2b(req.query.includeHeader)  || s2b(req.body.includeHeader)  || false;
	options.includeLstat   = s2b(req.query.includeLstat)   || s2b(req.body.includeLstat)   || false;
	options.includeVers    = s2b(req.query.includeVers)    || s2b(req.body.includeVers)    || false;
	options.respectHeaders = s2b(req.query.respectHeaders) || s2b(req.body.respectHeaders) || true;
	options.plugin         = req.query.plugin              || req.body.plugin              || "";
	options.return         = req.body.return               || req.query.return             || "json";
	options.dir            = req.query.dir                 || req.body.dir                 || "/cache/";

	options.streamOrder    = s2b(req.query.streamOrder)    || s2b(req.body.streamOrder)    || false;
	options.streamGzip     = s2b(req.query.streamGzip)     || s2b(req.body.streamGzip)     || false;
	options.streamFilter   = req.query.streamFilter        || req.body.streamFilter        || "";

	//options.streamFilterBinary   = req.query.streamFilterBinary        || req.body.streamFilterBinary        || "";


	options.streamFilterReadBytes    = s2i(req.query.streamFilterReadBytes)    || s2i(req.body.streamFilterReadBytes)    || 0;
	options.streamFilterReadLines    = s2i(req.query.streamFilterReadLines)    || s2i(req.body.streamFilterReadLines)    || 0;
	options.streamFilterReadPosition = s2i(req.query.streamFilterReadPosition) || s2i(req.body.streamFilterReadPosition) || 1;

	options.lineRegExp     = req.query.lineRegExp          || req.body.lineRegExp          || "";
	options.extractData    = req.query.extractData         || req.body.extractData         || "";

	// Need to use http://gf3.github.com/sandbox/ for these insecure operations.
	// Express decodes a "+" as a space.  Decode these parts manually.  
	if (options.streamFilter) {
		options.streamFilter = decodeURIComponent(req.originalUrl.replace(/.*streamFilter=(.*?)(\&|$).*/,'$1'));
	}
	if (options.extractData) {
		options.extractData = decodeURIComponent(req.originalUrl.replace(/.*extractData=(.*?)(\&|$).*/,'$1'));
	} else {
		options.extractData = 'body.toString().split("\\n").filter(function(line){return line.search(lineRegExp)!=-1;}).join("\\n") +"\\n";';
	}
	if (options.lineRegExp) {
		options.lineRegExp = decodeURIComponent(req.originalUrl.replace(/.*lineRegExp=(.*?)(\&|$).*/,'$1'));
	} else {
		options.lineRegExp = "^[0-9]";
	}
	if (options.dir) {
	    if (options.dir[0] !== '/') {
			options.dir = '/'+options.dir;
	    }
	    if (options.dir[options.dir.length-1]!=='/'){
			options.dir = options.dir+'/';
	    }
	}

	return options;
}

function parseSource(req) {

    var source = req.body.source || req.query.source;
    var prefix = req.body.prefix || req.query.prefix;

    var template   = req.body.template   || req.query.template;
	var timeRange  = req.body.timeRange  || req.query.timeRange;
	var indexRange = req.body.indexRange || req.query.indexRange;
    
    if (!source && !template) return "";

	if (template) {
		sourcet = new Array();
		if (timeRange) {			
			sourcet = expandtemplate(template,timeRange.split("/")[0],timeRange.split("/")[1],"strftime");
		}
		if (indexRange) {
			sourcet = sourcet.concat(expandtemplate(template,indexRange.split("/")[0],indexRange.split("/")[1],"sprintf"));
		}
	}
	if (source) {
		source = source.trim().replace("\r", "").split(/[\r\n]+/).filter(function (line) {return line.trim() != "";});
	}
	if (sourcet && source) {
		source = source.concat(sourcet);
	} else {
		source = sourcet;
	}

	//console.log(source);
	if (prefix)		    			
		for (i = 0; i < source.length; i++) {source[i] = prefix + source[i];}
	
	return source;
}