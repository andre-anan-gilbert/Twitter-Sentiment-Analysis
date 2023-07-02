"""Database connector."""
import mysql.connector
import logging
import pyspark
from typing import Iterator

_DB_OPTIONS = {
    "host": "my-app-mariadb-service",
    'port': 3306,
    "user": "root",
    "password": "mysecretpw",
    'database': 'popular',
}


def save_tweets_to_db(batch_df: pyspark.sql.DataFrame, batch_id: int) -> None:
    """Saves a batch to MariaDB."""

    def save_partition_to_db(iterator: Iterator) -> None:
        db_connection = mysql.connector.connect(**_DB_OPTIONS)
        cursor = db_connection.cursor()
        for row in iterator:
            tweet_id, count, prediction = row

            # Run upsert (insert or update existing data)
            upsert_statement = 'INSERT INTO popular (tweet_id, sentiment, count) VALUES (%s, %s, %s) ON DUPLICATE KEY UPDATE count = count + %s'
            cursor.execute(upsert_statement, (tweet_id, prediction, count, count))
            db_connection.commit()

        db_connection.close()

    logging.info(
        f"Writing tweets batch_id {batch_id} to database @ {_DB_OPTIONS['host']}:{_DB_OPTIONS['port']}/{_DB_OPTIONS['database']}"
    )

    # Perform batch upserts per data partition
    batch_df.foreachPartition(save_partition_to_db)


def save_events_to_db(batch_df: pyspark.sql.DataFrame, batch_id: int) -> None:
    """Saves a batch to MariaDB."""

    def save_partition_to_db(iterator: Iterator) -> None:
        db_connection = mysql.connector.connect(**_DB_OPTIONS)
        cursor = db_connection.cursor()
        for row in iterator:
            event_type, count = row

            # Run upsert (insert or update existing data)
            upsert_statement = 'INSERT INTO events (event_type, count) VALUES (%s, %s) ON DUPLICATE KEY UPDATE count = count + %s'
            cursor.execute(upsert_statement, (event_type, count, count))
            db_connection.commit()

        db_connection.close()

    logging.info(
        f"Writing events batch_id {batch_id} to database @ {_DB_OPTIONS['host']}:{_DB_OPTIONS['port']}/{_DB_OPTIONS['database']}"
    )

    # Perform batch upserts per data partition
    batch_df.foreachPartition(save_partition_to_db)