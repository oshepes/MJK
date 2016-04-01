#!/bin/bash
# ------------------------------------------
# main.sh
# wrapper shell script to execute 
# Advertiser Compliance Check
# @author: Oren Shepes <oren@advertise.com>
# @since: 3/1/16
# ------------------------------------------

# get command line options (casperjs)
# --f={feed} feed file name
# --d={delimiter} delimiter character for feed parsing (def: ",")
# --l={logfile} log file name
# --h print available user-agent options
# --u={UA_KEY} use specified user-agent (ex: --ua=Chrome41/Win7)

usage() {
	echo ""
	echo "Usage: /bin/bash $0 [OPTIONS]"
	echo "-f source feed (default feed.csv)"
	echo "-d delimiter (default ,)"
	echo "-u user-agent to use in spider (use key from object below)"
	echo "-r email recipient of report"
	echo "-s data source (db|file) the above -f is ignored if this is set"
	echo "-h help"
	echo ""
	echo "User Agents:"
	echo `cat ./includes/useragents.js`
	echo ""
}

args=""

while getopts ":f:d:l:u:r:s:m:o:t:h" opt; do
  case $opt in
    f) 	feed="$OPTARG"; args+=" --feed=$feed"
    ;;
    d) 	delim="$OPTARG"; args+=" --delim=$delim"
    ;;
    l) 	log="$OPTARG"; args+=" --log=$log"
    ;;
    u) 	ua="$OPTARG"; args+=" --ua=$ua"
    ;;
    r) 	rcpt="$OPTARG"; 
    ;;
    m) 	log_delim="$OPTARG"; args+=" --log_delim=$log_delim"
    ;;
    s) 	src="$OPTARG"; args+=" --src=$src"
    ;;
    o)  offset="$OPTARG"; 
    ;;
    t)  limit="$OPTARG";
    ;;
    h) 	help="$OPTARG"; args+=" --ua_help"
       	usage
	exit
    ;;
    \?) echo "Invalid option -$OPTARG" >&2
	exit
    ;;
  esac
done

# cd to location
cd /var/www/html/advcp/

# if data source is API
if [ $src == "db" ]; then
	echo "Writing feed...";
	node request.js $offset $limit;
fi

# run spider first
echo "Running Spider (casperjs) ... ";
cmd="casperjs --ignore-ssl-errors=true $args crawler.js"
echo $cmd; $cmd
echo "Done crawling.";

# sync to cdn screenshots
echo "Synchronizing to CDN ... ";
for x in `ls screenshots/`; do node sync_to_cdn.js screenshots/$x; done;
echo "Done synchronizing.";

# mail report
args=""
if [ -n "$rcpt" ]; then
   args+=" $rcpt"
fi
echo "Sending mail ... "
mail="node mailer.js $args"; 
echo $mail; $mail
echo "Done mailing.";
echo ""
