"""PySpark entrypoint."""
import logging
import pyspark.sql.functions as F
from pyspark.sql.types import IntegerType, StringType, StructType, TimestampType
from model import load_model, train_model
from database import save_to_database
from session import spark
from utils import NoPipelineModelFoundError

logging.basicConfig(format='%(asctime)s %(levelname)s %(message)s', datefmt='%y/%m/%d %H:%M:%S')
logging.getLogger().setLevel(logging.INFO)

_WINDOW_DURATION = '1 minute'
_SLIDING_DURATION = '1 minute'

# Load or train tweet sentiment prediction model
try:
    model_pipeline = load_model()
except NoPipelineModelFoundError:
    logging.error('No PySpark PipelineModel found. Training model instead.')
    model_pipeline = train_model()

# Read messages from Kafka
kafka_messages = spark.readStream.format('kafka').option(
    'kafka.bootstrap.servers',
    'my-cluster-kafka-bootstrap:9092',
).option(
    'subscribe',
    'tracking-data',
).option(
    'startingOffsets',
    'earliest',
).load()

# Define schema of tracking data
tracking_message_schema = StructType().add(
    'tweet_id',
    IntegerType(),
).add(
    'tweet',
    StringType(),
).add(
    'timestamp',
    IntegerType(),
)

# Convert value: binary -> JSON -> fields + parsed timestamp
tracking_messages = kafka_messages.select(
    # Extract 'value' from Kafka message (i.e., the tracking data)
    F.from_json(
        F.column('value').cast('string'),
        tracking_message_schema,
    ).alias('json')).select(
        # Convert Unix timestamp to TimestampType
        F.from_unixtime(F.column('json.timestamp')).cast(TimestampType()).alias('parsed_timestamp'),
        F.column('json.tweet_id').alias('tweet_id'),
        F.column('json.tweet').alias('tweet'),
    ).withWatermark(
        'parsed_timestamp',
        _WINDOW_DURATION,
    )

# Compute most popular tweets
popular = tracking_messages.groupBy(
    F.window(F.column('parsed_timestamp'), _WINDOW_DURATION, _SLIDING_DURATION),
    F.column('tweet'),
    F.column('tweet_id'),
).count().withColumnRenamed(
    'window.start',
    'window_end',
).withColumnRenamed(
    'window.end',
    'window_start',
)

# Predict sentiment of tweets
popular = model_pipeline.transform(popular)

# Print running counts to the console
console_dump = popular.writeStream.trigger(
    processingTime=_SLIDING_DURATION).outputMode('update').format('console').option(
        'truncate',
        'false',
    ).start()

# Save each batch to MariaDB
db_insert_stream = popular.select(
    F.column('tweet_id'),
    F.column('count'),
    F.column('prediction'),
).writeStream.trigger(processingTime=_SLIDING_DURATION).outputMode('complete').foreachBatch(save_to_database).start()

# Wait for termination
spark.streams.awaitAnyTermination()
