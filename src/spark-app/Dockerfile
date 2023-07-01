FROM bitnami/spark:3.4.1
LABEL maintainer="Dennis Pfisterer, http://dennis-pfisterer.de"

#------------------------------------
# Set execution environment

ENV SPARK_VERSION "3.4.1"

#------------------------------------
# Download Java dependencies (Kafka, MariaDB) using Ivy (cf. https://stackoverflow.com/a/15456621) 

ENV IVY_PACKAGE_DIR "/tmp/.ivy"
ENV EXTRA_JAR_PATH "/opt/bitnami/spark/jars"

ENV IVY_CMD "java -Divy.default.ivy.user.dir=/tmp/.ivy-home -jar ${EXTRA_JAR_PATH}/ivy-*.jar -verbose -cache ${IVY_PACKAGE_DIR} -retrieve ${EXTRA_JAR_PATH}/[artifact]-[revision](-[classifier]).[ext]"

# Dependencies for Spark Kafka
RUN echo Using ivy command: ${IVY_CMD}
RUN ${IVY_CMD} -dependency "org.apache.spark" "spark-sql-kafka-0-10_2.12" "${SPARK_VERSION}" 
RUN ${IVY_CMD} -dependency "org.apache.spark" "spark-streaming-kafka-0-10-assembly_2.12" "${SPARK_VERSION}"

# Dependencies for database connection
ENV MYSQL_DB_VERSION "8.0.30"
RUN ${IVY_CMD} -dependency "mysql" "mysql-connector-java" "${MYSQL_DB_VERSION}"
ENV JDBC_JAR_FILE "${EXTRA_JAR_PATH}/mysql-connector-java-${MYSQL_DB_VERSION}.jar"

# Delete temp dir
RUN rm -rf ${IVY_PACKAGE_DIR}

#------------------------------------
# Prepare the system

WORKDIR /app/
USER root

# Workaround for "failure to login" error message: 
# cf. https://stackoverflow.com/questions/41864985/hadoop-ioexception-failure-to-login/56083736
RUN groupadd --gid 1001 spark
RUN useradd --uid 1001 --gid spark --shell /bin/bash spark
# End: Workaround

RUN apt-get update && apt-get install -y zip

# Workaround for "No module named numpy"
RUN python3 -m pip install numpy

RUN chown spark:spark /app/

USER spark
WORKDIR /app

#------------------------------------
# Prepare dependencies in ZIP file

# Prefetch Maven dependencies by running an empty python file using spark-submit
# to benefit from Docker's build cache
RUN echo -e 'IGNORE_THIS_ERROR' > /tmp/empty.py ; /opt/spark/bin/spark-submit --verbose \
	--conf "spark.jars.ivy=${IVY_PACKAGE_DIR}" \
	--packages "${EXTRA_PACKAGES}" \
	/tmp/empty.py ; rm -f /tmp/empty.py

# Prepare the app's python dependencies
ADD --chown=spark:spark requirements.txt /app/
RUN pip install --no-cache-dir -t /app/dependencies -r requirements.txt
RUN echo -e "Contents of /app/dependencies:\n" ; find /app/dependencies

# Zip all dependencies
WORKDIR /app/dependencies
RUN zip -r /app/dependencies.zip .

WORKDIR /app
RUN rm -rf /app/dependencies

#------------------------------------
# Copy the application code into the container

# Copy application code
COPY --chown=spark:spark src/*.py /app/

# Copy tweets data
COPY *.csv.gz /app/
RUN find /app/ -name '*.csv.gz' -print0 | xargs -0 -n1 gzip -d

#------------------------------------
# Set entrypoint and use dependencies zip file

# Use YARN deployment in client mode (requires Hadoop config)
# --master yarn --deploy-mode client"

# Use YARN deployment in cluster mode (requires Hadoop config)
# --master yarn --deploy-mode cluster

# Use local deployment
# --master local

ENTRYPOINT /opt/bitnami/spark/bin/spark-submit \
	--master local \
	--jars ${JDBC_JAR_FILE} \
	--verbose \
	--files /app/tweets.1600000.processed.noemoticon.csv \
	--py-files /app/dependencies.zip \
	/app/spark-app.py

CMD [""]
