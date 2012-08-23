exports.match = function(url){
	return url.split("/")[2].toLowerCase()==="supermag.uib.no";
}

exports.extractData = function(data){
	var re = /^([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)$|^([a-zA-Z]+)\s+([\d-]+)\s([\d-]+)\s([\d-]+)$/;
	return data.toString()
			.split("\n")
			.filter(function(line){
				return line.search(re)!=-1;
			})
			.join("\n");;
};