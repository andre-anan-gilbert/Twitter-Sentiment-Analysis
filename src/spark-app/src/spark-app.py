from pyspark.sql.functions import *
from pyspark.sql.types import IntegerType, StringType, StructType, TimestampType
from model import load_model, train_model
from database import save_to_database
from session import spark

_WINDOW_DURATION = '1 minute'
_SLIDING_DURATION = '1 minute'

# Example Part 2
# Read messages from Kafka
kafka_messages = spark.readStream.format("kafka").option(
    "kafka.bootstrap.servers",
    "my-cluster-kafka-bootstrap:9092",
).option(
    "subscribe",
    "tracking-data",
).option(
    "startingOffsets",
    "earliest",
).load()

# Define schema of tracking data
tracking_message_schema = StructType().add(
    "tweet_id",
    IntegerType(),
).add(
    "tweet",
    StringType(),
).add(
    "timestamp",
    IntegerType(),
)

# Example Part 3
# Convert value: binary -> JSON -> fields + parsed timestamp
tracking_messages = kafka_messages.select(
    # Extract 'value' from Kafka message (i.e., the tracking data)
    from_json(
        column("value").cast("string"),
        tracking_message_schema,
    ).alias("json")).select(
        # Convert Unix timestamp to TimestampType
        from_unixtime(column('json.timestamp')).cast(TimestampType()).alias("parsed_timestamp"),

        # Select all JSON fields
        column("json.*"),
    ).withColumnRenamed(
        'json.tweet_id',
        'tweet_id',
    ).withColumnRenamed(
        'json.tweet',
        'tweet',
    ).withWatermark(
        "parsed_timestamp",
        _WINDOW_DURATION,
    )

# Example Part 4
# Compute most popular slides
popular = tracking_messages.groupBy(
    window(column("parsed_timestamp"), _WINDOW_DURATION, _SLIDING_DURATION),
    column("tweet"),
    column("tweet_id"),
).count().withColumnRenamed(
    'window.start',
    'window_end',
).withColumnRenamed(
    'window.end',
    'window_start',
)

# Tweet sentiment prediction
try:
    model_pipeline = load_model()
except:
    model_pipeline = train_model()

popular = model_pipeline.transform(popular)

# Example Part 5
# Start running the query; print running counts to the console
console_dump = popular.writeStream.trigger(processingTime=_SLIDING_DURATION).outputMode("update").format("console").option(
    "truncate",
    "false",
).start()

# Example Part 7
db_insert_stream = popular.select(
    column('tweet_id'),
    column('count'),
    column('prediction'),
).writeStream.trigger(processingTime=_SLIDING_DURATION).outputMode("update").foreachBatch(save_to_database).start()

# Wait for termination
spark.streams.awaitAnyTermination()
