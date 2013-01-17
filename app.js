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

var qs = require('querystring');
// TODO: Check if cache directory is writeable and readable.
// If not, send 500 error.

// TODO: Allow input of extractData regular expression.

// TODO: Allow input of timestamp2integer + startdate + integerunit.

// TODO: Create .bin files with extension .binN, where N is 1+(# of data columns).
// (or create field which is numberOfColumns).


var scheduler = require("./scheduler.js");
var util = require("./util.js");
var logger = require("./logger.js");

// Create cache dir if it does not exist.
if (!fs.existsSync(__dirname+"/cache")) {fs.mkdirSync(__dirname+"/cache");}

// Get port number from command line option.
var port = process.argv[2] || 8000;

// Middleware
//app.use(express.logger());
app.use(express.compress());
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

// app.use(express.errorHandler({ showStack: true, dumpExceptions: true }));

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
  	 		console.log(querystr);
  	 		res.send(data.replace("__QUERYSTR__", querystr));
  	 	});
}) 
app.post("/report", function (req,res) {
  	 fs.readFile(__dirname+"/report.htm", "utf8", 
  	 	function (err,data) {
  	 		console.log(req.body);
  	 		var source = (req.body.source || "").replace(/\r\n/g,'%0A');
  	 		var querystr = qs.stringify(req.query);
  	 		console.log(querystr);
  	 		res.send(data.replace("__QUERYSTR__",querystr+"&source="+source));
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
	if (source.length === 0) {
	    res.contentType("html");
	    fs.readFile(__dirname+"/sync.htm", "utf8", function (err, data) {res.send(data);});
	    return;
	}
	stream(source,options,res);
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
			l = l + results[i]["dataLength"]
	}
	sresults = new Object();
	sresults["dataLength"] = l;
	return sresults;
}

function stream(source, options, res) {
	scheduler.addURLs(source, options, function (results) {
			if (options.return === "json") {
			    res.send(results);
			} else if (options.return === "xml") {
				res.contentType("text/xml");
				var ret = '<array>';
				for (j = 0; j < results.length; j++) {
					ret = ret + whiskers.render("<element><url>{url}</url><urlMd5>{urlMd5}</urlMd5><dataLength>{dataLength}</dataLength><error>{error}</error></element>", results[j]);
				}
				ret = ret + "</array>";
				res.send(ret);
			} else if (options.return === "jsons") {
				res.send(streaminfo(results));
			} else if ((options.return === "stream")) {
			    function pushfile(j) {
			    		//console.log(results[j]);
					fname = util.getCachePath(results[j]) + ".data";		    
					var fstream = fs.createReadStream(fname);
					fstream.on('error',function (err) {res.end(err);});
					fstream.on('end',function () {
						if (j < results.length-1) {
						    console.log("Finished piping file #" + j + ": " + fname);
						    j = j+1;
						    pushfile(j);
						} else {
						    console.log("Finished piping file #" + j + ": " + fname);
						    res.end();
						}
					});
					// TODO: Check if file exists.  If it does not, send error.
					fstream.on('open', function () {fstream.pipe(res,{end:false});});
			    }
			    var lsi = streaminfo(results)["dataLength"].toString();
			    res.writeHeader(200, {'Content-Length': lsi});
			    pushfile(0);
			} else {
				return res.send(400, "return = json, jsonp, stream, or report.");
			}
	    });
}

function parseOptions(req) {

 	var options = {};
        
	function s2b(str) {if (str === "true") {return true} else {return false}}
	function s2i(str) {return parseInt(str)}

	options.forceUpdate    = s2b(req.query.forceUpdate)    || s2b(req.body.forceUpdate)    || false
	options.maxTries       = s2i(req.query.maxTries)       || s2i(req.body.maxTries)       || 2;
//	options.compressResponse = s2b(req.query.compressResponse) || s2b(req.body.compressResponse)     || true;
	options.includeData    = s2b(req.query.includeData)    || s2b(req.body.includeData)    || false;
	options.includeMeta    = s2b(req.query.includeMeta)    || s2b(req.body.includeMeta)    || false;
	options.includeHeader  = s2b(req.query.includeHeader)  || s2b(req.body.includeHeader)  || true;
	options.includeLstat   = s2b(req.query.includeLstat)   || s2b(req.body.includeLstat)   || true;
	options.includeVers    = s2b(req.query.includeVers)    || s2b(req.body.includeVers)    || false;
	options.respectHeaders = s2b(req.query.respectHeaders) || s2b(req.body.respectHeaders) || true;
	options.plugin         = s2b(req.query.plugin)         || s2b(req.body.plugin)         || false;
	options.return         = req.body.return               || req.query.return             || "json";
	options.dir            = req.query.dir                 || req.body.dir                 || "/cache/";

//	if (!options.compressResponse) {
//    Don't compress response even if Accept-Encoding: gzip,deflate
//    appears in request header.
//	}

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
    
    if (!source) return "";

    source = source.trim().replace("\r", "").split(/[\r\n]+/).filter(
				function (line) {
					return line.trim() != "";
	    			});
	
	if (prefix)		    			
		for (i = 0; i < source.length; i++) {source[i] = prefix + source[i];}
	
	return source;
}