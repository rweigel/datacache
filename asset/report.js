function formatboolean(b) {
	return b.toString().replace('false','f').replace('true','t')
}

function computetime(start,stop,type) {
	if (start == 0 || stop == 0) {
		return "&nbsp;&nbsp;	-";
	}
	start = new Date(start);
	stop = new Date(stop);
	time = stop-start;
	if (type == 1) return time;
	time = sprintf("%4s",time.toString());
	return time.replace(/ /g,'&nbsp;');
}

function report() {
	source = "__SOURCE__";
	source = "ftp%3A%2F%2Fftp.sec.noaa.gov%2Fpub%2Flists%2Fxray%2F20121218_Gp_xr_5m.txt%0D%0A%0D%0Aftp%3A%2F%2Fftp.sec.noaa.gov%2Fpub%2Flists%2Fxray%2F20121219_Gp_xr_5m.txt%0A";
	source = "http://datacache.org/dc/demo/file1.txt%0Ahttp://datacache.org/dc/demo/file2.txt";
	source = source + "%0A" + source;
	//source = "ftp%3A%2F%2Fftp.sec.noaa.gov%2Fpub%2Flists%2Fxray%2F20121218_Gp_xr_5m.txt%0D%0A%0D%0Aftp%3A%2F%2Fftp.sec.noaa.gov%2Fpub%2Flists%2Fxray%2F20121219_Gp_xr_5m.txt%0A";

	Nruns   = 3;
	servers = true; // Get additional servers from /servers
	TIMEOUT = 1000;
	DC      = [location.href.replace(/report.*/,'sync'),"http://datacache.org/dc/sync"];

	// TODO: Create color array if not defined.
	colors  = ['red','blue','red','green','white']; // Need one color per server.
	
	if (source.length == 0) {
		$('#error').html('Append ?source=URLlist to URL to generate report. ');
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

	var urls = new Array();
	var times = new Array();
	
	function tryurls(Nrun) {
		tic = new Date();
		z = 0;
		times[Nrun] = new Array();
		N = source.split("%0A").length;
		for (i=0;i<DC.length;i++) {
		
			urls[i]  = DC[i] + "?forceUpdate=false&source="+source;
			$('#wrapper').append("<div id='status'></div>".replace('status','status-'+i+""+Nrun));
			//$('#status-'+i+""+Nrun).css('background-color',colors[i]);
			$('#status-'+i+""+Nrun).append("Sending " + N + " URLs to " + urls[i].replace(/\?.*/,''));
			//console.log($('#status-'+i+""+Nrun).text());
			getreport(urls[i],i,Nrun,tic);

			//console.log(DC[0]);
		}
	}
	
	// Submit requests to each server in list.  When both are done,
	// repeat.
	tryurls(0);
	
	function getreport(url,i,Nrun,tic) {
		var template = $("#reportTemplate").html();
		status = template.replace('status','status-'+i+""+Nrun);
		//console.log(template);
		
		// Histogram:
		// http://jsfiddle.net/jlbriggs/9LGVA/3/
		function summary(times) {
			$('#summary').text("Times: " + times.toString() + "\n");
		}
		
		$.ajax({
				type: 'GET',
				async: true,
				timeout: TIMEOUT,
				url: url, 
				success: 
					function (data) {
						toc = new Date();
						times[Nrun][i] = (toc-tic);

						z = z+1;
						$('#status-'+i+""+Nrun).append(".  Total turn-around: "+(toc-tic)+" ms.");							
						var report = $.tmpl(template,data);							
						$('#status-'+i+""+Nrun).append(report);
						$('#status-'+i+""+Nrun+" img").css("background-color",colors[i]);
						$('img').eq(0).position()['left']
						tooltip('span');
						
						if ((z == urls.length) & (Nrun == Nruns))
							summary(times);					
						if ((z == urls.length) & (Nrun < Nruns))
							tryurls(Nrun+1);
				},
				error: 
					function (request,status,errorThrown) {
					
						times[Nrun][i] = -1;
						z = z+1;
						    						
						if ((z == urls.length) & (Nrun == Nruns))
							summary(times);
						if ((z == urls.length) & (Nrun < Nruns))
							tryurls(Nrun+1);
						$('#status-'+i+""+Nrun).html("AJAX GET request to DataCache failed <a href='" + url + "''>Request</a>.  Error: " + errorThrown);
					}
			});
	}
}