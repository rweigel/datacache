function formatboolean(b) {
	return b.toString().replace('false','f').replace('true','t')
}
function formatlength(l,w) {

	ls = l.toString().replace("-1","x")
	lsl = ls.length;
	while (lsl < w) {
		ls = " " + ls;
		lsl = ls.length;
	}
	return ls
}

function formaterror(e) {
	if (arguments.length > 1) {
		e = e.toString().replace('false','false.');
		return e;
	}

	e = e.toString().replace('false','f').replace('true','t');
	if (e.length > 1) { 
		e = "t";
	}
	return e
}

function computewidth(start,stop,type) {
	return (computetime(start,stop,1))/10.0;
}


function computetime(start,stop,type) {
	if (start == 0 || stop == 0) {
		return "&nbsp;&nbsp;-";
	}
	start = new Date(start);
	stop = new Date(stop);
	time = stop-start;
	if (type == 1) return time;
	time = sprintf("%3s",time.toString());
	return time.replace(/ /g,'&nbsp;');
}

function report() {

	var DOMLoadedTime = new Date();

	//ASYNC   = true;
	//DC      = [location.href.replace(/report.*/,'sync'),"http://datacache.org/dc/sync"];
	DC      = [location.href.replace(/report.*/,'sync')];

	// TODO: Create color array if not defined.
	colors  = ['red','blue','red','green','white']; // Need one color per server.
	
	var urls  = new Array();
	//console.log(querystr);
	urls    = querystr.replace(/.*source=(.*\s+)/,'$1').split("\n").filter(function(element){return element.length});
	//console.log(urls.length);
	//console.log("report.js: querystring length = " + querystr.length);
	if (urls.length == 0) {
		$('#error').show();
		$('#error').html('At least one URL must be specified.');
		$('#error').append('<a>Example</a>');
		$('#error a').attr('href',location.href + "?source=http://datacache.org/dc/demo/file1.txt%0Ahttp://datacache.org/dc/demo/file2.txt%0A");
		return;
	}

	if (servers) {		
		$.ajax({
			type: 'GET',
			async: false,
			url: DC[0].replace('/sync','/servers'), 
			success: function (data) {
				DC = $.unique(DC.concat(data));
			},
			error: function (err) {
				$("#error").text("Could not fetch list of available DataCache servers from http://datacache.org/dc/servers.");
			}
		});
	}

	
	var times = new Array();
	
	function tryurls(Nrun) {
		tic = new Date();
		z = 0;
		times[Nrun] = new Array();
		N = urls.length;

		console.log(N);
		console.log(querystr);
		options = querystr.replace(/source=.*[\s\S]*?$/g,'');
		options = options.replace(/\&.*=\&/g,'');
		console.log(options);
		console.log(querystr);
		console.log(urls);
		for (i = 0;i < DC.length;i++) {
			$('#wrapper').append("<div id='status'></div>".replace('status','status-'+i+""+Nrun));
			if (ASYNC) {
				msg = "<div class='note'>Sending " + N + " URLs (one-by-one ayncronously) to " + DC[i] + (options ? " with options " + options : "") + "</div>";
			} else {
				msg = "<div class='note'>Sending " + N + " URLs to (in one request) " + DC[i] + (options ? " with options " + options : "") + "</div>";
			}
			$('#status-'+i+""+Nrun).append(msg);
			if (ASYNC) {
				for (var j = 0;j < urls.length;j++) {
					getreport(DC[i] + "?"+options+"&source="+urls[j],i,Nrun,tic);
					console.log(urls[j]);	
					//summary(times);
				}						
			} else {
				console.log(querystr);
				rurl = DC[i] + "?"+querystr.replace(/\n/g,'%0A');
				console.log(rurl);
				getreport(rurl,i,Nrun,tic);
				summary(times);									
			}
		}
	}
	// Submit requests to each server in list.  When done, repeat.
	tryurls(0);
	
	// Histogram: http://jsfiddle.net/jlbriggs/9LGVA/3/
	function summary(times,callback) {
		//$('#summary').text("Times: " + times.toString() + "\n");
	}
	
	function getreport(url,i,Nrun,tic,callback) {
		
		$.ajax({
				type: 'GET',
				async: ASYNC,
				timeout: TIMEOUT,
				url: url, 
				success: 
					function (data) {

						toc = new Date();
						times[Nrun][i] = (toc-tic);
						z = z+1;
						//$('#status-'+i+""+Nrun).append(".  Total turn-around: "+(toc-tic)+" ms.");							

						if (typeof data != "object") {
							var template = $("#reportTemplate").html();
							status = template.replace('status','status-'+i+""+Nrun);
							
							console.log(url)
							console.log(data);							
							for (k = 0;k < data.length; k++) {
								console.log(data[k]);
								var report = $.tmpl(template,data[k]);							
								$('#status-'+i+""+Nrun).append(report);
							}
							//$('#status-'+i+""+Nrun+" img").css("background-color",colors[i]);

						} else {	
							
							var template = $("#reportTemplate").html();
							status = template.replace('status','status-'+i+""+Nrun);
							console.log(data);
							
							//console.log(data.length);
							for (var k = 0; k < data.length; k++) {
								data[k]["DOMLoadedTime"] = DOMLoadedTime;
								data[k]["requestStart"]  = tic;
								data[k]["requestFinish"] = toc;
								
							}
							var report = $.tmpl(template,data);							
							$('#status-'+i+""+Nrun).append(report);
						}

						tooltip('span');
						
						
						//if ((z == urls.length) & (Nrun == Nruns-1))
											
						if ((z == urls.length) & (Nrun < Nruns-1))
							tryurls(Nrun+1);
				},
				error: 
					function (request,status,errorThrown) {
											
						times[Nrun][i] = -1;
						z = z+1;
						console.log('here');
						if ((z == urls.length) & (Nrun == Nruns))
							summary(times);

						if ((z == urls.length) & (Nrun < Nruns))
							tryurls(Nrun+1);
						
						//$('#status-'+i+""+Nrun).html("AJAX GET request to DataCache failed <a href='" + url + "''>Request</a>.  Error: " + errorThrown);
					}
			});
	}
}