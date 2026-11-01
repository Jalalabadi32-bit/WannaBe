# WANNABE Free-Tier Cloud Deployment Guide

> Deploy WANNABE completely free using **Vercel Hobby** (Frontend) and **Render Free** (API Gateway) with zero infrastructure costs, automated TLS subdomains, and no credit card required.

---

## Architecture Overview

```
                      100% FREE CLOUD TIER
                      
  Web Browser / Visitor
           │
           ├──────────────────────────┐
           │ Static SPA Assets        │ REST API & SSE Streams
           ▼                          ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│       Vercel Hobby        │   │        Render Free        │
│    (React 18 Dashboard)   │   │   (Fastify REST Gateway)  │
│                           │   │                           │
│ • URL:                    │   │ • URL:                    │
│   https://*.vercel.app    │   │   https://*.onrender.com  │
│ • Automated CI/CD on git  │   │ • 512 MB RAM / 0.1 CPU    │
│ • SPA Rewrites (index)    │   │ • In-Memory Cache         │
│ • Free SSL / CDN Edge     │   │ • Deterministic AI Engine │
└───────────────────────────┘   └─────────────┬─────────────┘
                                              │
                                              ▼
                                ┌───────────────────────────┐
                                │      Sandbox Storage      │
                                │   /tmp/wannabe-sandboxes  │
                                │   • Fetches npm tarballs  │
                                │   • Clones Git tags       │
                                │   • AST & Entropy Analysis│
                                └───────────────────────────┘
```

### Key Highlights
- **AI Explanations**: Uses WANNABE's **built-in deterministic rule engine** (`WANNABE_FORCE_DETERMINISTIC_AI=true`). Produces full risk scores (0–100), risk levels, threat breakdowns, and plain-English recommendations in **0ms** without requiring a GPU or Ollama.
- **Database / Cache**: Uses WANNABE's built-in in-memory cache and volatile scan store with **no Redis or PostgreSQL** required.
- **Cross-Origin Security**: Render API is configured with wildcard CORS matching (`https://*.vercel.app`), allowing your Vercel production and preview deployments to communicate seamlessly.

---

## Step 1: Deploy API to Render Free (5 minutes)

### Option A — 1-Click Render Blueprint (Recommended)
1. Push your repository to GitHub.
2. Log in to [render.com](https://render.com).
3. In the Render Dashboard, click **New +** > **Blueprint**.
4. Connect your GitHub repository.
5. Render will automatically detect [`render.yaml`](../render.yaml) and configure:
   - **Service Name**: `wannabe-api`
   - **Environment**: Node
   - **Plan**: Free
   - **Build Command**: `npm ci && npm run build:api`
   - **Start Command**: `npm run start:api`
   - **Auto-generated Secrets**: `JWT_SECRET` and `WANNABE_API_KEY`
   - **Deterministic AI**: `WANNABE_FORCE_DETERMINISTIC_AI=true`
6. Click **Apply**.
7. Once deployment finishes, copy:
   - Your Render URL: `https://wannabe-api.onrender.com`
   - Your generated `WANNABE_API_KEY` from the service's **Environment** tab.

### Option B — Manual Render Setup
If creating a Web Service manually:
- **Build Command**: `npm ci && npm run build:api`
- **Start Command**: `npm run start:api`
- **Health Check Path**: `/healthz`
- **Environment Variables**:
  - `NODE_ENV`: `production`
  - `HOST`: `0.0.0.0`
  - `WANNABE_FORCE_DETERMINISTIC_AI`: `true`
  - `JWT_SECRET`: *(Generate a 32-char hex string: `openssl rand -hex 32`)*
  - `WANNABE_API_KEY`: *(Generate an API key: `openssl rand -hex 32`)*
  - `CORS_ORIGIN`: `https://*.vercel.app,http://localhost:5173`
  - `TRUST_PROXY`: `true`

---

## Step 2: Deploy Frontend to Vercel Hobby (3 minutes)

1. Log in to [vercel.com](https://vercel.com).
2. Click **Add New...** > **Project** and select your repository.
3. Vercel will automatically detect the root [`vercel.json`](../vercel.json):
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build:frontend`
   - **Output Directory**: `packages/frontend/dist`
4. Expand **Environment Variables** and add:
   | Key | Value | Description |
   |---|---|---|
   | `VITE_API_BASE_URL` | `https://wannabe-api.onrender.com` | Your Render API service URL from Step 1 |
   | `VITE_API_KEY` | *(your generated WANNABE_API_KEY)* | Key from Render environment tab |
5. Click **Deploy**.
6. Vercel will build and assign you a free subdomain (e.g. `https://wannabe.vercel.app`).

---

## Step 3: Verify End-to-End Connection

1. Open your Vercel URL in your browser: `https://wannabe.vercel.app`.
2. Look at the top right header status badge:
   - 🟢 **API Online**: Connected and ready to scan!
   - 🟡 **API Offline**: Render service is waking up from sleep (see Cold Starts below). Click the refresh icon to re-check.
3. Run a test verification:
   - Package: `lodash`
   - Version: `4.17.21`
   - Source Git Repository: `https://github.com/lodash/lodash`
   - Git Tag: `4.17.21`
4. Click **Start Security Verification**.
5. Watch live SSE progress updates:
   - `Fetching package tarball`
   - `Extracting tarball`
   - `Cloning git release tag`
   - `Analyzing AST & entropy`
   - `Evaluating AI verdict (deterministic mode)`
   - `Completed`

---

## Understanding Render Free Tier Cold Starts

Render Free Web Services automatically enter sleep mode after **15 minutes of inactivity** to conserve resources.

- **Wake-up Time**: When a visitor accesses the site while Render is sleeping, the first request takes **30–50 seconds** while Render spins up the container.
- **Built-in Demo Mode**: While Render is spinning up, users can click **Clean Baseline** or **Tampered Package** in the header to immediately explore full interactive security reports and diff viewers with zero waiting.
- **Keeping It Awake (Optional)**: If you want to prevent sleep mode during demonstrations or hackathon judging, use a free uptime monitoring service like [UptimeRobot](https://uptimerobot.com) to ping `https://wannabe-api.onrender.com/healthz` every 10 minutes.

---

## Transitioning to Custom Domains or Self-Hosting

When you are ready to move from free subdomains to custom domains or self-hosted Docker instances:
- See the [Docker Deployment Guide](DEPLOYMENT.md) for self-hosting with Docker Compose, Nginx SSL, and local GPU acceleration via Ollama.
