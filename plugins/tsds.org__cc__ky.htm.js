var FtpClient  = require("ftp"),
    util = require("../util"),
    logger = require("../logger");

var moment = require("moment");
var jsdom = require("jsdom");
var jquery = require("jquery");

exports.name = "tsds.org/cc/ky.htm";

exports.match = function(url){
    logger.d("url")
    logger.d("matched with tsds plugin " + url.split("/")[2].toLowerCase()==="tsds.org")
    return url.split("/")[2].toLowerCase()==="tsds.org";
}

exports.extractData = function(data, callback){
    var window = jsdom.jsdom(data).createWindow();
    var $ = jquery.create(window);

    var time = new Date("2012-01-01 00:30:00.00000");

    var rawData = $(".data")
                        .text()
                        .split("\n")
                        .filter(function(line){return line.search(/^[0-9]|^ [0-9]/)!=-1;})
                        .join("\n")
                        .replace(/\n[0-9]|^ [0-9]/g,'')
                        .replace(/\s{2,}/g," ");
    logger.d("rawData: "+rawData);
    var result = rawData.split(' ')
                    .map(function(number){
                        var ret = moment(time).format("YYYY-MM-DD HH:mm:ss.00000") + " " + number;
                        time = add30min(time);
                        return ret;
                    })
                    .join("\n");

    logger.d("result: " + result);
    return result;
}

function add30min(date){
    return new Date(date.getTime() + 30*60000);
}