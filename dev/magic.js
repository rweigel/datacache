
if (0) {
Magic = mmm.Magic;
var magic = new Magic(mmm.MAGIC_MIME_TYPE);
app.use(function(req, res, next) {
	fs.exists(__dirname + req.path, function (exists) {
		if (!exists) {
			next()
			return
		}
		magic.detectFile(__dirname + req.path, function (err, result) {
			if (!err) {
				res.contentType(result)
			} else {
				console.log(new Date().toISOString() + " [datacache] Could not determine content type of " + req.path)
			}
			next()
		})
	})
})
}
