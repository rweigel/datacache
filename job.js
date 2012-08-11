var fs = require("fs"),
	request = require("request"),
	xml2js = require('xml2js'),
	parser = new xml2js.Parser();

var util = require("./util.js");

var MAXTRIES = 3;
var TIMEOUT = 50000;
var MAXCONNECTION = 10000;
var CONCURRENCY = 1000;

var params = {
	maxTries : MAXTRIES,
	timeout : TIMEOUT,
	concurrency : CONCURRENCY,
}

// module.exports.runJob = runJob;
module.exports.getStatus = getStatus;
module.exports.getAll = getAll;
module.exports.getRunningJob = function(){return runningJob};
module.exports.getFinishedJobs = function(){return finishedJobs};
module.exports.submitJob = submitJob;
module.exports.setParams = setParams;

var runningWorks = [];
var worksQueue = [];
var jobQueue = [];
var finishedJobs = [];
var runningJob = null;

var memLock = {};
// var jobStatus = {};

var getJobId = (function(){
	var jobId = 1;
	var timeStamp = "";

	function pad(str, num){
		// convert to string
		str = str+"";
		while(str.length < num) {
			str = "0"+str;
		}
		return str;
	}

	return function(){
		var now = new Date();
		var ret = "" + now.getFullYear() + pad(now.getMonth() + 1, 2) + pad(now.getDate(), 2);
		if(ret!==timeStamp){
			timeStamp = ret;
			jobId = 1;
		}
		return ret+"-"+(jobId++);
	}
})();

function getAll(){
	var ret = jobQueue.concat(finishedJobs);
	if(runningJob){
		ret.push(runningJob);
	}
	return ret;
}

function getStatus(id){
	var job = getAll().find(function(el){
		return el.id===id;
	})
	return job ? 
		{
			id : job.id,
			isFinished : job.isFinished,
			finishTime : job.finishTime,
			beginTime : job.beginTime,
			time : job.time, 
			works : job.works.map(function(work){
				var ret = {};
				for(var field in work){
					if(field==="url"){
						ret["url"] = util.escapeHTML(work.url);
					}else if(field!=="data" && field!=="header" && field !== "body"){
						ret[field] = work[field];
					}
				}
				return ret;
			})
		} :
		"";
}

function setParams(p){
	for(var key in params){
		if(p[key]){
			params[key]=p[key];
		}
	}
}

function submitJob(source, options){
	var works = source.slice().map(function(url){
		return newWork(url);
	});
	var job = newJob(works);
	job.options = options;
	jobQueue.push(job);
	if(!runningJob){
		run();
	}
	return job.id;
}

function run(){
	if(runningJob || jobQueue.length===0){
		return;
	}
	runningJob = jobQueue.shift();

	runJob(runningJob, function(){
		run();
	});
}

function runJob(job, callback){
	util.log("Job#"+job.id+" started.");

	runningJobId = job.id;
	job.beginTime = new Date();
	job.works.forEach(function(work){
		worksQueue.push(work);
	})

	runWorks();

	function runWorks(){
		while(runningWorks.length < params.concurrency && worksQueue.length>0) {
			var work = worksQueue.shift();
			runningWorks.push(work);
			processUrl(work, function(work){
				runningWorks.remove(work);
				if(work.error && work.tries < params.maxTries){
					work.tries += 1;
					worksQueue.push(work);
				} else{
					work.isFinished = true;
					job.finishedCount++;
					if(job.finishedCount === job.works.length){
						job.isFinished = true;
					}
				}
				runWorks();
			});
		}
		if(worksQueue.length > 0) {
			process.nextTick(runWorks);
		} 
		if(job.isFinished){
			util.log("Job#"+job.id+" ended.");
			job.isFinished = true;
			job.finishTime = new Date();
			job.time = (+job.finishTime) - job.beginTime;
			finishedJobs.push(job);
			runningJob = null;
			callback();
		}
	}

	function processUrl(work, callback){
		var url = work.url;
		var start = +new Date();

		util.log("Processing URL: "+url);
		
		isCached(url, function(exist){
			if(exist) {
				work.foundInCache = true;
				 if(job.options.forceUpdate){
				 	fetch();
				 } else {
				 	work.isFromCache = true;
					callback(work);
				 }
			} else {
				fetch();
			}
		});

		function fetch(){
			getDataUrl(url, function(err, url2){
				if(err){
					work.error = "Error getting data url";
					callback(work);
				} else {
					var headers = job.options.acceptGzip ? {"accept-encoding" : "gzip, deflate"} : {};
					work.requestSentTime = new Date();
		    		request.get({uri:url2, timeout: TIMEOUT,  pool: {maxSockets : MAXCONNECTION}, headers:headers, encoding: null}, function(error, response, body){
		    			if(error || response.statusCode!==200){
		    				work.error = "Can't fetch data";
		    				callback(work);
		    			} else {
		    				var end = +new Date();
		    				work.time = (end -start);
		    				work.body = body;
		    				work.data = getData(url, body);
		    				work.md5 =  util.md5(work.data);
		    				work.urlMd5 = util.md5(url);
		    				work.header = response.headers;
		    				work.responseFinshedTime = new Date();
		    				writeCache(work, start, function(){
		    					callback(work);
		    				});
		    			}
		    		})
		    		.on("data", function(data){
						if(!work.responseTime) {
							work.responseTime = new Date();
						}
					});
				}
			})
		}
	}
}

	

