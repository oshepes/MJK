/* process.js */
exports.Request = function(email) {

    	var util = require('util'),
	spawn = require('child_process').spawn,
	proc_script = spawn("/var/www/html/advcp/main.sh", ['-m', ',', '-s', 'file', '-f', 'feed.csv', '-u', 'Chrome41/Win7', '-r', email]);
	console.log('Recipient: '+email);

	proc_script.stdout.on('data', function(data) {
		var str = data.toString();
		console.log(str);
	});

	proc_script.stderr.on('data', function(data) {
		console.log(data);
	});

	proc_script.on('error', function(err) {
		console.log(err);
	});

	proc_script.on('exit', function() {
		console.log('Done processing');
	});
};
