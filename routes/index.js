/** 
 * Router
 * @author Oren Shepes <oren@advertise.com>
 * @since 4/1/16
 */

/* index */
exports.home = function(req, res){
    res.render('pages/index', {"socket_io": config.ADV_SOCKET, "host": config.ADV_HOST});
};

/* run */
exports.run = function(req, res){
    res.render('pages/run', {uas: userAgents, detect: detect, socket_io: config.ADV_SOCKET, host: config.ADV_HOST});
};

/* reports */
exports.reports = function(req, res){
    pkgcloud = require('pkgcloud');
    var client = pkgcloud.storage.createClient({
        provider: 'rackspace',
        username: rackspace.CDN_USER,
        apiKey: rackspace.CDN_KEY,
        region: rackspace.CDN_REGION
    });

    list = [];
    client.getFiles(rackspace.CDN_CONT, {prefix: 'logs', limit: 100}, function (err, files) {
        files.forEach(function (file) {
           if(file.name.indexOf('.csv') > -1) list.push(file.name);
        });
        (function () {
            res.render('pages/reports', {
                "files": list,
                "cdn_host": rackspace.CDN_IMG_HOST,
                "socket_io": config.ADV_SOCKET,
                "host": config.ADV_HOST
            });
        })();
    });
};

/* process */
exports.process = function(req, res) {
    var email = req.query.email;
    var request = require('./process.js').Request; 
    res.send(request(email)); 
};

/* upload */
exports.upload = function(req, res) {
    var fs      = require('fs');
    var multer  = require('multer'),
    	storage = multer.diskStorage({
        destination: function (req, file, callback) {
            callback(null, './data');
        },
        filename: function (req, file, callback) {
            callback(null, 'feed.csv'); // TODO: timestamp: + Date.now());
        }
    });
    var upload = multer({storage : storage}).single('feed');

    upload(req, res, function(err) {
        if(err) {
            return res.end("Error uploading file: " + err);
        }
        try {
            fs.chmodSync('data/feed.csv', '777');
        } catch(e) {
            console.log('Error: %s', e.stack);
        }
        res.end("File upload completed.");
    });
};

/* archive */
exports.archive = function(req, res) {
    try {
        fs.readdir(__dirname + '/logs/', function (err, files) {
            if (err) throw err;
            list = [];
            files.forEach(function (file) {
                list.push(file);
            });
            res.render('pages/reports', {
		"files": list,
                "socket_io": config.ADV_SOCKET
            	});
        });
    } catch(e) {
        	console.log(e);
    }
};

/* list */
exports.list = function(req, res) {
    var fs      = require('fs');
    try {
        fs.readdir(__dirname + '/logs/', function (err, files) {
            if (err) throw err;
            list = [];
            files.sort.forEach(function (file) {
                if(file.indexOf('.csv') > -1) list.push("<li><a href='/logs/" + file + "'>" + file + "</a></li>");
            });
            res.send(list);
   	});
    } catch(e) {
    	console.log(e);
    }
};

/* campaigns endpoint */
exports.getCampaigns = function (req, res) {
    var util = require('util');
    var offset = req.params.offset || 0;
    var limit = req.params.limit || 1000;
    connectionpool.getConnection(function (err, connection) {
        if (err) {
            console.error('CONNECTION error: ', err);
            res.statusCode = 503;
            res.send({
                result: 'error',
                err: err.code
            });
        } else {
            var sql = util.format(mysql_cfg.CMP_QUERY, offset, limit);
            console.log('Query: %s', sql);
            connection.query(sql, function (err, rows, fields) {
                if (err) {
                    console.error('DB Error: %s', err);
                    res.statusCode = 500;
                    res.send({
                        result: 'error',
                        err: err.code
                    });
                }
                res.send({
                    result: 'success',
                    err: '',
                    fields: fields,
                    json: rows,
                    length: rows.length
                });
                console.log('recieved %d rows from db', rows.length);
                connection.release();
            });
        }
    });
};

