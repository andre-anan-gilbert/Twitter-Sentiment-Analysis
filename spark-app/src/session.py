from pyspark.sql import SparkSession

spark = SparkSession.builder.appName("Twitter Sentiment Analysis").getOrCreate()
spark.sparkContext.setLogLevel('WARN')