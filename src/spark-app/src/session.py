"""PySpark session."""
from pyspark.sql import SparkSession

# Create PySpark session
spark = SparkSession.builder.appName('Twitter Sentiment Analysis').getOrCreate()
spark.sparkContext.setLogLevel('WARN')
