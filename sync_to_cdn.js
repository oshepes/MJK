/**
 * @author: Oren Shepes <oren@advertise.com>
 * @since: 2/17/16
 * 
 * File: 
 * -----
 * sync_to_cdn.js
 * 
 * Description:
 * ------------
 * CDN synchronizer - syncs local files to cloud filesystem
 * 
 * Run:
 * ----
 * node sync_to_cdn.js {file}
 * 
 * Batch Mode:
 * -----------
 * !#/bin/bash
 * for x in `ls screenshots/`; do node sync_to_cdn.js screenshots/$x; done;
 * 
 */

require('node-import');
imports('includes/rackspace.js');
var pkgcloud    = require('pkgcloud');
var fs          = require('fs');
var path        = require('path');
var screenshots_dir = 'screenshots/';

// CDN client
var client = pkgcloud.storage.createClient({
    provider: 'rackspace',
    username: rackspace.CDN_USER,
    apiKey: rackspace.CDN_KEY,
    region: rackspace.CDN_REGION
});

if (process.argv.length <= 2) {
    console.log("Usage: node " + path.basename(__filename) + " filename");
    process.exit(-1);
}
 
var file = process.argv[2];

// do the sync
console.log("Sending: " + file);
sync(file, client);    

// sync
function sync(file, client) {
    var fsys   = require('fs'); 
    var source = fsys.createReadStream(file);
    var dest = client.upload({
        container: rackspace.CDN_CONT,
        remote: file
    });

    dest.on('error', function(err) {
        // error handler
        console.log("Error syncing image file: " + JSON.stringify(err));
    });

    dest.on('success', function(file) {
        fs.unlinkSync(file.name);
    }, file);

    source.pipe(dest);
}

// directory reader
function fileList(dir) {
    return fs.readdirSync(dir).reduce(function(list, file) {
        var name = path.join(dir, file);
        var isDir = fs.statSync(name).isDirectory();
        return list.concat(isDir ? fileList(name) : [name]);
    }, []);
}

