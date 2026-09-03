# Production Deployment Guide: Supabase + Koyeb + Cloudflare Pages

This guide walks you through deploying the **IoT Remote Monitoring Dashboard (Wagon Bulge Detection System)** using a **100% free cloud stack**:

| Component | Service | Free Tier Allowance | Role |
| :--- | :--- | :--- | :--- |
| **Database** | **Supabase Cloud** | 500 MB Vanilla PostgreSQL | Stores devices, telemetry, users, alerts |
| **Backend & MQTT** | **Koyeb** | 512 MB RAM, 24/7 Eco Worker | FastAPI REST, WebSockets, EMQX MQTT subscriber |
| **Frontend UI** | **Cloudflare Pages** | Unlimited static hosting | React 19 + Vite dashboard |

---

## Critical Requirement: 24-Hour Rolling Retention (500 MB Free Tier)

> [!WARNING]
> With 50 sensors sending telemetry every 3 seconds, uncompressed data generates **~192 MB/day**.
> Without automatic cleanup, **Supabase's 500 MB free storage limit will fill up in less than 3 days**.
> 
> To prevent any crashes during your demo, this project implements a **Dual-Layer Retention System**:
> 1. **Supabase Native (`pg_cron`)**: Automatically purges records older than 24 hours every hour inside the database engine.
> 2. **Backend Application Safeguard**: FastAPI periodically deletes records older than 24 hours as an automatic fallback.
> 
> **Result**: Database storage stays stably under **~200 MB**, running indefinitely within the free tier!

---

## Step 1: Database Setup on Supabase

