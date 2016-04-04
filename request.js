/*
 * Feed writer - writes API response to a feed for casperjs processing
 * @author Oren Shepes <oren@advertise.com>
 * @since 3/17/16
 */

// required modules
var fs 		= require('fs');
var util 	= require('util');
var request 	= require('request');

var offset      = process.argv[2] || 0;
var limit       = process.argv[3] || 1000;

require('node-import');
imports('includes/config.js');

// API endpoint
var endpoint	= util.format('%s/campaigns/%d/%d', config.ADV_HOST, offset, limit);

// feed config
var feed 	= 'data/feed.csv';
var stats       = '';
var formatter   = "%s%s%s%s%s%s%s%s%s%s%s\n";
var delim	= ',';

// get data from API and write feed
request(endpoint, function (error, response, body) {
  if (!error && response.statusCode == 200) {
      try {
        // clear/touch feed
        if (!fs.existsSync(feed)) {
            fs.writeFile(feed, '');
            fs.chmodSync(feed, '777');
        } else {
            fs.truncate(feed, 0, function(){ 
                console.log('feed truncated.');
            });
        }
        
      	var obj = JSON.parse(body);
	obj.json.forEach(function(cam) {
		fs.appendFile(feed, util.format(formatter, cam.AccID, delim, cam.Account, delim, cam.CampName, delim, cam.AdgrpName, delim, cam.user_name, delim, cam.destination_url), {
			encoding: 'utf8',
			mode: 777,
			flags: 'a' 
		});
     	});
    } catch(err) {
        console.log('Error writing feed: %s', err.stack);
    }
  } else {
      	console.log(error);
  }
});

// done
console.log('Done writing feed!');
