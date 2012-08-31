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
	res.send(fs.readFileSync(__dirname+"/index.html", "utf8"));
})

app.get('/log', function(req, res){
	res.send(fs.readFileSync(__dirname+"/application.log", "utf8"));
})

app.post("/submit", function(req, res){
	var options = parseOptions(req);
	var source = parseSource(req);
	scheduler.addURLs(source, options);
	res.send(200);
})

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
	
	options.forceUpdate = req.body.forceUpdate;
	options.acceptGzip = req.body.acceptGzip;

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