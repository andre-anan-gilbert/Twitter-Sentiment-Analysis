# <img width="25" height="25" src="https://upload.wikimedia.org/wikipedia/commons/6/6f/Logo_of_Twitter.svg" alt="Twitter Icon"> Twitter Sentiment Analysis

The goal of this project is to showcase how to use Kubernetes, Docker, Kafka and PySpark to analyse the sentiment of tweets in real-time using machine learning. The Spark app uses a logistic regression model to predict the sentiment of tweets that are streamed via Kafka and the results of the Spark jobs can be viewed via the Express.js app.

<video src="docs/Screencast.mp4" controls title="Title"></video>

[This renders the screencast on GitHub]: <>
https://github.com/Andre-Gilbert/Twitter-Sentiment-Analysis/assets/59315862/215677f9-bc7f-4fed-9d86-e708e8bb781f


<br>
The final Project presentation can be found [here](https://github.com/Andre-Gilbert/Twitter-Sentiment-Analysis/blob/main/docs/Presentation.pdf).

## Contributors

- André Anan Gilbert (3465546)
- David Hoffmann (2571020)
- Jan Henrik Bertrand (8556462)
- Marc Grün (9603221)
- Felix Noll (9467152)

## Table of Contents

1. [Business Use Case](#business-use-case)
2. [Application Architecture](#application-architecture)

   1. [Kubernetes](#kubernetes)
   2. [Kafka](#kafka)
   3. [PySpark ML](#pyspark-ml)

3. [Get Started](#get-started)
   1. [Prerequisites](#prerequisites)
   2. [Deploy](#deploy)
   3. [Troubleshooting](#troubleshooting)

## Business Use Case

The business motivation of this project is to create a big data application which enables users to get an overview of trending Twitter posts and the sentiment reflected by them. Through this functionality, it has utility for personal, academic and corporate use cases.

It allows personal users to better understand what, for some, is their primary source of information.
Further, the application could be used as an information basis for researchers to study the sentiment of Twitter users towards certain topics and analyse their interactions.
In addition to that, the application could also be used by commercial users to analyse user behaviour with a brand or a new product, offering valuable marketing insights.

Moreover, the big data application offers an easy-to-use front end, to allow for easy interaction of versatile user groups.

## Application Architecture

The application is built as a kappa architecture composed of a data ingestion layer, a stream processing system and a serving layer. First the web app acts as a data producer which sends tweets and application events to the Kafka broker. The spark app consumes the tweets and events, aggregates them, predicts the sentiment of the tweets in the current batch, and saves the result to MariaDB. To avoid data from being pulled from the database every time, memcached is used to store query results in-memory.

![application architecture diagram](/docs/application_kappa_architecture.png)

In the following, some of the components are explained in more detail.

### Kubernetes

The individual components as seen in the big data application architecture above are containerized and orchestrated using Kubernetes. The individual resources and their functional relationships are shown in the following diagram:

- **Service**: Acts as a communication gateway and load balancer for individual pods of a component. It keeps track of the list of IPs of active pods and updates it as pods die and dynamically restart. This is done by using tags, which not only ensures that traffic is forwarded to the right pods, but also enables seemless rolling deployments by changing the tag assigned to pods with the new version of a container image.
- **Deployment**: Manages the pods and their lifecycle.
- **Ingress**: Routs and manages external access to the different components.

![application architecture diagram](/docs/kubernetis_resources.png)

### Kafka

The application has two distinct kafka topics. One for ingesting tweets into the streaming layer (spark) and one for tracking events occurring in the frontend, such as user interaction and engagement.

1. The first Kafka topic used for ingesting tweets is structured as shown in the following exemplary:

   ```json
   {
     "tweet_id": 0,
     "tweet": "content",
     "timestamp": 1604325221
   }
   ```

2. The second topic which is used to track application events is structured as shown in the following exemplary message:
   ```json
   {
     "event_type": "streamed",
     "timestamp": 1604326237
   }
   ```
   Alternative event types are "clicked" or "fetched".

To produce to multiple topics at the same time, the ingestion into kafka is done via a batch.

### PySpark ML

The sentiment analysis of Twitter posts by the application is done using a logistic regression algorithm. As a datasource we used the public [Sentiment140](http://help.sentiment140.com/for-students) dataset, which is a CSV with emoticons removed. The data file format has 6 fields:

1. The sentiment (polarity) of the tweet (0 = negative, 2 = neutral, 4 = positive)
2. The id of the tweet (e.g. 2087)
3. The date of the tweet (e.g. Sat May 16 23:58:44 UTC 2009)
4. The query (lyx). If there is no query, then this value is NO_QUERY.
5. The user that tweeted (e.g. robotickilldozr)
6. The text of the tweet (e.g. "Lyx is cool")

Before this data can be used for training, the following four preprocessing steps are applied. Firstly, the text field is cleaned using regular expressions, replacing special characters such as HTML codes and removing @mentions, and #tags. Then the data is split into train- and test-partition, using a 90:10 split. Next, the tweets are tokenized and vectorized, based on the frequency (count) of each word that occurs in the entire text, using the respective Spark ML native methods. As a last step, IDF (inverse document frequency) is applied.

The train partition is then used to learn the logistic regression model used for sentiment classification, which is then evaluated on the test partition.

## Get Started

### Prerequisites

Once all docker and minikube are installed, the following steps can be used to get the prerequisites necessary, to deploy the application up and running:

1. Start Docker (Open Docker Desktop)

2. Next minikube should be started. To do this, run:

   ```bash
   minikube start --addons=ingress
   ```

3. Setup the Strimzi.io Kafka operator:

   ```bash
   helm repo add strimzi http://strimzi.io/charts/
   helm upgrade --install my-kafka-operator strimzi/strimzi-kafka-operator
   kubectl apply -f https://farberg.de/talks/big-data/code/helm-kafka-operator/kafka-cluster-def.yaml
   ```

4. Create a Hadoop cluster with YARN (for checkpointing):

   ```bash
   helm repo add pfisterer-hadoop https://pfisterer.github.io/apache-hadoop-helm/
   helm upgrade --install my-hadoop-cluster pfisterer-hadoop/hadoop --namespace=default --set hdfs.dataNode.replicas=1 --set yarn.nodeManager.replicas=1 --set hdfs.webhdfs.enabled=true
   ```

### Deploy

To develop the application using [Skaffold](https://skaffold.dev/), run the following command from the **src** folder:

```bash
skaffold dev
```

### Access the Application

There are two ways to connect to the application.

1. To connect to LoadBalancer services, run:

   ```bash
   minikube tunnel
   ```

   Once this is done, the application can be accessed through: http://localhost.

2. Alternatively, you can generate a URL using:

   ```bash
   minikube service popular-slides-service --url
   ```

### Troubleshooting

#### Install

In case an installation command fails, try to update the respective helm repo using one of the commands below:

```bash
helm repo update strimzi
helm repo update pfisterer-hadoop
```

#### Deployment

If issues arise, try to redeploy k8s resources.

After initial startup, **skaffold dev** might fail if executed too quickly after starting kafka. Just re-run **skaffold dev** after waiting a short period.

If deployment still doesn't work, here are some commands to completely redeploy Hadoop and Kafka.

To delete strimzi resources:

```bash
// Get resources managed by strimzi
kubectl get strimzi -o name
// Pass those resources to delete
kubectl delete <name>
```

To delete a helm chart:

```bash
helm list
helm delete <chartname>
```

To delete a helm repo:

```bash
helm repo list
helm repo remove <repo_name>
```

Now you can execute the commands from prequisites again.
