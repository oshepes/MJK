/*
 * Advertiser compliance spider
 * @author Oren Shepes <oren@advertise.com>
 * @since 2/17/16
 * @link http://dashboard.advertise.com/display/PROD/Advertiser+Compliance+Toolkit
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
 * --src={db|file} feed data source 
 * 
 * User-agents are configured in includes/useragents.js
 * 
 * Features:
 * - Capture screenshot of violating lander (JS Alerts)
 * - Checks for JS Alerts (JS Pop)
 * - Checks for Overlays 
 * - Checks for download dialogs triggers 
 * - Checks for 404/500 errors
 * 
 * Feed: default data/feed.csv otherwise read from --feed=FEED option on CLI, 
 * feed has to be present under `data` directory
 * 
 * TODO: connect to data sources via an API (pull/push)
 */


/* ----------------------------------- Main ----------------------------------- */

phantom.injectJs('includes/useragents.js');
phantom.injectJs('includes/screen.js');
phantom.injectJs('includes/rackspace.js');
phantom.injectJs('includes/detect.js');

var fs          = require("fs");
var dump        = require('utils').dump;
var util        = require('util');
var ua          = '';

// default feed config
var formatter   = "%s%s%s%s%s%s%s%s%s%s%s%s%s\n";
var lm_format   = "{date: \"%s\", url_count: \"%s\", errors: \"%s\", ua: \"%s\"},\n";
var feed        = 'data/feed.csv';
var delim       = ",";
var log_delim   = ",";
var lm_log      = 'logs/lm_log.txt';

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
    verbose: true,
    logLevel: 'error',
    exitOnError: false,
    waitTimeout: 2000,
    onAlert: handleAlert,
    onLoadError: handleLoadError,
});

// user agents object
casper.userAgents = userAgents;

// set script options
var logfile = getLogfile();
feed        = casper.cli.options.feed ? 'data/' + casper.cli.options.feed : feed;
logfile     = casper.cli.options.logfile ? 'logs/' + casper.cli.options.logfile : 'logs/' + logfile;
delim       = casper.cli.options.delim || delim;
log_delim   = casper.cli.options.log_delim || log_delim;
ua          = casper.cli.options.ua ? casper.cli.options.ua : 'Chrome41/Win7'; 
var src     = casper.cli.options.src ? casper.cli.options.src : 'file';
var detect  = casper.cli.options.detect ? casper.cli.options.detect : Object.keys(detect);

// truncate logger
try {
    if(fs.isFile(logfile)){
        fs.remove(logfile);
    }
} catch (e) {
    console.log(e);
}

// report header
fs.write(logfile, util.format(formatter, 'Account ID', log_delim, 'Campaign ID', log_delim, 'Campaign Name', log_delim, 'Error Type', log_delim, 'Message', log_delim, 'URL', log_delim, 'Screenshot'), 'a');

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
if(src === 'file') casper.echo("Using feed: " + feed);
else casper.echo("Using: DB");
casper.echo("Delimiter: " + delim);
casper.echo("Logfile: " + logfile);
casper.echo("---------------------------------");
casper.echo("Starting ...");

// error counter
casper.totalErrors = 0;
var urls = [];
   
// read/write feed
getData(feed, delim, src, function(res) {
    urls = res;
});

// check if we got data
if(urls.length < 1) console.log('Did not get any URLs to process, existing.');

// crawal
crawl(ua, urls);


/* ----------------------------------- Routines ----------------------------------- */

