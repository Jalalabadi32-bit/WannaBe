# WANNABE Production Deployment Guide

> Complete operations manual for deploying WANNABE to public cloud instances (AWS, GCP, DigitalOcean, Hetzner, Bare Metal) with automated TLS, rate limiting, and zero exposed backend ports.

---

## 1. Architecture & Threat Model

In public deployment, WANNABE operates under a **Zero Exposed Backend Ports** architecture:

```
                            PUBLIC INTERNET
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │     Host Firewall (UFW)     │
                    │   Allow 22, 80, 443 only    │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
              ┌─────────────────────────────────────────┐
              │     Frontend & Hardened Nginx Proxy     │
              │  • Port 80: ACME Challenge / Redirect   │
              │  • Port 443: TLS 1.2/1.3 + HSTS         │
              │  • Edge Rate Limiting (15 r/s, burst 30)│
              │  • SPA Static Assets (Cache-Control)    │
              │  • SSE Buffering Disabled (Live Streams)│
              │  • Blocked Public /metrics Endpoint     │
              └──────────────┬──────────────────────────┘
                             │
             INTERNAL DOCKER NETWORK (wannabe-net)
                             │
       ┌─────────────────────┼─────────────────────┐
       │                     │                     │
       ▼                     ▼                     ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Fastify API (:3000) │  │  Redis 7 (:6379) │  │  Ollama (:11434) │
│ • trustProxy: true│  │  • Auth required│  │  • Gemma 4/3     │
│ • Secrets check   │  │  • Persistent vol│ │  • Isolated host │
│ • CORS whitelist  │  └──────────────────┘  └──────────────────┘
└────────┬─────────┘
         │ Scrapes metrics
         ▼
┌──────────────────┐
│Prometheus (:9090)│
│ • Localhost only │
└──────────────────┘
```

### Security Guarantees
1. **Network Isolation**: The Fastify API Gateway (`3000`), Redis (`6379`), and Ollama (`11434`) do NOT bind to host ports. They are reachable exclusively through Nginx across the private Docker bridge network.
2. **Prometheus Shielding**: Prometheus (`9090`) is bound exclusively to `127.0.0.1:9090`. It cannot be queried from the public internet without an SSH tunnel.
3. **Hardened Secrets**: Fastify refuses to boot in `NODE_ENV=production` if default or development secret keys are detected.
4. **Edge DoS Protection**: Nginx enforces token-bucket rate limits (`15 req/s` per IP with burst `30`) and connection limits (`20` concurrent connections per IP).
5. **Real IP Preservation**: Fastify has `trustProxy: true` enabled, ensuring rate limiting and security logs accurately track visitor IPs via `X-Forwarded-For`.

---

## 2. Server Requirements

| Component | Minimum | Recommended (with GPU) |
|---|---|---|
| **OS** | Ubuntu 22.04 LTS / 24.04 LTS, Debian 12 | Ubuntu 22.04 / 24.04 LTS |
| **CPU** | 4 vCPUs (x86_64 or ARM64) | 8 vCPUs |
| **RAM** | 8 GB | 16 GB+ |
| **GPU** | None (CPU inference supported) | NVIDIA RTX 3060/4060/5050+ (8 GB+ VRAM) |
| **Storage** | 30 GB SSD | 60 GB NVMe SSD |
| **Ingress** | Ports `80` (HTTP) and `443` (HTTPS) open | Ports `80` and `443` |

---

## 3. Step-by-Step Deployment

### Step 1: Firewall Configuration
On your Linux host, lock down incoming ports to SSH, HTTP, and HTTPS:
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (ACME challenge & HTTPS redirect)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### Step 2: Configure DNS
Create an **A Record** on your domain registrar or Cloudflare pointing to your server's public IP:
```
Type: A
Name: scanner  (or @ for apex domain)
Value: <YOUR_SERVER_PUBLIC_IP>
TTL: Auto / 300
```
Verify resolution:
```bash
dig +short scanner.yourdomain.com
```

