# Twitter Sentiment Analysis

```json
{
  "tweet_id": 0,
  "tweet": "content",
  "timestamp": 1604325221
}
```

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
minikube service popular-slides-service --url
```

In case an installation command fails, try to update the respective repo using one of the commands below or use the --debug flag with the installation command for further information.

```bash
helm repo update strimzi
helm repo update stable
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

Ingress
To utilize Ingress, you need an Ingress controller.
With Minikube

```bash
minikube addons enable ingress
```
