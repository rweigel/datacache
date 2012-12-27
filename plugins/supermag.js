exports.name = "supermag";

exports.match = function(url){
	return url.split("/")[2].toLowerCase()==="supermag.jhuapl.edu";
}


exports.extractData = function(data){
    // Time stamp line
    var re1 = /^([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)/;
    // Data line
    var re2 = /\n([a-zA-Z]+)\s+([\d-]+)\s([\d-]+)\s([\d-]+)/g;
    // First combine timestamp and data line and remove station string.  Then split on newlines and keep data lines.

    if (0) {
    var date = new Date();
    var curDate = null;
    do { curDate = new Date(); }
    while(curDate-date < 1000);
    }

    if (0) {
	var arr = new Array();
	var arr = data
	    .toString()
	    .replace(re2," $2 $3 $4")
	    .split("\n")
	    .filter(function(line){ return line.search(re1)!=-1;})
	    .join("\n")
	    .split(/\s+/g);

	console.log(arr.length + " " + arr[0]);

	var buff = new Buffer(8*arr.length);
	for (i = 0;i < arr.length; i++) {
	    buff.writeDoubleLE(parseFloat(arr[i]),8*(i-1));
	}
	fs.writeFileSync("/tmp/a.bin", buff);
	return buff;
    }

    return data.toString()
	                .replace(re2," $2 $3 $4")
			.split("\n")
			.filter(function(line){
				return line.search(re1)!=-1;
			})
			.join("\n");
};