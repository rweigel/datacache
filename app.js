var request = require("request"),
	xml2js = require('xml2js'),
	parser = new xml2js.Parser(),
	express = require('express'),
	app = express.createServer(),
	crypto = require("crypto"),
	fs = require("fs"),
	hogan = require("hogan.js");

var memLock = {};
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
		forceUpdate: false,
		concurrency: 1
	}))
})

app.post('/', function(req, res, next){
	var source = [];
	var results = [];
	var options = {};
	
	options.forceUpdate = req.body.forceUpdate;
	
	var concurrency = req.body.concurrency ? +req.body.concurrency : 1;


	source = req.body.source
			.trim()
			.split("\n")
			.filter(function(line){
				return line.trim()!="";
			});
	if(source.length==0){
		return res.redirect("back");
	}

	results = [];

	var running = 0;
	var jobs = source.slice(); // a copy of source array

	runJob();

	function runJob(){
		while(running < concurrency && jobs.length>0) {
			running++;
			var url = jobs.pop();
			processUrl(url, results, options, function(result){
				running--;
				results.push(result);
				runJob();
			});
		} 
		if(results.length == source.length){
			res.contentType("html");	
			res.send(renderIndex({
				source: source,
				results : results,
				forceUpdate: options.forceUpdate,
				concurrency : concurrency
			}))
		}
	}
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
			return "URL: "+escapeHTML(d.url)+"<br><font color='red'>Error:"+d.error+"</font>";
		} else {
			var cacheUrl = "/cache/"+d.url.split("/")[2]+"/"+md5(d.url);
			return "URL: "+escapeHTML(d.url)
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
		concurrency : context.concurrency 
	});
};

function processUrl(url, results, options, callback){
	var result = newResult(url);
	if(!options.forceUpdate){
		isCached(url, function(exist){
			if(exist) {
				result.isFromCache = true;
				callback(result);
			} else {
				fetch();
			}
		});
	} else {
		fetch();
	}

	function fetch(){
		getDataUrl(url, function(err, url2){
			if(err){
				result.error = "Error getting data url";
				callback(result);
			} else {
				var start = +new Date();
	    		request.get({uri:url2}, function(error, response, body){
	    			if(error || response.statusCode!==200){
	    				result.error = "Can't fetch data";
	    				callback(result);
	    			} else {
	    				var end = +new Date();
	    				result.time = (end -start);
	    				result.body = body;
	    				result.data = getData(url, body);
	    				result.md5 =  md5(result.data);
	    				result.header = response.headers;
	    				writeCache(result);
	    				callback(result);
	    			}
	    		})
			}
		})
	}
}

function getData(url, doc){
	var re;
	switch(url.split("/")[2].toLowerCase()){
	case "cdaweb.gsfc.nasa.gov": 
		re = /^([\d-]+)\s+([\d:\.]+)\s+([\d\.]+)\s+([+-\.\d]+)\s+([+-\.\d]+)\s+([+-\.\d]+)$/;
		break;
	case "sscweb.gsfc.nasa.gov":
		re = /^([\d]+)\s+([\d]+)\s+([\d:]+)\s+([+-\.\d]+)\s+([+-\.\d]+)\s+([+-\.\d]+)$/;
		break;
	case "supermag.uib.no":
		re = /^([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)$|^BRW\s+([\d-]+)\s([\d-]+)\s([\d-]+)$/;
		break;
	default:
		re = /.*/;
	}
	return doc.split("\n")
			.filter(function(line){
				return line.search(re)!=-1;
			})
			.join("\n");
}

function getDataUrl(url, callback){ 	//callback(err, url)
	if(url.split("/")[2].toLowerCase()==="cdaweb.gsfc.nasa.gov"){
		request.get({uri: url}, function(error, response, body) {
			if(error || response.statusCode!==200) {
				callback(true, undefined);
			} else {
				parser.parseString(body, function(err, res){
					if(err || !res.FileDescription || !res.FileDescription.Name){
						callback(true, undefined);
					} else{
						callback(false, res.FileDescription.Name);
					}
				});
			}
		});
	} else {
		callback(false, url);
	}
}

function isCached(url, callback){
	fs.exists(__dirname + "/cache/" + url.split("/")[2] + "/" + md5(url)+".log", callback);
}

// Async version
function writeCache(result){
	var directory =  __dirname + "/cache/" + result.url.split("/")[2];
	var filename = directory + "/" + md5(result.url);
	var header = [];
	for(var key in result.header){
		header.push(key + " : " + result.header[key]);
	}
	if(!memLock[result.url]) {
		// if memLock[result.url] is undefine or 0, no writting is on-going
		memLock[result.url] = 4;

		// create dir if not exist
		fs.exists(directory, function(exist){
			if(!exist){
				fs.mkdir(directory, function(err){
					if(err){
						console.error(err);
					} else {
						writeCacheFiles();
					}
				});
			} else{
				writeCacheFiles();
			}
			
		});	
	}

	function writeCacheFiles(){
		fs.writeFile(filename+".data", result.data, finish);
		fs.writeFile(filename+".header", header.join("\n"), finish);
		fs.writeFile(filename+".out", result.body);
		fs.writeFile(filename+".md5", result.md5, finish);
		fs.appendFile(filename+".log", 
			formatTime(result.date) + "\t"+result.time+"\t"+result.md5+"\n",
			finish
		);
	}

	function finish(err){
		if(err){
			console.log("Error occured when writing cache!: "+err);
			console.trace(err);
		}
		memLock[result.url]--;
	}
}

function formatTime(date){
	if(!date){
		return;
	}
	return [date.getFullYear(),
		pad(date.getMonth()+1,2),
		pad(date.getDate(), 2),
		pad(date.getHours(), 2),
		pad(date.getMinutes(), 2),
		pad(date.getSeconds(), 2),
		pad(date.getMilliseconds(), 3)
	].join(" ");

	function pad(str, num){
		// convert to string
		str = str+"";
		while(str.length < num) {
			str = "0"+str;
		}
		return str;
	}
}

// construct a result object with default values
function newResult(url){
	return {
		url : url,
		md5 : "",
		data : "",
		header : "",
		date : new Date(),
		time : 0,
		isFromCache : false,
		error : false
	}
}

function md5(str){
	return crypto.createHash("md5").update(str).digest("hex");
}

function escapeHTML(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
}