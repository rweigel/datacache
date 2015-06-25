var util     = require("./util.js");
var log      = require("./log.js");
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
	source.forEach(function (url) {
		addURL(url, options, function (work) {
			finished.push(work)
			if (finished.length == source.length) {
				finished.sort(function (a,b) {
					return +a.id.split("-")[1] - b.id.split("-")[1];
				})
				callback(finished)
			}
			//callback(finished);
			//callback(work);
		});
	})
}
exports.addURLs = addURLs;

function addURL(url, options, callback) {
	var loginfo  = options.loginfo
	var logcolor = options.logcolor

	if (options.debugschedulerconsole) {
		log.logc(options.loginfo + " scheduler.addURL(): Called with url = " + url, logcolor)
	}
	options  = options || {}
	var work = newWork(url, options, callback)
	exports.emit("submit", work)
	worksQueue.push(work)
	if (work.options.debugschedulerconsole) {
		log.logc(options.loginfo + " scheduler.addURL(): Calling run().", options.logcolor)
	}
	run();
}
exports.addURL = addURL;

var plugins = []
var defaultPlugin = require("./plugins/default.js")
fs.readdir(__dirname+"/plugins", function (err, files) {
	if (!err) {
		files.forEach(function (file) {
			if (file !== "default.js") {
				var p = require("./plugins/"+file)
				p.__proto__ = defaultPlugin
				plugins.push(p)
			}
		})
	}
})
exports.plugins = plugins;

function run() {

	while (runningWorks.length < params.concurrency && worksQueue.length > 0) {
		var work     = worksQueue.shift()
		var loginfo  = work.options.loginfo
		var logcolor = work.options.logcolor

		runningWorks.push(work)

		if (work.options.respectHeaders) {
			work.cacheCheckStartTime = new Date();
		}
		if (work.options.debugschedulerconsole) {
			log.logc(loginfo + " scheduler.run(): Calling util.isCached.", logcolor)
		}
		util.isCached(work, function (work) {
			work.cacheCheckFinishedTime = new Date()
			if (work.options.debugschedulerconsole) {
				log.logc(loginfo + " scheduler.run(): util.isCached() callback.", logcolor)
				log.logc(loginfo + " scheduler.run(): work.foundInCache      = " + work.foundInCache, logcolor)
				log.logc(loginfo + " scheduler.run(): options.forceUpdate    = " + work.options.forceUpdate, logcolor)
				log.logc(loginfo + " scheduler.run(): options.forceWrite     = " + work.options.forceWrite, logcolor)
				log.logc(loginfo + " scheduler.run(): options.respectHeaders = " + work.options.respectHeaders, logcolor)
				log.logc(loginfo + " scheduler.run(): work.isExpired         = " + work.isExpired, logcolor)
			}
			if (!work.foundInCache || work.options.forceUpdate || (work.options.respectHeaders && work.isExpired)) {				
			    work.preprocess(function (err, work) {
				    work.processStartTime = new Date()
				    work.process(function (err, work) {
					    work.postprocess(function (err, work) {
						    work.processFinishedTime = new Date()
						    workFinish()
						})
					})
				})
			} else {
				if (work.options.debugschedulerconsole) {
					log.logc(loginfo + " scheduler.run(): Cache hit.", logcolor)
				}
			    work.isFromCache = true
			    workFinish()
			}

			function workFinish() {
				runningWorks.remove(work)
				if (work.options.debugschedulerconsole) {
					log.logc(loginfo + " scheduler.run.workFinish(): Called.", logcolor)
				}
				if (work.options.debugschedulerconsole) {
					log.logc(loginfo + " scheduler.run.workFinish(): work.error    = " + work.error, logcolor)
					log.logc(loginfo + " scheduler.run.workFinish(): work.retries  = " + work.retries, logcolor)
					log.logc(loginfo + " scheduler.run.workFinish(): work.maxTries = " + work.options.maxTries, logcolor)
				}

				if (!work.error && work.retries < work.options.maxTries) {
					util.getCachedData(work, function (err) {
						exports.emit("finish", work)
						if (!work.isfinished) {
							work.isfinished = true;
							work.callback(work2result(work))
						} else {
							if (work.options.debugstreamconsole) {
								log.logc(loginfo + " scheduler.run.workFinish(): Work already sent.  Not executing work.callback().", logcolor)
							}
						}
					})						
				}

				if (work.error && work.retries < work.options.maxTries) {
					log.logc(loginfo + "  scheduler.run.workFinish(): Will retry " + work.url, 160)
					work.retries += 1
					worksQueue.push(work)
				} else {
					if (work.data && !work.isfinished) {
						if (work.options.debugstreamconsole) {
							log.logc(loginfo + " scheduler.run.workFinish(): work.data exists and work.isfinished=false. Executing work.callback().", logcolor)
						}
						work.isfinished = true;
						work.callback(work2result(work))
					} else {
						if (work.retries == work.options.maxTries) {
							log.logc(loginfo + " scheduler.run.workFinish(): Finished max number of tries (" + work.options.maxTries + ") for "+work.url, 160)	
							if (!work.isfinished) {
								if (work.options.debugstreamconsole) {
									log.logc(loginfo + " scheduler.run.workFinish(): Work not already sent.  Executing work.callback().", logcolor)
								}
								util.getCachedData(work, function (err) {
									exports.emit("finish", work)
									if (!work.isfinished) {
										work.isfinished = true;
										work.callback(work2result(work))
									} else {
										if (work.options.debugstreamconsole) {
											log.logc(loginfo + " scheduler.run.workFinish(): Work already sent.  Not executing work.callback().", logcolor)
										}
									}
								})	
							} else {
								if (work.options.debugschedulerconsole) {
									log.logc(loginfo + " scheduler.run.workFinish(): Work already sent.  Not Checking cache.", logcolor)
								}
							}						
						}
					}
				}
				run()
			}
		})		
	}
	if (worksQueue.length > 0) {
	    if (typeof(setImmediate) !== "undefined") {
	    	setImmediate(run)
	    } else {
	    	process.nextTick(run);
	    }
	}
}

