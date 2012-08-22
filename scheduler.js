var util = require("./util.js"),
	fs = require("fs");

var MAXTRIES = 3;
var CONCURRENCY = 1000;

var params = {
	maxTries : MAXTRIES,
	concurrency : CONCURRENCY
}

var plugins = [];
var defaultPlugin = require("./default_plugin.js");

fs.readdir(__dirname+"/plugins", function(err, files){
	if(!err){
		fils.forEach(function(file){
			plugins.push(require(file));
		});
		
	}
})

var runningWorks = [];
var worksQueue = [];

function addURLs(source, options){
	var works = source.slice().map(function(url){
		return newWork(url, options);
	});
	worksQueue = worksQueue.concat(works);
	run();
}
exports.addURLs = addURLs;

function run(){
	while(runningWorks.length < params.concurrency && worksQueue.length>0) {
		var work = worksQueue.shift();
		runningWorks.push(work);
		work.process(function(work){
			runningWorks.remove(work);
			if(work.error && work.tries < params.maxTries){
				work.tries += 1;
				worksQueue.push(work);
			} else{
				params.previousTime = work.time;
				if(work.time > params.previousTime) {
					if(params.concurrency < 300){
						params.concurrency += 1;
					}
				} else {
					if(params.concurrency > 1){
						params.concurrency -= 1;
					}
				}
				work.isFinished = true;
				util.log("URL finshed :"+work.url + " <br> ");
			}
			run();
		});
	}
	if(worksQueue.length > 0) {
		process.nextTick(run);
	}
}

function newWork(url){
	util.log("Add url: "+url);
	var plugin = plugins.find(function(d){ return d.match(url);}) 
		|| defaultPlugin;
	return {
		plugin : plugin,
		url : url,
		options : {},
		md5 : "",
		urlMd5 : util.md5(url),
		data : "",
		header : "",
		createTime : new Date(),
		time : 0,
		isFromCache : false,
		isCached : false,
		isFinished : false,
		error : false,
		requestSentTime : 0,
		responseTime : 0,
		responseFinshedTime : 0,
		writeFinishedTime : 0,
		tries : 0,
		process : function(callback){
			this.plugin.process(this, callback);
		}
	}
}