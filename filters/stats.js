var log = require("../log.js")

exports.filterSignature = function (options) {
	return options.streamFilterWriteComputeFunctionWindow + options.streamFilterComputeFunction;
}

exports.stats = function stats(datas, options) {

	var datas   = datas.split(/\n/g);
	var dataave = [];
	var datastd = [];
	var datamax = [];
	var datamin = [];
	var Nvalid  = [];

	var i = 0;
	var j = 0;
	var tmp;
	var t;

	var exludeso = [];
	var excludes = [];

	var config = options.config

	var data = datas[0].split(/\s+/g);

	if (options.debuglinefilterconsole) {
		log.logres("stats.js: # rows input = "+datas.length, config)
	}
	if (options.debuglinefilterconsole) {
		log.logres("stats.js: # cols in first row = "+data.length, config)
	}

	if (options.streamFilterWriteComputeFunctionExcludes.match(",")) {
		excludeso = options.streamFilterWriteComputeFunctionExcludes.split(",");
		for (j = 0;j < data.length-1;j++) {
			excludes[j] = parseFloat(excludeso[j]);
		}	
	} else {
		// Use same exclude value for all columns if only one was given.
		for (j = 0;j < data.length-1;j++) {
			excludes[j] = parseFloat(options.streamFilterWriteComputeFunctionExcludes);
		}		
	}
	
	// Set values for first row.
	for (j = 1;j<data.length;j++) {
		tmp   = parseFloat(data[j]);
		Nvalid[j-1] = 0.0;
		if (tmp != excludes[j-1]) {
			dataave[j-1] = tmp;
			datamax[j-1] = tmp;
			datamin[j-1] = tmp;
			datastd[j-1] = tmp*tmp;
			Nvalid[j-1]  = Nvalid[j-1] + 1.0;
		} else {
			dataave[j-1] = 0.0;
			datastd[j-1] = 0.0;
		}
	}
	
	// Set first timestamp to be first column of first row.	
	t  = new Date(data[0]).getTime();

	// Iterate over all rows except first.
	for (i = 1;i < datas.length;i++) {

		if (options.debuglinefilterconsole) {
			log.logres("stats.js: datas[i] = " + datas[i], config)
		}

		data = datas[i].split(/\s+/g);
		t  = t + new Date(data[0]).getTime()

		// Iterate over all columns except first
		for (j = 1;j < data.length;j++) {
			tmp = parseFloat(data[j]);			
			if (tmp != excludes[j-1]) {
				if (tmp > datamax[j-1]) {
					datamax[j-1] = tmp;
				}
				if (tmp < datamin[j-1]) {
					datamin[j-1] = tmp;
				}
				dataave[j-1] = dataave[j-1] + tmp;
				datastd[j-1] = datastd[j-1] + tmp*tmp;
				Nvalid[j-1]  = Nvalid[j-1] + 1.0;
			}
		}
	}

	for (j = 1;j < data.length;j++) {
		if (Nvalid[j-1] > 0) {
			datastd[j-1] = (datastd[j-1]-(dataave[j-1]*dataave[j-1]/Nvalid[j-1]))/Nvalid[j-1];
			dataave[j-1] = dataave[j-1]/Nvalid[j-1];
		} else {
			dataave[j-1] = excludes[j-1];
			datastd[j-1] = excludes[j-1];
		}
	}

	t = new Date(t/datas.length).toISOString();

	if (options.streamFilterWriteComputeFunction.match(/stats/)) {
		ret = t+" "+dataave.join(" ")+" "+datastd.join(" ")+" "+datamax.join(" ")+" "+datamin.join(" ")+" "+Nvalid.join(" ")+"\n";
	}
	if (options.streamFilterWriteComputeFunction.match(/max/)) {
		ret = t+" "+datamax.join(" ")+"\n";
	}
	if (options.streamFilterWriteComputeFunction.match(/min/)) {
		ret = t+" "+datamin.join(" ")+"\n";
	}
	if (options.streamFilterWriteComputeFunction.match(/mean/)) {
		ret = t+" "+dataave.join(" ")+"\n";
	}
	if (options.streamFilterWriteComputeFunction.match(/std/)) {
		ret = t+" "+datastd.join(" ")+"\n";
	}
	if (options.streamFilterWriteComputeFunction.match(/Nvalid/)) {
		ret = t+" "+Nvalid.join(" ")+"\n";
	}
	if (options.debuglinefilterconsole) {
		log.logres("stats.js: returning " + ret, config)
	}
	return ret
}