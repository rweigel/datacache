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
	.on("data", function(data){
		if(!work.getFirstChunkTime) {
		    work.getFirstChunkTime = new Date();
		}
	})
	.on("end", function(data){
		if(!work.getConnectTime) {
		    work.getConnectTime = new Date();
		}
	});

};

exports.extractData = function(data){
    	var re = /^([\d-]+)\s+([\d:\.]+)\s.*/;
	return data.toString()
			.split("\n")
			.filter(function(line){
				return line.search(re)!=-1;
			})
			.join("\n");
};

exports.extractDataJson = function(body){
	var data = exports.extractData(body);
	return exports.dataToJson(data);				
};

exports.dataToJson = function(data){
	return data.split(/\r?\n/)
			.map(function(d){
				return d.split(/\s+/);
			});
}

exports.extractMeta = function(body){
	// console.log(body);
	return body.toString().split(/\r?\n/)
			.splice(56, 3)
			.join("\n");
}

exports.extractMetaJson = function(body){
	var meta = body.toString()
				.split(/\r?\n/)
				.splice(57, 2)
				.join("\n");
	//console.log(meta);
	return exports.metaToJson(meta);

}

exports.metaToJson = function(meta){
    var metaJson = meta.split(/\r?\n/)
			.map(function(d){
					return d.split(/\s+/);
				});
    metaJson[0].unshift('Date');
    metaJson[0][1] = "Time";
    metaJson[1].unshift('');
	return metaJson;
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
