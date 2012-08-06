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

var DEFAULT_CONCURRENCY = 1000;
var DEFAULT_TRIES = 3;

var indexTmpl = hogan.compile(fs.readFileSync(__dirname+"/index.html", "utf8"));

// create cache dir if not exist
if(!fs.existsSync(__dirname+"/cache")){
	fs.mkdirSync(__dirname+"/cache");
}

// middleware
app.use(express.bodyParser());

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
	res.send(renderIndex({
		source: [],
		results: [],
		forceUpdate: false
	}))
})

app.post('/', function(req, res, next){
	var request_start = +new Date();
	var source = [];
	var options = {};
	
	options.forceUpdate = req.body.forceUpdate;
	options.acceptGzip = req.body.acceptGzip;
	options.output = req.body.output;
	
	var concurrency = +req.body.concurrency;
	if(!concurrency || concurrency <1 || concurrency >1000){
		concurrency = DEFAULT_CONCURRENCY;
	};
	var tries = req.body.tries;
	if(!tries || tries<1 || tries>10){
		tries = DEFAULT_TRIES;
	}

	options.concurrency = concurrency;
	options.tries = tries;


	source = req.body.source
			.trim()
			.split("\n")
			.filter(function(line){
				return line.trim()!="";
			});
	if(source.length==0){
		return res.redirect("back");
	}

	util.log("Job started.");
	jobRunner.runJob(source, options, function(results){
		var request_end = +new Date();
		if(options.output==="json"){
			var urlnum = 1;
			res.json(results.map(function(result){
				return [
					urlnum++, 
					result.url, 
					util.md5(result.url),
					result.isCached ? 1 : 0,
					result.time,


				];
			}));
		} else {
			res.contentType("html");	
			res.send(renderIndex({
				source: source,
				results : results,
				forceUpdate: options.forceUpdate,
				concurrency : concurrency,
				tries : tries,
				total_time : request_end - request_start
			}))
		}
		util.log("Job ended.");
	});
})

app.listen(8000);

function renderIndex(context){
	var resultText = context.results
	// restore urls' order
	.sort(function(a, b){
		return context.source.indexOf(a.url) - context.source.indexOf(b.url);
	})
	.map(function(d){
		if(d.error){
			return "URL: "+escapeHTML(d.url)+"<br><font color='red'>Error:"+d.error+"</font><br>Tried " + (d.tries || 1) + " times";
		} else {
			var cacheUrl = "/cache/"+d.url.split("/")[2]+"/"+util.md5(d.url);
			return "URL: "+util.escapeHTML(d.url)
				 + (d.isFromCache ? "<br><font color='orange'>Found in cache.</font>" : "")
				+"<br>Time: <font color='green'>"+d.time + "ms</font>"
				+"<br> md5: "+d.md5
				+"<br> File: <a href='"+ cacheUrl+".data'>data</a> | <a href='"
				+cacheUrl+".out'> response </a>  | <a href='"
				+cacheUrl+".header'> header </a> | <a href='"
				+cacheUrl + ".log'> log </a>";
		}
	}).join('<br><br>');
	return indexTmpl.render({
		source : context.source.join("\n\n"),
		resultText : resultText,
		forceUpdate : context.forceUpdate ? "checked" : "",
		concurrency : context.concurrency || DEFAULT_CONCURRENCY,
		tries : context.tries || DEFAULT_TRIES,
		total_time : context.total_time
	});
};
