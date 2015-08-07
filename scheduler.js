var util     = require("./util.js")
var log      = require("./log.js")
var fs       = require("fs")
EventEmitter = require("events").EventEmitter

module.exports = exports = new EventEmitter()
exports.setMaxListeners(0)

// Maximum number of jobs to run at same time.
var params = { concurrency : 40 }

var runningWorks = []
var worksQueue   = []

function addURLs(source, res, callback){
	callback = callback || function () {}
	var finished = []
	source.forEach(function (url, partnum) {
		addURL(url, res.options, partnum, function (work) {
			finished.push(work)
			if (finished.length == source.length) {
				finished.sort(function (a,b) {
					return +a.id.split("-")[1] - b.id.split("-")[1]
				})
				callback(finished)
			}
		})
	})
}
exports.addURLs = addURLs

function addURL(url, partnum, res, callback) {

	log.logres("Called with url = " + url, res.options)

	var work = newWork(url, partnum, res.options, callback)

	work.res     = res
	work.partnum = partnum

	if (work.error !== "") {
		callback(work)
		return
	}

	worksQueue.push(work)

	log.logres("Calling run().", res.options)
	run()
}
exports.addURL = addURL

var plugins = []
var defaultPlugin = require("./plugins/default.js")
fs.readdir(__dirname + "/plugins", function (err, files) {
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

		var work = worksQueue.shift()

		runningWorks.push(work)

		if (work.options.respectHeaders) {
			work.cacheCheckStartTime = new Date();
		}
		log.logres("Calling util.isCached.", work.options, "scheduler")
		util.isCached(work, function (work) {
			work.cacheCheckFinishedTime = new Date()
			log.logres("Callback.", work.options, "scheduler")
			log.logres("work.foundInCache      = " + work.foundInCache, work.options, "scheduler")
			log.logres("options.forceUpdate    = " + work.options.forceUpdate, work.options, "scheduler")
			log.logres("options.forceWrite     = " + work.options.forceWrite, work.options, "scheduler")
			log.logres("options.respectHeaders = " + work.options.respectHeaders, work.options, "scheduler")
			log.logres("work.isExpired         = " + work.isExpired, work.options, "scheduler")
			if (!work.foundInCache || work.options.forceUpdate || (work.options.respectHeaders && work.isExpired)) {				
				log.logres("Calling work.preprocess().", work.options, "scheduler")
				work.preprocess(function (err, work) {
					work.processStartTime = new Date()
					log.logres("Calling work.process().", work.options, "scheduler")
					work.process(function (err, work) {
						log.logres("Calling work.postprocess().", work.options, "scheduler")
						work.postprocess(function (err, work) {
							work.processFinishedTime = new Date()
							log.logres("Calling workFinish().", work.options, "scheduler")
							workFinish(work)
						})
					})
				})
			} else {
				log.logres("Cache hit.", work.options, "scheduler")
				log.logres("Setting work.isFromCache = true.", work.options, "scheduler")
				log.logres("Calling workFinish().", work.options, "scheduler")
			    work.isFromCache = true
			    workFinish(work)
			}

			function workFinish(work) {
				runningWorks.remove(work)

				log.logres("Called.", work.options, "scheduler")
				log.logres("work.error      = " + work.error, work.options, "scheduler")
				log.logres("work.retries    = " + work.retries, work.options, "scheduler")

				if (work.error === "") {
					log.logres("Calling work.callback(work2result(work))", work.options, "scheduler")
					work.callback(work2result(work))
					return
				}

				if (work.error !== "" && work.retries < work.options.maxTries) {
					log.logres("Will retry " + work.url, work.options, "scheduler")
					work.retries += 1
					worksQueue.push(work)
				} else {
					log.logres("Finished max number of tries (" + work.options.maxTries + ") for "+work.url, work.options, "scheduler")	
					work.callback(work2result(work))
				}
				run()
			}
		})		
	}
	if (worksQueue.length > 0) {
	    if (typeof(setImmediate) !== "undefined") {
	    	setImmediate(run)
	    } else {
	    	process.nextTick(run)
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

function getPlugin(options, url) {
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

function getId() {
	if (!getId.jobId) {getId.jobId = 1}
	var now = new Date().toISOString().substring(0,10).replace(/-/g,"")+"-"+getId.jobId
	getId.jobId = getId.jobId + 1
	return now
}

function newWork(url, partnum, options, callback){

	// TODO: Check if plugin changed on disk.  If so, re-load it.
	plugin = getPlugin(options, url)

	// Make a copy of options so we can add partnum that will not change.
	var optionsc  = JSON.parse(JSON.stringify(options))
	optionsc.partnum = partnum

	pluginerror = ""
	if (plugin === "") {
		log.logres("Error: plugin "+options.plugin+" not found.", options)
		pluginerror = "Error: plugin "+options.plugin+" not found."
	} else {
		pluginerror = ""
	}

	if (pluginerror !== "") {
		return {error: pluginerror, errorcode: 500, options: optionsc}
	}
	
	var extractSignature = ""
	if (plugin.extractSignature) {
		extractSignature = plugin.extractSignature(options)
		log.logres("MD5(URL): " + util.md5(url), options, "scheduler")
		log.logres("MD5(URL + extractSignature): " + util.md5(url+extractSignature), options, "scheduler")
	} else {
		pluginerror = "Error: plugin "+options.plugin+" does not have an extractSignature."
	}

	if (pluginerror !== "") {
		return {error: pluginerror, errorcode: 500, options: optionsc}
	}
	
	var work = {
				id: getId(),
				plugin : plugin,
				url : url,
				options : optionsc ? optionsc : {},
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
				foundInCache: false,
				error: "",
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
				callback : callback || function () {},
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
				extractMeta: function (data, options) {
					return this.plugin.extractMeta(data, options);
				},
				extractMetaJson: function (data, options) {
					return this.plugin.extractMetaJson(data, options);
				},
				extractRem: function (data, options) {
					return this.plugin.extractRem(data, options);
				}
			}
	return work
}
exports.newWork = newWork
