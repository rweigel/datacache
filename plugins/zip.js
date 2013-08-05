var request = require("request");
var util    = require("../util.js");
var async   = require("async");
var AdmZip = require('adm-zip');
var fs  	= require("fs");
var mkdirp 	= require("mkdirp");

var urlRegx = /(.*\.zip)(.+)/i;

exports.name  = "zip";

exports.match = function (url) {
	return urlRegx.test(url);
}

exports.preprocess = function (work, callback) {callback(false, work)};

exports.process = function (work, callback) {
	var matches = work.url.match(urlRegx);
	work.zipFileUrl = matches[1];
	work.filePathInZip = matches[2];

	var filepath = util.getZipCachePath(work);
	var unzippath = filepath + '.content';
	var body;
	
	if (work.options.forceUpdate || !util.isZipCached(work)) {
		async.series([
			downloadZip,
			getFileFromZip
		], function(err){
			if(err){
				work.error = err;
			} else {
				work.body       = body || "";
				work.dataBinary = work.extractDataBinary(work.body, "bin");
				work.data       = work.extractData(work.body, work.options);
				work.dataMd5    = util.md5(work.data);
				work.dataJson   = work.extractDataJson(work.body, work.options);
				work.datax      = work.extractRem(work.body, work.options);
				work.meta       = work.extractMeta(work.body, work.options);
				work.metaJson   = work.extractMetaJson(work.body, work.options);
			}
			return callback(work.error, work);
		});
	} else {
		return callback(work.error, work);
	}

	// download and extract zip file
	function downloadZip(done){
		util.download(work.zipFileUrl, function(err, data){
			if(err){return done(err)};
			var dirpath = util.getCacheDir(work);
			mkdirp(dirpath, function(err){
				if(err){return done(err)};
				fs.writeFile(filepath, data, function(err){
					var zip  = new AdmZip(filepath);
					zip.extractAllTo(unzippath , /*overwrite*/true);
					done(err);

				});
			});
		})
	}

	// get file from unzipped folder
	function getFileFromZip(done){
		fs.readFile(unzippath + work.filePathInZip, function(err, data){
			if(err){return done(err)};
			body = data;
			done(err);

		})
	}
};
