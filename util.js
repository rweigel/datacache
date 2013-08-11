var fs      = require("fs");
var crypto  = require("crypto");
var moment  = require("moment");
var request = require("request");
var mkdirp  = require("mkdirp");
var logger  = require("./logger.js");
var FtpClient  = require("ftp");

var TIMEOUT = 20000;
var MAXCONNECTION = 1000;

var app = require("./app.js");

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

var downloadHttp = function(url, callback){
	return get(url, function(err, response, body){
		return callback(err, body);
	});
};

var downloadFtp = function(url, callback){
	var conn = new FtpClient({host: url.split("/")[2]});
	conn.on("connect", function(){
		conn.auth(function(err){
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
	})
	.on("error", function(e){callback(e, work);conn.end();})
	.connect();
	return conn;
}

function get(url, callback){
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

function formatTime(date){

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
exports.getId = getId;

var isCached = function isCached(work, callback) {
    fs.exists(getCachePath(work) + ".data", function (exist) {
	    if (exist) {
			work.foundInCache = true;
			work.dir = getCacheDir(work,true);
	    }
	    if (work.options.respectHeaders) {
	    }
	    if (work.options.includeVers) {
	    		// TODO: Get list of files named md5data./*.data.
	    }
	    callback(work);
	});
}
exports.isCached = isCached;

var isZipCached = function isZipCached(work){
	return fs.existsSync(getZipCachePath(work) + ".data");
}
exports.isZipCached = isZipCached;

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
			//console.log(msg);
			if (finished.z == 4) {
				work.isFinished = true;
				callback(err);
			};
		}
		
		function getHeader() {
			//console.log("Reading Header Started");
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
			//console.log("Reading Lstat Started");
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
			//console.log("Reading Meta Started");
			if (!work.options.includeMeta) { finished("Reading Meta Finished"); return;}			
			fs.readFile(getCachePath(work) + ".meta", "utf8",
				function (err, data) {
					work.meta       = data;
					work.metaJson   = work.plugin.metaToJson(data);
					finished("Reading Meta Finished");
				});
		}
		function getData(callback) {
			//console.log("Reading Data Started");
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
		console.log(err);
	}
}
exports.getCachedData = getCachedData;

function getCachePath(work){
	return getCacheDir(work) + work.urlMd5; 
}
exports.getCachePath = getCachePath;

function getZipCachePath(work){
	return getCacheDir(work) + md5(work.zipFileUrl) +".zip"; 
}
exports.getZipCachePath = getZipCachePath;

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

var memLock = {};
var writeCache = function(work, callback){

	var directory = getCacheDir(work);
	var filename  = getCachePath(work);
	var header    = [];

	for (var key in work.header) {
		header.push(key + " : " + work.header[key]);
	}
  	
  	// If .streaming file exists, it is being streamed and result is the same
  	// as if request for data failed.
  	// No other process should be writing to cache directory, so no need to check lock
  	// before writing.
//	if (!memLock[work.id]) {
	if (!memLock[work.id] && (app.stream.streaming[filename] == 0 || typeof(app.stream.streaming[filename]) === "undefined")) {
	    // If memLock[result.url] is undefined or 0, no writing is on-going.
	    memLock[work.id] = 6;
	    work.writeStartTime = new Date();

	    // Create dir if it does not exist
	    fs.exists(directory, function (exist) {
		    if (!exist) {
				mkdirp(directory, function (err) {
					if (err) {console.log(err);}
					else {writeCacheFiles();}
			    });
		    }
		    writeCacheFiles();
		});
	} else {
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
				  	  if (app.stream.streamdebug) console.log(work.options.id+" Computing MD5 of " + filename.replace(/.*\/(.*)/,"$1"));
					  //dataMd5old = md5(fs.readFileSync(filename+".data"));
					  if (1) {
					  try {
					      dataMd5old = md5(fs.readFileSync(filename+".data"));
					  } catch (e) {
					  		debugger
					  	  if (app.stream.streamdebug) console.log(work.options.id+" Computing MD5 of " + filename.replace(/.*\/(.*)/,"$1" + " failed."));
						  dataMd5old = "";
					  }
					  }
				      //console.log(work.dataMd5 + " " + dataMd5old);
				      if ( (work.dataMd5 != dataMd5old) || work.options.forceWrite) {
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
			//fs.writeFileSync(filename+".lck","");
			//fs.writeFileSync(__dirname+"/cache/locks/"+work.urlMd5+".lck",work.dir);
			if (app.stream.streamdebug) console.log(work.options.id + " Attempting write of: "+filename.replace(/.*\/(.*)/,"$1")+".data");
			if (app.stream.streamdebug) console.log(work.options.id + " fs.exists: " + fs.existsSync(filename));
			if (app.stream.streaming[filename] > 0) {
				if (app.stream.streamdebug) {
					console.log(work.options.id + " " + filename.replace(/.*\/(.*)/,"$1") + " A stream lock was found.  Aborting write.");
					console.log(work.options.id + " " + "Presumably, an update was recently performed.  forceUpdate=true may have unexpected results.");
				}
				finish();finish();finish();finish();finish();finish();
				return;
			}
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

		function tryrename(fname) {
			try {
				fs.renameSync(filename+".data"  , filename+"/"+dataMd5old+".data");			
			} catch (e) {
				if (app.stream.streamdebug) {
					console.log(work.options.id  + " Could not move " + filename.replace(/.*\/(.*)/,"$1") + ".  forceUpdate=true may have unexpected results.");
					console.log(work.options.id  + " It was probably moved by another request.");
				}
			}		
		}
		function renameFiles(callback) {
			var newdir = filename + "/";
			mkdirp(newdir, function (err) {
					if (app.stream.streamdebug) console.log(work.options.id  + " Created directory " + newdir);
					//console.log("filename: " + filename);
					if (err) {console.log(err);}
					if (app.stream.streamdebug)
						console.log(work.options.id  + " Tring to move files to: " + newdir);
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

	function finish(err) {
	    if (err) {logger.log("error", work); console.trace(err);}
	    memLock[work.id]--;
	    work.writeFinishedTime = new Date();
	    //fs.unlinkSync(filename+".lck");
	    //fs.unlinkSync(__dirname+"/cache/locks/"+work.urlMd5+".lck");
	    if (memLock[work.id]==0) {callback(work);}
	}
}
exports.writeCache = writeCache;

Array.prototype.remove = function (el) {this.splice(this.indexOf(el), 1);}

Array.prototype.find = function (match){
    for (var i=0;i<this.length;i++) {
		if (match(this[i])) {
		    return this[i];
		}
	}
    return null;
}