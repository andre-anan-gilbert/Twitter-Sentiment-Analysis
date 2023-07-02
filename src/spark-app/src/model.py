"""Logistic regression model for tweet sentiment prediction."""
import logging
import pyspark
import pyspark.sql.functions as F
from pyspark.sql.types import IntegerType, StringType, StructType, StructField
from pyspark.ml.classification import LogisticRegression
from pyspark.ml.feature import IDF, Tokenizer, StringIndexer, CountVectorizer
from pyspark.ml import PipelineModel
from pyspark.ml.classification import LogisticRegression
from pyspark.ml.evaluation import BinaryClassificationEvaluator, MulticlassClassificationEvaluator
from session import spark
from typing import Any

_MODEL_PATH = '/app/model/'


def regex_replace(df: pyspark.sql.DataFrame) -> pyspark.sql.DataFrame:
    # Remove URLs
    df = df.withColumn('tweet', F.regexp_replace('tweet', r'http\S+', ''))

    # Convert HTML coded characters
    df = df.withColumn('tweet', F.regexp_replace('tweet', '&amp', 'and'))
    df = df.withColumn('tweet', F.regexp_replace('tweet', '&lt', '<'))
    df = df.withColumn('tweet', F.regexp_replace('tweet', '&gt', '>'))

    # Replace no-break space unicode
    df = df.withColumn('tweet', F.regexp_replace('tweet', '\xa0', ' '))

    # Replace newline characters
    df = df.withColumn('tweet', F.regexp_replace('tweet', '[\r\n]+', ' '))

    # Replace mentions
    df = df.withColumn('tweet', F.regexp_replace('tweet', '@\w+', ''))

    # Replace hashtags
    df = df.withColumn('tweet', F.regexp_replace('tweet', '#\w+', ''))

    # Replace whitespace
    df = df.withColumn('tweet', F.regexp_replace('tweet', '\s+', ' '))
    return df


def _read_data() -> pyspark.sql.DataFrame:
    """Reads tweets data from HTTP file server."""
    schema = StructType([
        StructField('polarity', IntegerType(), True),
        StructField('id', StringType(), True),
        StructField('date', StringType(), True),
        StructField('query', StringType(), True),
        StructField('author', StringType(), True),
        StructField('tweet', StringType(), True),
    ])
    df = spark.read.csv(
        'file:///app/tweets.1600000.processed.noemoticon.csv',
        inferSchema=True,
        header=False,
        schema=schema,
    )
    # Remove rows with null values
    df = df.dropna()

    # Remove neutral tweets
    df = df.where(df.polarity != 2)

    df = regex_replace(df)

    logging.info('Tweets data schema')
    df.printSchema()
    logging.info(f'Dataset size: {df.count()}')
    return df


def _split_data(df: pyspark.sql.DataFrame) -> tuple[pyspark.sql.DataFrame, ...]:
    """Splits data into train and test sets."""
    logging.info('Splitting data into train/test')
    df_train, df_test = df.randomSplit([0.90, 0.10], seed=42)
    logging.info('Data distribution')
    logging.info(
        f'Train data - negative: {df_train.where(df_train.polarity == 0).count()}, positive: {df_train.where(df_train.polarity == 4).count()}'
    )
    logging.info(
        f'Test data - negative: {df_test.where(df_test.polarity == 0).count()}, positive: {df_test.where(df_test.polarity == 4).count()}'
    )
    return df_train, df_test


