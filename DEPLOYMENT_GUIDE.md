# Production Deployment Guide: Supabase + Render (with Keep-Alive) + Cloudflare Pages

This guide walks you through deploying the **IoT Remote Monitoring Dashboard (Wagon Bulge Detection System)** using a **100% free cloud stack**:

| Component | Service | Free Tier Allowance | Role |
| :--- | :--- | :--- | :--- |
| **Database** | **Supabase Cloud** | 500 MB Vanilla PostgreSQL | Stores devices, telemetry, users, alerts |
| **Backend & MQTT** | **Render (Web Service)** | 750 free hrs/mo (512MB RAM) | FastAPI REST, WebSockets, EMQX MQTT subscriber |
| **Keep-Alive Worker**| **UptimeRobot** | 50 free monitors (5-min interval) | Pings `/health` every 5m to prevent Render from sleeping |
| **Frontend UI** | **Cloudflare Pages** | Unlimited static hosting | React 19 + Vite dashboard |

---

## The Math Behind 24/7 Free Execution on Render

> [!NOTE]
> - **Render** grants **750 free instance hours** every month. A 31-day month has $31 \times 24 = 744$ hours.
> - By running **one Web Service** continuously, you consume 744 hours, staying 100% inside the free tier without paying a single cent.
> - Free services on Render normally spin down after 15 minutes of inactivity. **UptimeRobot** sends a GET request to `/health` every 5 minutes, keeping the MQTT listener and WebSocket gateway awake 24/7!

---

## Summary: What You Have Completed So Far
- [x] **Step 1.1 - 1.3**: Supabase project created, `supabase_init.sql` executed, and `pg_cron` hourly retention verified.
- [x] **Step 1.4**: Session pooler URI selected (`postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:5432/postgres`).
- [x] **Step 2.1**: Code committed locally to git.

👉 **Continue directly from Step 2.1 below (Push to GitHub) and proceed to Render!**

---

## Step 2: Backend Deployment on Render

### 2.1 Push your Code to GitHub
Run this command in your terminal to push your latest commits (including the new `render.yaml`) to GitHub:
```bash
git push origin master
```

---

