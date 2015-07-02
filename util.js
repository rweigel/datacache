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

// maxSockets Number Maximum number of sockets to allow per host. Default = Infinity.
// Most Apache servers have this set at 100.
http.globalAgent.maxSockets = 100;  
//http.globalAgent.keepAlive = false;

//var TIMEOUT = 2000;
var TIMEOUT = 1000*60*15;
var MAXCONNECTION = 1000;

var app = require("./stream.js");

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

// Name of urlMd5.* files
function getCachePath(work){
	return getCacheDir(work) + work.urlMd5; 
}
exports.getCachePath = getCachePath;

function getZipCachePath(work){
	return getCacheDir(work) + md5(work.zipFileUrl) +".zip"; 
}
exports.getZipCachePath = getZipCachePath;

// Head check on resource.
var head = function head(work, callback) {

	// TODO: Check lock on header file before writing.
	work.headCheckStartTime = new Date()

	if (work.options.debugutilconsole) {
		log.logc(work.options.loginfo + " util.head(): Doing head check of " + work.url, work.options.logcolor)
	}

	if (work.url.match("^ftp")) {
		// TODO: Read .header file.
		if (work.options.debugutil) {
			log.logc(work.options.loginfo + " util.head(): Head check of FTP is not implemented.", work.options.logcolor)
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
			log.logc(work.options.loginfo + " util.head(): Finished head check.", work.options.logcolor)
		}
		var filename = getCachePath(work)

		if (fs.existsSync(filename + ".header")) {

			readLockFile(filename + ".header", work, function (success) {

				if (!success) {
					if (work.options.debugutilconsole) {
						log.logc(work.options.loginfo + " util.head(): Cached header file is write locked.", work.options.logcolor)
					}
					// TODO: Try again?
					readUnlockFile(filename + ".header", work, function () {})
					work.headCheckFinishedTime = new Date()
					callback(work)
					return
				}

				if (work.options.debugutilconsole) {
					log.logc(work.options.loginfo + " util.head(): Reading (sync) cached header file " + filename.replace(/.*\/(.*)/,"$1") + ".header", work.options.logcolor)
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
						log.logc(work.options.loginfo + " util.head(): No last-modified in cached header.", work.options.logcolor)
					}
					work.headCheckFinishedTime = new Date()
					callback(work)
					return
				}
				
				var lmcache = headersplit.join(":").replace(/^\s/,"")
				if (work.options.debugutilconsole) {
					log.logc(work.options.loginfo + " util.head(): last-modified of cache file: " + lmcache, work.options.logcolor)
				}
				var mslmcache = new Date(lmcache).getTime()
				work.headInCacheLastModified = (new Date(lmcache)).toISOString()
				var  lmnow = res.headers["last-modified"]
				if (lmnow) {
					if (work.options.debugutilconsole) {
						log.logc(work.options.loginfo + " util.head(): last-modified of from head : " + lmnow, work.options.logcolor)
					}
					var mslmnow = new Date(lmnow).getTime();
					work.headLastModified = (new Date(mslmnow)).toISOString()
					if (mslmnow > mslmcache) {
						if (work.options.debugutilconsole) {
							log.logc(work.options.loginfo + " util.head(): Cache has expired.", work.options.logcolor)
						}
						work.isExpired = true
					} else {
						if (work.options.debugutilconsole) {
							log.logc(work.options.loginfo + " util.head(): Cache has not expired.", work.options.logcolor)
						}
					}
				} else {
					if (work.options.debugutilconsole) {
						log.logc(work.options.loginfo + " util.head(): No last-modified in response header.", work.options.logcolor)
					}
				}
				work.headCheckFinishedTime = new Date()
				callback(work)
			})
		} else {
			if (work.options.debugutilconsole) {
				log.logc(work.options.loginfo + " util.head(): No cached header file.", work.options.logcolor)
			}
			work.headCheckFinishedTime = new Date()
			callback(work)
		}
	})
	.on('error', function (err) {
		if (work.options.debugutilconsole) {
			log.logc(work.options.loginfo + " util.head(): Error when attempting head check: " + JSON.stringify(err), work.options.logcolor)
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
					log.logc(work.options.loginfo + " util.head(): Timeout ("+work.options.respectHeadersTimeout+" ms) when attempting head check.", work.options.logcolor)
					log.logc(work.options.loginfo + " util.head(): setting headCheckTimeout=true, isExpired=false.", work.options.logcolor)
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

// Determine if request is in cache.
var isCached = function isCached(work, callback) {

	// TODO: If extractSignature was provided, the plugin modifies the returned data.  
	// For example if a time range was specified, it subsets the returned file.
	// Because urlMd5 depends on the signature, the original file will be
	// re-downloaded each time the signature changes.  This could be avoided by
	// symlinking urlMd5base.out to urlMd5.out. If a request
	// comes in and urlMd5base.out exists, isCached should recognize this.

	if (work.options.debugutilconsole) {
		log.logc(work.options.loginfo + " util.isCached(): Checking cache.", work.options.logcolor)
	}

	fs.exists(getCacheDir(work)+work.urlMd5base+".out.tmp", function (exist) {
			if (work.options.debugutilconsole) {
				log.logc(work.options.loginfo + " util.isCached(): Found .out.tmp cache file.", work.options.logcolor)
			}
			work.foundOutInCache = true
			work.dir = getCacheDir(work, true)	
	})

	fs.exists(getCachePath(work) + ".data", function (exist) {
		if (exist) {
			if (work.options.debugutilconsole) {
				log.logc(work.options.loginfo + " util.isCached(): Found .data cache file.", work.options.logcolor)
			}
			work.foundInCache = true
			work.dir = getCacheDir(work, true)
		}
		if (work.options.respectHeaders) {
			if (work.options.debugutilconsole) {
				log.logc(work.options.loginfo + " util.isCached(): Doing head check because requestHeaders = true", work.options.logcolor)
			}
			head(work, callback)
		} else {
			if (work.options.debugutilconsole) {
				log.logc(work.options.loginfo + " util.isCached(): Not doing head check because requestHeaders = false", work.options.logcolor)
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

// Read data from cache.
function getCachedData(work, callback) {

	if (work.options.debugutilconsole) {
		log.logc(work.options.loginfo + " util.getCachedData(): Called.", work.options.logcolor)
	}

	var filename = getCachePath(work)
	var Nr = 0
	var err = "";

	try {
	
		if (work.options.includeHeader) {
			getHeader()
			Nr = Nr + 1
		} else {
			if (work.options.debugutilconsole) {
				log.logc(work.options.loginfo + " util.getCachedData.finished(): includeHeader = false. Not reading.", work.options.logcolor)
			}
		}
		if (work.options.includeLstat) {
			getLstat()
			Nr = Nr + 1
		} else {
			if (work.options.debugutilconsole) {
				log.logc(work.options.loginfo + " util.getCachedData.finished(): includeLsat   = false. Not reading.", work.options.logcolor)
			}
		}

		if (work.options.includeMeta) {
			getMeta()
			Nr = Nr + 1
		} else {
			if (work.options.debugutilconsole) {
				log.logc(work.options.loginfo + " util.getCachedData.finished(): includeMeta   = false. Not reading.", work.options.logcolor)
			}
		}
		if (work.options.includeData) {
			getData()
			Nr = Nr + 1
		} else {
			if (work.options.debugutilconsole) {
				log.logc(work.options.loginfo + " util.getCachedData.finished(): includeData   = false. Not reading.", work.options.logcolor)
			}
		}

		if (Nr == 0) {
			callback(err)			
		}

		function finished(msg) {
			if (work.options.debugutilconsole) {
				log.logc(work.options.loginfo + " util.getCachedData.finished(): " + msg, work.options.logcolor)
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
			util.readLockFile(filename + ".header", work, function (success) {
				if (!success) {
					log.logc(work.options.loginfo + " util.getCachedData.finished(): Could not read .header file.", 160)
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
			util.readLockFile(filename + ".data", work, function (success) {
				if (!success) {
					log.logc(work.options.loginfo + " util.getCachedData.finished(): Could not lstat .data file.", 160)
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
			util.readLockFile(filename + ".meta", work, function (success) {
				if (!success) {
					log.logc(work.options.loginfo + " util.getCachedData.finished(): Could not read .meta file.", 160)
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
		function getData(callback) {
			// TODO: Don't specify encoding if writeDataBinary exists.
			// Create work.dataEncoding?
			util.readLockFile(filename + ".data", work, function (success) {
				if (!success) {
					log.logc(work.options.loginfo + " util.getCachedData.finished(): Could not read .data file.", 160)
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
	} catch(err) {
		log.logc(work.options.loginfo + " util.getCachedData(): Error: " + err, 160)
	}
}
exports.getCachedData = getCachedData;

function memCacheInit() {
	writeCache.memReadLock = {}
	writeCache.memWriteLock = {}
	writeCache.finishQueue = {}
}
exports.memCacheInit = memCacheInit

function writeLockFile(fname, work, callback) {
	if (writeCache.memWriteLock[fname] || writeCache.memReadLock[fname]) {
		if (work.options.debugutilconsole) {
			log.logc(work.options.loginfo + " util.writeLockFile(): Could not write lock " + fname.replace(__dirname, "").replace("/cache/", ""), work.options.logcolor)
		}
		callback(false)
	} else {
		if (work.options.debugutilconsole) {
			log.logc(work.options.loginfo + " util.writeLockFile(): Write locking " + fname.replace(__dirname, "").replace("/cache/", ""), work.options.logcolor)
		}
		writeCache.memWriteLock[fname] = true
		callback(true)
	}
}
exports.writeLockFile = writeLockFile

function writeUnlockFile(fname, work, callback) {
	if (work.options.debugutilconsole) {
		log.logc(work.options.loginfo + " util.writeUnlockFile(): Write unlocking " + fname.replace(__dirname, "").replace("/cache/", ""), work.options.logcolor)
	}
	writeCache.memWriteLock[fname] = false
	if (callback) {
		callback()
	}
}
exports.writeUnlockFile = writeUnlockFile

function readLockFile(fname, work, callback) {
	if (writeCache.memWriteLock[fname]) {	
		if (work.options.debugutilconsole) {
			log.logc(work.options.loginfo + " util.readLockFile(): Could not read lock " + fname.replace(__dirname, "").replace("/cache/", ""), work.options.logcolor)
		}
		callback(false)
	} else {
		if (!writeCache.memReadLock[fname]) {
			writeCache.memReadLock[fname] = 0
		} 
		if (work.options.debugutilconsole) {
			log.logc(work.options.loginfo + " util.readLockFile(): Incrementing # of read locks from " + writeCache.memReadLock[fname] + " to " + (writeCache.memReadLock[fname] + 1), work.options.logcolor)
		}
		writeCache.memReadLock[fname] = writeCache.memReadLock[fname] + 1
		callback(true)
	}
}
exports.readLockFile = readLockFile

function readUnlockFile(fname, work, callback) {
	if (work.options.debugutilconsole) {
		log.logc(work.options.loginfo + " util.readUnlockFile(): Decrementing # of read locks from " + writeCache.memReadLock[fname] + " to " + (writeCache.memReadLock[fname] - 1), work.options.logcolor)
	}
	writeCache.memReadLock[fname] = writeCache.memReadLock[fname] - 1
	if (callback) {
		callback()
	}
}
exports.readUnlockFile = readUnlockFile

var writeCache = function(work, callback) {

	var directory = getCacheDir(work)
	var filename  = getCachePath(work)
	var header    = []

	if (work.options.debugutilconsole) {
		log.logc(work.options.loginfo + " util.writeCache(): Called.", work.options.logcolor)
	}
	
	work.cacheWriteStartTime = new Date();

	writeLockFile(filename, work, function (success) {

		if (!success) {
			if (work.options.debugutilconsole) {
				log.logc(work.options.loginfo + " util.writeCache(): Can't write cache file.  Putting " + work.options.loginfo + " into finish queue.", 160);//work.options.logcolor)
			}
			if (!writeCache.finishQueue[filename]) {
				writeCache.finishQueue[filename] = [];
			}
			work.finishQueueCallback = callback
			writeCache.finishQueue[filename].push(work)
			if (work.options.debugutilconsole) {
				log.logc(work.options.loginfo + " util.writeCache(): Done putting work into finish queue.", 160);//work.options.logcolor)
			}
			return
		}

		// 6 is number of writes associated with each request.
		writeCache.memWriteLock[work.id] = 6; 

		// Create dir if it does not exist
		mkdirp(directory, function (err) {
			if (err) {
				log.logc(work.options.loginfo + " util.writeCache() mkdirp error: " + JSON.stringify(err), 160)
			}
			else {
				writeCacheFiles()
			}
		})
	})

	function writeCacheFiles() {

		fs.exists(filename + ".data",
			function (exists) {
				if (!exists) {
					if (work.options.debugutilconsole) {
						log.logc(work.options.loginfo + " util.writeCacheFiles.writeFiles(): .data does not exist.", work.options.logcolor)
					}
					writeFiles();
				} else {
					if (work.options.debugutilconsole) {
						log.logc(work.options.loginfo + " util.writeCacheFiles.writeFiles(): .data exists: " + fs.existsSync(filename+".data"), work.options.logcolor)
						log.logc(work.options.loginfo + " util.writeCacheFiles(): Computing MD5 (sync) of " + filename.replace(/.*\/(.*)/,"$1") + ".data", work.options.logcolor)
					}
					try {
						dataMd5old = md5(fs.readFileSync(filename + ".data"))
					} catch (e) {
						debugger
						if (work.options.debugutilconsole) {
							log.logc(work.options.loginfo + " util.writeCacheFiles(): Computing MD5 of " + filename.replace(/.*\/(.*)/,"$1" + ".data" + " failed."), work.options.logcolor)
						}
						dataMd5old = "";
					}
					if (work.options.debugutilconsole) {
						if (work.dataMd5 === dataMd5old) {
					  		log.logc(work.options.loginfo + " util.writeCacheFiles(): Existing MD5 = cached MD5", work.options.logcolor)
						} else {
							log.logc(work.options.loginfo + " util.writeCacheFiles(): Existing MD5 != cached MD5", work.options.logcolor)
						}
					}
					if ( (work.dataMd5 != dataMd5old) || work.options.forceWrite || (work.options.respectHeaders && work.isExpired)) {
						if (work.options.debugutilconsole) {
							log.logc(work.options.loginfo + " util.writeCacheFiles(): Will attempt to write files.", work.options.logcolor)
						}
						writeFiles()
					} else {
						if (work.options.debugutilconsole) {
					  		log.logc(work.options.loginfo + " util.writeCacheFiles(): Not writing files.", work.options.logcolor)
						}
						work.isFromCache = true
						work.isFinished = true
						finish();finish();finish();finish();finish();finish();
					}
				}
			})
		
		function writeFiles() {
	
			if (work.options.debugutilconsole) {
				log.logc(work.options.loginfo + " util.writeCacheFiles(): Writing " + filename.replace(/.*\/(.*)/,"$1") + ".*", work.options.logcolor)
 				log.logc(work.options.loginfo + " util.writeCacheFiles(): .out size = " + work.body.length + " .data size = "+work.data.length, work.options.logcolor)
			}

			fs.appendFile(filename + ".log", (new Date()).toISOString() + "\t" + work.body.length + "\t" + work.data.length + "\n", finish)
			
			writeLockFile(filename + ".data", work, function (success) {
				if (!success) {
 					log.logc(work.options.loginfo + " util.writeCacheFiles(): Could not write lock .data file", 160)
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
 					log.logc(work.options.loginfo + " util.writeCacheFiles(): Could not write lock .out file", 160)
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
 					log.logc(work.options.loginfo + " util.writeCacheFiles(): Could not write lock .header file", 160)
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
 					log.logc(work.options.loginfo + " util.writeCacheFiles(): Could not write lock .bin file", 160)
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
 					log.logc(work.options.loginfo + " util.writeCacheFiles(): Could not write lock .meta file", 160)
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
 					log.logc(work.options.loginfo + " util.writeCacheFiles(): Could not write lock .datax file", 160)
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

			if (err) {
				console.trace(err)
			}
			writeCache.memWriteLock[work.id] = writeCache.memWriteLock[work.id] - 1
			if (writeCache.memWriteLock[work.id] == 0) {

				work.cacheWriteFinishedTime = new Date();
 				writeUnlockFile(filename, work, function () {

					if (writeCache.finishQueue[filename]) {
						while (writeCache.finishQueue[filename].length > 0) {
							workq = writeCache.finishQueue[filename].shift()
							if (workq.options.debugutilconsole) {
								log.logc(work.options.loginfo + " util.writeCache(): Evaluating callback for queued work " + workq.options.loginfo, 160);//work.options.logcolor)
								workq.cacheWriteFinishedTime = new Date()
								workq.isFinished = true
								workq.finishQueueCallback(workq)
							}
						}
					} else {
						if (work.options.debugutilconsole) {
							log.logc(work.options.loginfo + " util.writeCache(): No queue found.", work.options.logcolor)
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