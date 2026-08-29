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

---

## 6. Deployment on Render (Free Tier vs Production)

### A. Render Free Tier Web Service (Current Setup)

On Render's Free Tier, private services, internal DNS hostnames, and persistent disks are unavailable. The service runs as a **Web Service** reachable via its public HTTPS/WSS URL:

1. **Deploy NATS on Render:**
   - Service Type: **Web Service**
   - Dockerfile Path: `packages/nats/Dockerfile`
   - Health Check Path: `/healthz` (or `/varz`)
2. **Environment Variables on NATS Service:**
   - Set `NATS_TOKEN` to your secret token .
3. **Configure Worker Service (`apps/workers` on Render):**
   - Set `NATS_URL=https://<your-service-name>.onrender.com` (e.g. `https://nats-2-10-alpine-1.onrender.com`).
   - Set `NATS_TOKEN=<your-secret-token>`.
   - The `@build/nats` client uses `nats.ws` to connect securely over WebSocket through Render's TLS reverse proxy.

### B. Render Paid Tier / Multi-Node Cluster Roadmap

When upgrading to Render paid tiers:

1. Switch NATS to a **Private Service** with a mounted persistent disk at `/data`.
2. Use internal hostname: `NATS_URL=nats://nats-<hash>:4222`.
3. For HA clustering: Deploy 3 private services (`nats-1`, `nats-2`, `nats-3`) with `cluster` blocks pointing to each other for RAFT quorum.

For zero-downtime JetStream RAFT quorum:

1. Create 3 private services: `nats-1`, `nats-2`, `nats-3` (each with its own mounted `/data` disk).
2. Configure `cluster` block in each `nats-server.conf` pointing to the other two nodes via their internal hostnames (`routes: ["nats-route://nats-2-<hash>:6222", "nats-route://nats-3-<hash>:6222"]`).
3. Point workers to all 3 servers: `NATS_URL=nats://nats-1-<hash>:4222,nats://nats-2-<hash>:4222,nats://nats-3-<hash>:4222`.

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
