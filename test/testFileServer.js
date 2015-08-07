
// Test files
app.get("/test/changingfile.txt", function (req,res) {
	var date = new Date();
    var str = date.getFullYear() + " " + date.getMonth() + " " + 
    			date.getDate() + " " + date.getHours() + " " + 
    			date.getMinutes() + " " + date.getSeconds();
	res.send(str)
})

// Delay serving files to test stream ordering. 
app.get("/test/data-stream/bou20130801vmin.min", function (req,res) {
	setTimeout(function () {
		res.send(fs.readFileSync("test/data-stream/bou20130801vmin.min"))},0);
})
app.get("/test/data-stream/bou20130802vmin.min", function (req,res) {
	setTimeout(function () {
		res.send(fs.readFileSync("test/data-stream/bou20130802vmin.min"))},0);
})
app.get("/test/data-stream/bou20130803vmin.min", function (req,res) {
	setTimeout(function () {
		res.send(fs.readFileSync("test/data-stream/bou20130803vmin.min"))},Math.round(100*Math.random()));
})
app.get("/test/data-stream/bou20130804vmin.min", function (req,res) {
	setTimeout(function () {
		res.send(fs.readFileSync("test/data-stream/bou20130804vmin.min"))},Math.round(100*Math.random()));
})
app.get("/test/data-stream/bou20130805vmin.min", function (req,res) {
	setTimeout(function () {
		res.send(fs.readFileSync("test/data-stream/bou20130805vmin.min"))},Math.round(100*Math.random()));
})
