// See also
// https://github.com/clmarquart/node-http-load-balancer
// http://sebastian.formzoo.com/2012/04/03/vost-simple-virtual-hosts-load-balancing-with-node-js/
// http://www.contentwithstyle.co.uk/content/nodejs-load-balancer-proof-of-concept/

http://dailyjs.com/2012/03/22/unix-node-processes/
http://stackoverflow.com/questions/2387724/node-js-on-multi-core-machines
http://stackoverflow.com/questions/10663809/how-do-i-use-node-js-clusters-with-my-simple-express-app
http://nodejs.org/docs/latest/api/all.html#all_cluster

A request comes in for
server0/async?source=url1\nurl2

If forceUpdate=true, the scheduler sends a request to 
server1/async?source=url1
server2/async?source=url2
server1/async?source=url1
server2/async?source=url2
..

The user receives the response and it contains the location at which the file was actually cached. 

If forceUpdate=false, async requests are made to all servers for all URLs.  The user gets back the work object from the first responding server with foundInCache=true for each work object.  The user can now grab the files from fast responding servers with cached data.  (I am assuming here that the response time of the server for the work object is correlated with file download time.)

Now that I write this, I realize that this won't have an impact on the scheduler.
It can be implemented by modifying only app.js.  Something like this for forceUpdate=false

userthisserver = false;
responses  = new Array();
badservers = new Array();
z = 0;
var Ns = 0;
var Nb = 0;
var Nu = urls.length;
var deltaT = 0;
var deltaTl = 0;
tic = new Date();
fs.readFile(__dirname+"/servers.txt", "utf8",                                                                                
                function (err, data) {
                         servers = data.split('\n').filter(function(element){return element.length});
                         servers = autotune(servers);

                         if (Ns == 0) usethisserver = true;
                         if (usethisserver) servers.shift(request.headers.host);

                         // Once through to remove bad servers.
                         for (i =0;servers.length;i++) {dorequest(server[i],url[i],i,runall)}}
                         function runall() {
                            Ns = servers.length;
                            for (i =0;i<urls.length;i++) {dorequest(server[mod(i,Ns)],url[mod(i,Ns)],i,checkfinish)}}
                         }
)

function autotune(servers,z) {
  // Look at serverreport.txt and find lines with url hostname, this server hostname, remote server hostname.
  // If one server is much faster than the others, insert it into the list of servers again.
  // If all servers near equal, do nothing.
  // If no url hostname, this server hostname, remoteserver hostname matches, look for matches to 
  // server hostname, remoteserver hostname.
  // Base decision for how many to keep on z/Nu.
}

function serverreport() {
  // Read serverreport.txt and update
  // Save url hostname, url prefix, this server hostname, remote server hostname, average time per request
}

function checkfinished(z) {

  serverreport();
  if (z == Nu) {
     res.send(responses);
  }

  toc = new Date();
  deltaTl = deltaT;
  deltaT = (toc-tic);
  if (deltaT > deltaTl) maxdeltaT = deltaT

  // Some servers are slow.  Fire off more requests!  
  if ((z == Math.floor(Nu/2) && (Nu > 4) && (deltaT > 2*maxdeltaT)) {

     servers = autotune(serversF,z);

     // Remove finished URLs
     urls = removefinished(urls);

     // Should we send req.end() to slow responders?
     for (i =0;i<urls.length;i++) {dorequest(serverR[mod(i,Ns)],urls[mod(i,Ns)],i,checkfinished)}}
   }

  if (Nb == Ns) {
     if (usethisserver == false) {
         usethisserver=true;
         for (i =0;i<urls.length;i++) {dorequest(request.headers.host,url[i],i,callback)}}
     } else {
        res.send(400,"Cannot fulfill request.");
     }
   }
}

function dorequest(server,url,i, callback)  {
   if (response[i]) callback;return; // request already fulfilled.
   var request = require('request');
   tic = new Date();

   // Option to switch to server with the fastest response thus far?

   request(server+"/async?source="+url, function (error, response, body) {
       if (error && callback == runall ) {Nb = Nb+1;servers.remove(i);}
       if (!error && response.statusCode == 200) {
          responses[z] = parseJSON(body)[0];
          times[server] = (toc-tic);
          z=z+1;
     }
     callback;
)
}
    