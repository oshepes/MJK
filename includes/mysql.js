var mysql_cfg = {
	"MYSQL_HOST": "localhost",
	"MYSQL_USER": "root",
	"MYSQL_PASS": "lastchance",
	"MYSQL_DB": "advertisedb",
        "CMP_QUERY": "SELECT A.id AS AccID, A.name AS Account,C.name AS CampName, AG.name AS AdgrpName, U.user_name, AD.destination_url " +
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
                    "AND AD.status_id = 7 LIMIT %d, %d"
};
