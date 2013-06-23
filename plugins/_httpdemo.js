var	xml2js = require('xml2js'),
	parser = new xml2js.Parser();

var util = require("../util.js");
var time = require("../asset/time.js");

exports.name = "_httpdemo";

exports.match = function(url){
	return url.split("/")[2].toLowerCase()==="xdatacache.org";
}

exports.extractData = function (data) {
    // Match lines that begin with this pattern
    var re1 = /^([\d-]+)\s+([\d:\.]+)\s.*/;
    	var re2 = new RegExp(/([0-9])\-([0-9])/g);
    	var re3 = new RegExp(/\:/g);
    	var re4 = new RegExp(/ 0/g);
    	var re5 = new RegExp(/\n0/g);
    
    // Note the addition of a newline at the end of data. 
    // If it is not added, streaming of multiple files will result
    // in last line of first appearing on same line as first
    // line of second file.
    newdata = data
               .toString()
               .replace(/[ \t]+/g,' ')
               .replace(re2,"$1 $2")
               .replace(re3," ")
			   .replace(re4,"  ")
			   .replace(re5,"\n")
               .split("\n")
               .filter(function (line) {return line.search(re1)!=-1;});

	for (i = 0;i < newdata.length;i++) {
		newdata[i] = time.soy(newdata[i]);
	}
	return newdata.join('\n') + "\n";
};

exports.extractDataBinary = function (data) {

    var re1  = /^([\d-]+)\s+([\d:\.]+)\s.*/;
	var re2 = new RegExp(/[0-9]\-[0-9]|\:/g);
 
 	var arr = new Array();
	var arr = data
	    .toString()
	    .replace(re2," ")
	    .split("\n")
	    .filter(function(line){return line.search(re1)!=-1;})
	    .join("\n")
	    .split(/\s+/g);
	
	var buff = new Buffer(8*arr.length);
	for (i = 0;i < arr.length; i++) {
	    buff.writeDoubleLE(parseFloat(arr[i]),8*(i-1));
	}
	return buff;
}
exports.extractDataJson = function(body){
	var data = exports.extractData(body);
	return exports.dataToJson(data);				
};

exports.dataToJson = function(data){
    //Split each line on space.
    return data
               .split(/\r?\n/)
               .map(function(d){return d.split(/\s+/);});
}

exports.extractMeta = function(body){
    // Grab lines 6 and 7
    return body
               .toString()
               .split(/\r?\n/)
               .splice(4, 1)
 	       .join("\n");
}

exports.extractMetaJson = function(body){
    var meta = body
                   .toString()
                   .split(/\r?\n/)
                   .splice(4, 1)
                   .join("\n");
    //console.log("__httpdemo.js: extractMetaJson: " + meta);
    return exports.metaToJson(meta);
}

exports.metaToJson = function(meta){
    var metaJson = meta
                       .split(/\r?\n/)
		       .map(function(d){return d.split(/\s+/);});

    metaJson[0].unshift('Date');
    metaJson[0][1] = "Time";
    return metaJson;
}

exports.extractRem = function(body){
	var re = /^#/;
	return body
	           .toString()
		   .split("\n")
		   .filter(function(line){return line.search(re)!=-1;})
		   .join("\n");;
}
