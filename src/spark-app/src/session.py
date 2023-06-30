import logging
from pyspark.sql import SparkSession


spark = SparkSession.builder.appName("Twitter Sentiment Analysis").getOrCreate()
spark.sparkContext.setLogLevel('WARN')

# Set logging format
logging.basicConfig(format='%(asctime)s %(levelname)s %(message)s', datefmt='%y/%m/%d %H:%M:%S')
logging.getLogger().setLevel(logging.INFO)