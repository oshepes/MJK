/*
 * Node Server for ADVCP toolkit
 * Implements UI/API
 * @author: Oren Shepes <oren@advertise.com>
 * @since: 3/17/16
 */

/* config files */
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
    util    = require('util'),
    shortid = require('shortid'),
    cookieParser = require('cookie-parser'),
    session      = require('express-session');
    connectionpool = mysql.createPool({
        host     : mysql_cfg.MYSQL_HOST,
        user     : mysql_cfg.MYSQL_USER,
        password : mysql_cfg.MYSQL_PASS,
        database : mysql_cfg.MYSQL_DB
    });

var log     = require("./includes/log.js");
var http    = require('http').Server(app);
var io      = require('socket.io')(http);
var routes  = require('./routes');

/* app config */
app.use(express.static(path.join(__dirname, '/')));
app.use(cookieParser());
app.use(session({
    secret: 'Ad73p$t00lk1t', 
    cookie: {}, 
    resave: true, 
    saveUninitialized: true
}));
app.use(parser.urlencoded({ 
    extended: false 
}));
app.use(parser.json());
app.set('view engine', 'ejs');

/* index */
app.get('/', routes.home);

/* run bot page */
app.get('/run', routes.run);

/* run bot */
app.get('/process', routes.process);

/* upload */
app.post('/upload', routes.upload);

/* reports */
app.get('/reports', routes.reports);

/* report list */
app.get('/list', routes.list);

/* get campaigns */
app.get('/campaigns/:offset/:limit', routes.getCampaigns);

/* get campaigns total */
app.get('/campaigns/total', routes.campaignsTotal);

/* set a campaign */
app.get('/setcmp', routes.setCampaign);

/* write job */
app.get('/finish/:job_id/:logfile', routes.finish);

/* socket to bot process */
io.on('connection', function(socket){
    socket.on('run', function(params) {    
        var source  = params.src || 'file';
        var ua      = params.ua || 'Chrome41/Win7';
        var offset  = params.offset || 0;
        var limit   = params.limit || 1000;
        var job_id  = shortid.generate();
        var feed    = 'feed.csv';
                
        var spw = cp.spawn("/var/www/html/advcp/main.sh", ['-m', ',', '-o', offset, '-t', limit, '-s', source, '-f', feed, '-u', ua, '-r', params.email, '-l', log.getLogFile(), '-v', params.detect, '-j', job_id]);
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
            var request     = require('request');
            var endpoint    = util.format('%s/finish/%s/%s', config.ADV_HOST, job_id, log.getLogFile());
            var logfile     = util.format('logs/%s_%s.csv', log.getLogFile(), job_id);
            request(endpoint, function (error, response, body) {
              if (!error && response.statusCode == 200) {
                  try {
                      fs.unlinkSync(logfile);
                  } catch(e) {
                      console.log('Error removing log file: %s', e.stack);
                  }
              } else {
                    console.log(error);
              }
            });
            io.emit('close', 1);
        });
        
        spw.on('error', function(e){
            io.emit('error', 1);
        });
    });
    
    socket.on('kill', function(params) {
        console.log('Got pid to kill: %d', params.pid);
        var spw = cp.spawn("killall", ['phantomjs']);
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
