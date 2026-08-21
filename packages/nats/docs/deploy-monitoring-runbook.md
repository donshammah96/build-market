# Runbook: Deploy NATS Exporter + Prometheus/Grafana (AKS Automatic)

Run these from a shell with `kubectl`/`helm` context pointed at your AKS Automatic cluster.

## 1. Create the Monitoring Namespace and Secret

```bash
kubectl create namespace monitoring

kubectl create secret generic grafana-admin-secret \
  --namespace monitoring \
  --from-literal=admin-user='admin' \
  --from-literal=admin-password='c4b9e712a8304f5e6d1c90a2b3f4e5d6'
```

## 2. Install kube-prometheus-stack (AKS Automatic Compatible)

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --set grafana.admin.existingSecret=grafana-admin-secret \
  --set grafana.admin.passwordKey=admin-password \
  --set prometheus.prometheusSpec.retention=15d \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.storageClassName=managed-csi \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=20Gi \
  --set nodeExporter.enabled=false \
  --set coreDns.enabled=false \
  --set kubeDns.enabled=false \
  --set kubeEtcd.enabled=false \
  --set kubeControllerManager.enabled=false \
  --set kubeScheduler.enabled=false \
  --set kubeProxy.enabled=false \
  --set prometheusOperator.admissionWebhooks.enabled=false \
  --set grafana.sidecar.dashboards.resources.requests.cpu=50m \
  --set grafana.sidecar.dashboards.resources.requests.memory=64Mi \
  --set grafana.sidecar.datasources.resources.requests.cpu=50m \
  --set grafana.sidecar.datasources.resources.requests.memory=64Mi \
  --set grafana.resources.requests.cpu=100m \
  --set grafana.resources.requests.memory=128Mi \
  --set kube-state-metrics.resources.requests.cpu=50m \
  --set kube-state-metrics.resources.requests.memory=64Mi \
  --set prometheusOperator.resources.requests.cpu=100m \
  --set prometheusOperator.resources.requests.memory=128Mi
```

## 3. Deploy NATS release with Exporter & PodMonitor enabled

```bash
helm repo add nats https://nats-io.github.io/k8s/helm/charts/
helm repo update

helm upgrade --install nats nats/nats \
  -f nats-values.yaml \
  -f nats-exporter-values.yaml \
  -n synadia-deploy --create-namespace
```

## 4. Grafana & Prometheus Port-Forwarding

Port-forward Prometheus:

```bash
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090
```

Port-forward Grafana:

```bash
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80
```

Import dashboard ID **2279** (official NATS server metrics) via Grafana's "Import dashboard" screen.
