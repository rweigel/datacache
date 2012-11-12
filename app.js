var request = require("request"),
	xml2js = require('xml2js'),
	parser = new xml2js.Parser(),
	express = require('express'),
	app = express(),
	server = require("http").createServer(app),
	sio = require("socket.io").listen(server),
	crypto = require("crypto"),
	fs = require("fs"),
	hogan = require("hogan.js"),
	moment = require("moment");

var scheduler = require("./scheduler.js");
var util = require("./util.js");
var logger = require("./logger.js");

// create cache dir if not exist
if(!fs.existsSync(__dirname+"/cache")){
	fs.mkdirSync(__dirname+"/cache");
}

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
// app.use(express.errorHandler({ showStack: true, dumpExceptions: true }));

app.get('/', function(req, res){
	res.contentType("html");
	fs.readFile(__dirname+"/index.html", "utf8", function(err, data){
		res.send(data);
	})
})

app.get('/log', function(req, res){
	res.send(fs.readFileSync(__dirname+"/application.log", "utf8"));
})

app.get("/syncsubmit", function(req,res){
	res.contentType("html");
	fs.readFile(__dirname+"/syncsubmit.html", "utf8", function(err, data){
		res.send(data);
	})
})

app.post("/syncsubmit", function(req, res){
	var options = parseOptions(req);
	// console.log(options);
	var source = parseSource(req);
	// console.log(source, source===[]);
	if(source.length===0){
		return res.send(400, "At least one url must be provided.");
	}
	var results = [];
	scheduler.addURLs(source, options, function(results){
		res.send(results);
	});
})

app.get("/tsds_fe", function(req, res){
	var options = parseOptions(req);
	if(source.length===0){
		return res.send(400, "At least one url must be provided.");
	}scheduler.addURL(req.query.url, options, function(work){
		if(options.type==="json"){
			return res.send(work);
		}
		// res.redirect("/cache/"+work.url.split("/")[2]+"/"+work.urlMd5+".out");
		var filePath = __dirname+"/cache/"+work.url.split("/")[2]+"/"+work.urlMd5;
		if(options.type==="data"){
			filePath+=".data";
		} else { // default to options.type = "repsonse"
			filePath+=".out";
		}
		fs.readFile(filePath, function(err, data){
			if(err){
				return res.send(404);
			} else{
				return res.send(data);
			}
		})
	});
})


app.post("/submit", function(req, res){
	var options = parseOptions(req);
	var source = parseSource(req);
	scheduler.addURLs(source, options);
	res.send(200);
})

app.get("/api/plugins", function(req, res){
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

server.listen(8000);
var clients = [];

sio.sockets.on("connection", function(socket){
	clients.push(socket);
	socket.on("disconnect", function(){
		clients.remove(socket);
	})
})
sio.set("log level", 1);
logger.bindClientList(clients);

function parseOptions(req){
	var options = {};
	
	options.forceUpdate = req.body.forceUpdate || req.query.update==="true";
	options.acceptGzip = req.body.acceptGzip || req.acceptGzip;
	options.type = req.query.type || "response"; // valid values: "data", "response", "json"
	options.includeData = req.query.includeData || req.body.includeData || "false";

	return options;
}

function parseSource(req){
	var source = req.body.source
			.trim()
			.replace("\r", "")
			.split(/[\r\n]+/)
			.filter(function(line){
				return line.trim()!="";
			});
	return source;
}