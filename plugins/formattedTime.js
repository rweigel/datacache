var moment = require('moment');

//if (1) {
exports.extractSignature = function (options) {
	var version = "1.0.0";

	var xoptions = ""+options.req.query.timeformat+options.req.query.timecolumns+options.req.query.outformat;
	//console.log(options.req.query.outformat)

	xoptions = xoptions.replace(/undefined/g,"");
	return version.split(".")[0] + xoptions;
}


//var strfmtime = require(__dirname + "/sprintf-0.7-beta1.js");

exports.formatLine = function (line, options) {

	var debug = options.debugplugin;
	
	var timeformat  = options.req.query.timeformat || "YYYY-MM-DDZHH:mm:ss.SSSZ";
	var timecolumns = options.req.query.timecolumns || 1;
	var outformat   = options.req.query.outformat || "0";

	timeformat       = timeformat.replace("yyyy","YYYY").replace("yy","YY").replace("DD",'dd').replace("S","SSS").replace("SS","SSS")
	if (debug) console.log(timeformat);
	if (debug) console.log(timecolumns);

	var timeformata  = timeformat.split(/,/);
	var timecolumnsa = timecolumns.split(/,/);

	// Assumes time is in continuous columns and before any data column that is to be kept.
	timev      = line.split(/\s+/).slice(parseInt(timecolumnsa[0])-1,parseInt(timecolumnsa[timecolumnsa.length-1]));
	datav      = line.split(/\s+/).slice(parseInt(timecolumnsa[timecolumnsa.length-1]));

	if (debug) {
		console.log("line: " + line);
		console.log("timeformat array: " + timeformata.join(","));
		console.log("time array: " + timev.join(","))
		console.log("data array: " + datav.join(","));
	}
	
	d = moment(timev.join(" "),timeformat)._a;

	if (outformat === "0") {
		var timestamp = timev.join(" ");
	}

	if (outformat === "1") {
		d[1] = ((""+d[1]).length == 1) ? "0"+(d[1]+1) : (d[1]+1);
		d[2] = ((""+d[2]).length == 1) ? "0"+d[2] : d[2];
		d[3] = ((""+d[3]).length == 1) ? "0"+d[3] : d[3];
		d[4] = ((""+d[4]).length == 1) ? "0"+d[4] : d[4];
		d[5] = ((""+d[5]).length == 1) ? "0"+d[5] : d[5];
		d[6] = ((""+d[6]).length == 1) ? "00"+d[6] : d[6];
		d[6] = ((""+d[6]).length == 2) ? "0"+d[6] : d[6];
	
		if (debug) console.log("Formatted date: " + d)
		var timestamp = d[0]+"-"+d[1]+"-"+d[2]+"T"+d[3]+":"+d[4]+":"+d[5]+"."+d[6]+"Z";

		if (debug) console.log("returning: "+timestamp + " " + datav.join(" "))
	}
	if (outformat === "2") {
		var timestamp = d[0]+" "+(parseInt(d[1])+1)+" "+d[2]+" "+d[3]+" "+d[4]+" "+d[5]+"."+d[6];
	}

	line = timestamp + " " + datav.join(" ");
	
	return line;

}
//}