### 1.1 Create a New Project
1. Log in to [Supabase](https://supabase.com).
2. Click **New Project**.
3. Choose an Organization, give your project a name (e.g., `iot-monitoring-db`), and set a **strong database password** (save this password!).
4. Choose the region closest to your target demo location (e.g., `Southeast Asia (Singapore)` or `South Asia (Mumbai)`).
5. Click **Create new project** and wait ~2 minutes for provisioning.

### 1.2 Run the Database Schema & pg_cron Script
1. In the Supabase left sidebar, click **SQL Editor**.
2. Click **+ New Query**.
3. Open [`infrastructure/database/supabase_init.sql`](file:///c:/Users/sumit/Desktop/INSYS/IoT-Remote-Monitoring-Dashboard/infrastructure/database/supabase_init.sql) from this repository, copy the full contents, and paste into the Supabase SQL Editor.
4. Click **Run** (or press `Ctrl + Enter`).
5. Confirm the query returns:
   ```text
   status: IoT Dashboard Supabase database initialized successfully
   ```

### 1.3 Verify the 24-Hour Retention Cron Job
In the Supabase SQL Editor, run:
```sql
SELECT jobid, jobname, schedule, command, active FROM cron.job;
```
You should see:
```text
jobname: purge-telemetry-hourly
schedule: 0 * * * *
command: SELECT purge_old_telemetry(INTERVAL '24 hours');
active: true
```

### 1.4 Retrieve your Connection String (Supavisor Pooler)
1. Go to **Project Settings** (gear icon) -> **Database**.
2. Scroll down to **Connection parameters** / **Connection string**.
3. Select **URI** tab and click **Mode: Session** (or **Transaction**).
   - *Example format:*
     `postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres`
4. Replace `[YOUR-PASSWORD]` with your actual database password.
5. Save this URI; you will enter it into Koyeb in Step 2.

> [!TIP]
> The backend automatically converts `postgresql://` to `postgresql+asyncpg://` and configures `statement_cache_size=0`, so standard Supabase connection strings work seamlessly out-of-the-box!

---

## Step 2: Backend & MQTT Worker Setup on Koyeb

Koyeb hosts the Python container running FastAPI and the continuous EMQX MQTT subscriber without sleeping.

### 2.1 Push your Code to GitHub
Ensure all changes from this repository are committed and pushed to your GitHub repository:
```bash
git add .
git commit -m "Configure deployment for Supabase, Koyeb, and Cloudflare Pages"
git push origin main
```

### 2.2 Create Koyeb Service
1. Log in to [Koyeb](https://www.koyeb.com).
2. Click **Create Service**.
3. Select **GitHub** as the deployment method.
4. Select your GitHub repository.

### 2.3 Configure Build Settings
- **Builder**: Select **Dockerfile**.
- **Work directory / Context**: `backend`
- **Dockerfile location**: `Dockerfile` (or if Koyeb uses repo root: Work directory: `.` and Dockerfile path: `backend/Dockerfile`).
- **Instance Type**: Select **Eco** (`512MB RAM` - Free Tier).

### 2.4 Configure Ports & Health Check
- **Port**: `8000` (Protocol: `HTTP`).
- **Public route**: `/` mapped to port `8000`.

### 2.5 Set Environment Variables
In the **Environment Variables** section on Koyeb, add:

| Key | Value | Notes |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://postgres.[REF]:[PASS]@[POOLER]:5432/postgres` | From Step 1.4 |
| `MQTT_BROKER_HOST` | `j18eff7a.ala.asia-southeast1.emqxsl.com` | EMQX Cloud Broker |
| `MQTT_BROKER_PORT` | `8883` | TLS Port |
| `MQTT_USERNAME` | `your_mqtt_username` | From your EMQX credentials |
| `MQTT_PASSWORD` | `your_mqtt_password` | From your EMQX credentials |
| `MQTT_TOPIC_PATTERN`| `test/devices/+/power` | MQTT subscription topic |
| `MQTT_USE_TLS` | `true` | Required for port 8883 |
| `JWT_SECRET_KEY` | `[generate-random-secret-key]` | e.g. 64-char random string |
| `CORS_ORIGINS` | `http://localhost:3000` | Will add Cloudflare Pages domain in Step 3 |
| `TELEMETRY_RETENTION_HOURS` | `24` | 24-hour retention safety |
| `DEBUG` | `false` | Production mode |

### 2.6 Deploy & Verify
1. Click **Deploy**.
2. Koyeb will build the Docker container and launch the service.
3. Once the status turns green (**Healthy**), copy your public Koyeb app URL:
   `https://<your-app>-<org>.koyeb.app`
4. Test the health check in your browser:
   `https://<your-app>-<org>.koyeb.app/health`
   You should see:
   ```json
   {
     "status": "ok",
     "app": "IoT Remote Monitoring Dashboard",
     "version": "0.1.0",
     "mqtt_connected": true,
     "websocket_clients": 0
   }
   ```

---

## Step 3: Frontend Setup on Cloudflare Pages

Cloudflare Pages provides global CDN hosting with zero sleep and unlimited bandwidth.

### 3.1 Create Cloudflare Pages Project
1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com).
2. In the left menu, navigate to **Compute (Workers) > Workers & Pages**.
3. Click **Create application** > Select the **Pages** tab > Click **Connect to Git**.
4. Authorize Cloudflare and select your GitHub repository.

### 3.2 Configure Build & Output
- **Project name**: `iot-monitoring-dashboard` (or your choice)
- **Production branch**: `main`
- **Framework preset**: `Vite` (or `None`)
- **Root directory**: `frontend`
- **Build command**: `npm run build`
- **Build output directory**: `dist`

### 3.3 Set Environment Variables
In the **Environment variables (advanced)** section, add:

| Key | Value | Example |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `https://<your-koyeb-app>.koyeb.app/api` | `https://iot-dash-demo.koyeb.app/api` |
| `VITE_WS_BASE_URL` | `wss://<your-koyeb-app>.koyeb.app/ws/telemetry` | `wss://iot-dash-demo.koyeb.app/ws/telemetry` |

### 3.4 Deploy
1. Click **Save and Deploy**.
2. Cloudflare Pages will install packages and build the React Vite bundle.
3. Once completed, your dashboard is live at:
   `https://<your-project>.pages.dev`

> [!NOTE]
> The repository includes [`frontend/public/_redirects`](file:///c:/Users/sumit/Desktop/INSYS/IoT-Remote-Monitoring-Dashboard/frontend/public/_redirects) (`/* /index.html 200`). This ensures direct navigation and refreshing on `/devices`, `/alerts`, and `/settings` will never result in a 404.

---

## Step 4: Final Linkage & Verification

### 4.1 Update CORS on Koyeb
1. Copy your Cloudflare Pages domain (e.g. `https://iot-monitoring-dashboard.pages.dev`).
2. Go to **Koyeb** -> your service -> **Settings** -> **Environment variables**.
3. Update `CORS_ORIGINS` to include your Cloudflare Pages URL:
   ```text
   ["https://iot-monitoring-dashboard.pages.dev", "http://localhost:3000"]
   ```
   *(Or simply comma-separated: `https://iot-monitoring-dashboard.pages.dev,http://localhost:3000`)*
4. Click **Save** and trigger a redeployment.

### 4.2 End-to-End Verification Checklist

- [ ] **Open the Dashboard**: Visit your Cloudflare Pages URL. The login screen should appear.
- [ ] **Sign In**:
  - **Username**: `admin`
  - **Password**: `admin123`
- [ ] **Verify WebSocket**: The connection indicator in the header should display green (**Connected** / Live).
- [ ] **Sensor Telemetry**: As your ESP32 / SIM7670 firmware sends messages to EMQX, verify:
  - Koyeb logs show: `Received telemetry from device ...`
  - The dashboard updates battery voltages, MCB status, and wagon gauges in real time.
- [ ] **Data Retention Check**:
  In Supabase SQL Editor, run:
  ```sql
  SELECT COUNT(*) FROM telemetry;
  SELECT MIN(time), MAX(time) FROM telemetry;
  ```
  The minimum time should never be older than 24 hours.