function getData(url, doc){
	try {
		doc = doc.toString();
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
	} catch(e) { // doc is binary 
		return doc;
	}
}

function getDataUrl(url, callback){ 	//callback(err, url)
	if(url.split("/")[2].toLowerCase()==="cdaweb.gsfc.nasa.gov"){
		request.get({uri: url, timeout : TIMEOUT,  pool: {maxSockets : MAXCONNECTION}}, function(error, response, body) {
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
		})
	} else {
		callback(false, url);
	}
}

function isCached(url, callback){
	fs.exists(__dirname + "/cache/" + url.split("/")[2] + "/" + util.md5(url)+".log", callback);
}

// Async version
function writeCache(work, start, callback){
	var directory =  __dirname + "/cache/" + work.url.split("/")[2];
	var filename = directory + "/" + util.md5(work.url);
	var header = [];
	for(var key in work.header){
		header.push(key + " : " + work.header[key]);
	}
	if(!memLock[work.url]) {
		// if memLock[result.url] is undefine or 0, no writting is on-going
		memLock[work.url] = 4;

		// create dir if not exist
		fs.exists(directory, function(exist){
			if(!exist){
				fs.mkdirSync(directory);
			}
			writeCacheFiles();
		});	
	} else {
		callback();
	}

	function writeCacheFiles(){
		fs.writeFile(filename+".data", work.data, finish);
		fs.writeFile(filename+".header", header.join("\n"), finish);
		fs.writeFile(filename+".out", work.body);
		fs.writeFile(filename+".md5", work.md5, finish);
		fs.appendFile(filename+".log", 
			util.formatTime(work.date) + "\t"+work.time+"\t"+work.md5+"\n",
			finish
		);
	}

	function finish(err){
		if(err){
			log("Error occured when writing cache: " + filename + "\n" + err);
			console.trace(err);
		}
		memLock[work.url]--;
		if(memLock[work.url]==0){
			util.log("Cached stored: " + filename + (+new Date() - start) + "ms");
			work.writeFinishedTime = new Date();
			callback();
		}
	}
}

function newWork(url){
	return {
		// job : null,
		url : url,
		md5 : "",
		data : "",
		header : "",
		date : new Date(),
		time : 0,
		isFromCache : false,
		isCached : false,
		isFinished : false,
		error : false,
		requestSentTime : 0,
		responseTime : 0,
		responseFinshedTime : 0,
		writeFinishedTime : 0,
		tries : 0
	}
}

function newJob(works){
	var job = {
		id : getJobId(),
		isFinished : false,
		finishedCount : 0,
		submitTime : new Date(),
		beginTime : 0,
		finishTime : 0,
		time : 0,
		works : works,
		options : null
	};
	// job.works.forEach(function(work){
	// 	work.job = job;
	// })
	return job;
}