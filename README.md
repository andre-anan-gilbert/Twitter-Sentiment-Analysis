# (!!! Lock: WIP adavidho !!!)

# Twitter Sentiment Analysis

The goal of this project is to showcase how to use Kubernetes, Docker, Kafka and PySpark to analyse the sentiment of tweets in real-time using machine learning. The Spark app uses a logistic regression model to predict the polarity of tweets that are streamed via Kafka and the results of the Spark jobs can be viewed via the Express.js app. 

## Contributors
- Andre-Anan Gilbert (3465546)
- David Hoffmann (2571020)
- Jan Henrik Bertrand (8556462)
- Marc Grün (9603221)
- Felix Noll (9467152)

## Table of Contents
1. [Business Use Case](#business-use-case)
2. [Application Architecture](#application-architecture)

     1. [Kubernetes](https://github.com/Andre-Gilbert/Twitter-Sentiment-Analysis/blob/main/README.md#kubernetes)
     2. [Kafka](https://github.com/Andre-Gilbert/Twitter-Sentiment-Analysis/blob/main/README.md#kafka)
     3. [PySpark ML](https://github.com/Andre-Gilbert/Twitter-Sentiment-Analysis/blob/main/README.md#pyspark-ml)
  
4. [Get Started](#get-started)

## Business Use Case

The business motivation of this project is to create a big data application which enables users to get an overview over trending Twitter post and the sentiment reflected by them. Through this functionality it has utility for personal, academic and corporate use cases. 

It allows personal users to better understand, what for some is, their primary source of information. 
Further, the applicaiton could be used a information basis for researchers to study sentiment of Twitter users toward certain topics and analyse their interactions. 
The application could also be used by commercial users to analyse user behaviour with a brand or a new product, offering valuable marketing insights.

Moreover the big data application offers an easy to use front end, to allow for easy interaction of versatile user groups.

## Application Architecture

The application is build as a kappa architecture compromised of a data ingestion layer, a stream processing system and a serving layer.

![application architecture diagram](https://github.com/Andre-Gilbert/Twitter-Sentiment-Analysis/blob/main/docs/application_kappa_architecture.png)


### Kubernetes

The individual components as seen in the big data application architecture above are containerized and orchestrated using Kubernetes. The individual resources and their functional relationships are shown in the following diagram:

- **Service**: Communication gateway to individual pods of a component.
- **Deployment**: Manage the pods and their lifecycle.
- **Ingress**: Routs and manages exernal access to the different components.

![application architecture diagram](https://github.com/Andre-Gilbert/Twitter-Sentiment-Analysis/blob/main/docs/kubernetis_resources.png)

### Kafka

The application has two distinct kafka topics. One for ingesting tweets into the streaming layer (spark) and one for tracking events occuring in the frontend, such as user interaction and engagement.

1. The first Kafka topic used for ingesting tweets is structured as shown in the follwoing examplary message:
```json
{
  "tweet_id": 0,
  "tweet": "content",
  "timestamp": 1604325221
}
```

2. The second topic which is used to track application events is structured as shown in the follwoing examplary message:
```json
{
  "event_type": ???,
  "timestamp": 1604326237
}
```



### PySpark ML

The Sentiment analysis of Twitter posts by the application, is done using a logistic regression algortihm. The final model is trained on the public [Sentiment140](http://help.sentiment140.com/for-students) dataset, which is structured as follows:

The data is a CSV with emoticons removed. Data file format has 6 fields:
1. The polarity of the tweet (0 = negative, 2 = neutral, 4 = positive)
2. The id of the tweet (2087)
3. The date of the tweet (Sat May 16 23:58:44 UTC 2009)
4. The query (lyx). If there is no query, then this value is NO_QUERY.
5. The user that tweeted (robotickilldozr)
6. The text of the tweet (Lyx is cool)

## Get Started

### Prerequisits

Once all docker and minikube are installed, the following steps can be used to get the prerequisits to deploy the application up and running:

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

To develop the application using [Skaffold](https://skaffold.dev/), run `skaffold dev` from the **src** folder.

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

In case an installation command fails, try to update the respective repo using one of the commands below or use the --debug flag with the installation command for further information.

```bash
helm repo update strimzi
helm repo update pfisterer-hadoop
```

If issues arise, try to redeploy k8s resources.

After initial startup it might fail if executed to quickly after starting kafka. Just re-run **skaffold dev** a little bit later.

Here are some commands to completely redeploy Hadoop and Kafka <br />
To delete strimzi resources

```bash
// Get resources managed by strimzi
kubectl get strimzi -o name
// Pass those resources to delete
kubectl delete <name>
```

To delete helm chart and helm repo

```bash
// Delete helm chart
helm list
helm delete <chartname>
// Delete helm repo
helm repo list
helm repo remove <repo_name>
// Now you can execute the commands from prequisites again.
```
