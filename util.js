var fs        = require("fs");
var crypto    = require("crypto");
var moment    = require("moment");
var request   = require("request");
var mkdirp    = require("mkdirp");
var FtpClient = require("ftp");
var url       = require('url');
var clc       = require('cli-color');
var http      = require('http');
var log       = require("./log.js");

// maxSockets Number Maximum number of sockets to allow per host.
// Default = Infinity.  Most Apache servers have this set at 100.
http.globalAgent.maxSockets = 100;  
//http.globalAgent.keepAlive = false;

//var TIMEOUT = 2000;
var TIMEOUT = 1000*60*15
var MAXCONNECTION = 1000

Array.prototype.remove = function (el) {this.splice(this.indexOf(el), 1)}

Array.prototype.find = function (match) {
	for (var i=0;i<this.length;i++) {
		if (match(this[i])) {
			return this[i]
		}
	}
	return null;
}

function get(url, callback) {

	var options = {	
					url: url,
					timeout: TIMEOUT,
					encoding: null
				  }

	return request.get(options, callback)
}
exports.get = get

// Head check on resource.
var head = function head(work, callback) {

	// TODO: Check lock on header file before writing.
	work.headCheckStartTime = new Date()

	var filename = getCachePath(work)
	if (!fs.existsSync(filename + ".header")) {
		log.logres("No cached header file.  Not doing head check.", work.options, "util")
		work.headCheckFinishedTime = new Date()
		callback(work)
		return
	}

	log.logres("Doing head check of " + work.url, work.options, "util")

	if (work.url.match("^ftp")) {
		// TODO: Read .header file.
		log.logres("Head check of FTP is not implemented.", work.options, "util")
		work.headCheckFinishedTime = new Date()
		callback(work)
		return
	}
	
	// IMPORTANT: Connection: Close.  Otherwise socket is kept open.
	var options = {
					method: 'HEAD',
					host: url.parse(work.url).hostname,
					port: url.parse(work.url).port || 80,
					path: url.parse(work.url).pathname,
					headers: { 'Connection':'Close' }
				}

	var req = http.request(options, function (res) {

		log.logres("Finished head check.", work.options, "util")

		readLockFile(filename + ".header", work, function (success) {

			if (!success) {
				log.logres("Cached header file is write locked.", work.options, "util")
				// TODO: Try again?
				readUnlockFile(filename + ".header", work, function () {})
				work.headCheckFinishedTime = new Date()
				callback(work)
				return
			}

			log.logres("Reading (sync) cached header file " 
						+ filename.replace(/.*\/(.*)/,"$1") + ".header", work.options, "util")

			var header = fs.readFileSync(filename+".header").toString()
			readUnlockFile(filename + ".header", work, function () {})

			var headers = header.split("\n")
			for (var j = 0;j < headers.length;j++) {
				var headersplit = headers[j].split(":")
				if (headersplit[0].match(/last-modified/i)) {
					headersplit.shift()
					break
				}
			}	
			if (j == headers.length) {
				log.logres("No last-modified in cached header.", work.options, "util")
				work.headCheckFinishedTime = new Date()
				callback(work)
				return
			}
			
			var lmcache = headersplit.join(":").replace(/^\s/,"")
			log.logres("last-modified of cache file: " + lmcache, work.options, "util")
			var mslmcache = new Date(lmcache).getTime()
			work.headInCacheLastModified = (new Date(lmcache)).toISOString()
			var  lmnow = res.headers["last-modified"]
			if (lmnow) {
				log.logres("last-modified of from head : " + lmnow, work.options, "util")
				var mslmnow = new Date(lmnow).getTime();
				work.headLastModified = (new Date(mslmnow)).toISOString()
				if (mslmnow > mslmcache) {
					log.logres("Cache has expired.", work.options, "util")
					work.isExpired = true
				} else {
					log.logres("Cache has not expired.", work.options, "util")
				}
			} else {
				log.logres("No last-modified in response header.", work.options, "util")
			}
			work.headCheckFinishedTime = new Date()
			callback(work)
		})
	})
	.on('error', function (err) {
		log.logres("Error when attempting head check: " 
					+ JSON.stringify(err), work.options, "util")
		work.isExpired = false
		work.headCheckError = true
		work.headCheckFinishedTime = new Date()
		callback(work)
	})
	.on('socket', function (socket) {
	    socket.setTimeout(work.options.respectHeadersTimeout);  
	    socket.on('timeout', function() {
				log.logres("Timeout (" 
							+ work.options.respectHeadersTimeout
							+ " ms) when attempting head check.", work.options, "util")
				log.logres("Setting headCheckTimeout=true & isExpired=false.", work.options, "util")
				work.headCheckTimeout = true
				work.isExpired = false
				work.headCheckFinishedTime = new Date()
				callback(work)
       	})
    })
	.end()
}
exports.head = head

