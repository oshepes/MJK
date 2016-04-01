/*
 * Node Server for ADVCP toolkit
 * Implements UI/API
 * @author: Oren Shepes <oren@advertise.com>
 * @since: 3/17/16
 */

require('node-import');
imports('includes/mysql.js');
imports('includes/useragents.js');

var express = require('express'),
    app     = express(),
    mysql   = require('mysql'),
    path    = require('path'),
    cp      = require('child_process'),
    parser  = require('body-parser'),
    fs      = require('fs'),
    multer  = require('multer'),
    connectionpool = mysql.createPool({
        host     : mysql_cfg.MYSQL_HOST,
        user     : mysql_cfg.MYSQL_USER,
        password : mysql_cfg.MYSQL_PASS,
        database : mysql_cfg.MYSQL_DB
    });

var http = require('http').Server(app);
var io = require('socket.io')(http);
    
/* config */
app.use(express.static(path.join(__dirname, '/')));
app.use(parser.urlencoded({ extended: false }));
app.use(parser.json());
app.set('view engine', 'ejs');


/* index */
app.get('/', function(req, res){
    res.render('pages/index');
});

/* run bot page */
app.get('/run', function(req, res){
    res.render('pages/run', {uas: userAgents});
});

/* run bot */
app.get('/process', function(req, res) {
    var email = req.query.email;
    var request = require('./process.js').Request; 
    res.send(request(email)); 
});

/* process bot - sse */
app.get('/exec', function(req, res){
    res.writeHead(200, { 
	"Content-Type": "text/event-stream",
        "Cache-control": "no-cache",
	"Connection": "keep-alive"
    });

    var spw = cp.spawn("/var/www/html/advcp/main.sh", ['-m', ',', '-s', 'file', '-f', 'feed.csv', '-u', 'Chrome41/Win7', '-r', 'oren@advertise.com']),
    str = "";

    spw.stdout.on('data', function (data) {
        str += data.toString();
        // status
        console.log(str);
	res.write(str);
    });
   
    spw.on('close', function (code) {
    	res.end(str);
    });
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
        fs.readdir(__dirname + '/logs/', function (err, files) {
            if (err) throw err;
            list = [];
            files.forEach(function (file) {
                list.push(file);
            });
            res.render('pages/reports', {
		"files": list
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
app.get('/campaigns', function (req, res) {
    connectionpool.getConnection(function (err, connection) {
        if (err) {
            console.error('CONNECTION error: ', err);
            res.statusCode = 503;
            res.send({
                result: 'error',
                err: err.code
            });
        } else {
            var sql = "SELECT A.id AS AccID, A.name AS Account,C.name AS CampName, AG.name AS AdgrpName, U.user_name, AD.destination_url " +
                    "FROM adgroup_property AP " +
                    "LEFT JOIN property P ON (AP.property_id = P.id) " +
                    "LEFT JOIN adgroup AG ON (AP.adgroup_id = AG.id) " +
                    "LEFT JOIN ad AD ON (AG.id = AD.adgroup_id) " +
                    "LEFT JOIN campaign C ON (AG.campaign_id = C.id) " +
                    "LEFT JOIN account A ON (C.account_id = A.id) " +
                    "LEFT JOIN user U ON (A.rep_user_id = U.id) WHERE " +
                    "A.name NOT LIKE 'qatest%' " +
                    "AND C.status_id = 7 " +
                    "AND A.status = 7 " +
                    "AND AG.status_id = 7 " +
                    "AND AD.status_id = 7 LIMIT 1500";
            connection.query(sql, function (err, rows, fields) {
                if (err) {
                    console.error(err);
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
                connection.release();
            });
        }
    });
});

/* socket to bot process */
io.on('connection', function(socket){
    socket.on('run', function(params) {    
        var source  = params.src || 'file';
        var ua      = params.ua || 'Chrome41/Win7';
        var spw = cp.spawn("/var/www/html/advcp/main.sh", ['-m', ',', '-s', source, '-f', 'feed.csv', '-u', ua, '-r', params.email]);
	console.log('running bot...');
        console.log('params: %s=%s, %s=%s, %s=%s', 'rcpt', params.email, 'ua', ua, 'src', source);
	        
	var chunk = '';
	spw.stdout.on('data', function(data){
            chunk += data.toString().replace('<<', '&lt;&lt;').replace('>>', '&gt;&gt;');
            chunk.replace('<', '&lt;').replace('>', '&gt;').replace(/(?:\r\n|\r|\n)/g, '<br />');
            console.log('%s', chunk);
            io.emit('newdata', chunk);
	});
	
	spw.stderr.on('data', function (data) {
            //console.log('Failed to start child process.');
	});
        
        spw.on('exit', function(code) {
            io.emit('close', 1);
        });
        
        spw.on('error', function(e){
            io.emit('error', 1);
        });
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
