/*
 * Node Server for ADVCP toolkit
 * Implements UI/API
 * @author: Oren Shepes <oren@advertise.com>
 * @since: 3/17/16
 */

require('node-import');
imports('includes/mysql.js');

var express = require('express'),
    app     = express(),
    mysql   = require('mysql'),
    path    = require('path'),
    cp      = require('child_process'),
    parser  = require('body-parser'),
    fs      = require('fs'),
    connectionpool = mysql.createPool({
        host     : mysql_cfg.MYSQL_HOST,
        user     : mysql_cfg.MYSQL_USER,
        password : mysql_cfg.MYSQL_PASS,
        database : mysql_cfg.MYSQL_DB
    });

/* config */
app.use(express.static(path.join(__dirname, '/')));
app.use(parser.urlencoded({ extended: false }));
app.use(parser.json());
app.set('view engine', 'ejs');

/* clients */
clients = {};
clientId = 0;

/* index */
app.get('/', function(req, res){
  	res.render('pages/index');
});

/* run bot page */
app.get('/run', function(req, res){
  	res.render('pages/run');
});

/* run bot */
app.get('/process', function(req, res) {
	var email = req.query.email;
	var request = require('./process.js').Request; 
	res.send(request(email)); 
});

/* process bot */
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

/* events */
app.get('/events/', function(req, res) {
	req.socket.setTimeout(Infinity);
    	res.writeHead(200, {
    		'Content-Type': 'text/event-stream',
    		'Cache-Control': 'no-cache',
    		'Connection': 'keep-alive'
   	 });
    	res.write('\n');
    	(function(clientId) {
        	clients[clientId] = res; 
        	req.on("close", function() {delete clients[clientId]}); 
    	})(++clientId)
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
app.get('/campaigns', function(req, res) {
    	connectionpool.getConnection(function(err, connection) {
        if (err) {
            console.error('CONNECTION error: ',err);
            res.statusCode = 503;
            res.send({
                result: 'error',
                err:    err.code
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
            connection.query(sql, function(err, rows, fields) {
                if (err) {
                    console.error(err);
                    res.statusCode = 500;
                    res.send({
                        result: 'error',
                        err:    err.code
                    });
                }
                res.send({
                    result: 'success',
                    err:    '',
                    fields: fields,
                    json:   rows,
                    length: rows.length
                });
                connection.release();
            });
        }
    });
});

/* TODO: implement rest of CRUD */

/* start listening */
app.listen(3000);

console.log('Starting server on port 3000');
