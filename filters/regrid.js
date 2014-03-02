x  = [1,1,1,1,1,1];
t  = ['2010-01-01T00:00:00.000Z','2010-01-01T00:00:01.000Z','2010-01-01T00:04:00.000Z','2010-01-01T00:05:00.000Z','2010-01-01T00:06:00.000Z'];

// If no timeRange given, assume that the grid should be from
// 00:00:00.000 of the first date to 00:00:00.000 of the day after the last date.
timeRange = "";
if (timeRange === "") {
	a = t[0].substring(0,10) + "T00:00:00.000"
	b = new Date(new Date(t[t.length-1].substring(0,10)).getTime()+24*60*60*1000).toISOString().substring(0,10) + "T00:00:00.000"
	timeRange = a + "/" + b;
}

var timeRange = '2010-01-01T00:00:00.0000Z/2010-01-01T00:00:20.000Z';
var dt        = 1000;

// TODO: This program assumes dt is in milliseconds, which is the highest precision possible.
// Support can be added for higher resolutions by adding determining the number of fractional microseconds
// and adding this each time getTime() is called.

if (timeRange.split("/")[0].match(/\.[0-9]{4,}/)) {
	console.log("Greater than ms precision.")
}

var tg = [];
var xg = [];
var Ng = [];

var START = new Date(timeRange.split("/")[0]);
var STOP  = new Date(timeRange.split("/")[1]);

var ti = START.getTime();
var tf = STOP.getTime();

var N  = Math.floor((tf-ti)/dt); 

console.log("ti = "+ti+" tf = "+tf+" tf-ti = "+(tf-ti)/dt);
console.log("N = "+N);

tx = ti-dt;

j = 0;
for (i = 0;i < N;i++) {
	Ng[i] = 0;
	xg[i] = 0;
	tx = tx+dt;
	tg[i] = new Date(tx).toISOString();

	//console.log(tx + " " + tf)
	if (ti > tf) {
		xg[i] = NaN;
	}
	while (new Date(t[j]).getTime() < tx+dt) {
	    xg[i] = xg[i]+x[j];
	    Ng[i] = Ng[i]+1;
	    if (j == t.length) {
	        break;
  		}
	    j = j+1;
	}

	if (Ng[i] > 0) {
		xg[i] = xg[i]/Ng[i];
	} else {
		xg[i] = NaN;
	}  
}
console.log(x)
console.log(t)
console.log(xg)
console.log(tg)

N = 5;
x = [1,1,1,1,1,1];
t = [0,1,3,4,5,6];
j = 0;
var tg = [];
var Ng = [];
var xg = [];
for (i = 0;i < N;i++) {
	tg[i] = i;
	Ng[i] = 0;
	xg[i] = 0;
  	while (t[j] <= tg[i]) {
	    xg[i] = xg[i]+x[j];
	    Ng[i] = Ng[i]+1;
	    if (j == t.length) {
	        break;
  		}
	    j = j+1;
	}

	if (Ng[i] > 0) {
		xg[i] = xg[i]/Ng[i];
	} else {
		xg[i] = NaN;
	}  
}
console.log(x)
console.log(t)
console.log(xg)
console.log(tg)
