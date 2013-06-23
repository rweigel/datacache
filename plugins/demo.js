var	xml2js = require('xml2js');
var parser = new xml2js.Parser();

var util = require("../util.js");

exports.name = "demo";

exports.match = function(url){
	return url.split("/")[2].toLowerCase()==="xdatacache.org";
}

exports.extractData = function(data){
    // Match lines that begin with this pattern
    var re = /^([\d-]+)\s+([\d:\.]+)\s.*/;
    // Note the addition of a newline at the end of data. 
    // If it is not added, streaming of multiple files will result
    // in last line of first appearing on same line as first
    // line of second file.
    return data
               .toString()
               .split("\n")
               .filter(function(line){return line.search(re)!=-1;})
               .join("\n") + "\n";
};

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
