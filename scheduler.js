var util     = require("./util.js");
var logger   = require("./logger.js");
var fs       = require("fs");
EventEmitter = require("events").EventEmitter;

module.exports = exports = new EventEmitter();
exports.setMaxListeners(1000);

// Maximum number of jobs to run at same time.
var params = { concurrency : 40 };

var runningWorks = [];
var worksQueue   = [];

function addURLs(source, options, callback){
	callback = callback || function () {};
	var finished = [];
	source.forEach(function(url){
		addURL(url, options, function (work) {
			finished.push(work);
			if (finished.length == source.length) {
				finished.sort(function (a,b){
					return +a.id.split("-")[1] - b.id.split("-")[1];
				});
				callback(finished);
			}
			//callback(finished);
			//callback(work);
		});
	})
}
exports.addURLs = addURLs;

function addURL(url, options, callback) {
	options  = options || {};
	var work = newWork(url, options, callback);
	exports.emit("submit", work);
	worksQueue.push(work);
	run();
}
exports.addURL = addURL;

var plugins = [];
var defaultPlugin = require("./plugins/default.js");
fs.readdir(__dirname+"/plugins", function (err, files) {
	if (!err) {
		files.forEach(function (file) {
			if (file !== "default.js") {
				var p = require("./plugins/"+file);
				p.__proto__ = defaultPlugin;
				plugins.push(p);
			}
		});
	}
})
exports.plugins = plugins;