function work2result(work) {

	work.work2ResultStartTime = new Date()

	if (work.options.includeMeta) {
		if (!work.hasOwnProperty("meta")) {
			work["meta"] = {}
		}
		if (!work.hasOwnProperty("datax")) {
			work["datax"] = {}
		}

		if (typeof(work["meta"]) === "undefined") {
			work["meta"] = work["datax"]			    
		} else if (work["meta"].length == 0) {
			work["meta"] = work["datax"]
		} else {
			work["meta"] = work["meta"]
		}
	}

	work.work2ResultFinishedTime = new Date()
	work.jobFinishedTime = new Date()
	return work

}

function getPlugin(options,url) {
	var plugin
	if (options.plugin) {
		// Find plug-in by name
		plugin = plugins.find(function (d) {return d.name === options.plugin}) || ""
	} else {
		// Find plug-in that returns true given a URL
		plugin = plugins.find(function (d) {return d.match(url)}) || defaultPlugin
	}
	return plugin
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

	if (plugin === "") {
		console.log("Error: plugin "+options.plugin+" not found.");
		var pluginerror = "Error: plugin "+options.plugin+" not found.";
	} else {
		var pluginerror = false;
	}

	// TODO: If pluginerror, a crash results.

	//TODO: Check if plugin changed on disk.  If so, re-load it.
	plugin = getPlugin(options,url);
	
	if (plugin.extractSignature) {
		extractSignature = plugin.extractSignature(options)
	}
	if (options.debugschedulerconsole && extractSignature !== "") {
		log.logc(options.loginfo + " scheduler.newWork(): MD5(URL): "+util.md5(url), options.logcolor)
		log.logc(options.loginfo + " scheduler.newWork(): MD5(extractSignature): "+util.md5(extractSignature), options.logcolor)
		log.logc(options.loginfo + " scheduler.newWork(): MD5(URL + extractSignature): "+util.md5(url+extractSignature), options.logcolor)
		//log.logc(options.loginfo + " scheduler.run(): plugin extractSignature: ", options.logcolor)
		//log.logc(extractSignature, options.logcolor)
	}

	// TODO: If extractSignature was provided, the plugin modifies the returned data.  
	// For example if a time range was specified, it subsets the returned file.
	// Because the urlMd5 depends on the signature, the original file will be
	// re-downloaded each time the signature changes.  This could be avoided by
	// creating work.urlMd5base which is the MD5 of the base file.  If a request
	// comes in and urlMd5.out does not exist, scheduler should check to see if
	// urlMd5base.out exists.
	
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
				error: pluginerror,
				jobStartTime : new Date(),
				processStartTime : 0,
				cacheCheckStartTime : 0,
				cacheCheckFinishedTime : 0,	
				cacheCheckError : "",	
				cacheWriteStartTime : 0,
				cacheWriteFinishedTime : 0,
				cacheWriteError : "",
				headCheckStartTime : 0,
				headCheckFinishedTime : 0,
				headLastModified : 0,
				headInCacheLastModified : 0,	
				headCheckError: false,
				getStartTime : 0,
				getFirstChunkTime: 0,
				getFinishedTime : 0,
				work2ResultStartTime: 0,
				work2ResultFinishedTime: 0,
				processFinishedTime : 0,
				jobFinishedTime : 0,
				retries : 0,
				isfinished: false,
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
	return work
}
exports.newWork = newWork
