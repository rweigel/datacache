exports.name = "supermag";

exports.match = function(url){
	return url.split("/")[2].toLowerCase()==="supermag.jhuapl.edu";
}

function pause(i) {
	var date = new Date();
	var curDate = null;
	do { curDate = new Date(); }
	while(curDate-date < i);
}

exports.extractDataBinary = function (data) {

    // Time stamp line
    var re1 = /^([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)/;
    // Data line
    var re2 = /\n([a-zA-Z]+)\s+([\d-]+)\s([\d-]+)\s([\d-]+)/g;
    // First combine timestamp and data line and remove station string.  Then split on newlines and keep data lines.

	var arr = new Array();
	var arr = data
	    .toString()
	    .replace(re2," $2 $3 $4")
	    .split("\n")
	    .filter(function(line){return line.search(re1)!=-1;})
	    .join("\n")
	    .split(/\s+/g);
	
	var buff = new Buffer(8*arr.length);
	for (i = 0;i < arr.length; i++) {
	    buff.writeDoubleLE(parseFloat(arr[i]),8*(i-1));
	}
	return buff;
}

exports.extractData = function (data) {
    // Time stamp line
    var re1 = /^([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)/;

    // Data line
    var re2 = /\n([a-zA-Z]+)\s+([\d-]+)\s([\d-]+)\s([\d-]+)/g;

    // First combine timestamp and data line and remove station string.
    // Then split on newlines and keep data lines.
    return data.toString()
    			.replace(/[ \t]+/g,' ')
			.replace(re2," $2 $3 $4")
			.split("\n")
			.filter(function (line) {return line.search(re1)!=-1})
			.join("\n") + "\n";
};