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

	//TODO: Create .out file here
	// var outfile = fs.createWriteStream('doodle.png')
	// outfile.on('finish', function(){ work.tmpfile = rnd })
	// return request.get(options, callback).pipe(outfile)
	// In default.js, if work.tmpfile exists, don't create .out file, just rename it
	// Will need to move code for unzipping to extractData in default.js

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

// Head check on resource.
var head = function head(work,callback) {

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

		if (fs.existsSync(filename+".header")) {
			if (work.options.debugutilconsole) {
				log.logc(work.options.loginfo + " util.head(): Reading cached header file " + filename.replace(/.*\/(.*)/,"$1") + ".header", work.options.logcolor)
			}
			var header = fs.readFileSync(filename+".header").toString()
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
		} else {
			if (work.options.debugutilconsole) {
				log.logc(work.options.loginfo + " util.head(): No cached header file.", work.options.logcolor)
			}
		}
		work.headCheckFinishedTime = new Date()
		callback(work)
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
	if (work.options.debugutilconsole) {
		log.logc(work.options.loginfo + " util.isCached(): Checking cache.", work.options.logcolor)
	}
	fs.exists(getCachePath(work) + ".data", function (exist) {
		if (exist) {
			if (work.options.debugutilconsole) {
				log.logc(work.options.loginfo + " util.isCached(): Found cache.", work.options.logcolor)
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

// Directory of md5.* files
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

// Name of md5.* files
function getCachePath(work){
	return getCacheDir(work) + work.urlMd5; 
}
exports.getCachePath = getCachePath;

function getZipCachePath(work){
	return getCacheDir(work) + md5(work.zipFileUrl) +".zip"; 
}
exports.getZipCachePath = getZipCachePath;

// Read data from cache.
function getCachedData(work, callback) {

	if (work.error !== "") {
		callback(work.error)
	}

	// TODO: Check write lock on files before reading.

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
			fs.readFile(filename + ".header", "utf8",	
				function (err, header) {
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
		}		
		function getLstat() {
			fs.lstat(filename + ".data",
				function (err, stats) {
					if (stats) {
						work.dataLength = stats.size
						work.lstat = stats
						finished("Finished lstat read.")
					}
				})
		}
		function getMeta() {
			fs.readFile(filename + ".meta", "utf8",
				function (err, data) {
					work.meta       = data
					work.metaJson   = work.plugin.metaToJson(data)
					finished("Finished reading meta.")
				})
		}
		function getData(callback) {
			// TODO: Don't specify encoding if writeDataBinary exists.
			// create work.dataEncoding?
			fs.readFile(filename + ".data", "utf8",
				function (err, data) {
					work.data       = data
					work.dataJson   = work.plugin.dataToJson(data)
					work.dataMd5    = exports.md5(data)
					work.dataLength = data ? data.length : 0;		
					finished("Finished reading data.")
				})
		}
	} catch(err) {
		log.logc(work.options.loginfo + " util.getCachedData(): Error: " + err, 160)
	}
}
exports.getCachedData = getCachedData;

var memLock = {};
//var writeLock = {};
var writeCache = function(work, callback) {

	var directory = getCacheDir(work)
	var filename  = getCachePath(work)
	var header    = []

	if (work.options.debugutilconsole) {
		log.logc(work.options.loginfo + " util.writeCache(): Called.", work.options.logcolor)
	}
	if (!writeCache.memLock) {
		writeCache.memLock = {}
	}
	if (typeof(writeCache.memLock[filename]) === "undefined") {
		writeCache.memLock[filename] = 0
	}
	//if (!writeLock[filename]) {writeLock[filename] = 0;}
	
	for (var key in work.header) {
		header.push(key + " : " + work.header[key])
	}
	
	// If it is being streamed and result is the same, result is
	// same as if request for data failed (and re-try will be made)
	// No other process should be writing to cache directory, so no need to check lock
	// before writing.

	if ((writeCache.memLock[filename] == 0 || typeof(writeCache.memLock[filename]) === "undefined") && (app.stream.streaming[filename] == 0 || typeof(app.stream.streaming[filename]) === "undefined")) {

		writeCache.memLock[filename] = writeCache.memLock[filename] + 1;
		var tmp = writeCache.memLock[filename];
		if (work.options.debugutilconsole) {
			log.logc(work.options.loginfo + " util.writeCache(): Cache memory locking " + filename.replace(/.*\/(.*)/,"$1"), work.options.logcolor)
		}
		memLock[work.id] = 6; // 6 is number of writes associated with each request.

		// Create dir if it does not exist
		fs.exists(directory, function (exist) {
			if (!exist) {
				mkdirp(directory, function (err) {
					if (err) {
						log.logc(work.options.loginfo + " util.writeCache() mkdirp error: " + JSON.stringify(err), 160)
					}
					else {
						writeCacheFiles()
					}
				})
			} else {
				writeCacheFiles()
			}
		})
	} else {
		if (writeCache.memLock[filename] != 0) {
			if (work.options.debugutilconsole) {
				log.logc(work.options.loginfo + " util.writeCache(): File is being written already by writeCache().  Not writing file.", work.options.logcolor)
			}
		}
		if ( !(typeof(app.stream.streaming[filename]) === "undefined") || app.stream.streaming[filename] != 0) {
			if (work.options.debugutilconsole) {
				log.logc(work.options.loginfo + " util.writeCache(): Stream memory lock found.  Not writing file.", work.options.logcolor)
			}
		}
		callback(work)
	}

	function writeCacheFiles() {

		// If .data does not exist, create it.
		// If .data file exists and differs from new data, move files to directory md5url.
		// If .data file exists and is same as new data, do nothing unless forceWrite=true.

		work.cacheWriteStartTime = new Date();

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
					}

					if (work.options.debugutilconsole) {
						log.logc(work.options.loginfo + " util.writeCacheFiles(): Computing MD5 of " + filename.replace(/.*\/(.*)/,"$1") + ".data", work.options.logcolor)
					}
					try {
						dataMd5old = md5(fs.readFileSync(filename + ".data"));
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
						if (keepversions(work.url) && (work.dataMd5 != dataMd5old)) {
							renameFiles(writeFiles);
						} else {
							if (work.options.debugutilconsole) {
								log.logc(work.options.loginfo + " util.writeCacheFiles(): Will attempt to write files.", work.options.logcolor)
							}
							writeFiles()
						}
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
	
			if (app.stream.streaming[filename] > 0) {
				if (work.options.debugutilconsole) {
					log.logc(work.options.loginfo + " util.writeCacheFiles(): A stream memory lock was found.  Aborting write.", work.options.logcolor)
				}
				work.cacheWriteError = "Cache file could not be written because it was stream locked.";
				finish();finish();finish();finish();finish();finish();
				return
			} else {
				if (work.options.debugutilconsole) {
					log.logc(work.options.loginfo + " util.writeCacheFiles(): No stream memory lock was found.  Writing.", work.options.logcolor)
				}
			}

			if (work.options.debugutilconsole) {
				log.logc(work.options.loginfo + " util.writeCacheFiles(): Writing " + filename.replace(/.*\/(.*)/,"$1") + ".*", work.options.logcolor)
 				log.logc(work.options.loginfo + " util.writeCacheFiles(): .out size = " + work.body.length + " .data size = "+work.data.length, work.options.logcolor)
			}

			fs.writeFile(filename+".data", work.data, finish)
			fs.writeFile(filename+".bin", work.dataBinary, finish)
			fs.writeFile(filename+".meta", work.meta, finish)
			fs.writeFile(filename+".datax", work.datax, finish)
			fs.writeFile(filename+".header", header.join("\n"), finish)
			fs.writeFile(filename+".out", work.body, finish)
			fs.appendFile(filename+".log",(new Date()).toISOString() + "\t" + work.body.length + "\t" + work.data.length + "\n", finish)
		}

		function finish(err) {
			if (err) {
				console.trace(err)
			}
			memLock[work.id]--;
			work.cacheWriteFinishedTime = new Date();
			if (memLock[work.id]==0) {
				if (fs.existsSync(filename+".lck")) {
					// Will not exist if write was aborted because stream lock was found.
					if (work.options.debugutilconsole) {
						log.logc(work.options.loginfo + " util.writeCacheFiles(): Removing " + filename.replace(/.*\/(.*)/,"$1") + ".lck", work.options.logcolor)
					}
					fs.unlinkSync(filename + ".lck")
				}
				writeCache.memLock[filename] = writeCache.memLock[filename] - 1
				if (work.options.debugutilconsole) {
					log.logc(work.options.loginfo + " util.writeCache(): Cache memory unlocking " + filename.replace(/.*\/(.*)/,"$1"), work.options.logcolor)
				}
				work.isFinished = true
				callback(work)
			}
		}

		function tryrename() {
			try {
				fs.renameSync(filename+".data"  , filename+"/"+dataMd5old+".data");			
			} catch (e) {
				if (work.options.debugutilconsole) {
					log.logc(work.options.loginfo  + " util.tryrename(): Could not move " + filename.replace(/.*\/(.*)/,"$1") + ".  forceUpdate=true may have unexpected results.", work.options.logcolor);
					log.logc(work.options.loginfo  + " util.tryrename(): It was probably moved by another request.");
				}
			}		
		}

		function renameFiles(callback) {
			var newdir = filename + "/";
			mkdirp(newdir, function (err) {
					if (work.options.debugutilconsole) {
						log.logc(work.options.loginfo  + " util.rename(): Created directory " + newdir,logcolor)
					}
					//log.logc("filename: " + filename);
					if (err) {
						log.logc(err)
					}
					if (work.options.debugutilconsole) {
						log.logc(work.options.loginfo  + " util.rename(): Tring to move files to: " + newdir,logcolor);
					}
					tryrename(filename+".data");					
					tryrename(filename+".bin");					
					tryrename(filename+".meta");					
					tryrename(filename+".datax");					
					tryrename(filename+".header");
					tryrename(filename+".out");					
					callback();
				});
		}
		
		function keepversions() {
			return false
		}	
	}
}
exports.writeCache = writeCache;