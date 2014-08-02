var fs        = require("fs");
var crypto    = require("crypto");
var moment    = require("moment");
var request   = require("request");
var mkdirp    = require("mkdirp");
var logger    = require("./logger.js");
var FtpClient = require("ftp");
var url       = require('url');
var clc       = require('cli-color');
var http      = require('http');
http.globalAgent.maxSockets = 100;  // Most Apache servers have this set at 100.	

//var TIMEOUT = 20000;
var TIMEOUT = 1000*60*15;
var MAXCONNECTION = 1000;

var app = require("./stream.js");

function logc(str,color) {
	var msg = clc.xterm(color);
	//logc(arguments.caller.toString())
	console.log(msg(str));
};
exports.logc = logc;

Array.prototype.remove = function (el) {this.splice(this.indexOf(el), 1);}

Array.prototype.find = function (match) {
	for (var i=0;i<this.length;i++) {
		if (match(this[i])) {
			return this[i];
		}
	}
	return null;
}

// Download a resource via http or ftp
function download(url, callback){
	if (url.match(/^http/)) {
		return downloadHttp(url, callback);
	} else if(url.match(/^ftp/)){
		return downloadFtp(url, callback);
	} else {
		callback("Error.  Protocol" + url.replace(/^(.*)\:.*/,"$1") + " is not supported.");
	}
}
exports.download = download;

var downloadHttp = function(url, callback) {
	return get(url, function(err, response, body){
		return callback(err, body);
	});
};

var downloadFtp = function(url, callback) { 
	var conn = new FtpClient();
	conn.on("ready", function(){
		conn.get(work.url.split("/").slice(3).join("/"), function(err, stream){
			if(err){
				callback("Ftp download error");
			} else{
				var buff = "";
				stream.on("data", function(data){
					buff+=data.toString();
				})
				.on("error", function(e){work.error=e;callback(true, work);conn.end();})
				.on("end", function(){
					callback(false, buff);
				});
			}
		});
	})
	.on("error", function(e){callback(e, work);conn.end();})
	.connect({host: url.split("/")[2]});
	return conn;
}

function get(url, callback) {
	var options = {	
					url: url,
					timeout: TIMEOUT,
					encoding: null,
					pool: {maxSockets : MAXCONNECTION}
				  };
				  var i =0;
	return request.get(options, callback);
}
exports.get = get;

// Time formatting for logging.
function formatTime(date) {

	if (!date) {return;}
	return [date.getFullYear(), pad(date.getMonth()+1,2), pad(date.getDate(), 2),
			pad(date.getHours(), 2), pad(date.getMinutes(), 2), pad(date.getSeconds(), 2),
			pad(date.getMilliseconds(), 3)].join(" ");

	function pad(str, num) {
		// Convert to string
		str = str + "";
		while (str.length < num) {
			str = "0" + str;
		}
		return str;
	}   
}
exports.formatTime = formatTime;