### 2.2 Create a Web Service on Render
1. Sign up or log in to [Render](https://render.com).
2. On your Render Dashboard, click the **New +** button in the top navigation bar.
3. Select **Web Service**.
4. Choose **Build and deploy from a Git repository** and click **Next**.
5. Connect your GitHub account and select your repository: **`IoT-Remote-Monitoring-Dashboard`**.

---

### 2.3 Configure the Web Service
Fill in the following fields:

- **Name**: `iot-monitoring-backend` (or your choice)
- **Region**: Choose the region closest to your Supabase DB (e.g. `Singapore` or `Frankfurt`).
- **Branch**: `master` (or `main`)
- **Root Directory**: Leave blank (or `backend` if deploying as native python)
- **Runtime**: **Docker**
  - *Render will automatically find `backend/Dockerfile` using `render.yaml` or you can set Dockerfile path to `./backend/Dockerfile` and Docker Context to `./backend`.*
- **Instance Type**: Select **Free** (`0.1 CPU, 512 MB RAM`).

---

### 2.4 Add Environment Variables on Render
Scroll down to the **Environment Variables** section on Render and click **Add Environment Variable** for each:

| Key | Value | Notes |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://postgres.[REF]:[PASS]@[POOLER]:5432/postgres` | Your Supabase Session Pooler URI from Step 1.4 |
| `MQTT_BROKER_HOST` | `j18eff7a.ala.asia-southeast1.emqxsl.com` | EMQX Cloud Broker |
| `MQTT_BROKER_PORT` | `8883` | TLS Port |
| `MQTT_USERNAME` | `your_mqtt_username` | From your EMQX credentials |
| `MQTT_PASSWORD` | `your_mqtt_password` | From your EMQX credentials |
| `MQTT_TOPIC_PATTERN`| `test/devices/+/power` | Sensor MQTT topic |
| `MQTT_USE_TLS` | `true` | Required for port 8883 |
| `JWT_SECRET_KEY` | `your_secure_random_key_here` | 32+ character random string |
| `CORS_ORIGINS` | `http://localhost:3000` | Will add Cloudflare Pages domain in Step 3 |
| `TELEMETRY_RETENTION_HOURS` | `24` | Automated 24h retention safeguard |
| `DEBUG` | `false` | Production mode |

---

### 2.5 Deploy the Backend
1. Click **Create Web Service**.
2. Render will build the Docker container and start your service.
3. Watch the deploy logs until you see:
   ```text
   Application startup complete.
   Uvicorn running on http://0.0.0.0:10000 (Press CTRL+C to quit)
   MQTT subscriber started
   Telemetry retention cleanup started (keeping last 24h)
   ```
4. Copy your public service URL from the top of the page:
   `https://iot-monitoring-backend-xxxx.onrender.com`
5. Test the health endpoint in your browser:
   `https://iot-monitoring-backend-xxxx.onrender.com/health`
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

### 2.6 Set Up the UptimeRobot "Keep-Alive" Hack (Prevents Sleep)

This step ensures Render never goes to sleep after 15 minutes of inactivity:

1. Go to [UptimeRobot](https://uptimerobot.com) and create a **Free Account**.
2. From the dashboard, click **+ Add New Monitor**.
3. Fill in the monitor settings:
   - **Monitor Type**: `HTTP(s)`
   - **Friendly Name**: `Render IoT Backend Keep-Alive`
   - **URL (or IP)**: `https://<your-app>.onrender.com/health` *(use your real Render URL!)*
   - **Monitoring Interval**: `Every 5 minutes`
   - **Monitor Timeout**: `30 seconds`
4. Click **Create Monitor**.

🎉 **Your Render service will now stay awake 24/7, continuously receiving sensor data!**

---

## Step 3: Frontend Deployment on Cloudflare Pages

### 3.1 Connect Repository to Cloudflare Pages
1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com).
2. In the left sidebar, navigate to **Compute (Workers) > Workers & Pages**.
3. Click **Create application** > Select the **Pages** tab > Click **Connect to Git**.
4. Select your GitHub repository: **`IoT-Remote-Monitoring-Dashboard`**.

### 3.2 Configure Build Settings
- **Project name**: `iot-monitoring-dashboard`
- **Production branch**: `master` (or `main`)
- **Framework preset**: `Vite` (or `None`)
- **Root directory**: `frontend`
- **Build command**: `npm run build`
- **Build output directory**: `dist`

### 3.3 Set Frontend Environment Variables
In the **Environment variables (advanced)** section, add:

| Key | Value | Example |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `https://<your-render-app>.onrender.com/api` | `https://iot-monitoring-backend.onrender.com/api` |
| `VITE_WS_BASE_URL` | `wss://<your-render-app>.onrender.com/ws/telemetry` | `wss://iot-monitoring-backend.onrender.com/ws/telemetry` |

### 3.4 Deploy
1. Click **Save and Deploy**.
2. When the build finishes, your dashboard is live at:
   `https://<your-project>.pages.dev`

---

## Step 4: Final Linkage & Verification

### 4.1 Update CORS on Render
1. Copy your Cloudflare Pages domain (e.g. `https://iot-monitoring-dashboard.pages.dev`).
2. Go to **Render** -> your Web Service -> **Environment**.
3. Update `CORS_ORIGINS` to include your Cloudflare Pages domain:
   ```text
   ["https://iot-monitoring-dashboard.pages.dev", "http://localhost:3000"]
   ```
   *(or comma-separated: `https://iot-monitoring-dashboard.pages.dev,http://localhost:3000`)*
4. Render will automatically restart with the new CORS setting.

### 4.2 Verification Checklist
- [ ] Visit your Cloudflare Pages URL: The login page loads without error.
- [ ] Log in using the default admin account:
  - **Username**: `admin`
  - **Password**: `admin123`
- [ ] Check WebSocket status: Header displays green (**Connected** / Live).
- [ ] Power on / simulate your ESP32 or SIM7670 devices and confirm telemetry is rendering on the dashboard.
- [ ] In Supabase SQL Editor, verify retention cleanup:
  ```sql
  SELECT COUNT(*), MIN(time), MAX(time) FROM telemetry;
  ```
  Telemetry older than 24 hours is automatically pruned, keeping database usage well under the 500 MB limit!
