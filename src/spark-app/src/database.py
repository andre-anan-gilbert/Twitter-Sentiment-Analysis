"""Database connector."""
import mysql.connector
import logging

_DB_OPTIONS = {
    "host": "my-app-mariadb-service",
    'port': 3306,
    "user": "root",
    "password": "mysecretpw",
    'database': 'popular',
}


def save_to_database(batch_df, batch_id):
    """Saves a batch data frame to MariaDB."""

    def save_to_db(iterator):
        """Saves a partition to MariaDB."""
        db_connection = mysql.connector.connect(**_DB_OPTIONS)
        cursor = db_connection.cursor()
        for row in iterator:
            tweet_id, count, prediction = row
            if tweet_id is None:
                continue

            # Run upsert (insert or update existing data)
            upsert_statement = 'INSERT INTO popular (tweet_id, sentiment, count) VALUES (%s, %s, %s) ON DUPLICATE KEY UPDATE count=%s'
            cursor.execute(upsert_statement, (tweet_id, prediction, count, count))
            db_connection.commit()

        db_connection.close()

    logging.info(
        f"Writing batch_id {batch_id} to database @ {_DB_OPTIONS['host']}:{_DB_OPTIONS['port']}/{_DB_OPTIONS['database']}"
    )

    # Perform batch upserts per data partition
    batch_df.foreachPartition(save_to_db)