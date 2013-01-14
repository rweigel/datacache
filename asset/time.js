function doy(y,m,d) {

	if (typeof(doy.cache) != 'object') {
		doy.cache = new Object();
	}
	if (doy.cache[y.toString()+m.toString()+d.toString()]) {
		return doy.cache[y.toString()+m.toString()+d.toString()];
	}
		
	isleap = new Date(y,1,29).getMonth() == 1;

	if (isleap) {
		var days = [0,31,60,91,121,152,182,213,244,274,305,335];
	} else {
		var days = [0,31,59,90,120,151,181,212,243,273,304,334];
	}
	var DOY = d;
	for (var i = 0; i < m; i++) {DOY = DOY + days[i];}

	doy.cache[y.toString()+m.toString()+d.toString()] = DOY;
	
	return DOY;	
}

function soy(y,m,d,h,mn,s) {

	if (typeof(y) === "string") {
		if (1) {
			str = y.replace(/\s+/g,' ').split(' ');
			m = parseInt(str.slice(0)[0]);
			d = parseInt(str.slice(1)[0]);
			y = parseInt(str.slice(2)[0]);
			h = parseInt(str.slice(3)[0]);
			mn = parseInt(str.slice(4)[0]);
			s = parseFloat(str.slice(5)[0]);
			str = str.slice(6).toString().replace(/,/g,' ');
		}
		if (0) {
			y = parseInt(str.slice(0)[0]);
			m = parseInt(str.slice(1)[0]);
			d = parseInt(str.slice(2)[0]);
			h = parseInt(str.slice(3)[0]);
			mn = parseInt(str.slice(4)[0]);
			s = parseInt(str.slice(5)[0]);
			str = str.slice(6).toString().replace(/,/g,' ');
		}
	}

	if (typeof(soy.cache) != 'object') {
		soy.cache = new Object();
	}
	if (soy.cache[y.toString()+m.toString()+d.toString()]) {
		SOY = 3600*24*(soy.cache[y.toString()+m.toString()+d.toString()]-1)+h*3600+mn*60+s;
		if (str != null) {
			return SOY.toString() + " " + str;
		} else {
			return SOY;
		}
	}
	soy.cache[y.toString() + m.toString() + d.toString()] = doy(y,m,d);

	SOY = 3600*24*(soy.cache[y.toString() + m.toString() + d.toString()]-1)+h*3600+mn*60+s;
	if (str != null) {
		return SOY.toString() + " " + str;
	} else {
		return SOY;
	}
}
exports.soy = soy;