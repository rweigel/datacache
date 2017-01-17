exports.name = "sscweb";

exports.extractSignature = function () {
	return "1"
}

exports.extractData = function(data){
	//var re = /^([\d]+)\s+([\d]+)\s+([\d:]+)\s+([+-\.\d]+)\s+([+-\.\d]+)\s+([+-\.\d]+)$/;
	var re = /^([\d]+)\s+([\d]+)\s+([\d:]+)/;
	return data.toString()
			.replace(/N\/A/g,"1e31")
			.split("\n")
			.filter(function(line){
				return line.search(re)!=-1;
			})
	.join("\n") + "\n";
};

exports.extractRem = function(data){
	//var re = /^([\d]+)\s+([\d]+)\s+([\d:]+)\s+([+-\.\d]+)\s+([+-\.\d]+)\s+([+-\.\d]+)$/;
	var re = /^([\d]+)\s+([\d]+)\s+([\d:]+)/;
	return data.toString()
			.split("\n")
			.filter(function(line){
				return line.search(re)==-1;
			})
			.join("\n");;
};