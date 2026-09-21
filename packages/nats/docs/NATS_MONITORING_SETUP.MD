# Runbook: Deploy NATS Exporter + Prometheus/Grafana (AKS Automatic)

Run these from a shell with `kubectl`/`helm` context pointed at your AKS (Azure Kubernetes Service) Automatic cluster.

## 1. Create the Monitoring Namespace and Grafana Credentials Secret

Provision a manual Kubernetes secret containing both `admin-user` and `admin-password`:

```bash
kubectl create namespace monitoring

# Create secret with admin-user and admin-password keys
kubectl create secret generic grafana-admin-secret \
  --namespace monitoring \
  --from-literal=admin-user='admin' \
  --from-literal=admin-password='c4b9e712a8304f5e6d1c90a2b3f4e5d6'
```

## 2. Install kube-prometheus-stack (AKS Automatic Compatible)

Install `kube-prometheus-stack` with AKS Automatic safeguard flags (`nodeExporter.enabled=false`, `coreDns.enabled=false`, etc.) and explicit resource requests to prevent default 2GiB resource injection by AKS Safeguards:

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

Confirm the `PodMonitor` CRD landed:

```bash
kubectl get crd podmonitors.monitoring.coreos.com
```

## 3. Deploy NATS release with Exporter & PodMonitor enabled

Ensure `nats-values.yaml` includes lightweight resource requests:

```yaml
# nats-values.yaml
promExporter:
  enabled: true
  port: 7777
  podMonitor:
    enabled: true
  resources:
    requests:
      cpu: 50m
      memory: 64Mi
    limits:
      cpu: 100m
      memory: 128Mi

reloader:
  resources:
    requests:
      cpu: 10m
      memory: 32Mi
    limits:
      cpu: 50m
      memory: 64Mi

nats:
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 500m
      memory: 512Mi

natsBox:
  enabled: true
  resources:
    requests:
      cpu: 10m
      memory: 32Mi
    limits:
      cpu: 500m
      memory: 64Mi
```

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
# Open http://localhost:9090/targets and look for "nats-exporter"
```

Port-forward Grafana:

```bash
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80
# Open http://localhost:3000, log in as admin / password from Step 1
```

Import dashboard ID **2279** (official NATS server metrics) via Grafana's "Import dashboard" screen.
