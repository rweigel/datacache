var util = require("./util.js"),
	fs = require("fs"),
	EventEmitter = require("events").EventEmitter;

module.exports = exports = new EventEmitter();
exports.setMaxListeners(1000);

var logger = require("./logger.js");

var MAXTRIES = 3;
var CONCURRENCY = 20;

var params = {
	maxTries : MAXTRIES,
	concurrency : CONCURRENCY
}

var runningWorks = [];
var worksQueue = [];

function addURLs(source, options, callback){
	callback = callback || function(){};
	var finished = [];
	source.forEach(function(url){
		addURL(url, options, function(work){
			finished.push(work);
			if(finished.length==source.length){
				callback(finished);
			}
		});
	})
}
exports.addURLs = addURLs;

function addURL(url, options, callback){
	options = options || {};
	var work = newWork(url, options, callback);
	exports.emit("submit", work);
	worksQueue.push(work);
	run();
}
exports.addURL = addURL;

var plugins = [];
var defaultPlugin = require("./plugins/default.js");
fs.readdir(__dirname+"/plugins", function(err, files){
	if(!err){
		files.forEach(function(file){
			if(file!=="default.js"){
				var p = require("./plugins/"+file);
				p.__proto__ = defaultPlugin;
				plugins.push(p);
			}
		});
	}
})

function run(){
	while(runningWorks.length < params.concurrency && worksQueue.length>0) {
		var work = worksQueue.shift();
		work.requestSentTime = new Date();
		runningWorks.push(work);
		util.isCached(work, function(work){
			if(!work.foundInCache || work.options.forceUpdate){
				work.preprocess(function(err, work){
					work.process(function(err, work){
						work.responseFinshedTime = new Date();
						work.time = (work.responseFinshedTime - work.requestSentTime);
						work.postprocess(function(err, work){
							workFinsih();
						});
					});
				})
			} else {
				work.isFromCache = true;
				workFinsih();
			}

			function workFinsih(){
				runningWorks.remove(work);
				if(work.error && work.tries < params.maxTries){
					work.tries += 1;
					worksQueue.push(work);
				} else{
					work.isFinished = true;
					exports.emit("finish", work);
					logger.log("finish", work);
					work.callback(work);
				}
				run();
			}
	
		})		
	}
	if(worksQueue.length > 0) {
		process.nextTick(run);
	}
}

function newWork(url, options, callback){
	console.log(url, typeof url);
	var plugin = plugins.find(function(d){ return d.match(url);}) 
		|| defaultPlugin;
	var work = {
		id: util.getId(),
		plugin : plugin,
		url : url,
		options : options ? {forceUpdate: options.forceUpdate, acceptGzip: options.acceptGzip} : {},
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
		callback : callback || function(){},
		process : function(callback){
			exports.emit("process", this);
			this.plugin.process(this, callback);
		},
		preprocess : function(callback){
			exports.emit("preprocess", this);
			this.plugin.preprocess(this, callback);
		},
		postprocess : function(callback){
			exports.emit("postprocess", this);
			this.plugin.postprocess(this, callback);
		},
		extractData: function(data){
			exports.emit("extractdata", this);
			return this.plugin.extractData(data);
		}
	}
	logger.log("submit", work);
	return work;
}