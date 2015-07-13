var moment = require('moment')
var log    = require('../log.js')

exports.extractSignature = function (options) {
	var version = "1.0.0";

	var xoptions = ""+options.req.query.timeformat+options.timeRangeExpanded+options.req.query.timecolumns+options.req.query.outformat;
	//console.log(options.req.query.outformat)

	xoptions = xoptions.replace(/undefined/g,"");
	return version.split(".")[0] + xoptions;
}

function plugininfo(options, what) {

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

exports.columnTranslator = function(col, options) {

	if (options.plugin) {
		var No = plugininfo(options,"timeColumns");
	} 

	if (options.streamFilterReadTimeColumns) {
		var No = options.streamFilterReadTimeColumns.split(",").length;
	}

	var outformat = options.streamFilterWriteTimeFormat;

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

	if (!exports.formatLine.wascalled) {
		exports.formatLine.wascalled = {};
	}

	debug = false

	// Only show debug information for first line.
	if (exports.formatLine.wascalled[options.loginfo]) {
		debug = false
	} else {
		exports.formatLine.wascalled[options.loginfo] = options.debuglineformatterconsole;
	}
	
	if (debug) {
		log.logc(options.loginfo + " formattedTime.formatLine(): Showing debug info for processed line.", options.logcolor)
	}

	var timeformat  = options.streamFilterReadTimeFormat  || "$Y-$m-$dT$H:$M$SZ";//"YYYY-MM-DDTHH:mm:ss.SSSZ";
	var timecolumns = options.streamFilterReadTimeColumns || "1";
	var outformat   = options.streamFilterWriteTimeFormat || "0";
	
	if (debug) {
		log.logc(options.loginfo + " formattedTime.formatLine(): streamFilterReadTimeFormat:  " + options.streamFilterReadTimeFormat, options.logcolor)
		log.logc(options.loginfo + " formattedTime.formatLine(): streamFilterReadTimeColumns: " + options.streamFilterReadTimeColumns, options.logcolor)
		log.logc(options.loginfo + " formattedTime.formatLine(): streamFilterReadTimeStart:   " + options.streamFilterReadTimeStart, options.logcolor)
		log.logc(options.loginfo + " formattedTime.formatLine(): streamFilterReadTimeStop:    " + options.streamFilterReadTimeStop, options.logcolor)
		log.logc(options.loginfo + " formattedTime.formatLine(): streamFilterWriteTimeFormat: " + options.streamFilterWriteTimeFormat, options.logcolor)
	}
	if (options.plugin && !options.streamFilterReadTimeFormat) {
		var timeformat = plugininfo(options,"timeFormat");
	}
	if (options.plugin && !options.streamFilterReadTimeColumns) {
		var timecolumns = plugininfo(options,"timeColumns");
	}

	//timeformat = timeformat.replace("yyyy","YYYY").replace("yy","YY").replace("dd",'DD').replace("S","SSS").replace("SS","SSS").replace("j","DDD");
	timeformat = timeformat.replace("$Y","YYYY").replace("$m","MM").replace("$H","HH").replace("$M","mm").replace("$d",'DD').replace("$S","ss").replace("$j","DDD").replace("$(millis)","SSS");
	if (debug) {
		log.logc(options.loginfo + " formattedTime.formatLine(): TimeFormat converted:        " + timeformat, options.logcolor);
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
	if (options.streamFilterReadColumnsDelimiter !== "") {
		var re = new RegExp(options.streamFilterReadColumnsDelimiter,"g")
		timev  = line.split(re).slice(parseInt(timecolumnsa[0])-1,parseInt(timecolumnsa[timecolumnsa.length-1]))
		datav  = line.split(re).slice(parseInt(timecolumnsa[timecolumnsa.length-1]))
	} else {
		timev  = line.split(/\s+/).slice(parseInt(timecolumnsa[0])-1,parseInt(timecolumnsa[timecolumnsa.length-1]))
		datav  = line.split(/,|\s+/).slice(parseInt(timecolumnsa[timecolumnsa.length-1]))
	}

	if (debug) {
		log.logc(options.loginfo + " formattedTime.formatLine(): time array: " + timev.join(","), options.logcolor)
		log.logc(options.loginfo + " formattedTime.formatLine(): data array: " + datav.join(","), options.logcolor);
	}

	if (options.streamFilterReadTimeStart !== "") {
		var startdate = options.streamFilterReadTimeStart;
		var startms = new Date(startdate).getTime();
		if (debug) {
			log.logc(options.loginfo + " formattedTime.formatLine(): start date: " + startdate, options.logcolor)
			log.logc(options.loginfo + " formattedTime.formatLine(): start ms:   " + startms, options.logcolor)

		}
	}
	if (options.streamFilterReadTimeStop !== "") {
		var stopdate = options.streamFilterReadTimeStop;
		var stopms  = new Date(stopdate).getTime();
		if (debug) {
			log.logc(options.loginfo + " formattedTime.formatLine(): stop date: " + stopdate, options.logcolor)
			log.logc(options.loginfo + " formattedTime.formatLine(): stop ms:   " + stopms, options.logcolor)
		}
	}

	tmp = moment(timev.join(" "), timeformat);
	d  = tmp._a;

	d[1] = ((""+(d[1]+1)).length == 1) ? "0"+(d[1]+1) : (d[1]+1);
	d[2] = ((""+d[2]).length == 1) ? "0"+d[2] : d[2];
	d[3] = ((""+d[3]).length == 1) ? "0"+d[3] : d[3];
	d[4] = ((""+d[4]).length == 1) ? "0"+d[4] : d[4];
	d[5] = ((""+d[5]).length == 1) ? "0"+d[5] : d[5];
	d[6] = ((""+d[6]).length == 1) ? "0"+d[6] : d[6];
	d[6] = ((""+d[6]).length == 2) ? "0"+d[6] : d[6];
	
	if (debug) {
		log.logc(options.loginfo + " formattedTime.formatLine(): line date:  " + d, options.logcolor)
	}
	var timestamp = d[0]+"-"+d[1]+"-"+d[2]+"T"+d[3]+":"+d[4]+":"+d[5]+"."+d[6]+"Z";

	if (options.streamFilterReadTimeStart !== "" || options.streamFilterReadTimeStop !== "") {

		var currms = new Date(timestamp).getTime();

		if (debug) {
			log.logc(options.loginfo + " formattedTime.formatLine(): line ms:    " + currms, options.logcolor)
		}

		if (options.streamFilterReadTimeStart !== "") {
			if (currms < startms) {
				if (debug) {
					log.logc(options.loginfo + " formattedTime.formatLine(): line date is less than TimeStart.  Returning empty line.", options.logcolor)
				}
				return "";
			}
		}
		if (options.streamFilterReadTimeStop !== "") {
			if (currms >= stopms) {
				if (debug) {
					log.logc(options.loginfo + " formattedTime.formatLine(): line date is greater than TimeStop. Returning END_OF_TIMERANGE.", options.logcolor)
				}
				return "END_OF_TIMERANGE";
			}
		}
	}

	if (outformat === "0") {
		if (debug) {
			log.logc(options.loginfo + " formattedTime.formatLine(): formattedTime: outformat = 0; Formatted date: " + d, options.logcolor)
		}
		var timestamp = timev.join(" ");
	}
	if (outformat === "1") {		
		if (debug) {
			log.logc(options.loginfo + " formattedTime.formatLine(): formattedTime: outformat = 1; Formatted date: " + d, options.logcolor)
		}
		var timestamp = d[0]+"-"+d[1]+"-"+d[2]+"T"+d[3]+":"+d[4]+":"+d[5]+"."+d[6]+"Z";
	}
	if (outformat === "2") {
		if (debug) {
			log.logc(options.loginfo + " formattedTime.formatLine(): formattedTime: outformat = 2; Formatted date: " + d, options.logcolor)
		}
		var timestamp = d[0]+" "+d[1]+" "+d[2]+" "+d[3]+" "+d[4]+" "+d[5]+"."+d[6];
	}

	line = timestamp + " " + datav.join(" ");

	if (debug) {
		log.logc(options.loginfo + " formattedTime.formatLine(): Returning: " + line, options.logcolor)
	}

	return line
}