function md5(str) {
	if (!str) return "";
	return crypto.createHash("md5").update(str).digest("hex");
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
	
		if (work.url.match("^ftp")) {
			// TODO: Read .header file.
			if (work.options.debugutil) logc("Head check of FTP is not implemented.")
			callback(work);
			return;
		}
		
		var options = {method: 'HEAD', host: url.parse(work.url).hostname, port: 80, path: url.parse(work.url).pathname};
		
		if (work.options.debugutil) logc("Doing head check of: " + work.url);
		var req = http.request(options, function(res) {
				
				var fname = getCachePath(work);

				if (fs.existsSync(fname+".header")) {
					var header = fs.readFileSync(fname+".header").toString();
					var headers = header.split("\n");
					for (var j = 0;j<headers.length;j++) {
						var headersplit = headers[j].split(":");
						if (headersplit[0].match(/last-modified/i)) {
							headersplit.shift();
							break;
						}
					}

					if (j==headers.length) {
						if (work.options.debugutil) logc("No last-modified in cached header.");
						callback(work);
						return;
					}
					
					var lmcache = headersplit.join(":")
					if (work.options.debugutil) logc("last-modified of cache:   " + lmcache);
					var mslmcache = new Date(lmcache).getTime();
					work.lastModified = lmcache;
					var  lmnow = res.headers["last-modified"];
					if (lmnow) {
						if (work.options.debugutil) logc("last-modified of response: " + lmnow);
						var mslmnow = new Date(lmnow).getTime();
						if (mslmnow > mslmcache) {
							if (work.options.debugutil) logc("Cache has expired.");
							work.isExpired = true;
						} else {
							if (work.options.debugutil) logc("Cache has not expired.");
						}
					} else {
						if (work.options.debugutil) logc("No last-modified in response header.");
					}
				} else {
					if (work.options.debugutil) logc("No cached header file.");
				}
				callback(work);
			});
		req.on('end',function () {if (work.options.debugutil) logc("Finished HEAD check of " + urlo);});
		req.on('error', function(e) {callback(e);});
		req.end();
}
exports.head = head;

// Determine if request is in cache.
var isCached = function isCached(work, callback) {
	fs.exists(getCachePath(work) + ".data", function (exist) {
		if (exist) {
			work.foundInCache = true;
			work.dir = getCacheDir(work,true);
		}
		if (work.options.respectHeaders) {
			head(work,callback)
		} else {
			callback(work);
		}
	});
}
exports.isCached = isCached;

// Determine if zip file is cached.
var isZipCached = function isZipCached(work){
	return fs.existsSync(getZipCachePath(work) + ".data");
}
exports.isZipCached = isZipCached;

