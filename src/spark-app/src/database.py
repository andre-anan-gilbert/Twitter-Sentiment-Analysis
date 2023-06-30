import mysql.connector
import logging

_DB_OPTIONS = {
    "host": "my-app-mariadb-service",
    'port': 3306,
    "user": "root",
    "password": "mysecretpw",
    'database': 'popular',
}


def save_to_database(batch_dataframe, batch_id):
    # Define function to save a dataframe to mariadb
    def save_to_db(iterator):

        # Connect to database
        connection = mysql.connector.connect(**_DB_OPTIONS)
        cursor = connection.cursor()
        for row in iterator:
            tweet_id, count, prediction = row
            if tweet_id is None:
                continue

            # Run upsert (insert or update existing)
            upsert_statement = "INSERT INTO popular (tweet_id, sentiment, count) VALUES (%s, %s, %s) ON DUPLICATE KEY UPDATE count=%s"
            cursor.execute(upsert_statement, (tweet_id, prediction, count, count))
            connection.commit()

        connection.close()
    logging.info(f"Writing batch_id {batch_id} to database @ {_DB_OPTIONS['host']}:{_DB_OPTIONS['port']}/{_DB_OPTIONS['database']}")
    
    # Perform batch UPSERTS per data partition
    batch_dataframe.foreachPartition(save_to_db)