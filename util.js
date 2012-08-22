var fs = require("fs"),
	crypto = require("crypto"),
	moment = require("prettydate");

function log(msg){
	var file = __dirname + "/application.log";
	var entry = formatTime(new Date()) + "\t" + msg + "\n";
	fs.appendFile(file, entry);
	console.log(entry);
}
exports.log = log;

function formatTime(date){
	if(!date){
		return;
	}
	return [date.getFullYear(),
		pad(date.getMonth()+1,2),
		pad(date.getDate(), 2),
		pad(date.getHours(), 2),
		pad(date.getMinutes(), 2),
		pad(date.getSeconds(), 2),
		pad(date.getMilliseconds(), 3)
	].join(" ");

	function pad(str, num){
		// convert to string
		str = str+"";
		while(str.length < num) {
			str = "0"+str;
		}
		return str;
	}
}
exports.formatTime = formatTime;

function md5(str){
	return crypto.createHash("md5").update(str).digest("hex");
}
exports.md5 = md5;

function escapeHTML(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
}
exports.escapeHTML = escapeHTML;

var getId = (function(){
	var Id = 1;
	var timeStamp = "";

	function pad(str, num){
		// convert to string
		str = str+"";
		while(str.length < num) {
			str = "0"+str;
		}
		return str;
	}

	return function(){
		var now = new Date();
		var ret = "" + now.getFullYear() + pad(now.getMonth() + 1, 2) + pad(now.getDate(), 2);
		if(ret!==timeStamp){
			timeStamp = ret;
			jobId = 1;
		}
		return ret+"-"+(jobId++);
	}
})();
exports.getId = getId;

var isCached = function isCached(url, callback){
	fs.exists(__dirname + "/cache/" + url.split("/")[2] + "/" + util.md5(url)+".log", callback);
}
exports.isCached = isCached;

var memLock = {};
var writeCache = function(work, callback){
	var directory =  __dirname + "/cache/" + work.url.split("/")[2];
	var filename = directory + "/" + md5(work.url);
	var header = [];
	for(var key in work.header){
		header.push(key + " : " + work.header[key]);
	}
	if(!memLock[work.url]) {
		// if memLock[result.url] is undefine or 0, no writting is on-going
		memLock[work.id] = 5;

		// create dir if not exist
		fs.exists(directory, function(exist){
			if(!exist){
				fs.mkdirSync(directory);
			}
			writeCacheFiles();
		});	
	} else {
		callback(work);
	}

	function writeCacheFiles(){
		fs.writeFile(filename+".data", work.data, finish);
		fs.writeFile(filename+".header", header.join("\n"), finish);
		fs.writeFile(filename+".out", work.body, finish);
		fs.writeFile(filename+".md5", work.md5, finish);
		fs.appendFile(filename+".log", 
			formatTime(work.date) + "\t"+work.time+"\t"+work.md5+"\n",
			finish
		);
	}

	function finish(err){
		if(err){
			log("Error occured when writing cache: " + filename + "\n" + err);
			console.trace(err);
		}
		memLock[work.id]--;
		if(memLock[work.id]==0){
			work.writeFinishedTime = new Date();
			log("cache written "+work.md5);
			callback(work);
		}
	}
}
exports.writeCache = writeCache;

Array.prototype.remove = function(el){
	this.splice(this.indexOf(el), 1);
}

Array.prototype.find = function(match){
	for(var i=0;i<this.length;i++){
		if(match(this[i])){
			return this[i];
		}
	}
}