// crawl
function crawl(ua_key, urls) {
    
    var i = 1;
        
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
        
        casper.campaign = {"url": url, "aid": aid, "cid": cid, "cname": cname, "remote_img": remote_img};
              
        casper.thenOpen(url, function openUrl(res) {
            
            var errors = [];
            
            this.echo(util.format('%d) %s: %s [%s]', i++, ua_key, url, res.status));    
            this.currentResponse.headers.forEach(function(header){
                if(header.name === 'X-Frame-Options' && (header.value === 'SAMEORIGIN' || header.value === 'DENY')) {
                    if(check("CODE_XFRAME", detect)) { 
                        errors.push(util.format('%s: %s', header.name, header.value));
                    }
                }
            });
  
            var file    = util.format('%s_%s_%s', aid, cid, cname);
            var loc_img = util.format('screenshots/%s_%s_%sx%s.png',file, ua_key.replace(/\//g, "."), screen._width, screen._height);
            
            /* instant articles */
            articleMetas = this.evaluate(function() {
                var metas = [];
                [].forEach.call(document.querySelectorAll('meta'), function(elem) {
                    var meta = {};
                    [].slice.call(elem.attributes).forEach(function(attr) {
                        if( attr.name === 'property' && (attr.value === 'article:body' || /fb:app_id/.test(attr.value) || /article:publisher/.test(attr.value)) ) {
                            meta[attr.name] = attr.value;
                        }
                    });
                    metas.push(meta);
                });
                return metas;
            });
            
            /* found 3 conditions to flag as IA */
            if(articleMetas.length === 3) {
                if(check("CODE_FBIA", detect)) {
                    errors.push('Facebook Instant Article');
                }
            }
            
            /* 404 */
            if(res.status == 404) {
                if(check("CODE_404", detect)) {
                    errors.push('404 Error');
                }
            }
            
            /* 500 */
            if(res.status >= 500) {
                if(check("CODE_500", detect)) {
                    errors.push('500 Error');
                }
            }
            
            if(errors.length > 0) {
                (function() {casper.totalErrors += errors.length}());
                fs.write(logfile, util.format(formatter, casper.campaign.aid, log_delim, casper.campaign.cid, log_delim, casper.campaign.cname, log_delim, 
                errors.join('|'), log_delim, errors.join('|'), log_delim, casper.campaign.url, log_delim, casper.campaign.remote_img), 'a'); 
            }
            
            /* capture screen */
            this.capture(loc_img, {
                top: screen._top,
                left: screen._left,
                width: screen._width,
                height: screen._height
            });
               
        }, logfile, screen, casper.campaign.url, aid, cid, cname, ua_key, log_delim)
        
    }, ua_key, casper, userAgents)
    
    // run casper
    casper.run(function() {
        fs.write(lm_log, util.format(lm_format, new Date(), urls.length, casper.totalErrors, ua_key), 'a');
        this.echo("Done").exit();
    });
    
} // crawl


// onAlert handler
function handleAlert(casper, msg) {
    if(check("CODE_JSPOP", detect)) {
        if(casper.campaign.url == casper.getCurrentUrl()) {
            casper.totalErrors += 1;
            fs.write(logfile, util.format(formatter, casper.campaign.aid, log_delim, casper.campaign.cid, log_delim, casper.campaign.cname, log_delim,
                'JS Alert (Pop)', log_delim, msg.replace(/\*/g,'').replace(/\r\n|\n|\r/gm,' ').replace(',',''), log_delim, casper.campaign.url, log_delim, casper.campaign.remote_img), 'a'); 
        }
    }
}

// onLoadError handler
function handleLoadError(casper, msg) {
    if(check("CODE_500", detect)) {
        if(casper.campaign.url == casper.getCurrentUrl()) {
            casper.totalErrors += 1;
            fs.write(logfile, util.format(formatter, casper.campaign.aid, log_delim, casper.campaign.cid, log_delim, casper.campaign.cname, log_delim, 
                'Resource Load Error', log_delim, 'Unavailable', log_delim, casper.campaign.url, log_delim, casper.campaign.remote_img), 'a');
        }
    }
}

// getData
function getData(feed, delim, source, cb) {
    
    switch(source) {
        case 'file':
        default:
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
            cb(urls);
            break;
    };
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

// inArray
function check(value, array) {
    return array.indexOf(value) > -1;
}