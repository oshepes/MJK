# MJK
##Advertiser Comliance Spider 
##author: Oren Shepes <oren [at] advertise.com>
##since: 2/17/16

```
DESCRIPTION:
This utility will crawl a given set of URLs and verify the following conditions are met on 
the designated target URLs:
- 1) NO javascript alerts or dialogs 
- 2) NO div overlays
- 3) NO auto sound play
- 4) NO download triggers

INSTALL:
Platform: CentOs 7 64bit / nodejs / phantomjs / casperjs
1. Install nodejs: 
  1.1 curl --silent --location https://rpm.nodesource.com/setup_5.x | bash -
  1.2 yum install nodejs
  1.3 npm install csv-parser (or) npm install papaparse
  1.4 npm install -g forever (optional)
  1.5 npm install -g nodemailer
  1.6 npm install pkgcloud
  1.7 npm install node-import
  1.8 npm install path
  1.9 npm install express
  1.10 sudo npm install mysql
  1.11 sudo npm install request
  1.12 sudo npm install body-parser
  1.13 sudo npm install ejs
  1.14 sudo npm install multer

2. Install Phantomjs:
  2.1 npm install -g phantomjs
3. Install Casperjs:
  3.1 npm install -g casperjs

CONFIG:
User-agent config file is located at `includes/useragents.js`
Feed of URLs to process is located at `data/feed.csv`
Allow Gmail access from less secure clients (i.e: node), https://www.google.com/settings/security/lesssecureapps
Output file is configured w/ --logfile switch (default: logs/{datestamp}.csv)
Mail config is under includes/mail_cfg.js

RUN:
1. forever start /var/www/html/advcp/server.js or `cd /var/www/html/advcp; node server.js &` (starts the API)
using the wrapper (runs all modules in a sequence):
2. /bin/bash main.sh - main wrapper (post deploy needs to grant main.sh execute perms)
or
3. http://{hostname}:8080 - select "Run Bot" from the UI

Using each module:
1. casperjs --ignore-ssl-errors=true [OPTIONS] crawler.js
2. for x in `ls screenshots/`; do node sync_to_cdn.js screenshots/$x; done;
3. node mailer.js

Options:
--feed={feed} feed file name
--delim={delimiter} delimiter character for feed parsing (default: ",")
--logfile={logfile} log file name
--ua_help prints available user-agent options
--src data source for feed generation for bot (file|db default file)
--ua={UA_KEY} use specified user-agent (ex: --ua=Chrome41/Win7)
```
Enjoy!
