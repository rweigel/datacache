var fs = require("fs"),
	crypto = require("crypto"),
	moment = require("prettydate");

exports.log = log;
exports.md5 = md5;
exports.formatTime = formatTime;
exports.escapeHTML = escapeHTML;

function log(msg){
	var file = __dirname + "/application.log";
	var entry = formatTime(new Date()) + "\t" + msg + "\n";
	fs.appendFile(file, entry);
	console.log(entry);
}

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

function md5(str){
	return crypto.createHash("md5").update(str).digest("hex");
}

function escapeHTML(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
}

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