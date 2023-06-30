# Twitter Sentiment Analysis

## Contributors
- Andre-Anan Gilbert (3465546)
- David Hoffmann (2571020)
- Jan Henrik Bertrand (8556462)
- Marc Grün (9603221)
- Felix Noll (9467152)

```json
{
  "tweet_id": 0,
  "tweet": "content",
  "timestamp": 1604325221
}
```

## Dataset used for PySpark ML

Sentiment140: http://help.sentiment140.com/for-students

The data is a CSV with emoticons removed. Data file format has 6 fields:
1. The polarity of the tweet (0 = negative, 2 = neutral, 4 = positive)
2. The id of the tweet (2087)
3. The date of the tweet (Sat May 16 23:58:44 UTC 2009)
4. The query (lyx). If there is no query, then this value is NO_QUERY.
5. The user that tweeted (robotickilldozr)
6. The text of the tweet (Lyx is cool)

## Prerequisites

Open Docker Desktop

Start minikube

```bash
minikube start
```

A running Strimzi.io Kafka operator

```bash
helm repo add strimzi http://strimzi.io/charts/
helm upgrade --install my-kafka-operator strimzi/strimzi-kafka-operator
kubectl apply -f https://farberg.de/talks/big-data/code/helm-kafka-operator/kafka-cluster-def.yaml
```

A running Hadoop cluster with YARN (for checkpointing)

```bash
helm repo add pfisterer-hadoop https://pfisterer.github.io/apache-hadoop-helm/
helm upgrade --install my-hadoop-cluster pfisterer-hadoop/hadoop --namespace=default --set hdfs.dataNode.replicas=1 --set yarn.nodeManager.replicas=1 --set hdfs.webhdfs.enabled=true
```

## Deploy

To develop using [Skaffold](https://skaffold.dev/), use `skaffold dev`.

## Access the Application

```bash
minikube addons enable ingress
minikube tunnel
```

Access the application at: http://localhost.

Generate an URL alternatively

```bash
minikube service popular-slides-service --url
```

In case an installation command fails, try to update the respective repo using one of the commands below or use the --debug flag with the installation command for further information.

```bash
helm repo update strimzi
helm repo update pfisterer-hadoop
```

## Troubleshooting

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
