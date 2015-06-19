var moment = require('moment')
var log    = require('../log.js')

exports.extractSignature = function (options) {
	var version = "1.0.0";

	var xoptions = ""+options.req.query.timeformat+options.timeRangeExpanded+options.req.query.timecolumns+options.req.query.outformat;
	//console.log(options.req.query.outformat)

	xoptions = xoptions.replace(/undefined/g,"");
	return version.split(".")[0] + xoptions;
}

function plugininfo(options,what) {

	var debug = options.debuglineformatterconsole;

	var scheduler = require("../scheduler.js");
	var plugin = scheduler.getPlugin(options);

	if (plugin === "") {
		log.logc(options.loginfo + "Error: plugin "+options.plugin+" not found.", 160);
	}

	if (what === "timeFormat") {
		var timeFormat = "";
		if (plugin.timeFormat) {
			timeFormat = plugin.timeFormat();
			if (debug) {
				log.logc(options.loginfo + " formattedTime.plugininfo(): Plugin has time format of: "+timeFormat, options.logcolor);
			}
		}
		return timeFormat;
	}
	if (what === "timeColumns") {
		var timeColumns = "";
		if (plugin.timeColumns) {
			timeColumns = plugin.timeColumns();
			if (debug) {
				log.logc(options.loginfo + " formattedTime.plugininfo(): Plugin has time columns of: "+timeColumns, options.logcolor);
			}
		}
		return timeColumns;
	}

}

exports.columnTranslator = function(col,options) {

	if (options.plugin) {
		var No = plugininfo(options,"timeColumns");
	} 

	if (options.req.query.timecolumns) {
		var No = options.req.query.timecolumns.split(",").length;
	}

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

	var debug = options.debuglineformatterconsole;

	// Only show debug information for first line.
	if (exports.formatLine.wascalled)
		if (exports.formatLine.wascalled[options.loginfo]) {
		debug = false
	}
	if (!exports.formatLine.wascalled) {
		exports.formatLine.wascalled = {};
		if (!exports.formatLine.wascalled[options.loginfo]) {
			exports.formatLine.wascalled[options.loginfo] = true;
		} 
	}
	
	exports.formatLine.wascalled[options.loginfo] = exports.formatLine.wascalled[options.loginfo] + 1;

	var timeformat  = options.req.query.timeformat   || "$Y-$m-$dT$H:$M$SZ";//"YYYY-MM-DDTHH:mm:ss.SSSZ";
	var timecolumns = options.req.query.timecolumns  || "1";
	var outformat   = options.streamFilterTimeFormat || "0";
	
	if (options.plugin && !options.req.query.timeformat) {
		var timeformat = plugininfo(options,"timeFormat");
	}
	if (options.plugin && !options.req.query.timecolumns) {
		var timecolumns = plugininfo(options,"timeColumns");
	}

	//timeformat = timeformat.replace("yyyy","YYYY").replace("yy","YY").replace("dd",'DD').replace("S","SSS").replace("SS","SSS").replace("j","DDD");
	timeformat = timeformat.replace("$Y","YYYY").replace("$m","MM").replace("$H","HH").replace("$M","mm").replace("$d",'DD').replace("$S","ss").replace("$j","DDD").replace("$(millis)","SSS");
	if (debug) {
		log.logc(options.loginfo + " formattedTime.formatLine(): timeformat: " + timeformat, options.logcolor);
		log.logc(options.loginfo + " formattedTime.formatLine(): timecolumns: " + timecolumns, options.logcolor);
	}

	var timeformata  = timeformat.split(/,|\s+/);
	var timecolumnsa = timecolumns.split(/,/);
		       
	if (line === "") {
		if (debug) {
			log.logc(options.loginfo + " formattedTime().formatLine: formattedTime: Empty line.", options.logcolor);
		}
		return "";
	}
	
	//line = line.replace(":"," ");
	// Assumes time is in continuous columns and before any data column that is to be kept.
	timev      = line.split(/\s+/).slice(parseInt(timecolumnsa[0])-1,parseInt(timecolumnsa[timecolumnsa.length-1]));
	datav      = line.split(/,|\s+/).slice(parseInt(timecolumnsa[timecolumnsa.length-1]));

	if (debug) {
		log.logc(options.loginfo + " formattedTime.formatLine(): line: " + line, options.logcolor);
		log.logc(options.loginfo + " formattedTime.formatLine(): timeformat array: " + timeformata.join(","), options.logcolor);
		log.logc(options.loginfo + " formattedTime.formatLine(): time array: " + timev.join(","), options.logcolor)
		log.logc(options.loginfo + " formattedTime.formatLine(): data array: " + datav.join(","), options.logcolor);
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
	
	if (debug) {
		log.logc(options.loginfo + " formattedTime.formatLine(): formatted date: " + d, options.logcolor)
	}
	var timestamp = d[0]+"-"+d[1]+"-"+d[2]+"T"+d[3]+":"+d[4]+":"+d[5]+"."+d[6]+"Z";

	var currms = new Date(timestamp).getTime();

	if (currms < startms) {
		if (debug) {
			log.logc(options.loginfo + " formattedTime.formatLine(): time of " + tmp._d + " is less than requested start time " + startdate, options.logcolor)
		}
		return "";
	}
	if (currms >= stopms) {
		if (debug) {
			log.logc(options.loginfo + " formattedTime.formatLine(): time of " + tmp._d + " is greater than requested stop time " + stopdate, options.logcolor)
		}
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
		if (debug) {
			log.logc(options.loginfo + " formattedTime.formatLine(): formattedTime: Formatted date: " + d, options.logcolor)
		}
		var timestamp = d[0]+"-"+d[1]+"-"+d[2]+"T"+d[3]+":"+d[4]+":"+d[5]+"."+d[6]+"Z";

		if (debug) {
			log.logc(options.loginfo + " formattedTime.formatLine(): Returning: "+timestamp + " " + datav.join(" "), options.logcolor)
		}
	}
	if (outformat === "2") {
		var timestamp = d[0]+" "+d[1]+" "+d[2]+" "+d[3]+" "+d[4]+" "+d[5]+"."+d[6];
	}

	line = timestamp + " " + datav.join(" ");

	//console.log(timestamp + " # of columns: " + datav.length)

	return line;

}