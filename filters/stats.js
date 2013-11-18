exports.filterSignature = function(options) {
	return options.streamFilterComputeWindow + options.streamFilterComputeFunction;
}

exports.stats = function stats(datas,options) {

	var datas = datas.split(/\n/g);
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

	var data = datas[0].split(/\s+/g);

	if (options.streamFilterExcludeColumnValues.match(",")) {
		excludeso = options.streamFilterExcludeColumnValues.split(",");
		for (j = 0;j<data.length-1;j++) {
			excludes[j] = parseFloat(excludeso[j]);
		}	
	} else {
		for (j = 0;j<data.length-1;j++) {
			excludes[j] = parseFloat(options.streamFilterExcludeColumnValues);
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
	for (i = 1;i<datas.length;i++) {

		data = datas[i].split(/\s+/g);
		t  = t + new Date(data[0]).getTime()

		for (j = 1;j<data.length;j++) {
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

	for (j = 1;j<data.length;j++) {
		if (Nvalid[j-1] > 0) {
			datastd[j-1] = (datastd[j-1]-(dataave[j-1]*dataave[j-1]/Nvalid[j-1]))/Nvalid[j-1];
			dataave[j-1] = dataave[j-1]/Nvalid[j-1];
		} else {
			dataave[j-1] = excludes[j-1];
			datastd[j-1] = excludes[j-1];
		}
	}

	t = new Date(t/datas.length).toISOString();

	//console.log(datastd.join(" "));
	if (options.streamFilterComputeFunction.match(/stats/)) {
		return t+" "+dataave.join(" ")+" "+datastd.join(" ")+" "+datamax.join(" ")+" "+datamin.join(" ")+" "+Nvalid.join(" ")+"\n";
	}
	if (options.streamFilterComputeFunction.match(/max/)) {
		return t+" "+datamax.join(" ")+"\n";
	}
	if (options.streamFilterComputeFunction.match(/min/)) {
		return t+" "+datamin.join(" ")+"\n";
	}
	if (options.streamFilterComputeFunction.match(/mean/)) {
		return t+" "+dataave.join(" ")+"\n";
	}
	if (options.streamFilterComputeFunction.match(/std/)) {
		return t+" "+datastd.join(" ")+"\n";
	}
	if (options.streamFilterComputeFunction.match(/Nvalid/)) {
		return t+" "+Nvalid.join(" ")+"\n";
	}
}