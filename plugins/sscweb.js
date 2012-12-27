exports.name = "sscweb";

exports.match = function(url){
	return url.split("/")[2].toLowerCase()==="sscweb.gsfc.nasa.gov";
}

exports.extractData = function(data){
	var re = /^([\d]+)\s+([\d]+)\s+([\d:]+)\s+([+-\.\d]+)\s+([+-\.\d]+)\s+([+-\.\d]+)$/;
	return data.toString()
			.split("\n")
			.filter(function(line){
				return line.search(re)!=-1;
			})
			.join("\n");;
};

exports.extractRem = function(data){
	var re = /^([\d]+)\s+([\d]+)\s+([\d:]+)\s+([+-\.\d]+)\s+([+-\.\d]+)\s+([+-\.\d]+)$/;
	return data.toString()
			.split("\n")
			.filter(function(line){
				return line.search(re)==-1;
			})
			.join("\n");;
};