/* campaigns total */
exports.campaignsTotal = function (req, res) {
    var util = require('util');
    var sess = req.session;
    if(!sess.t_campaigns) {
        connectionpool.getConnection(function (err, connection) {
            if (err) {
                console.error('CONNECTION error: ', err);
                res.statusCode = 503;
                res.send({
                    result: 'error',
                    err: err.code
                });
            } else {
                var sql = util.format(mysql_cfg.CMP_TOTAL);
                connection.query(sql, function (err, rows, fields) {
                    if (err) {
                        console.error('DB Error: %s', err);
                        res.statusCode = 500;
                        res.send({
                            result: 'error',
                            err: err.code
                        });
                    }
                    sess.t_campaigns = rows[0].total;
                    res.send({
                        result: 'success',
                        err: '',
                        fields: fields,
                        json: rows,
                        length: rows.length,
                        t_campaigns: rows[0].total
                    });
                    console.log('recieved count of %s records from db', rows[0].total);
                    connection.release();
                });
            }
        });
    } else {
        console.log('session t_campaigns: %s', sess.t_campaigns);
        res.send({
            result: 'success',
            err: '',
            json: [{total: sess.t_campaigns}]
        })
    }
};

exports.setCampaign = function(req, res) {
    
    var Cmp = require('../models/campaign');

    var newCmp = Cmp({
        account_id: "1009459",
        account_name: "Acct123",
        campaign_name: "Cmp abc",
        adgroup_name: "AG 123",
        username: "user123",
        code: "ABC",
        destination_url: "http://www.google.com/",
        violations: "CODE_JSPOP",
        created_at: new Date(),
        updated_at: new Date()
    });

    // save the user
    newCmp.save(function(err) {
        if (err) throw err;
        console.log('Campaign created!');
    });
};

exports.finish = function(req, res) {
    var job_id  = req.params.job_id || null;
    var logfile = req.params.logfile || null;
    var fs      = require('fs');
    var util    = require('util');
    var Job     = require('../models/job');
    var feed    = 'data/feed.csv';
    var logfeed = util.format("logs/%s_%s.csv", logfile, job_id);
    var now     = new Date();
    console.log('Finishing job: %s', job_id);
    // feed
    try {
        fs.readFile(feed, 'utf8', function(err, contents) {
            lines = contents.split('\n');
            lines.forEach(function(line) {
                var parts = line.split(',');
                var url = parts[parts.length - 1];
                if(url && job_id) {
                   
                    var newJob = Job({
                        job_id: job_id,
                        url: url,
                        violations: "",
                        created_at: now,
                        completed_at: now
                    });
                   
                    newJob.save(function(err) {
                        if (err) {
                            console.log(JSON.stringify(err));
                            throw err;
                        }
                        console.log('url saved: %s: %s', job_id, url);
                    });
                }
            });
        });
    } catch (e) {
        console.log(e.stack);
    }
    
    // violations
    console.log('processing violations... %s', logfeed);
    try {
        fs.readFile(logfeed, 'utf8', function (err, contents) {
            if (contents && contents.length > 1) {
                lines = contents.split('\n');
                lines.forEach(function (line) {
                    var parts = line.split(',');
                    var url = parts[parts.length - 2];
                    var violations = parts[3];
                    console.log('url: %s, job: %s, violations:', url, job_id, violations);
                    if (url && job_id && url !== 'URL') {

                        var newJob = Job({
                            job_id: job_id,
                            url: url,
                            violations: violations,
                            created_at: now,
                            completed_at: now
                        });

                        newJob.save(function (err) {
                            if (err) {
                                console.log(JSON.stringify(err));
                                throw err;
                            }
                            console.log('violation saved: %s: %s: %s', job_id, violations, url);
                        });
                    }
                });
            } else {
                console.log('skipping: %s, contents: %s', job_id, contents);
            }
        });
    } catch (e) {
        console.log(e.stack);
    }
    
    res.send('feed processing done!');
};

