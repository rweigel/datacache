var request = require("request"),
	xml2js = require('xml2js'),
	parser = new xml2js.Parser(),
	express = require('express'),
	app = express.createServer(),
	crypto = require("crypto"),
	fs = require("fs"),
	hogan = require("hogan.js");

var jobRunner = require("./job.js");
var util = require("./util.js");

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

app.post('/', function(req, res, next){
	var request_start = +new Date();
	var options = parseOptions(req);
	var source = parseSource(req);

	if(source.length==0){
		return res.redirect("back");
	}


	jobRunner.runJob(source, options, function(results){
		var request_end = +new Date();
		res.contentType("html");	
		res.send(renderIndex({
			source: source,
			results : results,
			forceUpdate: options.forceUpdate,
			concurrency : options.concurrency,
			tries : options.tries,
			total_time : request_end - request_start
		}))
	});
})

app.post("/submit", function(req, res){
	var options = parseOptions(req);
	var source = parseSource(req);
	var jobId = jobRunner.submitJob(source, options);
	res.send({
		id : jobId,
		num : source.length
	});
})

app.post("/api/setParams", function(req, res){
	var params = {}; 
	var concurrency = +req.body.concurrency;
	if(!concurrency || concurrency <1 || concurrency >1000){
		params.concurrency = concurrency;
	};
	var tries = req.body.tries;
	if(!tries || tries<1 || tries>10){
		params.maxTries = tries;
	}
	var timeout = req.body.timeout;
	if(!timeout || timeout<100 || timeout>10){
		params.timeout = timeout;
	}
	return res.send(jobRunner.setParams(params));
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
						name : file.split(".")[0],
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

app.get("/status/job/:id", function(req, res){
	return res.send(jobRunner.getStatus(req.params.id));
})

// app.get("/status/running", function(req, res){
// 	return res.send(jobRunner.getRunningJob());
// })

// app.get("/status/finished", function(req, res){
// 	return res.send(jobRunner.getFinishedJobs());
// })

// app.get("/status", function(req, res){
// 	var all = jobRunner.getAll();
// 	var ret = [];
// 	for(var id in all){
// 		ret.push({
// 			id : all[id].id,
// 			isFinished : all[id].isFinished 
// 		})
// 	}
// 	// res.contentType("html");
// 	// res.send(ret.map(function(job){
// 	// 	return "<a href='/status/"+job.id+"'>"+job.id+"</a><br>";
// 	// }).join(""));
// 	res.send(ret);
// })

app.listen(8000);

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