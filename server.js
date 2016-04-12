/*
 * Node Server for ADVCP toolkit
 * Implements UI/API
 * @author: Oren Shepes <oren@advertise.com>
 * @since: 3/17/16
 */

require('node-import');
imports('includes/mysql.js');
imports('includes/useragents.js');
imports('includes/detect.js');
imports('includes/config.js');
imports('includes/rackspace.js');

var express = require('express'),
    app     = express(),
    mysql   = require('mysql'),
    path    = require('path'),
    cp      = require('child_process'),
    parser  = require('body-parser'),
    fs      = require('fs'),
    multer  = require('multer'),
    util    = require('util'),
    pkgcloud    = require('pkgcloud'),
    cookieParser = require('cookie-parser'),
    session      = require('express-session');
    connectionpool = mysql.createPool({
        host     : mysql_cfg.MYSQL_HOST,
        user     : mysql_cfg.MYSQL_USER,
        password : mysql_cfg.MYSQL_PASS,
        database : mysql_cfg.MYSQL_DB
    });

var log  = require("./includes/log.js");
var http = require('http').Server(app);
var io   = require('socket.io')(http);
    
/* config */
app.use(express.static(path.join(__dirname, '/')));
app.use(cookieParser());
app.use(session({secret: 'Ad73p$t00lk1t', cookie: {}, resave: true, saveUninitialized: true}));
app.use(parser.urlencoded({ extended: false }));
app.use(parser.json());
app.set('view engine', 'ejs');


/* index */
app.get('/', function(req, res){
    res.render('pages/index', {"socket_io": config.ADV_SOCKET, "host": config.ADV_HOST});
});

/* run bot page */
app.get('/run', function(req, res){
    res.render('pages/run', {uas: userAgents, detect: detect, socket_io: config.ADV_SOCKET, host: config.ADV_HOST});
});

/* run bot */
app.get('/process', function(req, res) {
    var email = req.query.email;
    var request = require('./process.js').Request; 
    res.send(request(email)); 
});

/* upload */
app.post('/upload/feed', function(req, res) {
    var storage =   multer.diskStorage({
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
});

/* reports */
app.get('/reports', function(req, res){
    try {
        // CDN client
        var client = pkgcloud.storage.createClient({
            provider: 'rackspace',
            username: rackspace.CDN_USER,
            apiKey: rackspace.CDN_KEY,
            region: rackspace.CDN_REGION
        });
        
        list = [];
        client.getFiles(rackspace.CDN_CONT, {prefix: 'logs', limit: 100}, function(err, files) {
            files.forEach(function(file) {
                list.push(file.name);
            });
            (function() {
                res.render('pages/reports', {
                    "files": list,
                    "cdn_host": rackspace.CDN_IMG_HOST,
                    "socket_io": config.ADV_SOCKET,
                    "host": config.ADV_HOST
                });
            })();
        });
    } catch(e) {
        console.log(e);
    }
});

/* archive */
app.get('/archive', function(req, res){
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
});

/* report list */
app.get('/list', function(req, res) {
    try {
        fs.readdir(__dirname + '/logs/', function (err, files) {
            if (err) throw err;
            list = [];
            files.forEach(function (file) {
                list.push("<li><a href='/logs/" + file + "'>" + file + "</a></li>");
            });
            res.send(list);
   	});
    } catch(e) {
    	console.log(e);
    }
});

/* get campaigns */
app.get('/campaigns/:offset/:limit', function (req, res) {
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
});

/* get campaigns total */
app.get('/campaigns/total', function (req, res) {
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
});

/* socket to bot process */
io.on('connection', function(socket){
    socket.on('run', function(params) {    
        var source  = params.src || 'file';
        var ua      = params.ua || 'Chrome41/Win7';
        var offset  = params.offset || 0;
        var limit   = params.limit || 1000;
       
        var spw = cp.spawn("/var/www/html/advcp/main.sh", ['-m', ',', '-o', offset, '-t', limit, '-s', source, '-f', 'feed.csv', '-u', ua, '-r', params.email, '-l', log.getLogFile(), '-v', params.detect]);
	console.log('running bot...');
        console.log('params: %s=%s, %s=%s, %s=%s, %s=%s, %s=%s, %s=%s, %s=%s', 'rcpt', params.email, 'ua', ua, 'src', source, 'offset', offset, 'limit', limit, 'logfile', log.getLogFile(), 'detect', params.detect);
	        
        io.emit('start', spw.pid);
        
	var chunk = '';
	spw.stdout.on('data', function(data){
            chunk += data.toString().replace('<<', '&lt;&lt;').replace('>>', '&gt;&gt;');
            chunk.replace('<', '&lt;').replace('>', '&gt;').replace(/(?:\r\n|\r|\n)/g, '<br />');
            console.log('%s', chunk);
            io.emit('newdata', chunk);
	});
	
	spw.stderr.on('data', function (data) {
            
	});
        
        spw.on('exit', function(code) {
            io.emit('close', 1);
        });
        
        spw.on('error', function(e){
            io.emit('error', 1);
        });
    });
    
    socket.on('kill', function(params) {
        console.log('Got pid to kill: %d', params.pid);
        var spawn = cp.spawn("kill", ['-9', params.pid]);
        spawn.stdout.on('data', function(d) {
            io.emit('killed', d.toString());
        });
        spawn.stderr.on('data', function(data) {
            console.log('Error killing process %d: %s', params.pid, data.toString());
        })
    });
});

/* socket */
var socket_io = 8000, port = 8080;
http.listen(socket_io, function(){
	console.log('Opening socket on port %d', socket_io);
});

/* start listening app server */
app.listen(port, function() {
    console.log('Starting HTTP server on port %d', port);
});
