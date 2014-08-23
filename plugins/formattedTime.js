var moment = require('moment');

//if (1) {
exports.extractSignature = function (options) {
	var version = "1.0.0";

	var xoptions = ""+options.req.query.timeformat+options.timeRangeExpanded+options.req.query.timecolumns+options.req.query.outformat;
	//console.log(options.req.query.outformat)

	xoptions = xoptions.replace(/undefined/g,"");
	return version.split(".")[0] + xoptions;
}


//var strfmtime = require(__dirname + "/sprintf-0.7-beta1.js");

exports.columnTranslator = function(col,options) {
	var No = options.req.query.timecolumns.split(",").length;
	var outformat = options.streamFilterTimeFormat;

	if (outformat == "0") {
		return col;
	}
	if (outformat == "1") {
		if (col > No) {
			return col-No+1;
		} else {
			return 1;
		}
	}
	if (outformat == "2") {
		if (col > No) {
			return col-No+6;
		} else {
			return 1;
		}
	}
}

exports.formatLine = function (line, options) {

	var debug = options.debuglineformatter;

	var timeformat  = options.req.query.timeformat   || "$Y-$m-$dT$H:$M$SZ";//"YYYY-MM-DDTHH:mm:ss.SSSZ";
	var timecolumns = options.req.query.timecolumns  || "1";
	var outformat   = options.streamFilterTimeFormat || "0";
	
	var scheduler = require("../scheduler.js");
	
	if (options.plugin) {
		var plugin = scheduler.getPlugin(options);
		if (plugin.timeFormat) {
			var timeformat = plugin.timeFormat();
			if (debug) console.log("formattedTime: Plugin has time format of: "+timeformat);
		}
		if (plugin.timeColumns) {
			var timecolumns = plugin.timeColumns();
		}
	} 

	//timeformat = timeformat.replace("yyyy","YYYY").replace("yy","YY").replace("dd",'DD').replace("S","SSS").replace("SS","SSS").replace("j","DDD");
	timeformat = timeformat.replace("$Y","YYYY").replace("$m","MM").replace("$H","HH").replace("$M","mm").replace("$d",'DD').replace("$S","ss").replace("$j","DDD").replace("$(millis)","SSS");
	if (debug) console.log("formattedTime: timeformat: " + timeformat);
	if (debug) console.log("formattedTime: timecolumns: " + timecolumns);

	var timeformata  = timeformat.split(/,|\s+/);
	var timecolumnsa = timecolumns.split(/,/);

	if (debug) console.log("formattedTime: line: "+line);
		       
	if (line === "") {
		if (debug) console.log("formattedTime: Empty line.");
		return "";
	}
	
	//line = line.replace(":"," ");
	// Assumes time is in continuous columns and before any data column that is to be kept.
	timev      = line.split(/\s+/).slice(parseInt(timecolumnsa[0])-1,parseInt(timecolumnsa[timecolumnsa.length-1]));
	datav      = line.split(/,|\s+/).slice(parseInt(timecolumnsa[timecolumnsa.length-1]));

	if (debug) {
		console.log("formattedTime: line: " + line);
		console.log("formattedTime: timeformat array: " + timeformata.join(","));
		console.log("formattedTime: time array: " + timev.join(","))
		console.log("formattedTime: data array: " + datav.join(","));
	}
	
	var startdate = options.timeRangeExpanded.split("/")[0];
	var stopdate  = options.timeRangeExpanded.split("/")[1];

	var startms = new Date(startdate).getTime();
	var stopms  = new Date(stopdate).getTime();

	tmp = moment(timev.join(" "),timeformat);
	d  = tmp._a;

	d[1] = ((""+(d[1]+1)).length == 1) ? "0"+(d[1]+1) : (d[1]+1);
	d[2] = ((""+d[2]).length == 1) ? "0"+d[2] : d[2];
	d[3] = ((""+d[3]).length == 1) ? "0"+d[3] : d[3];
	d[4] = ((""+d[4]).length == 1) ? "0"+d[4] : d[4];
	d[5] = ((""+d[5]).length == 1) ? "0"+d[5] : d[5];
	d[6] = ((""+d[6]).length == 1) ? "0"+d[6] : d[6];
	d[6] = ((""+d[6]).length == 2) ? "0"+d[6] : d[6];
	
	if (debug) console.log("formattedTime: formatted date: " + d)
	var timestamp = d[0]+"-"+d[1]+"-"+d[2]+"T"+d[3]+":"+d[4]+":"+d[5]+"."+d[6]+"Z";

	var currms = new Date(timestamp).getTime();

	if (currms < startms) {
		if (debug) console.log("formattedTime: time of " + tmp._d + " is less than requested start time " + startdate)
		return "";
	}
	if (currms >= stopms) {
		if (debug) console.log("formattedTime: time of " + tmp._d + " is greater than requested stop time " + stopdate)
		return "END_OF_TIMERANGE";
	}

	//console.log("--------------")
	//zz = moment([1997,238,23,48].join(" "),'YYYY,DDD,HH,mm')._a;
	//console.log(zz);
	//console.log("xxxxxxxxxxxxxx")
	if (outformat === "0") {
		var timestamp = timev.join(" ");
	}
	//console.log(d)
	if (outformat === "1") {		
		if (debug) console.log("formattedTime: Formatted date: " + d)
		var timestamp = d[0]+"-"+d[1]+"-"+d[2]+"T"+d[3]+":"+d[4]+":"+d[5]+"."+d[6]+"Z";

		if (debug) console.log("formattedTime: Returning: "+timestamp + " " + datav.join(" "))
	}
	if (outformat === "2") {
		var timestamp = d[0]+" "+(parseInt(d[1])+1)+" "+d[2]+" "+d[3]+" "+d[4]+" "+d[5]+"."+d[6];
	}

	line = timestamp + " " + datav.join(" ");

	//console.log(timestamp + " # of columns: " + datav.length)

	return line;

}