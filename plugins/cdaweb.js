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
	// Note the addition of a newline at the end of data. 
	// If it is not added, streaming of multiple files will result
	// in last line of first appearing on same line as first
	// line of second file.
	return data.toString()
			.split("\n")
			.filter(function(line){
				return line.search(re)!=-1;
			})
	.join("\n") + "\n";
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
	// To be robust against changes in header length,
	// find first data line and then back up three lines.
	all = body.toString().split(/\r?\n/g);
	for (i = 0; i < all.length; i++) {
		if (all[i].match(/^EPOCH/)) {
			console.log(i);
			break;
		}
	}
	return all.splice(i, 3).join("\n");
}

exports.extractMetaJson = function(body){
	var meta = exports.extractMeta(body);
	return exports.metaToJson(meta);
}

exports.metaToJson = function(meta){
    //console.log("\n"+meta);
    var metaJson = meta.split(/\r?\n/)
			.map(function(d){
					return d.split(/\s+/);
				});
    metaJson[0].unshift('Date');
    metaJson[0][1] = "Time";
    if (metaJson[1] && metaJson[1][0] == "") {
    		//EPOCH                                   BX_GSE                 BY_GSE                 BZ_GSE
    		//                          (@_x_component_)       (@_y_component_)       (@_z_component_)
		//dd-mm-yyyy hh:mm:ss.ms                      nT                     nT                     nT
    		tmp = metaJson[1];
    		metaJson[1] = metaJson[2];
    		metaJson[2] = tmp;
    		metaJson[2].unshift("");
    } else {
    		// EPOCH                           <|B|>
		// dd-mm-yyyy hh:mm:ss.ms             nT
		// 01-01-2005 00:00:00.000       6.37000
    }
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
