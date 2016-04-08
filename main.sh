#!/bin/bash
# --------------------------------------------------------------------------------
# main.sh
# wrapper shell script to execute 
# Advertiser Compliance Check
# @author: Oren Shepes <oren@advertise.com>
# @since: 3/1/16
# @link: http://dashboard.advertise.com/display/PROD/Advertiser+Compliance+Toolkit
# --------------------------------------------------------------------------------

# get command line options
# --f={feed} feed file name
# --d={delimiter} delimiter character for feed parsing (def: ",")
# --l={logfile} log file name
# --l={logfile} log file name
# --o={offset} offset position in db resultset
# --t={limit} number of records to fetch
# --h print available user-agent options
# --u={UA_KEY} use specified user-agent (ex: --ua=Chrome41/Win7)

# app root
app_root="/var/www/html/advcp"

usage() {
	echo ""
	echo "Usage: /bin/bash $0 [OPTIONS]"
	echo "-f source feed (default feed.csv)"
	echo "-d delimiter (default ,)"
	echo "-u user-agent to use in spider (use key from object below)"
	echo "-r email recipient of report"
	echo "-s data source (db|file) the above -f is ignored if this is set"
	echo "-o offset in resultset from db"
	echo "-t number of records from db resultset"
	echo "-h help"
	echo ""
	echo "User Agents:"
	echo `cat ./includes/useragents.js`
	echo ""
}

args=""

while getopts ":f:d:l:u:r:s:m:o:t:v:h" opt; do
  case $opt in
    f) 	feed="$OPTARG"; args+=" --feed=$feed"
    ;;
    d) 	delim="$OPTARG"; args+=" --delim=$delim"
    ;;
    l) 	log="$OPTARG"; args+=" --logfile=$log"
    ;;
    u) 	ua="$OPTARG"; # args+=" --ua=$ua"
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
    v)  detect="$OPTARG"; args+=" --detect=$detect"
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
cd $app_root

# if data source is API
if [ $src == "db" ]; then
	echo "Writing feed...";
	node request.js $offset $limit;
fi

# run bot once per ua
IFS=',' read -r -a array <<< "$ua"
for ua in "${array[@]}"
do 
    	echo "Running bot ($ua) ... ";
    	cmd="casperjs --ignore-ssl-errors=true $args --ua=$ua crawler.js"
    	echo $cmd; $cmd
    	echo "Done crawling."

	# prepare report per ua
	u=`echo $ua | sed -e 's/\//_/g'`
	report=$(printf "%s_%s.csv" $log $u)
        cp_cmd="cp logs/$log logs/$report"
	echo $cp_cmd; $cp_cmd
	oldlog=$(printf "logs/%s" $log)
	rm $oldlog
    
    	# mail report
    	mail_args=""
    	if [ -n "$rcpt" ]; then
       		mail_args+=" $rcpt"
    	fi
    	echo "Sending mail ... "
    	mail="node mailer.js $mail_args $report $ua"; 
    	echo $mail; $mail
    	echo "Done mailing.";
done

# sync to cdn reports/screenshots
echo "Synchronizing to CDN ... ";
for x in `ls screenshots/`; do node sync_to_cdn.js screenshots/$x; done;
for r in `ls logs/`; do node sync_to_cdn.js logs/$r; done;
echo "Done synchronizing.";

echo ""
