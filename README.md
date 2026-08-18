# 🔌 IoT Remote Monitoring Dashboard

A high-performance, real-time IoT monitoring platform designed for rolling stock telemetry, battery health analytics, and power distribution switch monitoring across distributed railway fleets.

Built with **ESP32-S3 edge microcontrollers (4G LTE)**, **EMQX Cloud (MQTT/TLS)**, **FastAPI (Python Asyncpg)**, **TimescaleDB**, and **React (Vite + Zustand)**.

---

## ✨ Key Features

- **🚂 Fleet & Train Hierarchy Stream**: Group devices dynamically by `Train No` → `Coach No` → `Monitoring Nodes` with collapsible train fleet headers.
- **⚡ Instant Multi-Field Search & Filter Ribbon**: Search seamlessly across Train Number, Coach Number, Device Name, Type, Location, or MAC address (with or without `:` colons). Quick train filter pills with active node badges.
- **🔋 Telemetry Card Redesign**:
  - **Dual Battery Level Gauges**: Gradient-filled gauge bars with percentage & voltage readings (Emerald ≥ 12.0V, Amber 11.2V – 12.0V, Rose < 11.2V).
  - **Tactile 2×2 Switchboard**: Glowing LED pills for **Main MCB**, **FSDS MCB** (Fire & Smoke Detection System), **AC 1**, and **AC 2** with high-contrast ON/OFF states.
  - **Live Heartbeat & Countdown Timer**: Animated pulse dot on live WebSocket telemetry arrival with hardware countdown timer.
- **🌓 Design System & Dual Theme Engine**: Custom Obsidian/Slate/Emerald Dark Mode and Crisp Studio Light Mode with instant toggle in the header and `localStorage` persistence.
- **🔐 Enterprise RBAC (Role-Based Access Control)**: Strict JWT authentication with separate permission tiers for `admin` (full write/delete/rule creation) and `user` (read-only telemetry & alerts).
- **🚨 Real-time Alerts & Threshold Engine**: Automated rule evaluation for low battery voltages, MCB trips, and AC downtime with visual toasts, audio cues, and unread event tracking.
- **📈 Deep Telemetry Analytics**: Historical charting via Apache ECharts for voltage trends, switch transitions, and uptime logs.

---

## 🏗️ System Architecture

```
                                      ┌────────────────────────────────────────┐
                                      │        ESP32-S3 Edge Nodes             │
                                      │   (ADC Voltages, MCBs, AC Switches)    │
                                      └───────────────────┬────────────────────┘
                                                          │ 4G LTE (MQTT over TLS)
                                                          ▼
                                      ┌────────────────────────────────────────┐
                                      │          EMQX MQTT Broker              │
                                      └───────────────────┬────────────────────┘
                                                          │
                                                          ▼
                                      ┌────────────────────────────────────────┐
                                      │         FastAPI Backend Server         │
                                      │  (MQTT Ingest, Alert Engine, Auth API) │
                                      └─────────────┬────────────────────┬─────┘
                                                    │                    │
                          SQLAlchemy Asyncpg        │                    │ WebSocket / REST
                                                    ▼                    ▼
                                        ┌───────────────────┐  ┌───────────────────┐
                                        │ PostgreSQL 15 +   │  │ React Dashboard   │
                                        │ TimescaleDB       │  │ (Vite + Zustand)  │
                                        └───────────────────┘  └───────────────────┘
```

---

## 📦 Tech Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Edge Hardware** | ESP32-S3 + SIM7670 4G LTE | C++ (PlatformIO / Arduino Core), ADC voltage dividers, optocouplers |
| **Message Broker** | EMQX Cloud (MQTT/TLS) | Secure TLS 8883 MQTT packet broker with topic wildcarding |
| **Backend API** | Python 3.11, FastAPI, Uvicorn | Async REST endpoints, WebSockets, background tasks, Pydantic |
| **Database** | PostgreSQL 15 + TimescaleDB | Time-series hypertable for high-throughput telemetry storage |
| **ORM & Migrations**| SQLAlchemy 2.0 (Asyncpg) + Alembic | Asynchronous relational schema management |
| **Frontend UI** | React 19, Vite, Zustand, Lucide Icons | Reactive state management, design tokens, ECharts visualization |
| **Reverse Proxy** | Nginx Alpine | Reverse proxy, static asset compression, SSL termination |
| **Containerization**| Docker & Docker Compose | Multi-container unified orchestration |

---

## 📁 Repository Structure

