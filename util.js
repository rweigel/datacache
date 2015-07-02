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
var TIMEOUT = 1000*60*15;
var MAXCONNECTION = 1000;


Array.prototype.remove = function (el) {this.splice(this.indexOf(el), 1);}

Array.prototype.find = function (match) {
	for (var i=0;i<this.length;i++) {
		if (match(this[i])) {
			return this[i];
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
exports.get = get;

// Head check on resource.
var head = function head(work, callback) {

	var loginfo  = work.options.loginfo + " util.head(): "
	var logcolor = work.options.logcolor

	// TODO: Check lock on header file before writing.
	work.headCheckStartTime = new Date()

	if (work.options.debugutilconsole) {
		log.logc(loginfo + "Doing head check of " + work.url, logcolor)
	}

	if (work.url.match("^ftp")) {
		// TODO: Read .header file.
		if (work.options.debugutilconsole) {
			log.logc(loginfo + "Head check of FTP is not implemented.", logcolor)
		}
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

		if (work.options.debugutilconsole) {
			log.logc(loginfo + "Finished head check.", work.options.logcolor)
		}
		var filename = getCachePath(work)

		if (fs.existsSync(filename + ".header")) {

			readLockFile(filename + ".header", work, function (success) {

				if (!success) {
					if (work.options.debugutilconsole) {
						log.logc(loginfo + "Cached header file is write locked.", logcolor)
					}
					// TODO: Try again?
					readUnlockFile(filename + ".header", work, function () {})
					work.headCheckFinishedTime = new Date()
					callback(work)
					return
				}

				if (work.options.debugutilconsole) {
					log.logc(loginfo + "Reading (sync) cached header file " 
									+ filename.replace(/.*\/(.*)/,"$1") + ".header", logcolor)
				}

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
					if (work.options.debugutilconsole) {
						log.logc(loginfo + "No last-modified in cached header.", logcolor)
					}
					work.headCheckFinishedTime = new Date()
					callback(work)
					return
				}
				
				var lmcache = headersplit.join(":").replace(/^\s/,"")
				if (work.options.debugutilconsole) {
					log.logc(loginfo + "last-modified of cache file: " + lmcache, logcolor)
				}
				var mslmcache = new Date(lmcache).getTime()
				work.headInCacheLastModified = (new Date(lmcache)).toISOString()
				var  lmnow = res.headers["last-modified"]
				if (lmnow) {
					if (work.options.debugutilconsole) {
						log.logc(loginfo + "last-modified of from head : " + lmnow, logcolor)
					}
					var mslmnow = new Date(lmnow).getTime();
					work.headLastModified = (new Date(mslmnow)).toISOString()
					if (mslmnow > mslmcache) {
						if (work.options.debugutilconsole) {
							log.logc(loginfo + "Cache has expired.", logcolor)
						}
						work.isExpired = true
					} else {
						if (work.options.debugutilconsole) {
							log.logc(loginfo + "Cache has not expired.", logcolor)
						}
					}
				} else {
					if (work.options.debugutilconsole) {
						log.logc(loginfo + "No last-modified in response header.", logcolor)
					}
				}
				work.headCheckFinishedTime = new Date()
				callback(work)
			})
		} else {
			if (work.options.debugutilconsole) {
				log.logc(loginfo + "No cached header file.", logcolor)
			}
			work.headCheckFinishedTime = new Date()
			callback(work)
		}
	})
	.on('error', function (err) {
		if (work.options.debugutilconsole) {
			log.logc(loginfo + "Error when attempting head check: " 
												+ JSON.stringify(err), logcolor)
		}
		work.isExpired = false
		work.headCheckError = true
		work.headCheckFinishedTime = new Date()
		callback(work)
	})
	.on('socket', function (socket) {
	    socket.setTimeout(work.options.respectHeadersTimeout);  
	    socket.on('timeout', function() {
				if (work.options.debugutilconsole) {
					log.logc(loginfo + "Timeout (" 
										+ work.options.respectHeadersTimeout
										+ " ms) when attempting head check.", logcolor)
					log.logc(loginfo + "Setting headCheckTimeout=true & isExpired=false.", logcolor)
				}
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
	prefix = __dirname;
	if (arguments.length > 1 && relative) {
		prefix = "";
	}
	if (work.options.dir === "/cache/") {
		return prefix + work.options.dir + work.url.split("/")[2] + "/";
	} else {
		return prefix + "/cache" + work.options.dir;
	}
}
exports.getCacheDir = getCacheDir;

// Full path of urlMd5.* files
function getCachePath(work){
	return getCacheDir(work) + work.urlMd5; 
}
exports.getCachePath = getCachePath;

function getZipCachePath(work){
	return getCacheDir(work) + md5(work.zipFileUrl) + ".zip"
}
exports.getZipCachePath = getZipCachePath;

// Determine if request is in cache.
var isCached = function isCached(work, callback) {

	var loginfo  = work.options.loginfo + " util.isCached(): "
	var logcolor = work.options.logcolor

	if (work.options.debugutilconsole) {
		log.logc(loginfo + "Checking cache.", work.options.logcolor)
	}

	fs.exists(getCachePath(work) + ".data", function (exist) {
		if (exist) {
			if (work.options.debugutilconsole) {
				log.logc(loginfo + "Found .data cache file.", logcolor)
			}
			work.foundInCache = true
			work.dir = getCacheDir(work, true)
		}
		if (work.options.respectHeaders) {
			if (work.options.forceUpdate) {
				if (work.options.debugutilconsole) {
					log.logc(loginfo + "Not doing head check because"
										+ " requestHeaders = true and forceUpdate = true.", logcolor)
				}
				callback(work)
			} else {
				if (work.options.debugutilconsole) {
					log.logc(loginfo + "Doing head check because"
										+ " requestHeaders = true and forceUpdate = false.", logcolor)
				}
				head(work, callback)
			}
		} else {
			if (work.options.debugutilconsole) {
				log.logc(loginfo + "Not doing head check because"
										+ "requestHeaders = false && forceUpdate = true", logcolor)
			}
			callback(work)
		}
	})
}
exports.isCached = isCached;

// Determine if zip file is cached.
var isZipCached = function isZipCached(work) {
	return fs.existsSync(getZipCachePath(work) + ".data");
}
exports.isZipCached = isZipCached;

function memCacheInit() {
	writeCache.memReadLock = {}
	writeCache.memWriteLock = {}
	writeCache.finishQueue = {}
}
exports.memCacheInit = memCacheInit

function writeLockFile(fname, work, callback) {

	var loginfo  = work.options.loginfo + " util.writeLockFile(): "
	var logcolor = work.options.logcolor
	var fname_s  =  fname.replace(__dirname, "").replace("/cache/", "")

	if (writeCache.memWriteLock[fname] || writeCache.memReadLock[fname]) {
		if (work.options.debugutilconsole) {
			log.logc(loginfo + "Could not write lock " + fname_s, logcolor)
		}
		callback(false)
	} else {
		if (work.options.debugutilconsole) {
			log.logc(loginfo + "Write locking " + fname_s, logcolor)
		}
		writeCache.memWriteLock[fname] = true
		callback(true)
	}
}
exports.writeLockFile = writeLockFile

function writeUnlockFile(fname, work, callback) {

	var loginfo  = work.options.loginfo + " util.writeUnlockFile(): "
	var logcolor = work.options.logcolor
	var fname_s  =  fname.replace(__dirname, "").replace("/cache/", "")

	if (work.options.debugutilconsole) {
		log.logc(work.options.loginfo + "Write unlocking " + fname_s, logcolor)
	}
	writeCache.memWriteLock[fname] = false
	if (callback) {
		callback()
	}
}
exports.writeUnlockFile = writeUnlockFile

function readLockFile(fname, work, callback) {

	var loginfo  = work.options.loginfo + " util.readLockFile(): "
	var logcolor = work.options.logcolor
	var fname_s  =  fname.replace(__dirname, "").replace("/cache/", "")

	if (writeCache.memWriteLock[fname]) {	
		if (work.options.debugutilconsole) {
			log.logc(loginfo + "Could not read lock " + fname_s, logcolor)
		}
		callback(false)
	} else {
		if (!writeCache.memReadLock[fname]) {
			writeCache.memReadLock[fname] = 0
		} 
		if (work.options.debugutilconsole) {
			log.logc(loginfo + "Incrementing # of read locks from "	
								+ writeCache.memReadLock[fname] 
								+ " to " 
								+ (writeCache.memReadLock[fname] + 1), logcolor)
		}
		writeCache.memReadLock[fname] = writeCache.memReadLock[fname] + 1
		callback(true)
	}
}
exports.readLockFile = readLockFile

function readUnlockFile(fname, work, callback) {

	var loginfo  = work.options.loginfo + " util.readUnlockFile(): "
	var logcolor = work.options.logcolor
	var fname_s  =  fname.replace(__dirname, "").replace("/cache/", "")

	if (work.options.debugutilconsole) {
		log.logc(loginfo + "Decrementing # of read locks from "
								+ writeCache.memReadLock[fname] 
								+ " to " 
								+ (writeCache.memReadLock[fname] - 1), logcolor)
	}
	writeCache.memReadLock[fname] = writeCache.memReadLock[fname] - 1
	if (callback) {
		callback()
	}
}
exports.readUnlockFile = readUnlockFile

// Read data from cache for embedding in JSON response.
function getCachedData(work, callback) {

	var loginfo  = work.options.loginfo + " util.getCachedData(): "
	var logcolor = work.options.logcolor

	if (work.options.debugutilconsole) {
		log.logc(loginfo + "Called.", logcolor)
	}

	var filename = getCachePath(work)
	var Nr = 0 // Number of callbacks for finish() to expect.
	var err = ""

	try {
	
		if (work.options.includeHeader) {
			getHeader()
			Nr = Nr + 1
		} else {
			if (work.options.debugutilconsole) {
				log.logc(loginfo + "includeHeader = false. Not reading.", logcolor)
			}
		}

		if (work.options.includeLstat) {
			getLstat()
			Nr = Nr + 1
		} else {
			if (work.options.debugutilconsole) {
				log.logc(loginfo + "includeLsat   = false. Not reading.", logcolor)
			}
		}

		if (work.options.includeMeta) {
			getMeta()
			Nr = Nr + 1
		} else {
			if (work.options.debugutilconsole) {
				log.logc(loginfo + "includeMeta   = false. Not reading.", logcolor)
			}
		}

		if (work.options.includeData) {
			getData()
			Nr = Nr + 1
		} else {
			if (work.options.debugutilconsole) {
				log.logc(loginfo + "includeData   = false. Not reading.", logcolor)
			}
		}

		if (Nr == 0) {
			callback(err)			
		}

	} catch(err) {
		log.logc(loginfo + "Error: " + err, 160)
	}

	function finished(msg) {
		if (work.options.debugutilconsole) {
			log.logc(loginfo + msg, logcolor)
		}
		if (typeof(finished.z) == 'undefined') {
			finished.z = 0
		} 
		finished.z = finished.z + 1
		if (finished.z == Nr) {
			callback(err)
		}
	}
	
	function getHeader() {

		var loginfo  = work.options.loginfo + " util.getCachedData.getHeader(): "

		util.readLockFile(filename + ".header", work, function (success) {
			if (!success) {
				log.logc(loginfo + "Could not read .header file.", 160)
				finished("Finished reading header.")
				util.readUnockFile(filename + ".header", work)
				return
			}
			fs.readFile(filename + ".header", "utf8",	
				function (err, header) {
					util.readUnlockFile(filename + ".header", work)
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

		var loginfo  = work.options.loginfo + " util.getCachedData.getLstat(): "

		util.readLockFile(filename + ".data", work, function (success) {
			if (!success) {
				log.logc(loginfo + "Could not lstat .data file.", 160)
				finished("Finished lsat read.")
				util.readunLockFile(filename + ".data", work)
				return
			}
			fs.lstat(filename + ".data",
				function (err, stats) {
					util.readUnlockFile(filename + ".data", work)
					if (stats) {
						work.dataLength = stats.size
						work.lstat = stats
						finished("Finished lstat read.")
					}

			})
		})
	}

	function getMeta() {

		var loginfo  = work.options.loginfo + " util.getCachedData.getMeta(): "

		util.readLockFile(filename + ".meta", work, function (success) {
			if (!success) {
				log.logc(loginfo + "Could not read .meta file.", 160)
				finished("Finished reading meta.")
				util.readUnLockFile(filename + ".meta", work)
				return
			}
			fs.readFile(filename + ".meta", "utf8",
				function (err, data) {
					util.readUnLockFile(filename + ".meta", work)
					work.meta       = data
					work.metaJson   = work.plugin.metaToJson(data)
					finished("Finished reading meta.")
			})
		})
	}

	function getData() {

		var loginfo  = work.options.loginfo + " util.getCachedData.getData(): "

		// TODO: Don't specify encoding if writeDataBinary exists.
		// Create work.dataEncoding?
		util.readLockFile(filename + ".data", work, function (success) {
			if (!success) {
				log.logc(loginfo + "Could not read .data file.", 160)
				finished("Finished reading data.")
				util.readUnlockFile(filename + ".data", work)
				return
			}
			fs.readFile(filename + ".data", "utf8",
				function (err, data) {
					util.readUnlockFile(filename + ".data", work)
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
	var header    = []

	var loginfo  = work.options.loginfo + " util.writeCache(): "
	var logcolor = work.options.logcolor

	if (work.options.debugutilconsole) {
		log.logc(loginfo + "Called.", logcolor)
	}
	
	work.cacheWriteStartTime = new Date()

	writeLockFile(filename, work, function (success) {

		if (!success) {
			if (work.options.debugutilconsole) {
				log.logc(loginfo + "Can't write cache file.  Putting " 
												+ work.options.loginfo 
												+ " into finish queue.", 160)
			}
			if (!writeCache.finishQueue[filename]) {
				writeCache.finishQueue[filename] = [];
			}
			work.finishQueueCallback = callback
			writeCache.finishQueue[filename].push(work)
			if (work.options.debugutilconsole) {
				log.logc(loginfo + "Done putting work into finish queue.", 160)
			}
			return
		}

		// 6 is number of writes associated with each request.
		writeCache.memWriteLock[work.id] = 6; 

		// Create dir if it does not exist
		mkdirp(directory, function (err) {
			if (err) {
				log.logc(loginfo + "mkdirp error: " + JSON.stringify(err), 160)
			}
			else {
				writeCacheFiles()
			}
		})
	})

	function writeCacheFiles() {

		var loginfo  = work.options.loginfo + " util.writeCache.writeCacheFiles(): "
		var fname_s  = filename.replace(/.*\/(.*)/,"$1") + ".data"

		fs.exists(filename + ".data",
			function (exists) {
				if (!exists) {
					if (work.options.debugutilconsole) {
						log.logc(loginfo + ".data does not exist.", logcolor)
					}
					writeFiles()
				} else {
					if (work.options.debugutilconsole) {
						log.logc(loginfo + ".data exists.", logcolor)
						log.logc(loginfo + "Computing MD5 (sync) of " + fname_s, logcolor)
					}
					try {
						dataMd5old = md5(fs.readFileSync(filename + ".data"))
					} catch (e) {
						debugger
						if (work.options.debugutilconsole) {
							log.logc(loginfo + "Compute of MD5 of " + fname_s + " failed.", logcolor)
						}
						dataMd5old = "";
					}
					if (work.options.debugutilconsole) {
						if (work.dataMd5 === dataMd5old) {
					  		log.logc(" Existing MD5 = cached MD5", logcolor)
						} else {
							log.logc(loginfo + "Existing MD5 != cached MD5", logcolor)
						}
					}
					if ( (work.dataMd5 != dataMd5old) || work.options.forceWrite || 
									(work.options.respectHeaders && work.isExpired)) {
						if (work.options.debugutilconsole) {
							log.logc(loginfo + "Will attempt to write files.", logcolor)
						}
						writeFiles()
					} else {
						if (work.options.debugutilconsole) {
					  		log.logc(loginfo + "Not writing files.", logcolor)
						}
						work.isFromCache = true
						work.isFinished = true
						finish();finish();finish();finish();finish();finish();
					}
				}
			})
		
		function writeFiles() {
	
			var loginfo = work.options.loginfo + " util.writeCache.writeCacheFiles.writeFiles(): "
		
			if (work.options.debugutilconsole) {
				log.logc(loginfo + "Writing " + filename.replace(/.*\/(.*)/,"$1") + ".*", logcolor)
 				log.logc(loginfo + ".out size = " + work.body.length 
 													+ " .data size = "+work.data.length, logcolor)
			}

			fs.appendFile(filename + ".log", 
											(new Date()).toISOString() + "\t" 
											+ work.body.length + "\t" 
											+ work.data.length + "\n", finish)
			
			// TODO: If any of these fail, need to try again (unless another process
			// is already writing it).
			writeLockFile(filename + ".data", work, function (success) {
				if (!success) {
 					log.logc(loginfo + "Could not write lock .data file", 160)
					finish()
					return
				}
				fs.writeFile(filename + ".data", work.data, function () {
					writeUnlockFile(filename + ".data", work)
					finish()
				})
			})

			writeLockFile(filename + ".out", work, function (success) {
				if (!success) {
 					log.logc(loginfo + "Could not write lock .out file", 160)
					finish()
					return
				}
				fs.writeFile(filename + ".out", work.data, function () {
					writeUnlockFile(filename + ".out", work)
					finish()
				})
			})

			writeLockFile(filename + ".header", work, function (success) {
				if (!success) {
 					log.logc(loginfo + "Could not write lock .header file", 160)
					finish()
					return
				}
				for (var key in work.header) {
					header.push(key + " : " + work.header[key])
				}
				fs.writeFile(filename + ".header", work.data, function () {
					writeUnlockFile(filename + ".header", work)
					finish()
				})
			})

			writeLockFile(filename + ".bin", work, function (success) {
				if (!success) {
 					log.logc(loginfo + "Could not write lock .bin file", 160)
					finish()
					return
				}
				fs.writeFile(filename + ".bin", work.data, function () {
					writeUnlockFile(filename + ".bin", work)
					finish()
				})
			})

			writeLockFile(filename + ".meta", work, function (success) {
				if (!success) {
 					log.logc(loginfo + "Could not write lock .meta file", 160)
					finish()
					return
				}
				fs.writeFile(filename + ".meta", work.data, function () {
					writeUnlockFile(filename + ".meta", work)
					finish()
				})
			})

			writeLockFile(filename + ".datax", work, function (success) {
				if (!success) {
 					log.logc(loginfo + "Could not write lock .datax file", 160)
					finish()
					return
				}
				fs.writeFile(filename + ".datax", work.data, function () {
					writeUnlockFile(filename + ".datax", work)
					finish()
				})
			})

		}

		function finish(err) {

			var loginfo  = work.options.loginfo + " util.writeCache.writeCacheFiles.finish(): "

			if (err) {
				console.trace(err)
			}
			writeCache.memWriteLock[work.id] = writeCache.memWriteLock[work.id] - 1
			if (writeCache.memWriteLock[work.id] == 0) {

				work.cacheWriteFinishedTime = new Date()
 				writeUnlockFile(filename, work, function () {

					if (writeCache.finishQueue[filename]) {
						while (writeCache.finishQueue[filename].length > 0) {
							workq = writeCache.finishQueue[filename].shift()
							if (workq.options.debugutilconsole) {
								log.logc(loginfo + "Evaluating callback for queued work " + workq.options.loginfo, 160)
							}
							workq.cacheWriteFinishedTime = new Date()
							workq.isFinished = true
							workq.finishQueueCallback(workq)							
						}
					} else {
						if (work.options.debugutilconsole) {
							log.logc(loginfo + "No queue found.", logcolor)
						}
					}

					work.isFinished = true
					callback(work)

				})
			}
		}
	}

}
exports.writeCache = writeCache;