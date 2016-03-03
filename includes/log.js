module.exports.getLogFile = function() {
	var now     = new Date();
      	var month   = now.getMonth() + 1;
      	var day     = now.getDate();
      	var year    = now.getFullYear();
      	var logfile = 'logs/' + month + '-' + day + '-' + year  + '.csv';
      	return logfile;
};

module.exports.getDate = function() {
        var now     = new Date();
        var month   = now.getMonth() + 1;
        var day     = now.getDate();
        var year    = now.getFullYear();
        var today   = month + '-' + day + '-' + year;
        return today;
};