def _preprocess_data(df_train: pyspark.sql.DataFrame, df_test: pyspark.sql.DataFrame) -> dict[str, tuple[Any, ...]]:
    """Transforms data into the expected format of the ML model."""

    # Converts the input string to lowercase and then splits it by white spaces
    # Row(text='a b c', words=['a', 'b', 'c'])
    logging.info('Tokenizing words')
    tokenizer = Tokenizer(inputCol='tweet', outputCol='words')

    # Extracts a vocabulary from document collections
    # +-----+---------------+-------------------------+
    # |label|raw            |vectors                  |
    # +-----+---------------+-------------------------+
    # |0    |[a, b, c]      |(3,[0,1,2],[1.0,1.0,1.0])|
    # |1    |[a, b, b, c, a]|(3,[0,1,2],[2.0,2.0,1.0])|
    # +-----+---------------+-------------------------+
    logging.info('Applying count vectorizer')
    count_vectorizer = CountVectorizer(inputCol='words', outputCol='count_vector', vocabSize=2**15)

    # idf = log((m + 1) / (d(t) + 1)), where m is the total number of documents and
    # d(t) is the number of documents that contain term t
    logging.info('Applying inverse document frequency')
    inverse_document_frequency = IDF(inputCol='count_vector', outputCol='features', minDocFreq=5)

    # Maps a string column of labels to an ML column of label indices [0, numLabels)
    string_indexer = StringIndexer(inputCol='polarity', outputCol='label')

    logging.info('Preprocessing train data')
    df_train = tokenizer.transform(df_train)
    vectorizer = count_vectorizer.fit(df_train)
    df_train = vectorizer.transform(df_train)
    idf = inverse_document_frequency.fit(df_train)
    df_train = idf.transform(df_train)
    str_idx = string_indexer.fit(df_train)
    df_train = str_idx.transform(df_train)

    logging.info('Preprocessing test data')
    df_test = tokenizer.transform(df_test)
    df_test = vectorizer.transform(df_test)
    df_test = idf.transform(df_test)
    df_test = str_idx.transform(df_test)

    return {'data': (df_train, df_test), 'preprocessing_steps': (tokenizer, vectorizer, idf)}


def _get_metrics(predictions: pyspark.sql.DataFrame) -> None:
    """Logs the metrics of the trained model."""
    evaluator = BinaryClassificationEvaluator(rawPredictionCol='rawPrediction', labelCol='label')
    auc = evaluator.evaluate(predictions)

    multi_evaluator = MulticlassClassificationEvaluator(labelCol='label', predictionCol='prediction')
    accuracy = multi_evaluator.evaluate(predictions, {multi_evaluator.metricName: 'accuracy'})
    precision = multi_evaluator.evaluate(predictions, {multi_evaluator.metricName: 'weightedPrecision'})
    recall = multi_evaluator.evaluate(predictions, {multi_evaluator.metricName: 'weightedRecall'})

    # Accuracy is the most important metric since the dataset is balanced
    logging.info(f'AUC-ROC: {auc:.4f}')
    logging.info(f'Accuracy: {accuracy:.4f}')
    logging.info(f'Precision: {precision:.4f}')
    logging.info(f'Recall: {recall:.4f}')


def _save_model(*stages: list[pyspark.ml.base.Transformer]) -> pyspark.ml.PipelineModel:
    """Saves a pipeline model to hdfs."""
    logging.info('Saving model')
    model_pipeline = PipelineModel(stages=[*stages])
    model_pipeline.write().overwrite().save(_MODEL_PATH)
    return model_pipeline


def train_model() -> pyspark.ml.PipelineModel:
    """Trains a logistic regression model for tweet sentiment prediction."""
    df = _read_data()

    df_train, df_test = _split_data(df)

    preprocessing = _preprocess_data(df_train, df_test)
    df_train, df_test = preprocessing['data']

    logging.info('Initializing model')
    logistic_regression = LogisticRegression(featuresCol='features', labelCol='label')

    logging.info('Training model')
    model = logistic_regression.fit(df_train)

    logging.info('Evaluating model')
    predictions = model.transform(df_test)

    _get_metrics(predictions)

    logging.info('Prediction schema')
    predictions.printSchema()

    model_pipeline = _save_model(*preprocessing['preprocessing_steps'], model)
    return model_pipeline


def load_model() -> pyspark.ml.PipelineModel:
    """Loads a pipeline model from hdfs."""
    return PipelineModel.load(_MODEL_PATH)