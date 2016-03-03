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

// check if recipient arg was passed
var rcpt = process.argv[2] || mail.to;

// report 
var report      = 'adv_report_' + log.getDate() + '.csv';
var report_path = log.getLogFile();

// create transporter object using the default SMTP transport 
var transporter = nodemailer.createTransport('smtps://oren%40advertise.com:Or3n!1973@smtp.gmail.com');

// setup e-mail options
var mailOptions = {
    from: mail.from, 
    to: rcpt, 
    subject: mail.subject, 
    text: mail.body,
    html: mail.body,
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