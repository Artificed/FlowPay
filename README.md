# FlowPay

## Overview

FlowPay is a comprehensive digital wallet and payment processing system engineered for high reliability and consistency. Developed with a Go backend and a React/TypeScript frontend, it leverages Temporal orchestration to manage multi-step financial transactions securely. FlowPay features a complete client-server architecture with stateful transaction management, ensuring that payment operations are resilient to failures, utilizing a Saga pattern for robust compensating actions and reversals.

## Features

### Payment & Wallet Engine
- **Multi-Currency Wallets** - Automatic wallet creation upon user registration supporting multiple currency balances.
- **Idempotent Transactions** - Secure money transfers through discrete, idempotent steps (Validate, Create, Hold, Debit, Credit).
- **Saga Pattern Reversals** - Fully implemented `ReverseTransfer` acting as a compensating transaction that safely rolls back funds, debits recipients, and releases holds on failure.
- **Real-time Synchronization** - Server-Sent Events (SSE) streaming updates to the dashboard for live transaction and wallet balance states.
- **Scheduled Payments** - Schedule one-off or recurring payments with full lifecycle management (create, pause, reactivate, cancel), backed by a dedicated Temporal workflow with cron-style scheduling.

### Workflow Orchestration (Temporal)
- **Deterministic Workflows** - Multi-step payment workflows orchestrated deterministically, independent of direct DB calls within the workflow definition.
- **Resilient Activities** - Business logic encapsulated in retryable Temporal activities with exponential backoffs and timeouts.
- **Graceful Failure Handling** - Automatic triggering of compensating operations (Saga) mid-workflow upon component failure.

### Robust Backend Features
- **Authentication** - Secure user registration and login flows using JWT (`golang-jwt/jwt/v5`).
- **Structured Logging & Tracing** - Built using Go's `log/slog` with JSON handlers, coupled with `X-Request-ID` middleware for transaction correlation.
- **Graceful Shutdown** - SIGINT/SIGTERM handling for draining in-flight HTTP requests and Temporal workers safely.
- **API Documentation** - Fully documented REST API served via Swagger.

### Modern Dashboard UI
- **Interactive Interface** - Built with React 19, Tailwind CSS 4, and `shadcn/ui` for a responsive, modern aesthetic.
- **Live Transaction Monitoring** - Real-time displays for transaction histories, pending transfers, and live balance updates.
- **Dynamic Modals** - Intuitive popups for sending money and depositing funds.
- **Profile Management** - Avatar upload/delete (MinIO-backed), display name, email, and password editing with a glassmorphism profile card.
- **Full Page Suite** — Home (balance overview, activity chart, recent transactions), Transactions (date-grouped history, full-text search, detail modal), Scheduled Payments (status filters, stats cards, lifecycle controls), and Profile pages.

---

## Architecture

FlowPay is architected as an orchestrated micro-system, cleanly separating the presentation layer, the API endpoints, and the workflow state machine.

```text
FlowPay/
├── flowpay-be/             # Go REST API & Temporal Workers
├── flowpay-fe/             # React/Vite Frontend Web App
├── temporal/               # Temporal Setup Scripts & Configurations
├── docker-compose.yml      # Production infra composition
└── docker-compose.dev.yml  # Local development infra
```

### Module Details

#### Backend Module (`flowpay-be/`)
A scalable Go server utilizing the Gin framework and GORM:

| Package | Description |
|---------|-------------|
| `api/handler/` | REST endpoint handlers bound to domain services. |
| `service/` | Core business logic implementation for wallets, auth, and transfers. |
| `temporal/` | Workflow definitions, Activity wrappers, and Worker initializations orchestrating side-effect logic outside the HTTP boundary. |
| `repository/` | PostgreSQL database interactions via GORM. |
| `config/` | Application configuration management. |
| `models/` | Core domain entities. |
| `storage/` | MinIO S3-compatible object storage client for user avatars. |

#### Frontend Module (`flowpay-fe/`)
A fast, modern React SPA leveraging Vite:
- **State & Data Fetching**: Robust management using customized hooks for asynchronous behaviors.
- **Real-Time Data**: `EventSource` connections listening to backend SSE streams.
- **UI Components**: Formulated with `shadcn/ui`, `lucide-react`, and React Hook Form.

#### Infrastructure
- **PostgreSQL**: Primary data store for users, wallets, and transaction histories.
- **Temporal Server**: External orchestration cluster managing the state, queues, and history of all payment workflows independently of the primary app server.

---

## Technology Stack

| Category | Technologies |
|----------|--------------|
| **Backend** | Go 1.25, Gin, GORM, Temporal Go SDK |
| **Frontend** | React 19, TypeScript, Vite, TailwindCSS 4, shadcn/ui |
| **Database** | PostgreSQL 17 |
| **Orchestration**| Temporal Server v1.30.1 |
| **Infrastructure**| Docker, Docker Compose, Nginx |
| **Storage** | MinIO (S3-compatible object storage for user avatars) |
| **Security** | JWT, bcrypt |

---

## Installation

### Prerequisites
- **Docker & Docker Compose**
- **Go 1.25 or higher**
- **Node.js 20 or higher**

### Local Setup

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/FlowPay.git
cd FlowPay
```

2. **Start the Infrastructure (Temporal, Postgres, etc.):**
```bash
docker compose -f docker-compose.dev.yml up -d
```

3. **Run the Backend:**
Open a terminal and execute the Go backend application.
```bash
cd flowpay-be
go run main.go
```

4. **Run the Frontend:**
Open a new terminal session.
```bash
cd flowpay-fe
npm install
npm run dev
```

### Configuration
You may configure environment settings by duplicating the template:
```bash
cp .env.example .env
```
Ensure configurations match your active PostgreSQL setup and Temporal connection parameters.

---

## Screenshots

<img width="1920" height="999" alt="FlowPay - Login" src="https://github.com/user-attachments/assets/bf11c2d2-1d46-430d-b2f3-f25ab1a8a0ec" />
<img width="1920" height="999" alt="FlowPay - Transactions" src="https://github.com/user-attachments/assets/ca20feb6-f43a-4d38-8e72-c2fb9508c55f" />
<img width="1920" height="998" alt="FlowPay - Transfer" src="https://github.com/user-attachments/assets/f3e9d058-ba3e-48bb-93f3-f5b81cb586e4" />
<img width="1920" height="999" alt="FlowPay - Workflows" src="https://github.com/user-attachments/assets/a67a5f81-7690-4556-b897-660bd61cb2d0" />
<img width="1920" height="999" alt="FlowPay - Workflow Detail" src="https://github.com/user-attachments/assets/64f4cc2f-c0a4-44e2-bf71-6cc1b7f7d3de" />

---

## Usage

1. **Access the Web Dashboard** at `http://localhost:5173`.
2. **Register a new account** (which automatically provisions a multi-currency wallet).
3. **Deposit funds** into the wallet using the Dashboard modal.
4. **Initiate a Transfer** to another registered user using discrete money movements.
5. **Monitor Orchestration**: Open the Temporal Web UI at `http://localhost:8233` to view the real-time execution of the background Saga workflow, tracking retry attempts, activity timelines, and fault-toleration states.
6. **Schedule a Payment**: Navigate to the Scheduled Payments page to create a future or recurring payment, then pause, reactivate, or cancel it from the same dashboard.
7. **Manage your Profile**: Visit the Profile page to upload an avatar, update your display name or email, and change your password.