function run() {

	logger.d("scheduler: "+runningWorks.length + ", " + params.concurrency);

	while (runningWorks.length < params.concurrency && worksQueue.length > 0) {
		var work = worksQueue.shift();
		runningWorks.push(work);

		logger.d("scheduler.run(): Processing work");

		work.cacheCheckStartTime = new Date();
		util.isCached(work, function (work) {
			work.cacheCheckFinishedTime = new Date();
			if (!work.foundInCache || work.options.forceUpdate || (work.options.respectHeaders && work.isExpired)) {
				
			    work.preprocess(function (err, work) {
				    work.processStartTime = new Date();
				    work.process(function (err, work) {
					    work.postprocess(function (err, work) {
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
				if (work.error && work.retries < work.options.maxTries) {
					work.retries += 1;
					worksQueue.push(work);
				} else {
					if (work.retries == work.options.maxTries) {
						console.warn("scheduler.run.workFinish(): Number of tries (" + work.options.maxTries + ") exceeded.  Aborting and returing cached data if found. URL = \n\t"+work.url);
					}
					if(work.data){
						work.callback(work2result(work));
					} else {
						util.getCachedData(work, function (err) {
							exports.emit("finish", work);
							logger.log("finish", work);
							work.callback(work2result(work));
						})
					}
				}
				work.finishFinishedTime = new Date();				
				run();
			}
	
		})		
	}
	if (worksQueue.length > 0) {
	    logger.d("scheduler.run(): Delaying");
	    if (typeof(setImmediate) !== "undefined") {
	    	setImmediate(run);
	    } else {
	    	process.nextTick(run);
	    }
	}
}

function work2result(work) {

	work.work2ResultStartTime = new Date();
	var ret = {};
	//console.log(work.header);
	for (var key in work) {

		if (key!=="data" && key!=="dataBinary" && key!=="dataJson" && key!=="datax" && key!=="meta" && key!=="metaJson" && key!=="body") {
			ret[key] = work[key];
		}

		//console.log(work);
		if (work.options.includeData) {
		    if (Object.keys(work["dataJson"]).length == 0) {
			ret["data"] = work["data"];
		    } else {
			ret["dataJson"] = work["dataJson"];
		    }
		}
		
		//console.log(work["meta"]);
		//console.log(work["metaJson"]);
		//console.log(work.options.includeMeta)
		if (work.options.includeMeta) {
			//console.log(work.options.includeMeta)

			//if (Object.keys(work["metaJson"]).length == 0) {
		    	if (!work.hasOwnProperty("meta")) {
		    		work["meta"] = {};
		    	}
		    	if (!work.hasOwnProperty("datax")) {
		    		work["datax"] = {};
		    	}
		    	
				if (typeof(work["meta"]) === "undefined") {
				    ret["meta"] = work["datax"];			    
				} else if (work["meta"].length == 0) {
				    ret["meta"] = work["datax"];
				} else {
				    ret["meta"] = work["meta"];
				}
			    } else {
					ret["metaJson"] = work["metaJson"];
			    }
			//}
	}
	ret.work2ResultFinishedTime = new Date();
	ret.jobFinishedTime = new Date();
	return ret;
}

function getPlugin(options,url) {
	var plugin;
	if(options.plugin){
		plugin = plugins.find(function (d) {
			return d.name === options.plugin;
		}) || defaultPlugin;
	} else {
		plugin = plugins.find(function(d){return d.match(url);}) || defaultPlugin;
	}
	return plugin;
}
exports.getPlugin = getPlugin;

var getId = (function () {

	var Id = 1;
	var timeStamp = "";

	function pad(str, num){
	    // convert to string
	    str = str+"";
	    while (str.length < num) {
			str = "0" + str;
	    }
	    return str;
	}

	return function () {
	    var now = new Date();
	    var ret = "" + now.getFullYear() + pad(now.getMonth() + 1, 2) + pad(now.getDate(), 2);
	    if (ret !== timeStamp) {
			timeStamp = ret;
			jobId = 1;
	    }
	    return ret + "-" + (jobId++);
	}
})();

function newWork(url, options, callback){

	plugin = getPlugin(options,url)

	//TODO: Check if plugin changed on disk.  If so, re-load it.
	plugin = getPlugin(options,url);
	
	if (plugin.extractSignature) extractSignature = plugin.extractSignature(options);
	if (options.debugapp && extractSignature !== "") console.log("plugin extractSignature: " + extractSignature);

	// TODO:  If extractSignature was provided, the plugin modifies the returned data.  For example if a time range was specified, it
	// subsets the returned file.  Because the urlMd5 depends on the signature, the original file will be re-downloaded each time the signature
	// changes.  This could be avoided by creating work.urlMd5base which is the md5 of the base file.  If a request comes in and urlMd5.out does not exist,
	// scheduler should check to see if urlMd5base.out exists.
	
	var work = {
		id: getId(),
		plugin : plugin,
		url : url,
		options : options ? options : {},
		dataMd5 : "",
		dataLength : -1,
		urlMd5 : util.md5(url+extractSignature),
		urlMd5base: util.md5(url),
		time: 0,
		data: "",
		header: {},
		dir: "",
		lstat: {},
		versions: [],
		isFromCache : false,
		isExpired : false,
		isFinished : false,
		foundInCache: false,
		error : false,
		jobStartTime : new Date(),
		processStartTime : 0,
		cacheCheckStartTime : 0,
		cacheCheckFinishedTime : 0,
		getFirstChunkTime: 0,
		finishStartTime: 0,
		work2ResultStartTime: 0,
		work2ResultFinishedTime: 0,
		finishFinishedTime: 0,
		writeStartTime : 0,
		writeFinishedTime : 0,
		processFinishedTime : 0,
		jobFinishedTime : 0,
		getEndTime : 0,
		retries : 0,
		callback : callback || function(){},
		process : function (callback) {
			exports.emit("process", this);
			this.plugin.process(this, callback);
		},
		preprocess : function (callback) {
			exports.emit("preprocess", this);
			this.plugin.preprocess(this, callback);
		},
		postprocess : function (callback) {
			exports.emit("postprocess", this);
			this.plugin.postprocess(this, callback);
		},
		extractData: function (data, options) {
			exports.emit("extractdata", this);
			if (data.length == 0) {
				return "\n";
			}
			return this.plugin.extractData(data, options);
		},
		extractDataBinary: function (data, options) {
			exports.emit("extractdatabinary", this);
			return this.plugin.extractDataBinary(data, options);
		},
		extractDataJson: function (data, options) {
			return this.plugin.extractDataJson(data, options);
		},
		extractMeta: function(data, options) {
			return this.plugin.extractMeta(data, options);
		},
		extractMetaJson: function (data, options) {
			return this.plugin.extractMetaJson(data, options);
		},
		extractRem: function(data, options) {
			return this.plugin.extractRem(data, options);
		}
	}
	logger.log("submit", work);
	return work;
}