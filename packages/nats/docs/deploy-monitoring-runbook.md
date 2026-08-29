# Runbook: Deploy NATS 3-Node Cluster + Exporter + Prometheus/Grafana (AKS)

Run these commands from a workstation with `kubectl` and `helm` configured for your Azure Kubernetes Service (AKS) cluster.

---

## 1. Create Namespaces and Secrets

```bash
# Monitoring Namespace
kubectl create namespace monitoring

kubectl create secret generic grafana-admin-secret \
  --namespace monitoring \
  --from-literal=admin-user='admin' \
  --from-literal=admin-password='c4b9e712a8304f5e6d1c90a2b3f4e5d6'

# NATS Deployment Namespace
kubectl create namespace synadia-deploy

# NATS Authentication Token Secret
kubectl create secret generic nats-auth-secret \
  --namespace synadia-deploy \
  --from-literal=token='YOUR_HIGH_ENTROPY_SECRET_TOKEN_HERE'
```

---

## 2. (Optional) Create TLS Secret for Cross-Network WAN Clients (Render Workers)

If exposing NATS across cloud boundaries (e.g. Render workers connecting to AKS NATS), TLS is mandatory:

```bash
# Using cert-manager or manual certs:
kubectl create secret tls nats-server-tls \
  --namespace synadia-deploy \
  --cert=path/to/tls.crt \
  --key=path/to/tls.key
```

---

## 3. Install kube-prometheus-stack (AKS Compatible)

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

---

## 4. Deploy NATS 3-Node Cluster with JetStream and Exporter

```bash
helm repo add nats https://nats-io.github.io/k8s/helm/charts/
helm repo update

helm upgrade --install nats nats/nats \
  -f packages/nats/nats-values.yaml \
  -f packages/nats/nats-exporter-values.yaml \
  -n synadia-deploy
```

---

## 5. Verify Cluster Topology and JetStream Quorum

Exec into the NATS Box utility pod:

```bash
kubectl exec -it -n synadia-deploy deployment/nats-box -- nats server list
kubectl exec -it -n synadia-deploy deployment/nats-box -- nats rtt
kubectl exec -it -n synadia-deploy deployment/nats-box -- nats stream list
```

---

## 6. Configuring Render Workers for Remote Connectivity

In the Render dashboard for `apps/workers`:

1. Set `NATS_URL`: `tls://<YOUR-AKS-STATIC-IP-OR-DOMAIN>:4222`
2. Set `NATS_TOKEN`: Matches the token stored in `nats-auth-secret`
3. Verify connection in worker logs:
   ```
   [NATS] Connected and subscribed with durable consumer: notification-retry-worker-group
   [NATS] Connected and subscribed with durable consumer: license-auto-verify-group
   ```

---

## 7. Grafana & Prometheus Port-Forwarding

Port-forward Prometheus:

```bash
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090
```

Port-forward Grafana:

```bash
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80
```

Import dashboard ID **2279** (official NATS server metrics) via Grafana's "Import dashboard" screen.
