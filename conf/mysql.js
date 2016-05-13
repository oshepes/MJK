var mysql_cfg = {
	"MYSQL_HOST": "%{advdb.hostname}%",
	"MYSQL_USER": "%{advdb.username}%",
	"MYSQL_PASS": "%{advdb.password}%",
	"MYSQL_DB": "%{advdb.database}%",
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
                    "AND AD.status_id = 7 GROUP BY AD.destination_url LIMIT %d, %d",
        "CMP_TOTAL": "SELECT COUNT(1) AS total " +
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
                    "AND AD.status_id = 7",
};
