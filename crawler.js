/*
 * Advertiser compliance spider
 * @author Oren Shepes <oren@advertise.com>
 * @since 2/17/16
 * 
 * File: crawler.js
 * Run: casperjs --ignore-ssl-errors=true [options] crawler.js
 * 
 * Options:
 * --feed={feed} feed file name
 * --delim={delimiter} delimiter character for feed parsing (def: ",")
 * --logfile={logfile} log file name
 * --ua_help print available user-agent options
 * --ua={UA_KEY} use specified user-agent (ex: --ua=Chrome41/Win7)
 * 
 * User-agents are configured in includes/useragents.js
 * 
 * Features:
 * - Capture screenshot of violating lander (JS Alerts)
 * - Checks for JS Alerts (JS Pop)
 * - Checks for Overlays (planned)
 * - Checks for download dialogs triggers (planned)
 * - Checks for 404/500 errors
 * 
 * Feed: default data/feed.csv otherwise read from --feed=FEED option on CLI, 
 * feed has to be present under `data` directory
 * 
 * TODO: connect to data sources via an API (pull/push)
 */


phantom.injectJs('includes/useragents.js');
phantom.injectJs('includes/screen.js');
phantom.injectJs('includes/rackspace.js');

var fs          = require("fs");
var dump        = require('utils').dump;
var util        = require('util');
var ua          = '';

// default feed config
var feed        = 'data/feed.csv';
var delim       = ",";
var log_delim   = "|";

// casper config
var casper = require("casper").create({
    clientScripts: [
        'includes/jquery.js',       // These two scripts will be injected in remote
        'includes/underscore.js'    // DOM on every request
    ],
    pageSettings: {
        loadImages: false,          // The WebPage instance used by Casper will
        loadPlugins: false          // use these settings
    },
    userAgent: userAgents[userAgents.length-1],
    verbose: false,
    logLevel: 'error',
    exitOnError: false,
    onAlert: handleAlert,
    onLoadError: handleLoadError,
});

// user agents object
casper.userAgents = userAgents;

// set script options
var logfile = getLogfile();
feed        = casper.cli.options.feed ? 'data/' + casper.cli.options.feed : feed;
logfile     = casper.cli.options.logfile ? 'logs/' + casper.cli.options.logfile : logfile;
delim       = casper.cli.options.delim || delim;
log_delim   = casper.cli.options.log_delim || log_delim;
ua          = casper.cli.options.ua ? casper.cli.options.ua : 'Chrome41/Win7'; 

// report header
fs.write(logfile, util.format("%s %s %s %s %s %s %s %s %s %s %s %s %s\n", 
'Account ID', log_delim, 'Campaign ID', log_delim, 'Campaign Name', log_delim, 'Error Type', log_delim, 'Message', log_delim, 'URL', log_delim, 'Screenshot'), 'a');

// switch for user-agents menu
if(casper.cli.options.hasOwnProperty("ua_help")) {
    var i = 1;
    casper.echo("Available User-Agents (includes/useragents.js):");
    casper.echo("-----------------------------------------------");
    for(var u in userAgents) {
        casper.echo(util.format('%d) %s: %s', i++, u, userAgents[u]));
    }
    casper.echo("");
    casper.echo("casperjs --ignore-ssl-errors=true --feed=feed.csv crawler.js --ua={UA_KEY}");
    casper.echo("");
    casper.exit();
}

casper.echo("-----------Casper Conf-----------");
casper.echo("Using feed: " + feed);
casper.echo("Delimiter: " + delim);
casper.echo("Logfile: " + logfile);
casper.echo("---------------------------------");
casper.echo("Starting ...");


// Main
var urls    = getData(feed);
crawl(ua, urls);


