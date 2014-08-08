// gcc getgzipfilename.c -o getgzipfilename
// node embedGzFilename.js
// getgzipfilename a.node.gz

var zlib = require("zlib");
var fs = require('fs');
var util = require('util');
var stream = require('stream');

function embedFileName(data, fileName){
	fileName += '\0'; 
	var buff = new Buffer(data.length + fileName.length);

	data.copy(buff, 0, 0, 10);

	// set the flag to indicate that file name is included
	buff[3] |= 1<<3 ;

	buff.write(fileName, 10);

	data.copy(buff, 10+fileName.length, 10);

	return buff;
}

function Embeder(fileName) {
	this.fileName = fileName;
	stream.Duplex.call(this);
}

util.inherits(Embeder, stream.Duplex);

Embeder.prototype._read = function(size){}

Embeder.prototype._write = function(chunk, encoding, callback){
	console.log('write', chunk, chunk.length, chunk[0] == 31, chunk[1] == 139)
	if(chunk.length >= 10 && chunk[0] == 31 && chunk[1] == 139){
		this.buff = embedFileName(chunk, this.fileName);
		console.log(this.buff);
	} else {
		this.buff = chunk;
	}
	if(this.buff){
		this.push(this.buff);
		this.buff = undefined;
	}
	callback();
}


var gzip = zlib.createGzip();
var inp = fs.createReadStream('a');
var out = fs.createWriteStream('a.node.gz');
var embeder = new Embeder('a.node.gz');

inp.pipe(gzip).pipe(embeder).pipe(out);