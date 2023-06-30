import logging
from pyspark.sql import SparkSession

spark = SparkSession.builder.appName("Twitter Sentiment Analysis").getOrCreate()
spark.sparkContext.setLogLevel('WARN')

logging.getLogger().setLevel(logging.INFO)