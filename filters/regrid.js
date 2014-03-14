exports.filterSignature = function(options) {
	return options.streamFilterRegridDt + options.streamFilterRegridTimeRange;
}

exports.regrid = function regrid(datas,options) {

	console.log("REGRID");
	//datas  = "2010-01-01T00:00:00.000Z 1 1 1 1 1 1\n2010-01-01T00:00:00.500Z 1 1 1 1 1 1\n2010-01-01T00:00:00.750Z 1 1 1 1 1 1\n2010-01-01T00:00:05.000Z 1 1 1 1 1 1\n2010-01-01T00:06:00.000Z 1 1 1 1 1 1";
	//var datas = datas.split(/\n/g);
	//var options = {};

	//options.streamFilterRegridTimeRange = '2010-01-01T00:00:00.0000Z/2010-01-01T00:00:04.000Z';
	//options.timeRange = '2010-01-01T00:00:00.0000Z/2010-01-01T00:00:04.000Z';
	//options.streamFilterRegridDt = 1000;
		
	// TODO: This program assumes dt is in milliseconds, which is the highest precision possible.
	// Support can be added for higher resolutions by adding determining the number of fractional
	// microseconds and adding this each time getTime() is called.
	
	var datas = datas.replace(/\n$/,"").split(/\n/g);
	var line = datas[0].split(/\s+/g);

	if (options.streamFilterRegridDt) {
		var dt = options.streamFilterRegridDt;
	} else {
		var dt = new Date(datas[1].split(/\s+/g)[0]).getTime() - new Date(line[0]).getTime();
		console.log("regrid.js: No dt given.  Using dt between two data points");
	}

	if (options.streamFilterRegridTimeRange === "") {
		options.streamFilterRegridTimeRange = options.timeRange;
	}
	console.log(datas[datas.length-1])
	// If no timeRange given, assume that the grid should be from
	// 00:00:00.000 of the first date to 00:00:00.000 of the day after the last date.
	if (options.streamFilterRegridTimeRange === "") {
		// Use start/stop of available data.
		console.log("regrid.js: No time range and no regrid time range.  Using first and last points.");
		options.streamFilterRegridTimeRange = datas[0].split(/\s+/g)[0] + "/" + datas[datas.length-1].split(/\s+/g)[0];
		if (false) {
			a = line[0].substring(0,10) + "T00:00:00.000";
			if (!line[line.length-1].substring(12,23).match(/[1-9]/g)) {
				b = new Date(new Date(line[line.length-1].substring(0,10)).getTime()).toISOString().substring(0,10) + "T00:00:00.000";
			} else {
				b = new Date(new Date(line[line.length-1].substring(0,10)).getTime()+24*60*60*1000).toISOString().substring(0,10) + "T00:00:00.000";		
			}
			options.streamFilterRegridTimeRange = a + "/" + b;
		}
	}

	if (options.streamFilterRegridTimeRange.split("/")[0].match(/\.[0-9]{4,}/)) {
		console.log("Greater than ms precision requested.")
	}
		
	var START = new Date(options.streamFilterRegridTimeRange.split("/")[0]);
	var STOP  = new Date(options.streamFilterRegridTimeRange.split("/")[1]);
	
	var j     = 0;
	var lineg = "";
	var Ng    = 0;
	var xg    = 0;
	var tg    = 0;

	var ti = START.getTime();
	var tf = STOP.getTime();
	var N  = Math.floor((tf-ti)/dt); 
	var Np = datas.length;
				
	console.log("START = " + START);
	console.log("STOP  = " + STOP);
	console.log("ti    = "+ti);
	console.log("tf    = "+tf);
	console.log("tf-ti = "+(tf-ti)/dt);
	console.log("N     = "+N);
	console.log("Np    = "+Np);

	var tx = ti-dt;	

	for (i = 0;i<N;i++) {
		Ng = 0;
		xg = 0;
		tx = tx+dt;
		tg = new Date(tx).toISOString();
		line = datas[j].split(/\s+/g);
		console.log("Previous boundary >= " + new Date(tx));
		console.log("Next boundary      < " + new Date(tx+dt));
		while (new Date(line[0]).getTime() < tx+dt) {
		    xg = xg+line[1];
		    Ng = Ng+1;
	
			console.log("Using datum in " + line);

			j = j+1;
			line = datas[j].split(/\s+/g);
		}
		
		if (Ng > 0) {
			xg = xg/Ng;
		} else {
			xg = NaN;
		}
		lineg = lineg + tx + " " + xg + "\n";

	}

//	console.log(lineg)
	return lineg;
}