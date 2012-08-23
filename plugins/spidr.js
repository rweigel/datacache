exports.match = function(url){
	return url.split("/")[2].toLowerCase()==="spidr.ngdc.noaa.gov";
}

exports.extractData = function(data){
	var re = /^([-\d]+)\s+([\.,:\d]+)/;
	return data.toString()
			.split("\n")
			.filter(function(line){
				return line.search(re)!=-1;
			})
			.join("\n");;
};