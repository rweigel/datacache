var util = require("./util.js"),
	fs = require("fs"),
	EventEmitter = require("events").EventEmitter;

module.exports = exports = new EventEmitter();
exports.setMaxListeners(1000);

var logger = require("./logger.js");

var CONCURRENCY = 20;

var params = {
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
				finished.sort(function(a,b){
					return +a.id.split("-")[1] - b.id.split("-")[1];
				});
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
exports.plugins = plugins;

function run(){
	while (runningWorks.length < params.concurrency && worksQueue.length > 0) {
		var work = worksQueue.shift();
		runningWorks.push(work);
		work.cacheCheckStartTime = new Date();
		util.isCached(work, function(work){
			work.cacheCheckFinishedTime = new Date();
			if (!work.foundInCache || work.options.forceUpdate){
			    work.preprocess(function(err, work){
				    work.processStartTime = new Date();
				    work.process(function(err, work){
					    work.postprocess(function(err, work){
						    work.processFinishedTime = new Date();
						    workFinish();
						});
					});
				})
			} else {
			    work.isFromCache = true;
			    workFinish();
			}

			function workFinish() {
				work.finishStartTime = new Date();
				runningWorks.remove(work);
				if (work.error && work.retries < work.options.maxTries){
					work.retries += 1;
					worksQueue.push(work);
				} else {
					util.getCachedData(work, function (err) {
						exports.emit("finish", work);
						logger.log("finish", work);
						work.callback(work2result(work));
					})
				}
				work.finishFinishedTime = new Date();				
				run();
			}
	
		})		
	}
	if (worksQueue.length > 0) {
	    process.nextTick(run);
	}
}

function work2result(work){
	work.work2ResultStartTime = new Date();

	var ret = {};
	// console.log(typeof work.options.includeData, work.options.includeData, work.options);
	// console.log("###", work.options.includeData === "true")
	for(var key in work){
	    //console.log(key);
		if(key!== "data" && key!=="dataJson" && key!== "datax" && key !== "meta" && key!== "metaJson" && key!=="body"){
			ret[key] = work[key];
		}

		if(work.options.includeData === "true"){
		    if (Object.keys(work["dataJson"]).length == 0) {
				ret["data"] = work["data"];
		    } else {
				ret["dataJson"] = work["dataJson"];
		    }
		}
		
		if(work.options.includeMeta === "true"){
		    if (Object.keys(work["metaJson"]).length == 0) {
			if (work["meta"].length == 0) {
				ret["meta"] = work["datax"];
			} else {
			    ret["meta"] = work["meta"];
			}
		    } else {
				ret["metaJson"] = work["metaJson"];
		    }
		}
	}
	ret.work2ResultFinishedTime = new Date();
	ret.jobFinishedTime = new Date();
	return ret;

}

function newWork(url, options, callback){
	// console.log(url, typeof url);
	var plugin;
	if(options.plugin){
		plugin = plugins.find(function(d){
			return d.name === options.plugin;
		}) || defaultPlugin;
	} else {
		plugin = plugins.find(function(d){ return d.match(url);}) 
		|| defaultPlugin;
	}
	var work = {
		id: util.getId(),
		plugin : plugin,
		url : url,
		options : options ? options : {},
		dataMd5 : "",
		dataLength : -1,
		urlMd5 : util.md5(url),
		time: 0,
		data: "",
		header: "",
		dir: "",
		stats: {},
		isFromCache : false,
		isFinished : false,
		foundInCache: false,
		error : false,
		jobStartTime : new Date(),
		processStartTime : 0,
		cacheCheckStartTime : 0,
		cacheCheckFinishedTime : 0,
		finishStartTime: 0,
		work2ResultStartTime: 0,
		work2ResultFinishedTime: 0,
		finishFinishedTime: 0,
		getFirstChunkTime: 0,
		getEndTime: 0,
		writeStartTime : 0,
		writeFinishedTime : 0,
		processFinishedTime : 0,
		jobFinishedTime : 0,
		retries : 0,
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
		},
		extractDataJson: function(data){
			return this.plugin.extractDataJson(data);
		},
		extractMetaJson: function(data){
			return this.plugin.extractMetaJson(data);
		},
		extractRem: function(data){
			return this.plugin.extractRem(data);
		},
		extractMeta: function(data){
			return this.plugin.extractMeta(data);
		},
	}
	logger.log("submit", work);
	return work;
}