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
	moment = require("moment");

// Compress responses if accept-encoding allows it.
app.use(express.compress());

var scheduler = require("./scheduler.js");
var util = require("./util.js");
var logger = require("./logger.js");

// create cache dir if not exist
if(!fs.existsSync(__dirname+"/cache")){
	fs.mkdirSync(__dirname+"/cache");
}

// get port number from command line option
var port = process.argv[2] || 8000;

// middleware
app.use(express.bodyParser());

app.use("/asset", express.static(__dirname + "/asset"));

// set default content-type to "text"
app.use(function(req, res, next){
	res.contentType("text");
	next();
})
app.use("/cache", express.static(__dirname + "/cache"));
app.use("/cache", express.directory(__dirname+"/cache"));
app.use("/demo", express.static(__dirname + "/demo"));
app.use("/demo", express.directory(__dirname+"/demo"));
// app.use(express.errorHandler({ showStack: true, dumpExceptions: true }));

app.get('/', function(req, res){
	res.contentType("html");
	fs.readFile(__dirname+"/async.htm", "utf8", function(err, data){
		res.send(data);
	})
})

app.get('/log', function(req, res){
	res.send(fs.readFileSync(__dirname+"/application.log", "utf8"));
})

app.get("/async", function(req,res){
	res.contentType("html");
	fs.readFile(__dirname+"/async.htm", "utf8", function(err, data){
		res.send(data);
	})
})
app.post("/async", function(req, res){
	var options = parseOptions(req);
	var source = parseSource(req);
	scheduler.addURLs(source, options);
	res.send(200);
})

app.get("/sync", function(req,res){

	var options = parseOptions(req);
	var source = parseSource(req);
	if(source.length===0){
	    res.contentType("html");
	    fs
		.readFile(__dirname+"/sync.htm", "utf8",
			  function(err, data){res.send(data);});
	    return;
	}

	var results = [];
	scheduler.addURLs(source, options, function(results){
		res.send(results);
	});

})
app.post("/sync", function(req, res){
	var options = parseOptions(req);
	var source = parseSource(req);
	//console.log(source);
	//console.log(options);
	if(source.length===0){
	    return res.send(400, "At least one URL must be provided.");
	}
	var results = [];
	scheduler.addURLs(source, options,function(results){
		if (options.return === "json") {
		    res.send(results);
		}
		if (options.return === "data") {
		    function pushfile(j) {
			//console.log(j);
			fname = __dirname + results[j].dir + results[j]["urlMd5"] + ".data";		    
			console.log(fname);
			var fstream = fs.createReadStream(fname);
			fstream.on('error',function(err){res.end(err);});
			fstream.on('end',function(){
				if (j < results.length-1) {
				    console.log("Finished piping file #" + j + ": " + fname);
				    j = j+1;
				    pushfile(j);
				} else {
				    console.log("Finished piping file #" + j + ": " + fname);
				    res.end();
				}
			    });
			fstream.on('open', function() {fstream.pipe(res,{end:false});});
		    }
		    var j=0;
		    pushfile(j);
		}
	    });
    });


app.get("/plugins", function(req, res){
	res.send(scheduler.plugins.map(function(p){
		return p.name;
	}));
});


app.get("/api/presets", function(req,res){
	fs.readdir(__dirname+"/presets", function(err, files){
		if(err){
			return res.send("");
		}
		var results = [];
		files.forEach(function(file){
			fs.readFile(__dirname+"/presets/"+file, "utf8", function(err, data){
				if (file.split(".")[1].toLowerCase()==="js"){
					try {
						data = eval(data);
					} catch(err){

					}
				}
				results.push({
						name : file.split(".").slice(0, -1).join("."),
						urls : data
					});
				if(results.length===files.length){
					results.sort(function(a,b){
						return a.name > b.name;
					});
					res.contentType("js");
					res.send(results);
				}
			});
		})
	})
	
})

server.listen(port);
var clients = [];

sio.sockets.on("connection", function(socket){
	clients.push(socket);
	socket.on("disconnect", function(){
		clients.remove(socket);
	})
})
sio.set("log level", 1);

// Need if running app behind apache server that does not support
// websockets.
sio.set('transports', ['xhr-polling']);
sio.set('polling duration',10);

logger.bindClientList(clients);


function parseOptions(req){
	var options = {};

	options.forceUpdate = req.query.forceUpdate || req.body.forceUpdate || false
	options.acceptGzip = req.query.acceptGzip || req.body.acceptGzip || true;
	options.includeData = req.query.includeData || req.body.includeData || false;
	options.includeMeta = req.query.includeMeta || req.body.includeMeta || false;
	options.plugin = req.query.plugin || req.body.plugin || false;

	options.dir = req.query.dir || req.body.dir || "/cache/";
	if (options.dir){
	    if (options.dir[0]!=='/'){
		options.dir = '/'+options.dir;
	    }
	    if (options.dir[options.dir.length-1]!=='/'){
		options.dir = options.dir+'/';
	    }
	}

	// TODO: If response=data, stream concatentated data files.
	options.return = req.body.return || req.query.return || "json";

	return options;
}

function parseSource(req){
    var source = req.body.source || req.query.source;

    if (!source) 
	return "";

    source = source
	.trim()
	.replace("\r", "")
	.split(/[\r\n]+/)
	.filter(function(line){
		return line.trim()!="";
	    });

	return source;
}