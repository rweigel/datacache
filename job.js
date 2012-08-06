var fs = require("fs"),
	request = require("request"),
	xml2js = require('xml2js'),
	parser = new xml2js.Parser();

var util = require("./util.js");

module.exports.runJob = runJob;

var running = 0;
var memLock = {};

function runJob(source, options, callback){
	var concurrency = options.concurrency;
	var tries = options.tries;
	var results = [];

	var jobs = source.slice().map(function(url){
		return {
			url : url,
			tries : 1
		}
	});

	run();

	function run(){
		while(running < concurrency && jobs.length>0) {
			running++;
			var job = jobs.pop();
			processUrl(job, results, options, function(result, job){
				running--;
				if(result.error && job.tries < tries){
					job.tries += 1;
					jobs.push(job);
				} else{
					result.tries = job.tries;
					results.push(result);
				}
				
				run();
			});
		} 
		if(results.length == source.length){
			callback(results);
		}
	}
}

function processUrl(job, results, options, callback){
	var url = job.url;
	var start = +new Date();
	var result = newResult(url);

	util.log("Processing URL: "+url);
	
	isCached(url, function(exist){
		if(exist) {
			result.foundInCache = true;
			 if(options.forceUpdate){
			 	fetch();
			 } else {
			 	result.isFromCache = true;
				callback(result, job);
			 }
		} else {
			fetch();
		}
	});

	function fetch(){
		getDataUrl(url, function(err, url2){
			if(err){
				result.error = "Error getting data url";
				callback(result, job);
			} else {
				var headers = options.acceptGzip ? {"accept-encoding" : "gzip, deflate"} : {};
	    		request.get({uri:url2, headers:headers}, function(error, response, body){
	    			if(error || response.statusCode!==200){
	    				result.error = "Can't fetch data";
	    				callback(result, job);
	    			} else {
	    				var end = +new Date();
	    				result.time = (end -start);
	    				result.body = body;
	    				result.data = getData(url, body);
	    				result.md5 =  util.md5(result.data);
	    				result.header = response.headers;
	    				writeCache(result, start);
	    				callback(result, job);
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
		re = /^([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)$|^([a-zA-Z]+)\s+([\d-]+)\s([\d-]+)\s([\d-]+)$/;
		break;
	case "spidr.ngdc.noaa.gov":
		re = /^([-\d]+)\s+([\.,:\d]+)/;
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
	fs.exists(__dirname + "/cache/" + url.split("/")[2] + "/" + util.md5(url)+".log", callback);
}

// Async version
function writeCache(result, start){
	var directory =  __dirname + "/cache/" + result.url.split("/")[2];
	var filename = directory + "/" + util.md5(result.url);
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
			util.formatTime(result.date) + "\t"+result.time+"\t"+result.md5+"\n",
			finish
		);
	}

	function finish(err){
		if(err){
			log("Error occured when writing cache: " + filename + "\n" + err);
			console.trace(err);
		}
		memLock[result.url]--;
		if(memLock[result.url]==0){
			console.log("cached stored: ", (+new Date() - start), "ms");
			util.log("Cached stored: "+filename);
		}
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
		isCached : false,
		error : false,
		requestSentTime : 0,
		responseTime : 0,
		responseFinshedTime : 0,
		writeFinishedTime : 0,
	}
}