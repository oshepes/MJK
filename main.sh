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

while getopts ":f:d:l:u:r:s:m:o:j:t:v:h" opt; do
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
    j)  jobid="$OPTARG"; args+=" --job_id=$jobid"
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

# clean old files
for f in `ls logs/*.csv`; do rm -f $f; done;

# if data source is API
if [ $src == "db" ]; then
	echo "Writing feed...";
	node request.js $offset $limit;
fi

# report file
report=$(printf "%s_%s.csv" $log $jobid)

# run bot once per ua
IFS=',' read -r -a array <<< "$ua"
for ua in "${array[@]}"
do 
    	echo "Running bot ($ua) ... ";
    	cmd="casperjs --ignore-ssl-errors=true $args --ua=$ua crawler.js"
    	echo $cmd; $cmd
    	echo "Done crawling."

	# prepare report 
        cat_cmd=`cat logs/$log >> logs/$report`
	echo $cat_cmd; $cat_cmd
	oldlog=$(printf "logs/%s" $log)
done

# sort and uniq report
echo "preparing report..."
tmp_rpt="tmp_rpt"
cmd_sort=`cat logs/$report | grep -v "Account ID" | sort | uniq > logs/$tmp_rpt`
$cmd_sort
header=$(printf "%s%s%s%s%s%s%s%s%s%s%s%s%s" "AccountID" $log_delim "CampaignID" $log_delim "CampaignName" $log_delim "ErrorType" $log_delim "Message" $log_delim "URL" $log_delim "Screenshot")
echo $header > logs/$report && cat logs/$tmp_rpt >> logs/$report
rm logs/$tmp_rpt;

# mail report
if [ -n "$rcpt" ]; then
	mail_args+=" $rcpt"
fi

echo ""
echo "Sending mail ... "
mail="node mailer.js $mail_args $report";
echo $mail; $mail
echo "Done mailing.";
echo ""

# sync to cdn reports/screenshots
echo "Synchronizing to CDN ... ";
for x in `ls screenshots/`; do node sync_to_cdn.js screenshots/$x; done;
echo "Cleaning up..."
rm logs/$log;
for r in `ls logs/`; do node sync_to_cdn.js logs/$r; done;
echo "Done synchronizing.";
echo ""
echo "Bot process completed!"
