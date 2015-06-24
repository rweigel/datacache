var log = require("../log.js")

exports.filterSignature = function(options) {
	return options.streamFilterRegridDt + options.streamFilterComputeFunctionTimeRange
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

	datas = datas.split(/\n/g)
	if (datas[datas.length-1] === '') {
		datas.pop()
	}
	var line = datas[0].split(/\s+/g)

	if (options.streamFilterWriteComputeFunctionDt > 0) {
		var dt = options.streamFilterWriteComputeFunctionDt
	} else {
		var dt = new Date(datas[1].split(/\s+/g)[0]).getTime() - new Date(line[0]).getTime()
		if (options.debuglinefilterconsole) {
			log.logc(options.loginfo + " regrid.js: No dt given.  Using dt between first two data points = "+dt+" ms", options.logcolor)
		}
	}
	
	// If no timeRange given, assume that the grid should be from
	// 00:00:00.000 of the first date to 00:00:00.000 of the day after the last date.
	if (options.streamFilterWriteComputeFunctionTimeRange === "") {
		// Use start/stop of available data.
		if (options.debuglinefilterconsole) {
			log.logc(options.loginfo + " regrid.js: No time range and no regrid time range.  Using first and last points.", options.logcolor)
		}
		options.streamFilterWriteComputeFunctionTimeRange = datas[0].split(/\s+/g)[0] + "/" + datas[datas.length-1].split(/\s+/g)[0]
		if (false) {
			a = line[0].substring(0,10) + "T00:00:00.000"
			if (!line[line.length-1].substring(12,23).match(/[1-9]/g)) {
				b = new Date(new Date(line[line.length-1].substring(0,10)).getTime()).toISOString().substring(0,10) + "T00:00:00.000"
			} else {
				b = new Date(new Date(line[line.length-1].substring(0,10)).getTime()+24*60*60*1000).toISOString().substring(0,10) + "T00:00:00.000"
			}
			options.streamFilterWriteComputeFunctionTimeRange = a + "/" + b
		}
	}

	if (options.streamFilterWriteComputeFunctionTimeRange.split("/")[0].match(/\.[0-9]{4,}/)) {
		if (options.debuglinefilterconsole) {
			log.logc(options.loginfo + " regrid.js: Greater than ms precision requested.", options.logcolor)
		}
	}
		
	var START = new Date(options.streamFilterWriteComputeFunctionTimeRange.split("/")[0])
	var STOP  = new Date(options.streamFilterWriteComputeFunctionTimeRange.split("/")[1])
	
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
	if (options.streamFilterWriteComputeFunctionExcludes === '') {
		for (c = 0;c < line.length-1;c++) {
			excludes[c] = NaN
		}		
	} else {
		if (options.streamFilterWriteComputeFunctionExcludes.match(",")) {
			excludeso = options.streamFilterWriteComputeFunctionExcludes.split(",")
			for (var c = 0;c < line.length-1;c++) {
				excludes[c] = parseFloat(excludeso[c])
			}	
		} else {
			// Use same exclude value for all columns if only one was given.
			for (c = 0;c < line.length-1;c++) {
				excludes[c] = parseFloat(options.streamFilterWriteComputeFunctionExcludes)
			}
		}		
	}

	var tx = ti-dt
	var j     = 0
	var lineg = ""
	var tg    = 0
	var xg    = []
	var Ng    = []
	var tv    = []

	var linegl = "";

	for (i = 0;i < N;i++) {

		for (c = 0; c < line.length-1;c++) {
			xg[c] = 0
			Ng[c] = 0
			tv[c] = 0
		}

		tx = tx + dt
		tg = new Date(tx).toISOString()
		line = datas[j].split(/\s+/g)

		if (i == N-1) {
			log.logc(options.loginfo + " regrid.js: Last window", options.logcolor)
		}

		if (options.debuglinefilterconsole) {
			log.logc(options.loginfo + " regrid.js: Lower boundary >= " + new Date(tx).toISOString(), options.logcolor)
			log.logc(options.loginfo + " regrid.js: Upper boundary <  " + new Date(tx+dt).toISOString(), options.logcolor)
		}

		while (new Date(line[0]).getTime() < tx+dt) {
			//if (line[1] != excludes[0]) {
				for (c = 0; c < line.length-1;c++) {
					xg[c] = xg[c]+parseFloat(line[c+1])
					Ng[c] = Ng[c]+1
					tv[c] = tv[c]+(new Date(line[0]).getTime()-tx)
				}

				if (options.debuglinefilterconsole) {
					log.logc(options.loginfo + " regrid.js: Using datum at    " + line, options.logcolor)
				}
			//} else {
				//if (options.debuglinefilterconsole) {
				//	log.logc(options.loginfo + " regrid.js: Excluding            " + line, options.logcolor)
				//}				
			//}
			j = j+1
			line = datas[j].split(/\s+/g)
		}

		// Deal with last value
		if (i == N-1) {
			if (tx + dt == new Date(line[0]).getTime() || j != datas.length-1) {
				log.logc(options.loginfo + " regrid.js: Ignored lines: ")
				console.log(datas.slice(j,datas.length))

				if (Ng[0] > 1) {
					if (options.debuglinefilterconsole) {
						log.logc(options.loginfo + " regrid.js: Next datum after last window is on boundary.  Using in average.", options.logcolor)
						log.logc(options.loginfo + " regrid.js: Using datum at    " + line, options.logcolor)
					}
					for (c = 0; c < line.length-1;c++) {
						xg[c] = xg[c]+parseFloat(line[c+1])
						Ng[c] = Ng[c]+1
						tv[c] = tv[c]+(new Date(line[0]).getTime()-tx)
					}
				} else {
					if (options.debuglinefilterconsole) {
						log.logc(options.loginfo + " regrid.js: Next datum after last window is on boundary.  Using as grid value.", options.logcolor)
						log.logc(options.loginfo + " regrid.js: Using datum at    " + line, options.logcolor)
					}
					var xgl = []
					var Ngl = []
					var tvl = []
					tgl = new Date(tx+dt).toISOString()
					for (c = 0; c < line.length-1;c++) {
						xgl[c] = 0
						Ngl[c] = 0
						tvl[c] = 0
					}
					for (c = 0; c < line.length-1;c++) {
						xgl[c] = parseFloat(line[c+1])
						Ngl[c] = Ng[c]+1
						tvl[c] = 0
					}
					linegl = tgl + " " + xgl.join(" ") + " " + Ngl.join(" ") + " " + tvl.join(" ") + "\n"
				}
			}
		}

		for (c = 0; c < xg.length;c++) {		
			log.logc(options.loginfo + " regrid.js: Ng[" + c + "] = " + Ng[c], options.logcolor)

			if (Ng[c] == 1) {
				if (options.debuglinefilterconsole) {
				}
			} else if (Ng[c] > 1) {
				xg[c] = xg[c]/Ng[c]
				tv[c] = tv[c]/Ng[c]
			} else {
				if (options.debuglinefilterconsole) {
					log.logc(options.loginfo + " regrid.js: No datum in bin.  Using fill.", options.logcolor)
				}
				for (c = 0; c < xg.length;c++) {
					xg[c] = excludes[c]
				}
			}
		}
		lineg = lineg + tg + " " + xg.join(" ") + " " + Ng.join(" ") + " " + tv.join(" ") + "\n" + linegl
	}
	return lineg
}