### Step 3: Clone Repository & Create Environment Configuration
```bash
git clone https://github.com/Jalalabadi32-bit/WannaBe.git /opt/wannabe
cd /opt/wannabe

# Copy production template
cp .env.production.example .env
```

Generate strong cryptographic keys:
```bash
# Generate JWT Secret
openssl rand -hex 32

# Generate API Key
openssl rand -hex 32

# Generate Redis Password
openssl rand -hex 24
```

Edit `.env` and fill in:
- `DOMAIN_NAME=scanner.yourdomain.com`
- `SSL_EMAIL=security@yourdomain.com`
- `JWT_SECRET=<generated_jwt_secret>`
- `WANNABE_API_KEY=<generated_api_key>`
- `REDIS_PASSWORD=<generated_redis_password>`
- `CORS_ORIGIN=https://scanner.yourdomain.com`

### Step 4: Run Pre-Flight Validation
Ensure all prerequisites and security configurations pass:
```bash
bash deploy/validate-prod.sh
```

### Step 5: Start Production Containers
Launch the production stack:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

> **Note**: On the first start, Nginx will automatically generate a self-signed fallback certificate so it can bind port 443 immediately without crashing. In the background, `ollama-init` will pull the Gemma model.

Check container statuses:
```bash
docker compose -f docker-compose.prod.yml ps
```

### Step 6: Provision Official Let's Encrypt TLS Certificate
Run the turnkey SSL provisioning tool:
```bash
bash deploy/init-ssl.sh
```
This script will:
1. Complete the HTTP-01 ACME challenge against Let's Encrypt.
2. Install the production certificates into `./deploy/certs/`.
3. Reload Nginx gracefully without downtime.
4. Activate Certbot's automatic 12-hour renewal worker.

---

## 4. Verification & Testing

Verify that your deployment is secure:

### 1. Test HTTPS and Security Headers
```bash
curl -I https://scanner.yourdomain.com/
```
Expected response headers:
```http
HTTP/2 200
server: nginx
strict-transport-security: max-age=31536000; includeSubDomains; preload
x-content-type-options: nosniff
x-frame-options: SAMEORIGIN
referrer-policy: strict-origin-when-cross-origin
content-security-policy: ...
```

### 2. Verify Port Isolation
Verify that backend ports are NOT exposed on `0.0.0.0`:
```bash
# On the server host:
ss -tuln | grep -E ':(3000|6379|11434|9090)'
```
You should see **no bindings** on `0.0.0.0` for 3000, 6379, or 11434. Port 9090 should only show `127.0.0.1:9090`.

### 3. Verify Health Probes
```bash
curl -f https://scanner.yourdomain.com/healthz
curl -f https://scanner.yourdomain.com/readyz
```

### 4. Verify Metrics Protection
Public access to Prometheus metrics should be blocked:
```bash
curl -I https://scanner.yourdomain.com/metrics
# Expected: HTTP 403 Forbidden
```

---

## 5. Operations & Maintenance

### Accessing Prometheus Metrics Securely
Prometheus is bound to loopback `127.0.0.1:9090`. To access the Prometheus dashboard locally on your workstation, create an SSH tunnel:
```bash
ssh -L 9090:127.0.0.1:9090 user@your-server-ip
```
Then open `http://localhost:9090` in your workstation's browser.

### Inspecting Logs
Container logs are capped with size rotation (`max-size: 20m`, `max-file: 5`):
```bash
# View all logs
docker compose -f docker-compose.prod.yml logs -f

# View API logs only
docker compose -f docker-compose.prod.yml logs -f api

# View Nginx access & error logs
docker compose -f docker-compose.prod.yml logs -f frontend
```

### Zero-Downtime Updates
To update WANNABE to the latest release:
```bash
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```

### Backup Redis Cache
```bash
docker compose -f docker-compose.prod.yml exec redis sh -c \
  'redis-cli -a "$REDIS_PASSWORD" bgsave'
```
The snapshot is saved to Docker volume `redis_data` at `/data/dump.rdb`.
