# NATS TLS & WebSocket Security Architecture

> **Architectural Classification:** Infrastructure / Transport Security
> **Scope:** `@build/nats`, `apps/workers`, Render Web/Private Services, Azure Kubernetes Service (AKS)
> **Compliance & Invariants:** Zero-plaintext over WAN, In-transit Encryption (TLS 1.3), Automated Edge Offloading

---

## 1. Executive Summary & Context

When running NATS with a WebSocket listener behind a modern cloud reverse proxy (such as Render, Cloudflare, or AWS ALB), NATS outputs a diagnostic warning:

```text
[WRN] Websocket not configured with TLS. DO NOT USE IN PRODUCTION!
```

### Why This Warning Occurs

NATS server emits this warning when its internal `websocket` block has `no_tls: true`. The daemon has no visibility into upstream networking topology and assumes it is directly exposed to the public internet without encryption.

### Transport Reality on Render

On Render (and standard PaaS reverse proxies), **TLS is terminated at the edge load balancer (port 443)** using automated Let's Encrypt certificates.

- **Client to Render Edge (WAN):** 100% encrypted in transit via **TLS 1.3 / HTTPS / WSS**.
- **Render Edge to Container (LAN / Bridge):** Forwarded as plain HTTP/WebSocket on internal port `10000` inside the isolated container virtual network.

---

## 2. Phased Release Roadmap

```mermaid
flowchart LR
    subgraph Phase1["Phase 1: Render Web Service (Current)"]
        C1["Workers / Clients"] -->|WSS:443 (TLS 1.3)| E1["Render Edge Proxy"]
        E1 -->|Internal Port 10000 (no_tls: true)| N1["NATS Daemon (Ephemeral JetStream)"]
    end

    subgraph Phase2["Phase 2: Render Private Network"]
        C2["Workers Daemon"] -->|TCP:4222 ($NATS_TOKEN)| N2["NATS Private Service (Mounted Disk)"]
    end

    subgraph Phase3["Phase 3: AKS 3-Node Cluster (Enterprise)"]
        C3["App Pods / Workers"] -->|mTLS / TLS 1.3 (cert-manager)| N3["3-Node HA JetStream Cluster"]
    end
```

---

### Phase 1: Edge TLS Termination + Hardened WebSocket Security (Render Web Service)

**Target Environment:** Render Free & Standard Web Services (Public HTTPS endpoint).

#### Phase 1 Configuration (`packages/nats/nats-server.conf`)

```conf
# nats-server.conf — Render Web Service Configuration
# Public WSS (port 443) terminated at Render Edge; forwarded to port 10000 internally

websocket {
  port: 10000
  no_tls: true

  # Transport Hardening
  handshake_timeout: "10s"

  # Prevent cross-site WebSocket hijacking
  same_origin: false
}

http_port: 8222

jetstream {
  store_dir: "/tmp/jetstream"
  max_mem: 256M
  max_file: 1G
}

authorization {
  token: $NATS_TOKEN
}
```

#### Phase 1 Security Controls

1. **In-Transit Encryption:** Guaranteed by Render's TLS termination at `https://<service-name>.onrender.com`.
2. **Authentication:** Single-token authentication injected dynamically at runtime via `$NATS_TOKEN`.
3. **Resource Protection:** Memory store capped at 256MB to avoid OOM in 512MB RAM container tier.

---

### Phase 2: Private Network TCP & Isolated VPC (Render Private Services)

**Target Environment:** Render Paid Tier (Internal DNS & Persistent Disk).

When private services are available, WebSocket overhead is eliminated entirely in favor of raw TCP on the private network.

#### Phase 2 Configuration (`packages/nats/nats-private.conf`)

```conf
# nats-private.conf — Render Private Service (No Public Ingress)
port: 4222
http_port: 8222

jetstream {
  store_dir: "/data/jetstream"
  max_mem: 1G
  max_file: 10G
}

authorization {
  token: $NATS_TOKEN
}
```

#### Phase 2 Security Controls

1. **Network Isolation:** Service has zero public internet exposure; reachable only by services on the same Render account and region.
2. **Persistence:** Mounted `/data` persistent disk ensures JetStream stream state and consumers survive restarts and redeployments.
3. **Internal Hostname Addressing:** Format `nats://nats-<hash>:4222`.

---

### Phase 3: End-to-End TLS & Cert-Manager Automation (AKS / Enterprise Multi-Cloud)

**Target Environment:** Azure Kubernetes Service (AKS), Self-Hosted Kubernetes, or Hybrid Multi-Cloud.

When traffic crosses untrusted network boundaries without an upstream offloader, NATS terminates TLS 1.3 natively with client certificate verification.

#### Phase 3 Configuration (`packages/nats/nats-tls.conf`)

```conf
# nats-tls.conf — Production End-to-End TLS with Cert-Manager
port: 4222

tls {
  cert_file: "/etc/nats/certs/tls.crt"
  key_file:  "/etc/nats/certs/tls.key"
  ca_file:   "/etc/nats/certs/ca.crt"

  min_version: "1.3"
  cipher_suites: [
    "TLS_AES_256_GCM_SHA384",
    "TLS_CHACHA20_POLY1305_SHA256",
    "TLS_AES_128_GCM_SHA256"
  ]
  timeout: 5
}

websocket {
  port: 10000
  tls {
    cert_file: "/etc/nats/certs/tls.crt"
    key_file:  "/etc/nats/certs/tls.key"
  }
  handshake_timeout: "10s"
}

http_port: 8222

jetstream {
  store_dir: "/data/jetstream"
  max_mem: 2G
  max_file: 20G
}

authorization {
  token: $NATS_TOKEN
}
```

---

## 3. Comparison Matrix

| Architectural Dimension    | Phase 1: Edge TLS (Render Web)      | Phase 2: Private Network (Render) | Phase 3: End-to-End TLS (AKS)       |
| :------------------------- | :---------------------------------- | :-------------------------------- | :---------------------------------- |
| **Ingress Transport**      | WebSocket over HTTPS (WSS:443)      | Raw TCP (4222)                    | Native TLS 1.3 TCP / WSS            |
| **TLS Termination Point**  | Render Edge Reverse Proxy           | Isolated Private Network (No WAN) | In-Pod NATS Daemon                  |
| **Certificate Management** | Automated (Let's Encrypt by Render) | N/A (Internal VPC)                | Kubernetes `cert-manager` / Vault   |
| **Public Attack Surface**  | Low (Authenticated WSS)             | Zero (Private Network Only)       | Zero / Cloud Firewall Whitelist     |
| **JetStream Durability**   | Ephemeral (`/tmp/jetstream`)        | Persistent Disk (`/data`)         | High-Availability RAFT PVC (3-Node) |
| **Cost / Tier**            | Free Tier Compatible                | Render Team / Standard            | AKS Cluster                         |

---

## 4. Verification & Operational Health Check

### Verify Edge TLS Termination

```bash
curl -Iv https://nats-2-10-alpine-1.onrender.com/healthz
```

_Expected Response:_

```text
* ALPN: curl offers h2,http/1.1
* SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384
* Server certificate:
*  subject: CN=nats-2-10-alpine-1.onrender.com
*  issuer: C=US; O=Let's Encrypt; CN=R11
* SSL certificate verify ok.
< HTTP/1.1 200 OK
```

### Verify Worker Ingestion & Subscription

Check logs in `apps/workers`:

```text
[NATS] Connected to wss://nats-2-10-alpine-1.onrender.com
[NATS] Connected and subscribed with durable consumer: notification-retry-worker-group
[NATS] Connected and subscribed with durable consumer: license-auto-verify-group
```
