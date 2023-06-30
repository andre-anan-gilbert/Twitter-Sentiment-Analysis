import logging
from pyspark.sql import SparkSession

# Set logging format
logging.basicConfig(format='%(asctime)s %(levelname)s %(message)s', datefmt='%d/%m/%y %H:%M:%S')

spark = SparkSession.builder.appName("Twitter Sentiment Analysis").getOrCreate()
spark.sparkContext.setLogLevel('WARN')

logging.getLogger().setLevel(logging.INFO)