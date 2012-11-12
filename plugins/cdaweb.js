var	xml2js = require('xml2js'),
	parser = new xml2js.Parser();

var util = require("../util.js");


exports.name = "cdaweb";

exports.match = function(url){
	return url.split("/")[2].toLowerCase()==="cdaweb.gsfc.nasa.gov";
}

exports.preprocess = function(work, callback){
	util.get(work.url, function(error, response, body) {
		if(error || response.statusCode!==200) {
			callback(true, work);
		} else {
			parser.parseString(body, function(err, res){
				if(err || !res.FileDescription || !res.FileDescription.Name){
					callback(true, work);
				} else{
					work.url = res.FileDescription.Name;
					callback(false, work);
				}
			});
		}
	})
};

exports.extractData = function(data){
	var re = /^([\d-]+)\s+([\d:\.]+)\s+([\d\.]+)\s+([+-\.\d]+)\s+([+-\.\d]+)\s+([+-\.\d]+)$/;
	return data.toString()
			.split("\n")
			.filter(function(line){
				return line.search(re)!=-1;
			})
			.join("\n");;
};

exports.extractDataJson = function(body){
	var data = exports.extractData(body);
	return data.split(/\r?\n/)
				.map(function(d){
					return d.split(/\s+/);
				});
				
};

exports.extractMeta = function(body){
	// console.log(body);
	return body.toString().split(/\r?\n/)
			.splice(56, 3)
			.join("\n");
}

exports.extractMetaJson = function(body){
	return body.toString().split(/\r?\n/)
		.splice(57, 2)
		.map(function(d){
					return d.split(/\s+/);
				});
}


exports.extractRem = function(body){
	var re = /^#/;
	return body.toString()
			.split("\n")
			.filter(function(line){
				return line.search(re)!=-1;
			})
			.join("\n");;
}