```
IoT-Remote-Monitoring-Dashboard/
├── backend/                  # FastAPI Application
│   ├── app/
│   │   ├── core/             # JWT auth, security, config settings
│   │   ├── models/           # SQLAlchemy models (User, Device, Telemetry, AlertRule, AlertEvent)
│   │   ├── routers/          # API route handlers (auth, devices, telemetry, alerts)
│   │   ├── schemas/          # Pydantic request/response validation
│   │   └── services/         # MQTT client, WebSocket hub, alert rule engine
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                 # React + Vite Client
│   ├── src/
│   │   ├── components/
│   │   │   ├── alerts/       # Alert bell, event logs, rules modal
│   │   │   ├── dashboard/    # KPI Stats, DeviceGrid, DeviceCard
│   │   │   ├── device/       # Device management table, telemetry analytics
│   │   │   └── layout/       # AppLayout, Sidebar (RBAC aware), Header (Theme toggle)
│   │   ├── store/            # Zustand stores (authStore, deviceStore, alertStore)
│   │   └── index.css         # Complete Design System & Dark/Light mode tokens
│   ├── Dockerfile
│   └── vite.config.js
├── firmware/                 # ESP32-S3 C++ Source Code
│   ├── src/main.cpp          # Sensor acquisition, SIM7670 modem driver, MQTT publisher
│   └── platformio.ini
├── infrastructure/           # Database & Infrastructure Scripts
│   └── database/init.sql     # TimescaleDB initialization, hypertables & seed data
├── docker-compose.yml        # Multi-service production stack
├── .env.production.example   # Template for production environment variables
└── README.md
```

---

## 🚀 Quick Start Guide

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (v24+) & Docker Compose
- *Optional for local dev*: Python 3.11+, Node.js 18+

---

### Option 1: Full-Stack Docker Deployment (Recommended)

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/IoT-Remote-Monitoring-Dashboard.git
   cd IoT-Remote-Monitoring-Dashboard
   ```

2. **Configure Environment Variables**:
   ```bash
   cp .env.production.example .env
   ```
   *Update `.env` with your secure database credentials, JWT secret key, and EMQX broker details.*

3. **Launch the Stack**:
   ```bash
   docker-compose up -d --build
   ```

4. **Access Applications**:
   - **Web Dashboard**: [`http://localhost`](http://localhost) (or `http://localhost:5173` in development)
   - **Interactive API Docs (Swagger)**: [`http://localhost:8000/docs`](http://localhost:8000/docs)
   - **PostgreSQL / TimescaleDB**: `localhost:5433`

---

### Option 2: Local Development Setup (Without Dockerizing App Code)

#### 1. Start TimescaleDB Container
```bash
docker-compose up -d timescaledb
```

#### 2. Start the FastAPI Backend
```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\Activate.ps1
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

#### 3. Start the React Frontend
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173/` in your browser.

---

## 🔑 Default Credentials & RBAC Roles

| Username | Password | Role | Permissions |
| :--- | :--- | :--- | :--- |
| `admin` | `admin123` | **Admin** | Full access: Add/Edit/Delete Devices, Create Alert Rules, Manage Users, View Analytics |
| `testuser` | `user123` | **User** | Read-Only: View Live Dashboard, View Telemetry Charts, View Alerts, Acknowledge Alarms |

---

## 📡 Hardware & Telemetry Specification

The ESP32-S3 broadcasts telemetry payloads over MQTT on the topic `telemetry/train/{train_no}/{coach_no}/{mac_address}` every **30 seconds** (or immediately on state change):

### JSON Telemetry Schema
```json
{
  "mac_address": "A0F262E3B354",
  "battery_1_voltage": 12.84,
  "battery_2_voltage": 12.76,
  "main_mcb_status": "ON",
  "fsds_mcb_status": "ON",
  "ac_1_status": "ON",
  "ac_2_status": "OFF",
  "countdown_timer": 30,
  "rssi": -65,
  "firmware_version": "1.0.4"
}
```

---

## 🛡️ API Reference Overview

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | Authenticate user & receive JWT access token |
| `GET` | `/api/auth/me` | Authenticated | Retrieve current user profile & role |
| `GET` | `/api/devices` | Authenticated | Retrieve list of devices with latest telemetry |
| `POST` | `/api/devices` | **Admin Only** | Register a new monitoring device |
| `PUT` | `/api/devices/{id}` | **Admin Only** | Update device metadata / train / coach assignment |
| `DELETE` | `/api/devices/{id}` | **Admin Only** | Delete device and cascade telemetry records |
| `GET` | `/api/telemetry/{device_id}` | Authenticated | Historical time-series telemetry data |
| `GET` | `/api/alerts/rules` | Authenticated | List all alert rules |
| `POST` | `/api/alerts/rules` | **Admin Only** | Create an alert rule condition |
| `WS` | `/ws/telemetry` | Authenticated | Live WebSocket streaming channel for real-time telemetry |

---

## 🛠️ Verification & Building

To verify and produce an optimized production bundle of the frontend:

```bash
cd frontend
npm run build
```

---

## 📝 License
Private & Proprietary — All Rights Reserved.