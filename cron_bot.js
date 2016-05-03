/*
 * Cron Bot for ADVCP toolkit
 * @author: Oren Shepes <oren@advertise.com>
 * @since: 3/17/16
 * 
 * @usage (e.g run once a day): 
 * 0 10 * * * cd /var/www/html/advcp && node cron_bot.js 
 * --feed feed.csv 
 * --offset 250 
 * --limit 100 
 * --rcpt oren@advertise.com 
 * --ua Chrome41/Win7,Android/Mobile 
 * --proxies 52_53_173_229__3128,104_130_163_119__3128 
 * --detect CODE_JSPOP,CODE_404 
 * --src db >> /var/log/advcp_bot.log
 */

/* config files */
require('node-import');
imports('includes/mysql.js');
imports('includes/useragents.js');
imports('includes/detect.js');
imports('includes/config.js');
imports('includes/rackspace.js');
imports('includes/proxy.js');

var shortid = require('shortid'),
    path    = require('path'),
    cp      = require('child_process'),
    util    = require('util'),
    request = require('request'),
    commandLineArgs = require('command-line-args');
 
var log     = require("./includes/log.js");
 
// command line args
var cli = commandLineArgs([
  { name: 'offset', alias: 'o', type: String },
  { name: 'src', alias: 's', type: String },
  { name: 'limit', alias: 't', type: String },
  { name: 'feed', alias: 'f', type: String },
  { name: 'ua', alias: 'u', type: String },
  { name: 'rcpt', alias: 'r', type: String },
  { name: 'proxies', alias: 'p', type: String },
  { name: 'logfile', alias: 'l', type: String },
  { name: 'detect', alias: 'v', type: String },
]);

var opts = cli.parse();
console.log(JSON.stringify(opts));
process.exit;

/* get bot options */
var source  = opts.src || 'file';
var ua      = opts.ua || 'Chrome41/Win7';
var offset  = opts.offset || 0;
var limit   = opts.limit || 1000;
var proxies = opts.proxies || '';
var job_id  = shortid.generate();
var feed    = opts.feed || 'feed.csv';
var wrapper = '/var/www/html/advcp/main.sh';

// proc
var spw = cp.spawn(wrapper, ['-m', ',', '-o', offset, '-t', limit, '-s', source, '-f', feed, '-u', ua, '-r', opts.rcpt, '-p', proxies, '-l', log.getLogFile(), '-v', opts.detect, '-j', job_id]);

spw.stdout.on('data', function(data){
    console.log('%s', data.toString());
});

console.log(util.format('%s %s %s %s %s %s %s %s %s %s %s %s %s %s %s %s %s %s %s %s %s %s %s', wrapper, '-m', ',', '-o', offset, '-t', limit, '-s', source, '-f', feed, '-u', ua, '-r', opts.rcpt, '-p', proxies, '-l', log.getLogFile(), '-v', opts.detect, '-j', job_id));

// trigger stats reporting
var endpoint    = util.format('%s/finish/%s/%s', config.ADV_HOST, job_id, log.getLogFile());
var logfile     = util.format('logs/%s_%s.csv', log.getLogFile(), job_id);

request(endpoint, function (error, response, body) {
    if (!error && response.statusCode == 200) {
        // finish process
    } else {
        console.log(error);
    }
}); 
 