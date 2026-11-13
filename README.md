# ⚡ CampusPulse

> **Intelligent Campus Issue Reporting & Resolution Management Platform**  
> *Central Innovation: Multi-Factor Impact-Based Complaint Prioritization Engine*

[![Platform](https://img.shields.io/badge/Platform-Web%20SPA-indigo.svg)](#tech-stack)
[![Core Innovation](https://img.shields.io/badge/Core%20Engine-Impact%20Prioritization%20(Explainable)-red.svg)](#-the-central-innovation-impact-based-prioritization-engine)
[![Stack](https://img.shields.io/badge/Stack-HTML5%20%7C%20CSS3%20%7C%20Vanilla%20JS-blue.svg)](#tech-stack)
[![Storage](https://img.shields.io/badge/Data-Persistent%20LocalStorage-emerald.svg)](#architecture)
[![License](https://img.shields.io/badge/License-MIT-slate.svg)](#)

---

## 🎯 The Central Innovation: Impact-Based Prioritization Engine

Ordinary complaint portals operate on a **FIFO (First-In, First-Out)** or subjective dropdown model where minor issues block critical repairs. **CampusPulse** shifts the paradigm with a **deterministic, explainable multi-factor scoring algorithm** that ranks complaints by **actual campus disruption**:

$$\text{Impact Score (0 to 100)} = \text{Severity } (S) + \text{Location Importance } (L) + \text{Affected Population } (P)$$

```
                               ┌──────────────────────────────────────────────┐
                               │       Incoming Campus Issue Report           │
                               └──────────────────────┬───────────────────────┘
                                                      │
                                                      ▼
                                       ┌──────────────────────────────┐
                                       │   Emergency Hazard Check?    ├─────────► [ YES: EMERGENCY OVERRIDE ]
                                       │  (Sparks, Wire, Fire, Shock) │           - Score: 100 / 100 (P0)
                                       └──────────────┬───────────────┘           - Bypasses Normal Queue
                                                      │ NO
                                                      ▼
                     ┌────────────────────────────────┴───────────────────────────────┐
                     │              3-Factor Weighted Mathematical Model              │
                     ├────────────────────────┬───────────────────────────────────────┤
                     │ Severity (S: 40%)      │ Functional disruption & hazard grade  │
                     │ Location (L: 30%)      │ High-risk workshop, lab vs corridor   │
                     │ Population (P: 30%)    │ Occupancy & Duplicate Crowd Boost     │
                     └────────────────────────┬───────────────────────────────────────┘
                                                      │
                                                      ▼
                                       ┌──────────────────────────────┐
                                       │     Dynamic Impact Rank      │
                                       │  #1 (100 pts) > #2 (87 pts)  │
                                       └──────────────────────────────┘
```

### 1. Dimension Breakdown (Total = 100 Points)

| Dimension | Weight | Scoring Logic | Example Rationale |
| :--- | :--- | :--- | :--- |
| **Severity ($S$)** | **Max 40 pts** | Evaluates physical hazard risk, operational failure, and damage potential. | • Exposed live wires / sparks: `40/40`<br>• Corridor water main burst: `35/40`<br>• Violently wobbling fan: `28/40`<br>• Routine restroom cleaning: `8/40` |
| **Location Criticality ($L$)** | **Max 30 pts** | Classified into 4 tiers based on risk density and equipment sensitivity. | • **Tier 1 (Workshop/Labs):** `26–30 pts`<br>• **Tier 2 (Library, Dining, IT):** `22–25 pts`<br>• **Tier 3 (Classrooms):** `16–18 pts`<br>• **Tier 4 (Auxiliary):** `12 pts` |
| **Affected Population ($P$)** | **Max 30 pts** | Calculated by space capacity + **crowd duplicate boost** ($+4$ pts per duplicate report). | • Common corridor / mess (>200 people): `26–30 pts`<br>• Lecture halls (60–120 people): `20–24 pts`<br>• Standard classroom: `14–18 pts`<br>• Private faculty office: `8 pts` |

### 2. 🚨 Safety Emergency Override
If critical hazard triggers (`exposed wire`, `sparks`, `electric shock`, `fire`, `smoke`, `structural collapse`) are detected:
- **Impact Score is automatically pinned to `100 / 100` (`P0 - Critical Emergency`)**.
- The issue bypasses the normal queue and is pinned to **Rank #1** with an immediate flashing beacon.

### 3. 🔍 Smart Duplicate Detection & Crowd Escalation
- New complaints are compared against **active, unresolved issues** in the same building and room using **Jaccard token similarity**.
- **Crowd Endorsement:** When duplicate detection alerts the user, they can click **"👍 Endorse Existing Ticket (+Impact)"**.
- Each endorsement increments the affected student counter, escalating the original ticket's population score and moving it higher up the priority queue without creating ticket clutter.

### 4. 🔍 Explainable Algorithm (Zero Black-Box AI/ML)
Every ticket includes an interactive **"Explain Score"** button that reveals:
- Individual scores for $S$, $L$, and $P$ with progress bars.
- Clear operational reasoning for each dimension.
- The mathematical formula: $\text{Impact} = S + L + P$.

---

## 🚀 Quick Start (How to Run)

CampusPulse is a client-side single page application with no build steps or server dependencies.

### Option 1: Direct File Launch (No dependencies or internet required)
Simply double-click `index.html` or run:
```powershell
# Windows PowerShell
Start-Process "index.html"
```

### Option 2: Local HTTP Server (Python)
```powershell
python -m http.server 8080
```
Open in browser: [`http://localhost:8080`](http://localhost:8080)

---

## 📋 Comprehensive Feature Tour

### 🎓 Student Experience
1. **Prioritized Dashboard:** Displays active safety hazard banners, campus health stats, and issues sorted by impact rank.
2. **Submit New Complaint:**
   - Building dropdown (`Engineering Workshop`, `Science Complex`, `CS & IT Block`, `Academic Block A`, etc.) & room input.
   - **Photo Evidence Upload:** Instant thumbnail preview with automatic off-screen canvas compression.
   - **Live Impact Meter:** Animates in real-time as the student types, displaying predicted score ($0-100$), priority tier ($P0-P3$), and dimension bars.
3. **Track by Campus Impact:** Card grid with sorting options:
   - `⚡ Impact Rank (Default)` — Focus on highest impact issues first.
   - `🕒 Newest First` — Chronological view.

### 🛡️ Facility Operations Console (Admin)
1. **One-Click Persona Switcher:** Switch between **Student Mode** and **Admin Mode** in one click.
2. **Operations Desk:** Searchable by ID, title, room, technician, or submitter. Filterable by Category, Status, and Impact Tier ($P0, P1, P2, P3$).
3. **Technician Dispatch:** Assign issues directly to technicians (`Rajesh Kumar`, `Suresh Murthy`, `Anita Desai`, `Sunita Rawat`, `Vikram Singh`).
4. **Resolution Timeline:** Detailed audit log recording every status update and operational note.
5. **Data Export:** Export all tickets and scores to a formatted JSON file.

### 📊 Visual Analytics, Heatmap & Maintenance Intelligence
- **Campus Infrastructure Issue Heatmap:** Aggregates real-time problem density across all 9 campus facilities. Buildings are color-coded by risk level (`CRITICAL P0`, `HIGH RISK`, `MODERATE`, `NORMAL`), revealing spatial hotspots. Clicking any building card automatically filters the Operations Console backlog.
- **Recurring Issue Pattern Detector:** Clusters historical and active complaints by `building + category`. When $\ge 2$ incidents occur in the same location, the engine flags a structural wear pattern and generates targeted predictive maintenance actions (e.g., electrical circuit audits, plumbing riser valve overhaul).
- **Real Calculated Average Resolution Time:** Computed strictly from stored resolution timestamps ($\text{resolvedAt} - \text{createdAt}$).
- **Overdue SLA Breach Tracking:** Monitors active tickets against strict priority-tier SLAs (`P0: 2h`, `P1: 24h`, `P2: 48h`, `P3: 72h`), highlighting overdue tickets in red with elapsed breach hours across student and admin tables.
- **Impact Tier Breakdown ($P0-P3$):** Visualizes urgency distribution across the campus backlog.
- **Category & Pipeline Breakdown:** Interactive Doughnut charts.

---

## 🧪 Realistic Demonstration Dataset

CampusPulse includes 7 pre-seeded scenarios evaluated through the Impact Engine on first launch:

| ID | Title & Location | Category | Impact Score | Rank |
| :--- | :--- | :--- | :--- | :--- |
| **#CP-101** | **Exposed live wires & sparks** — Engineering Workshop (Machine Lab 2) | Safety | **100 / 100** | **Rank #1** *(P0 Emergency)* |
| **#CP-102** | **Severe pipe leakage flooding hallway** — Academic Block A (1st Floor) | Plumbing | **87 / 100** | **Rank #2** *(P1 High Impact)* |
| **#CP-103** | **Violently wobbling ceiling fan** — CS & IT Block (Room 204) | Electrical | **68 / 100** | **Rank #3** *(P2 Medium Impact)* |
| **#CP-104** | **Broken lecture bench with sharp metal** — Science Complex (Hall B-12) | Infrastructure | **64 / 100** | **Rank #4** *(P2 Medium Impact)* |
| **#CP-106** | **AC blowing warm air in seminar hall** — CS & IT Block (Seminar Hall 1) | Electrical | **62 / 100** | **Rank #5** *(P2 Medium Impact)* |
| **#CP-105** | **Unclean washroom & overflowing bin** — Central Library (Ground Floor) | Cleanliness | **35 / 100** | **Rank #6** *(P3 Low Impact, Resolved)* |
| **#CP-107** | **Flickering corridor tube lights** — Academic Block A (Staircase A2) | Electrical | **28 / 100** | **Rank #7** *(P3 Low Impact, Resolved)* |

> Click **"Reset Demo Data"** in the sidebar footer anytime during a live presentation to restore the demo dataset instantly.

---

## 🛠️ Architecture & Honest Technical Feasibility

```
CampusPulse/
├── index.html                # Single Page Application & Visual Impact Modals
├── css/
│   └── styles.css            # Dark mode SaaS design, heatmap grids & impact gauges
├── js/
│   ├── impactEngine.js       # Multi-factor scoring (S + L + P) & Emergency Override
│   ├── classifier.js         # Rule-based dictionary classification engine
│   ├── duplicateDetector.js  # Jaccard proximity similarity & crowd endorsement
│   ├── store.js              # Persistent store, SLA tracker, heatmap & recurring analysis
│   ├── analytics.js          # Heatmap rendering, recurring patterns & SLA charts
│   └── app.js                # App controller, event dispatching & modal handlers
└── README.md                 # Architecture, honest assessment & evaluation docs
```

### Current Implementation (Hackathon Prototype)
CampusPulse is currently engineered as an ultra-fast, zero-dependency client-side Single Page Application (SPA) leveraging:
- **State Store:** Reactive publish/subscribe pattern over browser `localStorage` (`campuspulse_complaints_v3`).
- **Mathematical Engines:** Decoupled pure JavaScript modules (`impactEngine.js`, `duplicateDetector.js`, `classifier.js`, `store.js`, `analytics.js`).
- **Zero-Dependency Fallbacks:** Chart.js with pure CSS/SVG bar chart fallbacks for offline demo resilience.

### Limitations of LocalStorage
While `localStorage` provides instant persistence without backend infrastructure for a hackathon demo, a production campus deployment has distinct constraints:
1. **Single-Device Isolation:** Data is stored locally per browser profile; updates made on one device are not automatically propagated to technician smartphones without a network sync bridge.
2. **5 MB Storage Ceiling:** Base64-encoded image attachments rapidly consume the ~5MB origin quota (mitigated in our prototype by canvas image downscaling to max 800px width at 75% JPEG quality).
3. **Synchronous I/O:** Serialized JSON parsing is synchronous on the main browser thread.
4. **Lack of Server-Side Security:** Client-side storage cannot enforce cryptographic role-based access control (RBAC) or audit tamper-resistance.

### Production Scaling Roadmap
To scale CampusPulse across a university of 25,000+ students and 200+ campus buildings, the following enterprise backend architecture is planned:

```
[Mobile / Web Client] ──HTTPS/WSS──► [API Gateway (Rate Limiting & Auth)]
                                               │
               ┌───────────────────────────────┼───────────────────────────────┐
               ▼                               ▼                               ▼
       [Node/FastAPI Core]           [Spatial Engine (PostGIS)]       [Object Storage (S3)]
       - Impact Engine Workers       - Campus GIS polygon bounds      - High-res photo uploads
       - SLA Expiry Cron Jobs        - Proximity duplicate search     - CDN caching (Cloudflare)
       - Institutional SSO (OAuth2)  - Indoor floor plan routing
```

1. **Centralized Geospatial Database (PostgreSQL + PostGIS):**
   - Store official campus CAD/GIS polygon coordinates for every facility.
   - Spatial index queries: `ST_DWithin()` to detect duplicate reports within a 15-meter radius inside the same building floor.
2. **Real-time Event-Driven API (Node.js / FastAPI + WebSockets):**
   - Field crew tablets receive instant push notifications when a P0 Safety Hazard or overdue ticket is flagged.
   - Distributed background queue (Redis + Celery/BullMQ) to recalculate building risk indexes every minute.
3. **Institutional Identity Integration (SAML 2.0 / OAuth 2.0 OIDC):**
   - Seamless sign-in with university email credentials.
   - Role-based permissions: Student, Faculty, Department Supervisor, Field Crew, Campus Safety Director.
4. **Resilient Object Storage (AWS S3 / Google Cloud Storage):**
   - Presigned upload URLs with automated thumbnail generation, EXIF metadata stripping (protecting student privacy), and WebP optimization.

---

## 🎤 3-Minute Hackathon Demo Script

1. **The Hook (30s):**  
   *"Most campus issue portals fail because they treat every complaint equally on a first-come, first-served basis. If someone reports a squeaky chair at 9:00 AM, it sits ahead of an electrical spark reported at 9:05 AM. CampusPulse solves this with our Impact-Based Prioritization Engine."*
2. **The Innovation in Action (60s):**  
   Click **"Report New Issue"**. Type:  
   - *Title:* `Sparks and burning smell from power panel`  
   - *Building:* `Engineering Workshop`, *Room:* `Machine Lab 2`  
   Point to the **Live Impact Meter**: the score immediately jumps to **`100/100`** with a **`🚨 P0 - EMERGENCY OVERRIDE`** beacon.
3. **Duplicate Detection & Crowd Escalation (30s):**  
   Notice the duplicate warning: `Ticket #CP-101 is already open for this location`. Click **"👍 Endorse This Issue (+Impact)"**. Show how student crowd endorsements raise the issue's population score without creating duplicate ticket clutter.
4. **Explainable Priority Modal (30s):**  
   Click **"Switch to Admin"**. Click **"Explain"** on ticket `#CP-102`. Show the judges the transparent mathematical breakdown: Severity ($35/40$) + Location ($22/30$) + Population ($30/30$) = **$87/100$**. Emphasize that it is **100% deterministic and explainable**, not fake AI.
5. **Analytics & Reset (30s):**  
   Navigate to **"Analytics & SLAs"** to view impact tier distribution. Click **"Reset Demo Data"** to demonstrate complete reset capability.
