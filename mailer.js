/**
 * node mailer
 * @author: Oren Shepes <oren@advertise.com>
 * @since: 3/1/16
 * 
 * File: 
 * -----
 * mailer.js
 * 
 * Description:
 * ------------
 * Sends SMTP mail with report attachment
 * 
 * Run:
 * ----
 * node mailer.js [recipient]
 * 
 */

require('node-import');
// mail module
var nodemailer = require('nodemailer');

// log module
var log     = require("./includes/log.js");

// mail config
imports('includes/mail_cfg.js');

// util
var util = require('util');

// check if recipient arg was passed
var rcpt = process.argv[2] || mail.to;
var logfile = process.argv[3] || log.getLogFile();
var subject = process.argv[4] || log.getDate();

// report 
var report_path = 'logs/' + logfile;
var report      = 'advcp_' + logfile;

// create transporter object using the default SMTP transport 
var transporter = nodemailer.createTransport('smtp://smtp-01.advdc.com');

// setup e-mail options
var mailOptions = {
    from: mail.from, 
    to: rcpt, 
    subject: util.format("%s %s %s", mail.subject, log.getDate(), subject), 
    text: util.format("%s %s %s", mail.body, log.getDate(), subject),
    html: util.format("%s %s %s", mail.body, log.getDate(), subject),
    attachments: [
        {   // utf-8 string as an attachment 
            filename: report,
            path: report_path
        },
    ]
};
 
// send mail with defined transport object 
transporter.sendMail(mailOptions, function(error, info){
    if(error){
        return console.log(error);
    }
    console.log('Message sent: ' + info.response);
});