function md5(str) {
	if (!str) return ""
	return crypto.createHash("md5").update(str).digest("hex")
}
exports.md5 = md5;

function escapeHTML(s) {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
exports.escapeHTML = escapeHTML;

function unescapeHTML(s) {
	return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
exports.unescapeHTML = unescapeHTML;

// Directory of urlMd5.* files
function getCacheDir(work, relative) {
	prefix = __dirname
	if (arguments.length > 1 && relative) {
		prefix = ""
	}
	if (work.options.dir === "/cache/") {
		return prefix + work.options.dir + work.url.split("/")[2] + "/"
	} else {
		return prefix + "/cache" + work.options.dir
	}
}
exports.getCacheDir = getCacheDir

// Full path of urlMd5.* files
function getCachePath(work){
	return getCacheDir(work) + work.urlMd5
}
exports.getCachePath = getCachePath

function getZipCachePath(work){
	return getCacheDir(work) + md5(work.zipFileUrl) + ".zip"
}
exports.getZipCachePath = getZipCachePath

// Determine if request is in cache.
var isCached = function isCached(work, callback) {

	log.logres("Checking cache.", work.options, "util")

	fs.exists(getCachePath(work) + ".data", function (exist) {
		if (!exist) {
			log.logres("Did not find .data cache file.  No head check needed.", work.options, "util")
			work.foundInCache = false
			callback(work)
		} else {
			log.logres("Found .data cache file.", work.options, "util")
			work.foundInCache = true
			//work.dir = getCacheDir(work, true)
			if (work.options.respectHeaders) {
				if (work.options.forceUpdate) {
					log.logres("Not doing head check because"
								+ " respectHeaders = true and forceUpdate = true.", work.options, "util")
					callback(work)
				} else {
					log.logres("Doing head check because"
								+ " respectHeaders = true and forceUpdate = false.", work.options, "util")
					head(work, callback)
				}
			} else {
				log.logres("Not doing head check because"
							+ " respectHeaders = false && forceUpdate = true", work.options, "util")
				callback(work)
			}
		}
	})
}
exports.isCached = isCached

// Determine if zip file is cached.
var isZipCached = function isZipCached(work) {
	return fs.existsSync(getZipCachePath(work) + ".data")
}
exports.isZipCached = isZipCached;

function memCacheInit() {
	writeCache.memReadLock = {}
	writeCache.memWriteLock = {}
	writeCache.finishQueue = {}
}
exports.memCacheInit = memCacheInit

function writeLockFile(fname, work, callback) {

	var fname_s = fname.replace(__dirname, "").replace("/cache/", "")

	if (writeCache.memWriteLock[fname] || writeCache.memReadLock[fname]) {
		log.logres("Could not write lock " + fname_s, work.options, "util")

		// Only place in queue if callback specified
		if (work.finishQueueCallback) {
			log.logres("Queuing " + fname_s, work.options, "util")
			if (!writeCache.finishQueue[fname]) {
				writeCache.finishQueue[fname] = []
			}
			writeCache.finishQueue[fname].push(work)
			log.logres("Done queuing " + fname_s, work.options, "util")
		}

		callback(false)
	} else {
		log.logres("Write locking " + fname_s, work.options, "util")
		if (work.options.workerid > 0) {
			process.send("memWriteLock" + " " + fname + " true")
		}
		writeCache.memWriteLock[fname] = true
		callback(true)
	}
}
exports.writeLockFile = writeLockFile

function writeUnlockFile(fname, work, callback) {

	var fname_s = fname.replace(__dirname, "").replace("/cache/", "")

	log.logres("Write unlocking " + fname_s, work.options, "util")
	if (work.options.workerid > 0) {
		process.send("memWriteLock" + " " + fname + " false")
	}
	writeCache.memWriteLock[fname] = false

	if (writeCache.finishQueue[fname]) {
		while (writeCache.finishQueue[fname].length > 0) {
			workq = writeCache.finishQueue[fname].shift()
			log.logres("Evaluating callback for queued work " 
						+ work.options.logsig,  work.options, "util")
			workq.cacheWriteFinishedTime = new Date()
			workq.finishQueueCallback(workq)							
		}
		if (writeCache.finishQueue[fname].length == 0) {
			delete writeCache.finishQueue[fname]
		}

	} else {
		log.logres("No writeCache queue found for "+fname_s, work.options, "util")
	}

	if (callback) {
		callback()
	}
}
exports.writeUnlockFile = writeUnlockFile

function readLockFile(fname, work, callback) {

	if (!work.options) {
		options = work
	} else {
		options = work.options
	}
	if (!options.workerid) {
		options.workerid = -1
	}

	if (options.workerid > 0) {
		process.send("memReadLock" + " " + fname)
	}

	var fname_s = fname.replace(__dirname, "").replace("/cache/", "")

	if (writeCache.memWriteLock[fname]) {	
		log.logres("Could not read lock " + fname_s, options, "util")

		// Only place in queue if callback specified
		if (work.finishQueueCallback) {
			log.logres("Queuing " + fname_s, work.options, "util")
			if (!writeCache.finishQueue[fname]) {
				writeCache.finishQueue[fname] = []
			}
			writeCache.finishQueue[fname].push(work)
			log.logres("Done queuing " + fname_s, work.options, "util")
		}

		callback(false)
	} else {
		if (!writeCache.memReadLock[fname]) {
			writeCache.memReadLock[fname] = 0
		} 
		log.logres("Incrementing # of read locks from "	
					+ writeCache.memReadLock[fname] 
					+ " to " 
					+ (writeCache.memReadLock[fname] + 1)
					+ " on " + fname_s, options, "util")
		if (options.workerid > 0) {
			process.send("memReadLock" + " " + fname + " true")
		}
		writeCache.memReadLock[fname] = writeCache.memReadLock[fname] + 1
		callback(true)
	}
}
exports.readLockFile = readLockFile

function readUnlockFile(fname, work, callback) {

	if (!work.options) {
		options = work
	} else {
		options = work.options
	}
	if (!options.workerid) {
		options.workerid = -1
	}

	var fname_s = fname.replace(__dirname, "").replace("/cache/", "")

	log.logres("Decrementing # of read locks from "
				+ writeCache.memReadLock[fname] 
				+ " to " 
				+ (writeCache.memReadLock[fname] - 1), options, "util")
	if (options.workerid > 0) {
		process.send("memReadLock" + " " + fname + " false")
	}
	writeCache.memReadLock[fname] = writeCache.memReadLock[fname] - 1

	if (writeCache.memReadLock[fname] == 0) {
		if (writeCache.finishQueue[fname]) {
			while (writeCache.finishQueue[fname].length > 0) {
				workq = writeCache.finishQueue[fname].shift()
				log.logres("Evaluating callback for queued work " 
							+ workq.options.logsig,  workq.options, "util")
				workq.cacheWriteFinishedTime = new Date()
				workq.finishQueueCallback(workq)							
			}
			if (writeCache.finishQueue[fname].length == 0) {
				delete writeCache.finishQueue[fname]
			}
		} else {
			log.logres("No writeCache queue found for " + fname_s, options, "util")
		}
	}

	if (callback) {
		callback()
	}
}
exports.readUnlockFile = readUnlockFile

// Read data from cache
function getCachedData(work, callback) {

	log.logres("Called.", work.options, "util")

	var filename = getCachePath(work)
	var Nr = 0 // Number of callbacks for finish() to expect.
	var err = ""

	//try {
	
		if (work.options.includeHeader) {
			getHeader()
			Nr = Nr + 1
		} else {
			log.logres("includeHeader = false. Not reading.", work.options, "util")
		}

		if (work.options.includeLstat) {
			getLstat()
			Nr = Nr + 1
		} else {
			log.logres("includeLsat   = false. Not reading.", work.options, "util")
		}

		if (work.options.includeMeta) {
			getMeta()
			Nr = Nr + 1
		} else {
			log.logres("includeMeta   = false. Not reading.", work.options, "util")
		}

		if (work.options.includeData) {
			getData()
			Nr = Nr + 1
		} else {
			log.logres("includeData   = false. Not reading.", work.options, "util")
		}

		if (Nr == 0) {
			callback(err)			
		}

	//} catch(err) {
	//	log.logc("Error: " + err, 160)
	//	console.trace(err)
	//}

	function finished(msg) {
		log.logres(msg, work.options, "util")
		if (typeof(finished.z) == 'undefined') {
			finished.z = 0
		} 
		finished.z = finished.z + 1
		if (finished.z == Nr) {
			callback(err)
		}
	}
	
	function getHeader() {

		util.readLockFile(filename, work, function (success) {
			if (!success) {
				log.logres("Could not read .header file.", work.options, "util")
				finished("Finished reading header.")
				util.readUnockFile(filename, work)
				return
			}
			fs.readFile(filename + ".header", "utf8",	
				function (err, header) {
					util.readUnlockFile(filename, work)
					if (typeof(header) !== 'undefined') {
						tmp = header.split("\n")
						for (i = 0; i < tmp.length; i++) {
							kv = tmp[i].split(":")
							work.header[kv[0]] = kv[1]
						}
					} else {
						work.header[0] = ""
					}
					finished("Finished reading header.")
			})
		})
	}		

	function getLstat() {

		util.readLockFile(filename, work, function (success) {
			if (!success) {
				log.logres("Could not lstat .data file.", work.options, "util")
				finished("Finished lsat read.")
				util.readunLockFile(filename + ".data", work)
				return
			}
			fs.lstat(filename + ".data",
				function (err, stats) {
					util.readUnlockFile(filename, work)
					if (stats) {
						work.dataLength = stats.size
						work.lstat = stats
						finished("Finished lstat read.")
					}

			})
		})
	}

	function getMeta() {

		util.readLockFile(filename, work, function (success) {
			if (!success) {
				log.logres("Could not read .meta file.", work.options, "util")
				finished("Finished reading meta.")
				util.readUnLockFile(filename + ".meta", work)
				return
			}
			fs.readFile(filename + ".meta", "utf8",
				function (err, data) {
					util.readUnLockFile(filename, work)
					work.meta       = data
					work.metaJson   = work.plugin.metaToJson(data)
					finished("Finished reading meta.")
			})
		})
	}

	function getData() {

		// TODO: Don't specify encoding if writeDataBinary exists.
		// Create work.dataEncoding?
		util.readLockFile(filename, work, function (success) {
			if (!success) {
				log.logres("Could not read .data file.", work.options, "util")
				finished("Finished reading data.")
				util.readUnlockFile(filename, work)
				return
			}
			fs.readFile(filename + ".data", "utf8",
				function (err, data) {
					util.readUnlockFile(filename, work)
					work.data       = data
					work.dataJson   = work.plugin.dataToJson(data)
					work.dataMd5    = exports.md5(data)
					work.dataLength = data ? data.length : 0;		
					finished("Finished reading data.")
			})
		})
	}
}
exports.getCachedData = getCachedData

var writeCache = function(work, callback) {

	var directory = getCacheDir(work)
	var filename  = getCachePath(work)

	log.logres("Called.", work.options, "util")
	
	work.cacheWriteStartTime = new Date()

	// In case writeLockFile fails.

	// When write is done, this work is treated as done.
	work.finishQueueCallback = callback

	writeLockFile(filename, work, function (success) {

		if (!success) {
			return
		}

		// 6 is number of writes associated with each request.
		writeCache.memWriteLock[work.id] = 6 

		// Create dir if it does not exist
		mkdirp(directory, function (err) {
			if (err) {
				log.logc("mkdirp error: " + JSON.stringify(err), 160)
			}
			else {
				writeCacheFiles()
			}
		})
	})

	function writeCacheFiles() {

		var fname_s  = filename.replace(/.*\/(.*)/,"$1") + ".data"

		fs.exists(filename + ".data", function (exists) {
			if (!exists) {
				log.logres(".data does not exist.", work.options, "util")
				writeFiles()
			} else {
				log.logres(".data exists.", work.options, "util")
				log.logres("Computing MD5 (sync) of " + fname_s, work.options, "util")
				try {
					dataMd5old = md5(fs.readFileSync(filename + ".data"))
				} catch (e) {
					debugger
					log.logres("Compute of MD5 of " + fname_s + " failed.", work.options, "util")
					dataMd5old = "";
				}
				if (work.dataMd5 === dataMd5old) {
					log.logres(" Existing MD5 = cached MD5", work.options, "util")
				} else {
					log.logres("Existing MD5 != cached MD5", work.options, "util")
				}
				if (work.dataMd5 != dataMd5old) {
					log.logres("Will attempt to write files because MD5s differ.", work.options, "util")
				}
				if (work.options.forceWrite) {
					log.logres("Will attempt to write files because forceWrite = true.", work.options, "util")
				}
				if (work.options.respectHeaders && work.isExpired) {
					log.logres("Will attempt to write files because isExpired = true and respectHeaders = true.", work.options, "util")
				}
				if ( (work.dataMd5 != dataMd5old) || work.options.forceWrite || 
					 (work.options.respectHeaders && work.isExpired)) {
					writeFiles()
				} else {
			  		log.logres("Not writing files.", work.options, "util")
					work.isFromCache = true
					finish();finish();finish();finish();finish();finish();
				}
			}
		})
		
		function writeFiles() {
	
			log.logres("Writing " 
						+ filename.replace(/.*\/(.*)/,"$1") + ".*", work.options, "util")
			log.logres(".out size = " + work.body.length 
							+ " .data size = " + work.data.length, work.options, "util")

			fs.appendFile(filename + ".log", 
								(new Date()).toISOString() + "\t" 
								+ work.body.length + "\t" 
								+ work.data.length + "\n")
			
			// TODO: If any of these fail, need to try again (unless another process
			// is already writing it).
			fs.writeFile(filename + ".data", work.data, finish)

			fs.writeFile(filename + ".out", work.body, finish)

			var header = []
			for (var key in work.header) {
				header.push(key + " : " + work.header[key])
			}
			fs.writeFile(filename + ".header", header.join("\n"), finish)

			fs.writeFile(filename + ".bin", work.data, finish)

			fs.writeFile(filename + ".meta", work.data, finish)

			fs.writeFile(filename + ".datax", work.data, finish)

		}

		function finish(err) {

			if (err) { console.trace(err) }

			//console.log(writeCache.memWriteLock[work.id] + " " + work.id)
			writeCache.memWriteLock[work.id] = writeCache.memWriteLock[work.id] - 1
			if (writeCache.memWriteLock[work.id] == 0) {
				work.cacheWriteFinishedTime = new Date()
 				writeUnlockFile(filename, work, function () {
					callback(work)
				})
			}
		}
	}
}
exports.writeCache = writeCache