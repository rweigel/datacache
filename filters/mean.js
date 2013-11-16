exports.filterSignature = function(options) {
	return options.streamFilterComputeWindow + "mean";
}

exports.mean = function mean(datas) {

	//console.log(datas)
	
	var datas = datas.split(/\n/g);
	var datax = [];
	var i = 0;
	var j = 0;
	var k = 0;

	var data = datas[0].split(/\s+/g);
	
	datax[0] = new Date(data[0]).getTime();
	for (j = 1;j<data.length;j++) {
		datax[j] = parseInt(data[j]);
	}
	
	for (i = 1;i<datas.length;i++) {
		data = datas[i].split(/\s+/g);

		var ms = new Date(data[0]).getTime();
		//console.log(ms);

		datax[0] = datax[0] + ms;
		for (j = 1;j<data.length;j++) {
			datax[j] = datax[j] + parseInt(data[j]);
		}
		//console.log(datax)
	}

	for (j = 0;j<data.length;j++) {
		datax[j] = datax[j]/i;
	}

	datax[0] = new Date(datax[0]).toISOString();
	return datax.join(" ")+"\n";

}