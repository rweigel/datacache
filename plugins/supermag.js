exports.name = "supermag";

// Reads SuperMAG response and extracts data portion into format that is easy for TSDS2 + template to process.
exports.extractData = function (data) {

	// Time stamp line
	var re1 = /^([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)/;

	// Data line
	var re2 = /\n([A-Z]\w+)\s+([\d-].*)/gi;

	// First combine timestamp and data line and remove station string.
	// Then split on newlines, remove last line, and keep data lines.
	
	return data
			.toString()
			.replace(/[ \t]+/g,' ')				// Replace space or tabs with space.
			.replace(re2," $2")					// Removes newline and keeps data line.
			.split("\n")
			.filter(function (line) {return line.search(re1)!=-1})	// Removes lines that don't match re1.
			.join("\n") + "\n";
};

if (0) {
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
			.replace(/[0-9](\n[A-Z])/g,'$1')  // Removes last element which is number of records that follow timestamp.
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
}
