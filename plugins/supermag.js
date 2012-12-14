exports.name = "supermag";

exports.match = function(url){
	return url.split("/")[2].toLowerCase()==="supermag.jhuapl.edu";
}

exports.extractData = function(data){
    // Time stamp line
    var re1 = /^([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)/;
    // Data line
    var re2 = /\n([a-zA-Z]+)\s+([\d-]+)\s([\d-]+)\s([\d-]+)/g;
    // First combine timestamp and data line and remove station string.  Then spit on newlines and keep data lines.
    return data.toString()
	                .replace(re2," $2 $3 $4")
			.split("\n")
			.filter(function(line){
				return line.search(re1)!=-1;
			})
			.join("\n");
};