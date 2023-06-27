# Use Case: Popular NASA Shuttle Missions

```json
{
  "mission": "sts-10",
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

## Access the APP

```bash
minikube service popular-slides-service --url
```

## Troubleshooting

If issues arise, try to redeploy k8s resources.

After initial startup it might fail if executed to quickly after starting kafka. Just re-run **skaffold dev** a little bit later.

Here are some commands to completely redeploy Hadoop and Kafka
To delete strimzi resources

```bash
// get resources managed by strimzi
kubectl get strimzi -o name
# pass those resources to delete
kubectl delete <name>
To delete helm chart and helm repo
```

```bash
// delete helm chart
helm list
helm delete <chartname>
// delete helm repo
helm repo list
helm repo remove
Now you can execute the commands from prequisites again.
```

Ingress
To utilize Ingress, you need an Ingress controller.
With Minikube

```bash
minikube addons enable ingress
```
