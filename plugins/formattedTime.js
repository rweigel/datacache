var log    = require('../log.js');

exports.extractSignature = function (options) {
	var version = "1.0.0";

	var xoptions = ""+options.req.query.timeformat+options.timeRangeExpanded+options.req.query.timecolumns+options.req.query.outformat;
	//console.log(options.req.query.outformat)

	xoptions = xoptions.replace(/undefined/g,"");
	return version.split(".")[0] + xoptions;
}

function plugininfo(options, what) {

	var debug = options.debuglineformatterconsole || false;

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

exports.formatLine = function (line, options, testing) {

	var moment = require('moment');
	var Big    = require('big.js'); // Double precision math for Javascript.

	var debug = options.debuglineformatterconsole || true;
	
	if (!exports.formatLine.wascalled) {
		exports.formatLine.wascalled = {};
	}

	// Only show debug information for first line.
	if (exports.formatLine.wascalled[options.logsig]) {
		var debug = false
	} else {
		exports.formatLine.wascalled[options.logsig] = true;
	}
	
	if (debug) {
		log.logres(" formattedTime.formatLine(): Showing debug info for processed line.", options)
	}

	var timeformat  = options.streamFilterReadTimeFormat  || "$Y-$m-$dT$H:$M$SZ";//"YYYY-MM-DDTHH:mm:ss.SSSZ";
	var timecolumns = options.streamFilterReadTimeColumns || "1";
	var outformat   = options.streamFilterWriteTimeFormat || "0";

	if (debug) {
		log.logres(" formattedTime.formatLine(): streamFilterReadTimeFormat:       " + options.streamFilterReadTimeFormat, options);
		log.logres(" formattedTime.formatLine(): streamFilterReadTimeColumns:      " + options.streamFilterReadTimeColumns, options);
		log.logres(" formattedTime.formatLine(): streamFilterReadTimeStart:        " + options.streamFilterReadTimeStart, options);
		log.logres(" formattedTime.formatLine(): streamFilterReadTimeStop:         " + options.streamFilterReadTimeStop, options);
		log.logres(" formattedTime.formatLine(): streamFilterReadColumnsDelimiter: " + options.streamFilterReadColumnsDelimiter, options);
		log.logres(" formattedTime.formatLine(): streamFilterWriteTimeFormat:      " + options.streamFilterWriteTimeFormat, options);
		log.logres(" formattedTime.formatLine(): streamFilterWriteDelimiter:       " + options.streamFilterWriteDelimiter, options);

	}
	if (options.plugin && !options.streamFilterReadTimeFormat) {
		var timeformat = plugininfo(options,"timeFormat");
	}
	if (options.plugin && !options.streamFilterReadTimeColumns) {
		var timecolumns = plugininfo(options,"timeColumns");
	}

	//timeformat = timeformat.replace("yyyy","YYYY").replace("yy","YY").replace("dd",'DD').replace("S","SSS").replace("SS","SSS").replace("j","DDD");
	timeformat = timeformat
					.replace("$Y","YYYY")
					.replace("$m","MM")
					.replace("$H","HH")
					.replace("$M","mm")
					.replace("$d",'DD')
					.replace("$S","ss")
					.replace("$j","DDD")
					.replace("$(millis)","SSS");

	if (debug) {
		log.logres(" formattedTime.formatLine(): ReadTimeFormat converted:         " + timeformat, options);
	}

	var timeformata  = timeformat.split(/,|\s+/);
	var timecolumnsa = timecolumns.split(/,/);
	if (debug) {
		log.logres(" formattedTime.formatLine(): line:         " + line, options);
		log.logres(" formattedTime.formatLine(): timeformat:   " + timeformat, options);
		log.logres(" formattedTime.formatLine(): timecolumns:  " + timecolumns, options);
	}
	if (line === "") {
		if (debug) {
			log.logres(" formattedTime().formatLine: formattedTime: Empty line.", options);
		}
		return "";
	}

	line = line.trim();

	if (debug) {
		log.logres(" formattedTime.formatLine(): line trimmed: " + line, options);
	}

	//console.log(line)
	// Assumes time is in continuous columns and before any data column that is to be kept.
	if (options.streamFilterReadColumnsDelimiter !== "") {
		var re = new RegExp(options.streamFilterReadColumnsDelimiter,"g");
		timev  = line.split(re).slice(parseInt(timecolumnsa[0])-1,parseInt(timecolumnsa[timecolumnsa.length-1]));
		datav  = line.split(re).slice(parseInt(timecolumnsa[timecolumnsa.length-1]));
	} else {
		timev  = line.split(/,|\s+/).slice(parseInt(timecolumnsa[0])-1,parseInt(timecolumnsa[timecolumnsa.length-1]));
		datav  = line.split(/,|\s+/).slice(parseInt(timecolumnsa[timecolumnsa.length-1]));
	}
	//console.log(datav)

	//console.log(datav)

	if (debug) {
		log.logres(" formattedTime.formatLine(): time array:   " + timev.join(options.streamFilterWriteDelimiter), options);
		log.logres(" formattedTime.formatLine(): data array:   " + datav.join(options.streamFilterWriteDelimiter), options);
	}

	if (options.streamFilterReadTimeStart !== "") {
		var startdate = options.streamFilterReadTimeStart;
		var startms = new Date(startdate).getTime();
		if (debug) {
			log.logres(" formattedTime.formatLine(): start date:   " + startdate, options);
			log.logres(" formattedTime.formatLine(): start ms:     " + startms, options);

		}
	}
	if (options.streamFilterReadTimeStop !== "") {
		var stopdate = options.streamFilterReadTimeStop;
		var stopms  = new Date(stopdate).getTime();
		if (debug) {
			log.logres(" formattedTime.formatLine(): stop date:    " + stopdate, options);
			log.logres(" formattedTime.formatLine(): stop ms:      " + stopms, options);
		}
	}

	// Convert from $Y,$j,? to year, month, day, hour, minute, fractional seconds.
	if (timeformat === "YYYY,DDD") {
		doy = new Big(parseFloat(timev[1]));
		s = doy.minus(Math.floor(doy)).times(86400);
		h = s.div(3600);
		m = h.minus(Math.floor(h)).times(60);
		s = m.minus(Math.floor(m)).times(60);
		timev[1] = Math.floor(doy);
		timev[2] = Math.floor(h);
		timev[3] = Math.floor(m);
		timev[4] = s;
		timeformat = "YYYY DDD HH mm ss SSS"
	}
	if (timeformat === "YYYY,DDD,HH") {
		hod = new Big(parseFloat(timev[2]));
		if (hod > 23) {
			// error;
		}
		h = Math.floor(hod);
		mo = hod.minus(h).times(60);
		m = Math.floor(mo);
		s = (mo.minus(m)).times(60);
		timev[2] = h;
		timev[3] = m;
		timev[4] = s;
		timeformat = "YYYY DDD HH mm ss SSS";
	}
	if (timeformat === "YYYY,DDD,mm") {
		mod = new Big(parseFloat(timev[2]));
		if (mod > 1339) {
			// error;
		}
		h = Math.floor(mod.div(60));
		m = Math.floor(mod.minus(h*60));
		s = mod.minus(Math.floor(mod)).times(60);
		timev[2] = h;
		timev[3] = m;
		timev[4] = s;
		timeformat = "YYYY DDD HH mm ss SSS";
	}
	if (timeformat === "YYYY,DDD,ss") {
		sod = new Big(parseFloat(timev[2]));
		if (sod > 86399) {
			// error;
		}
		h = new Big(Math.floor(sod.div(3600)));
		a = new Big(Math.floor(sod.div(60)))
		m =  a.minus(h.times(60));
		s =  h.times(3600).minus(m.times(60)).minus(sod);
		timev[2] = h;
		timev[3] = m;
		timev[4] = s;
		timeformat = "YYYY DDD HH mm ss SSS"
	}

	tmp = moment(timev.join(" "), timeformat);
	d  = tmp._a;

	// Zero pad month, day, hour, minute, second, milliseconds.
	// Month is zero-based in moment.js.
	d[1] = ((""+(d[1]+1)).length == 1) ? "0"+(d[1]+1) : (d[1]+1);
	d[2] = ((""+d[2]).length == 1) ? "0"+d[2] : d[2];
	d[3] = ((""+d[3]).length == 1) ? "0"+d[3] : d[3];
	d[4] = ((""+d[4]).length == 1) ? "0"+d[4] : d[4];
	d[5] = ((""+d[5]).length == 1) ? "0"+d[5] : d[5];
	d[6] = ((""+d[6]).length == 1) ? "0"+d[6] : d[6];
	d[6] = ((""+d[6]).length == 2) ? "0"+d[6] : d[6];
	
	if (debug) {
		log.logres(" formattedTime.formatLine(): line date:    " + d, options);
	}

	// Create ISO8601 timestamp.
	var timestamp = d[0]+"-"+d[1]+"-"+d[2]+"T"+d[3]+":"+d[4]+":"+d[5]+"."+d[6]+"Z";

	// Check if subset of file was specified.
	if (options.streamFilterReadTimeStart !== "" || options.streamFilterReadTimeStop !== "") {

		var currms = new Date(timestamp).getTime();

		if (debug) {
			log.logres(" formattedTime.formatLine(): line ms:      " + currms, options);
		}

		if (options.streamFilterReadTimeStart !== "") {
			if (currms < startms) {
				if (debug) {
					log.logres(" formattedTime.formatLine(): line date is less than TimeStart.  Returning empty line.", options);
				}
				return "";
			}
		}
		if (options.streamFilterReadTimeStop !== "") {
			if (currms >= stopms) {
				if (debug) {
					log.logres(" formattedTime.formatLine(): line date is greater than TimeStop. Returning END_OF_TIMERANGE.", options);
				}
				return "END_OF_TIMERANGE";
			}
		}
	}

	if (outformat === "0") {
		if (debug) {
			log.logres(" formattedTime.formatLine(): outformat:    0", options);
		}
		var timestamp = timev.join(" ");
	}
	if (outformat === "1") {		
		if (debug) {
			log.logres(" formattedTime.formatLine(): outformat:    1", options);
		}
		var timestamp = d[0]+"-"+d[1]+"-"+d[2]+"T"+d[3]+":"+d[4]+":"+d[5]+"."+d[6]+"Z";
	}
	if (outformat === "2") {
		if (debug) {
			log.logres(" formattedTime.formatLine(): outformat:    2", options);
		}
		var timestamp = d[0]+" "+d[1]+" "+d[2]+" "+d[3]+" "+d[4]+" "+d[5]+"."+d[6];
	}

	line = timestamp + options.streamFilterWriteDelimiter + datav.join(options.streamFilterWriteDelimiter);

	if (debug) {
		log.logres(" formattedTime.formatLine(): Returning:    " + line, options);
	}

	return line;
}