// crawl
function crawl(ua_key, urls) {
    // url counter
    var i = 0;
        
    // start casper engine
    casper.start();
    casper.userAgent(casper.userAgents[ua_key]);
   
    casper.eachThen(urls, function eachUrl(res) {
        var parts   = res.data.split(delim);
        var url     = parts[parts.length-1];
        var aid     = parts[0];
        var cid     = parts[1].replace(/\s+/g,"_").replace(/\//g, "."); 
        var cname   = parts[2].replace(/\s+/g,"_").replace(/\*/g,'').replace(/\//g, "_");
        var f       = util.format('%s_%s_%s', aid, cid, cname);
        var remote_img  = util.format('%sscreenshots/%s_%s_%sx%s.png', rackspace.CDN_IMG_HOST, f, ua_key.replace(/\//g, "."), screen._width, screen._height);
        
        casper.campaign = {"aid": aid, "cid": cid, "cname": cname, "remote_img": remote_img};
              
        casper.thenOpen(url, function openUrl(res) {
            // skip header line
            if(i !== 0) {
                this.echo(util.format('%d) %s: %s [%s]', i, ua_key, res.url, res.status));        
                var file    = util.format('%s_%s_%s', aid, cid, cname);
                var loc_img = util.format('screenshots/%s_%s_%sx%s.png',file, ua_key.replace(/\//g, "."), screen._width, screen._height);
                                
                this.capture(loc_img, {
                    top: screen._top,
                    left: screen._left,
                    width: screen._width,
                    height: screen._height
                });
               
                this.on('http.status.404', function is404() {
                    fs.write(logfile, util.format("%s %s %s %s %s %s %s %s %s %s %s %s %s\n", aid, log_delim, cid, log_delim, cname, log_delim, '404 Error', log_delim, '404 Error', log_delim, url, log_delim, casper.campaign.remote_img), 'a');
                });

                this.on('http.status.500', function is500() {
                    fs.write(logfile, util.format("%s %s %s %s %s %s %s %s %s %s %s %s %s\n", aid, log_delim, cid, log_delim, cname, log_delim, '500 Error', log_delim, '500 Error', log_delim, url, log_delim, casper.campaign.remote_img), 'a');  
                });
            } i++;
        }, logfile, screen, url, aid, cid, cname, ua_key, log_delim)
        
    }, ua_key, casper, userAgents)
           
    // run casper
    casper.run(function() {
        this.echo("Done").exit();
    });
} // crawl


// onAlert handler
function handleAlert(casper, msg) {
    var url = casper.getCurrentUrl();
    fs.write(logfile, util.format("%s %s %s %s %s %s %s %s %s %s %s %s %s\n", casper.campaign.aid, log_delim, casper.campaign.cid, log_delim, casper.campaign.cname, log_delim,
            'JS Alert (Pop)', log_delim, msg.replace(/\*/g,'').replace(/\r\n|\n|\r/gm,' ').replace(',',''), log_delim, url, log_delim, casper.campaign.remote_img), 'a');  
}

// onLoadError handler
function handleLoadError(casper, msg) {
    var url = casper.getCurrentUrl();
    fs.write(logfile, util.format("%s %s %s %s %s %s %s %s %s %s %s %s %s\n", casper.campaign.aid, log_delim, casper.campaign.cid, log_delim, casper.campaign.cname, log_delim, 
            'Resource Load Error', log_delim, 'Unavailable', log_delim, url, log_delim, casper.campaign.remote_img), 'a');
}

// getData
function getData(feed, delim) {
    var urls = []; 
    stream = fs.open(feed, 'r');
    line = stream.readLine();
    urls.push(line);
    while(line) {
        line = stream.readLine();
        var parts = line.split(delim);
        if(parts[parts.length-1]) {
            urls.push(line); 
        }
    }
    return urls;
}

// getLogfile
function getLogfile() {
    var now     = new Date();
    var month   = now.getMonth() + 1;
    var day     = now.getDate();
    var year    = now.getFullYear();
    var logfile = util.format('logs/%s-%s-%s.csv', month, day, year);
    return logfile;
}