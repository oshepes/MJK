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
    var fs      = require('fs'),
        shortid = require('shortid'),
        util    = require('util'),
        multer  = require('multer'),
    	storage = multer.diskStorage({
            destination: function (req, file, callback) {
                callback(null, './data');
            },
            filename: function (req, file, callback) {
                callback(null, 'feed.csv'); // TODO: timestamp: + Date.now());
            }
    });
    var Campaign    = require('../models/campaign');
    var upload      = multer({storage : storage}).single('feed');
    var feed        = 'data/feed.csv';
    
    upload(req, res, function(err) {
        if(err) {
            return res.end("Error uploading file: " + err);
        }
        try {
            fs.chmodSync(feed, '777');
            // process and save feed        
            var job_id  = shortid.generate();
            var now     = new Date();

            fs.readFile(feed, 'utf8', function (err, contents) {
                if (contents && contents.length > 1) {
                    lines = contents.split('\n');
                    lines.forEach(function (line) {
                        var parts = line.split(','),
                            acct_id     = parts[0],
                            acct_name   = parts[1],
                            cmp_name    = parts[2],
                            adgrp_name  = parts[3],
                            username    = parts[4],
                            screenshot  = '',
                            url         = parts[parts.length - 1],
                            violations  = '';
                       
                        if (acct_id && url && job_id && url !== 'URL') {

                            var newCampaign = Campaign({
                                job_id: job_id,
                                account_id: acct_id,
                                account_name: acct_name,
                                campaign_name: cmp_name,
                                adgroup_name: adgrp_name,
                                destination_url: url,
                                screenshot: screenshot,
                                violations: violations,
                                created_at: now,
                                completed_at: now
                            });

                            newCampaign.save(function (err) {
                                if (err) {
                                    console.log(JSON.stringify(err));
                                    throw err;
                                }
                                console.log('saving campaign: %s: %s: %s', job_id, acct_id, url);
                            });
                        }
                    });
                } else {
                    console.log('skipping: %s, contents: %s', job_id, contents);
                }
            });

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

/* jobs endpoint mongodb */
exports.jobs = function (req, res) {
    imports('includes/config.js');
    var Job         = require('../models/job');
    var limit       = req.params.limit || 1500; 
    
    Job.find({}).
            select({job_id: 1, account_id: 1, campaign_name: 1, url: 1, screenshot: 1, violations: 1, created_at: 1, completed_at: 1}).
            where('violations').ne('').
            limit(limit).
            sort('completed_at').
            exec(function(err, result){
                res.render('pages/jobs', {
                    "host": config.ADV_HOST,
                    "socket_io": config.ADV_SOCKET,
                    'jobs': result
                });
            });
};
  
/* campaigns endpoint mongodb */
exports.campaigns = function (req, res) {
    imports('includes/config.js');
    var mongoose    = require('mongoose');
    var limit       = req.params.limit || 1500; 
    var Campaign    = require('../models/campaign');
    mongoose.connect(config.MONGODB_HOST); 
    
    Campaign.find({}).
            select({account_id: 1, account_name: 1, screenshot: 1, url: 1, violations: 1, created_at: 1, completed_at: 1}).
            limit(limit).
            exec(function(err, result){
                res.send({
                    'campaigns': result
                });
            });
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

exports.initdb = function(req, res) {
    // init db w/ collections
    var Campaign = require('../models/campaign'),
            Job = require('../models/job');
    
    var newCampaign = Campaign({
        account_id: "100000",
        account_name: "Accttest",
        campaign_name: "Campaign Test",
        adgroup_name: "AdGroup Test",
        username: "advcp",
        code: "ADVCP",
        destination_url: "http://www.advertise.com/",
        violations: "CODE_JSPOP",
        created_at: new Date(),
        updated_at: new Date()
    });
    newCampaign.save(function(err) {
        if (err) throw err;
        console.log('Campaign created!');
    });
    
    var newJob = new Job({
        job_id: "10001",
        url: "http://www.advertise.com/",
        violations: "",
        created_at: new Date(),
        completed_at: new Date()
    });
    newJob.save(function(err) {
       if(err) throw err;
       console.log('Job created!');
    });
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
    // save 
    newCmp.save(function(err) {
        if (err) throw err;
        console.log('Campaign created!');
    });
};

exports.finish = function(req, res) {
    var fs      = require('fs');
    var util    = require('util');
    // params
    var job_id  = req.params.job_id || null;
    var logfile = req.params.logfile || null;
    var feed    = 'data/feed.csv';
    var logfeed = util.format("logs/%s_%s.csv", logfile, job_id);
    var now     = new Date();
    // model
    var Job     = require('../models/job');  
    
    console.log('Finishing job: %s', job_id);
    
    // violations
    console.log('processing violations... %s', logfeed);
    try {
        fs.readFile(logfeed, 'utf8', function (err, contents) {
            if (contents && contents.length > 1) {
                lines = contents.split('\n');
                lines.forEach(function (line) {
                    var parts = line.split(',');
				    var acct_id = parts[0];
				    var acct_name = parts[1];
		  		    var cmp_name = parts[2];
				    var url = parts[parts.length-2];
                    var screenshot = parts[parts.length - 1];
                    var violations = parts[3];
                    console.log('url: %s, job: %s, violations:', url, job_id, violations);
                    if (url && job_id && url !== 'URL') {

                        var newJob = Job({
                            job_id: job_id,
                            account_id: acct_id,
                            account_name: acct_name,
                            campaign_name: cmp_name,
                            destination_url: url,
                            screenshot: screenshot,
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