// Directory of md5.* files
function getCacheDir(work,relative){
	prefix = __dirname;
	if (arguments.length > 1 && relative) {
		prefix = "";
	}
	if (work.options.dir==="/cache/"){
		return prefix + work.options.dir + work.url.split("/")[2]+"/";
	} else {
		return prefix + "/cache"+work.options.dir;
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

	try {
	
		var err = "";

		getHeader();
		getLstat();
		getMeta();
		getData();
		
		function finished(msg) {
			if (typeof(finished.z) == 'undefined') {
				finished.z = 0;
			} 
			finished.z = finished.z+1;			
			//logc(msg);
			if (finished.z == 4) {
				work.isFinished = true;
				callback(err);
			};
		}
		
		function getHeader() {
			//logc("Reading Header Started");
			if (!work.options.includeHeader) { finished("Reading Header Finished"); return;}
				fs.readFile(getCachePath(work) + ".header", "utf8",	
					function (err, header) {
					if (typeof(header) !== 'undefined') {
						tmp = header.split("\n");
						for (i = 0; i < tmp.length; i++) {
							kv = tmp[i].split(":");
							work.header[kv[0]] = kv[1];
						}
					} else {
						work.header[0] = "";
					}
						finished("Reading Header Finished");
					});
		}		
		function getLstat() {
			//logc("Reading Lstat Started");
			if (!work.options.includeLstat) { finished("Reading Lstat Finished"); return;}
			fs.lstat(getCachePath(work) + ".data",
				function (err, stats) {
					if (stats) {
						work.dataLength = stats.size;
						work.lstat = stats;
						finished("Reading Lstat Finished");
					}
				});
		}
		function getMeta() {
			//logc("Reading Meta Started");
			if (!work.options.includeMeta) { finished("Reading Meta Finished"); return;}			
			fs.readFile(getCachePath(work) + ".meta", "utf8",
				function (err, data) {
					work.meta       = data;
					work.metaJson   = work.plugin.metaToJson(data);
					finished("Reading Meta Finished");
				});
		}
		function getData(callback) {
			//logc("Reading Data Started");
			if (!work.options.includeData) { finished("Reading Data Finished"); return;}			
			// TODO: Don't specify encoding if writeDataBinary exists.
			// create work.dataEncoding?
			fs.readFile(getCachePath(work) + ".data", "utf8",
				function (err, data) {
					work.data       = data;
					work.dataJson   = work.plugin.dataToJson(data);
					work.dataMd5    = exports.md5(data);
					work.dataLength = data ? data.length : 0;		
					finished("Reading Data Finished");
				});
		}
	} catch(err) {
		logc(err);
	}
}
exports.getCachedData = getCachedData;

var memLock = {};
var writeCache = function(work, callback) {

	var logcolor   = Math.round(255*parseFloat(work.options.id));		

	var fname = getCachePath(work);

	if (!writeCache.memLock) writeCache.memLock = {}; writeCache.memLock[fname] = 0

	var directory = getCacheDir(work);
	var filename  = getCachePath(work);
	var header    = [];

	for (var key in work.header) {
		header.push(key + " : " + work.header[key]);
	}
	
	// If it is being streamed and result is the same, result is
	// same as if request for data failed (and re-try will be made)
	// No other process should be writing to cache directory, so no need to check lock
	// before writing.

	if ((writeCache.memLock[filename] == 0 || typeof(writeCache.memLock[filename]) === "undefined") && (app.stream.streaming[filename] == 0 || typeof(app.stream.streaming[filename]) === "undefined")) {

		if (work.options.debugutil) logc(work.options.id + " util.writeCache(): Locking "+filename.replace(__dirname,"") + " " + writeCache.memLock[filename],logcolor);

		writeCache.memLock[filename] = writeCache.memLock[filename] + 1;

		memLock[work.id] = 6; // 6 is number of writes associated with each request.
		work.writeStartTime = new Date();

		// Create dir if it does not exist
		fs.exists(directory, function (exist) {
			if (!exist) {
				mkdirp(directory, function (err) {
					if (err) {
						logc(err);
					}
					else {
						writeCacheFiles();
					}
				});
			} else {
				writeCacheFiles();
			}
		});
	} else {
		if (writeCache.memLock[filename] != 0) {
			if (work.options.debugutil) logc(work.options.id + " util.writeCache(): File is being written already.",logcolor);
		}
		if ( !(typeof(app.stream.streaming[filename]) === "undefined") || app.stream.streaming[filename] != 0) {
			if (work.options.debugutil) logc(work.options.id + " util.writeCache(): Stream lock found.  Not writing file.",logcolor);
		}
		callback(work);
	}

	function writeCacheFiles() {


		// If .data does not exist, create it.
		// If .data file exists and differs from new data, move files to directory md5url.
		// If .data file exists and is same as new data, do nothing unless forceWrite=true.

		fs.exists(filename + ".data",
			  function (exists) {
				  if (!exists) {
					  writeFiles();
				  } else {
					  // If this fails, another process has moved it to the archive directory.
					  if (work.options.debugutil) logc(work.options.id+" util.writeCacheFiles(): Computing MD5 of " + filename.replace(/.*\/(.*)/,"$1"),logcolor);
					  //dataMd5old = md5(fs.readFileSync(filename+".data"));
					  try {
						  dataMd5old = md5(fs.readFileSync(filename+".data"));
					  } catch (e) {
						  debugger
						  if (work.options.debugutil) logc(work.options.id+" util.writeCacheFiles(): Computing MD5 of " + filename.replace(/.*\/(.*)/,"$1" + " failed."),logcolor);
						  dataMd5old = "";
					  }
					  if ( (work.dataMd5 != dataMd5old) || work.options.forceWrite || (work.options.respectHeaders && work.isExpired)) {
						if (keepversions(work.url) && (work.dataMd5 != dataMd5old)) {
							renameFiles(writeFiles);
						} else {
							writeFiles();
						}
					  } else {
						finish();finish();finish();finish();finish();finish();
					  }
				  }
			  });
		
		
		function writeFiles() {

			
			if (work.options.debugutil) logc(work.options.id + " util.writeCacheFiles(): Maybe writing: "+filename.replace(/.*\/(.*)/,"$1")+".data",logcolor);
			if (work.options.debugutil) logc(work.options.id + " util.writeCacheFiles(): fs.exists: " + fs.existsSync(filename+".data"),logcolor);
			if (app.stream.streaming[filename] > 0) {
				if (work.options.debugutil) {
					logc(work.options.id + " util.writeCacheFiles(): A stream lock was found.  Aborting write.",logcolor);
					logc(work.options.id + " util.writeCacheFiles(): Presumably, an update was recently performed.  forceUpdate=true may have unexpected results.",logcolor);
				}

				finish();finish();finish();finish();finish();finish();
				return;
			} else {
				if (work.options.debugutil) logc(work.options.id + " util.writeCacheFiles(): No stream lock was found.  Writing.",logcolor);
			}

			//if (work.options.debugutil)
			//logc(work.options.id + " util.writeCacheFiles(): Writing "+filename+".lck")
			//fs.writeFileSync(filename+".lck","");
			//fs.writeFileSync(__dirname+"/cache/locks/"+work.urlMd5+".lck",work.dir);

			if (work.options.debugutil) logc(work.options.id + " util.writeCacheFiles(): Writing "+filename.replace(__dirname,"")+".*. .out size = "+work.body.length+" .data size = "+work.data.length,logcolor)
			//logc("work.data.length: "+work.data.length)
			fs.writeFile(filename+".data", work.data, finish);
			fs.writeFile(filename+".bin", work.dataBinary, finish);
			fs.writeFile(filename+".meta", work.meta, finish);
			fs.writeFile(filename+".datax", work.datax, finish);
			fs.writeFile(filename+".header", header.join("\n"), finish);
			fs.writeFile(filename+".out", work.body, finish);

			fs.appendFile(filename+".log", 
				formatTime(work.jobStartTime) + 
				"\t" + work.body.length + "\t" + 
				work.data.length + "\n", finish);
		}

		function finish(err) {
			if (err) {logger.log("error", work); console.trace(err);}
			//logc(memLock[work.id])
			memLock[work.id]--;
			work.writeFinishedTime = new Date();
			if (memLock[work.id]==0) {

				var filename  = getCachePath(work);
				if (work.options.debugutil) logc(work.options.id + " util.writeCacheFiles(): Finished writing "+filename.replace(__dirname,"")+".*",logcolor);
				// Will not exist if write was aborted because stream lock was found.
				if (fs.existsSync(filename+".lck")) {
					if (work.options.debugutil) logc(work.options.id + " util.writeCacheFiles(): Removing "+filename.replace(__dirname,"")+".lck",logcolor);
					fs.unlinkSync(filename+".lck");
				}
				writeCache.memLock[filename] = writeCache.memLock[filename]-1;
				//logc(work.options.id + " util.writeCacheFiles(): " + writeCache.memLock[filename]);
				callback(work);
			}
		}

		function tryrename(fname) {
			try {
				fs.renameSync(filename+".data"  , filename+"/"+dataMd5old+".data");			
			} catch (e) {
				if (work.options.debugutil) {
					logc(work.options.id  + " Could not move " + filename.replace(/.*\/(.*)/,"$1") + ".  forceUpdate=true may have unexpected results.",logcolor);
					logc(work.options.id  + " It was probably moved by another request.");
				}
			}		
		}
		function renameFiles(callback) {
			var newdir = filename + "/";
			mkdirp(newdir, function (err) {
					if (work.options.debugutil) logc(work.options.id  + " Created directory " + newdir,logcolor);
					//logc("filename: " + filename);
					if (err) {logc(err);}
					if (work.options.debugutil)
						logc(work.options.id  + " Tring to move files to: " + newdir,logcolor);
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
			//return true;
			return false;
		}	
	}
}
exports.writeCache = writeCache;