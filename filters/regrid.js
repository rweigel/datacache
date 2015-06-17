var log = require("../log.js")

exports.filterSignature = function(options) {
	return options.streamFilterRegridDt + options.streamFilterRegridTimeRange
}

exports.regrid = function regrid(datas,options) {

	//datas  = "2010-01-01T00:00:00.000Z 1 1 1 1 1 1\n2010-01-01T00:00:00.500Z 1 1 1 1 1 1\n2010-01-01T00:00:00.750Z 1 1 1 1 1 1\n2010-01-01T00:00:05.000Z 1 1 1 1 1 1\n2010-01-01T00:06:00.000Z 1 1 1 1 1 1";
	//var datas = datas.split(/\n/g);
	//var options = {};

	//options.streamFilterRegridTimeRange = '2010-01-01T00:00:00.0000Z/2010-01-01T00:00:04.000Z';
	//options.timeRange = '2010-01-01T00:00:00.0000Z/2010-01-01T00:00:04.000Z';
	//options.streamFilterRegridDt = 1000;
		
	// TODO: This program assumes dt is in milliseconds, which is the highest precision possible.
	// Support can be added for higher resolutions by adding determining the number of fractional
	// microseconds and adding this each time getTime() is called.
	
	var datas = datas.replace(/\n$/,"").split(/\n/g)
	var line = datas[0].split(/\s+/g)

	if (options.streamFilterRegridDt) {
		var dt = options.streamFilterRegridDt
	} else {
		var dt = new Date(datas[1].split(/\s+/g)[0]).getTime() - new Date(line[0]).getTime()
		if (options.debuglinefilterconsole) {
			log.logc(options.loginfo + " regrid.js: No dt given.  Using dt between first two data points = "+dt+" ms", options.logcolor)
		}
	}

	if (options.streamFilterRegridTimeRange === "") {
		options.streamFilterRegridTimeRange = options.timeRange
	}
	
	// console.log(datas[datas.length-1])
	
	// If no timeRange given, assume that the grid should be from
	// 00:00:00.000 of the first date to 00:00:00.000 of the day after the last date.
	if (options.streamFilterRegridTimeRange === "") {
		// Use start/stop of available data.
		if (options.debuglinefilterconsole) {
			log.logc(options.loginfo + " regrid.js: No time range and no regrid time range.  Using first and last points.", options.logcolor)
		}
		options.streamFilterRegridTimeRange = datas[0].split(/\s+/g)[0] + "/" + datas[datas.length-1].split(/\s+/g)[0]
		if (false) {
			a = line[0].substring(0,10) + "T00:00:00.000"
			if (!line[line.length-1].substring(12,23).match(/[1-9]/g)) {
				b = new Date(new Date(line[line.length-1].substring(0,10)).getTime()).toISOString().substring(0,10) + "T00:00:00.000"
			} else {
				b = new Date(new Date(line[line.length-1].substring(0,10)).getTime()+24*60*60*1000).toISOString().substring(0,10) + "T00:00:00.000"
			}
			options.streamFilterRegridTimeRange = a + "/" + b
		}
	}

	if (options.streamFilterRegridTimeRange.split("/")[0].match(/\.[0-9]{4,}/)) {
		if (options.debuglinefilterconsole) {
			log.logc(options.loginfo + " regrid.js: Greater than ms precision requested.", options.logcolor)
		}
	}
		
	var START = new Date(options.streamFilterRegridTimeRange.split("/")[0])
	var STOP  = new Date(options.streamFilterRegridTimeRange.split("/")[1])
	
	var ti = START.getTime()
	var tf = STOP.getTime()
	var N  = Math.floor((tf-ti)/dt)
	var Np = datas.length
				
	if (options.debuglinefilterconsole) {
		log.logc(options.loginfo + " regrid.js: START  = " + START.toISOString(), options.logcolor)
		log.logc(options.loginfo + " regrid.js: STOP   = " + STOP.toISOString(), options.logcolor)
		log.logc(options.loginfo + " regrid.js: ti     = "+ti+" ms", options.logcolor)
		log.logc(options.loginfo + " regrid.js: tf     = "+tf+" ms", options.logcolor)
		log.logc(options.loginfo + " regrid.js: dt     = "+dt+" ms", options.logcolor)
		log.logc(options.loginfo + " regrid.js: (tf-ti)/dt        = "+(tf-ti)/dt, options.logcolor)
		log.logc(options.loginfo + " regrid.js: # output lines    = "+N, options.logcolor)
		log.logc(options.loginfo + " regrid.js: # input lines     = "+Np, options.logcolor)
	}

	if (options.debuglinefilterconsole) {
		log.logc(options.loginfo + " regrid.js: # cols in 1st row = "+line.length, options.logcolor)
	}

	var excludes = []
	if (options.streamFilterExcludeColumnValues === '') {
		for (c = 0;c < line.length-1;c++) {
			excludes[c] = NaN
		}		
	} else {
		if (options.streamFilterExcludeColumnValues.match(",")) {
			excludeso = options.streamFilterExcludeColumnValues.split(",")
			for (var c = 0;c < line.length-1;c++) {
				excludes[c] = parseFloat(excludeso[c])
			}	
		} else {
			// Use same exclude value for all columns if only one was given.
			for (c = 0;c < line.length-1;c++) {
				excludes[c] = parseFloat(options.streamFilterExcludeColumnValues)
			}
		}		
	}

	var tx = ti-dt
	var j     = 0
	var lineg = ""
	var tg    = 0
	var xg    = []

	for (i = 0;i < N;i++) {

		for (c = 0; c < line.length-1;c++) {
			xg[c] = 0
		}

		Ng = 0
		tx = tx+dt
		tv = 0

		tg = new Date(tx).toISOString()
		line = datas[j].split(/\s+/g)

		if (options.debuglinefilterconsole) {
			log.logc(options.loginfo + " regrid.js: Previous boundary >= " + new Date(tx).toISOString(), options.logcolor)
			log.logc(options.loginfo + " regrid.js: Next boundary      < " + new Date(tx+dt).toISOString(), options.logcolor)
		}

		while (new Date(line[0]).getTime() < tx+dt) {
			//if (line[1] != excludes[0]) {
				tv = tv+new Date(line[0]).getTime()
				Ng = Ng+1
				for (c = 0; c < line.length-1;c++) {
					xg[c] = xg[c]+parseFloat(line[c+1])
				}

				if (options.debuglinefilterconsole) {
					log.logc(options.loginfo + " regrid.js: Using datum at       " + line, options.logcolor)
				}
				console.log(line)
				console.log(xg)
			//} else {
				//if (options.debuglinefilterconsole) {
				//	log.logc(options.loginfo + " regrid.js: Excluding            " + line, options.logcolor)
				//}				
			//}
			j = j+1
			line = datas[j].split(/\s+/g)
		}
		
		if (Ng == 1) {
			if (options.debuglinefilterconsole) {
				log.logc(options.loginfo + " regrid.js: Ng = " + Ng, options.logcolor)
			}
			lineg = lineg + tg + " " + (i+1) + " " + Ng + " " + xg.join(" ") + "\n"
		} else if (Ng > 1) {
			if (options.debuglinefilterconsole) {
				log.logc(options.loginfo + " regrid.js: Ng = " + Ng, options.logcolor)
			}
			for (c = 0; c < xg.length;c++) {
				xg[c] = xg[c]/Ng
			}
			tv = tv/Ng
			lineg = lineg + new Date(tv).toISOString() + " " + (i+1) + " " + Ng + xg.join(" ") + "\n"
		} else {
			if (options.debuglinefilterconsole) {
				log.logc(options.loginfo + " regrid.js: Ng = " + Ng, options.logcolor)
			}
			if (options.debuglinefilterconsole) {
				log.logc(options.loginfo + " regrid.js: No datum in bin.  Using fill.", options.logcolor)
			}
			for (c = 0; c < xg.length;c++) {
				xg[c] = excludes[c]
			}
			lineg = lineg + tg + " " + (i+1) + " " + Ng + " " + xg.join(" ") + "\n"
		}

	}
	return lineg
}