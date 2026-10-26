# POS 🍽️

> **POS** is a modern, high-performance, offline-first Restaurant Point of Sale (POS) and Management System built with Next.js, NestJS, PostgreSQL, and TypeScript.

---

## Features

- **Fast Point of Sale (POS)**: Instant item selection, variants, modifiers, order hold/recall, and customizable order notes.
- **Dynamic Customer Display**: Real-time order synchronization with live running total, itemized breakdowns, and instant UPI QR code display for contactless payment.
- **Kitchen Display System (KDS)**: Real-time kitchen ticket management, preparation status tracking, and audio notifications.
- **Table & Floor Management**: Interactive dining room layout, table occupancy tracking, bill splitting, and multi-round table ordering.
- **Multi-Payment Support**: Instant UPI QR code generation, Cash with change calculation, Card, and split payments.
- **Role-Based Access Control**:
  - **Owner & Cashier**: Full administrative control, checkout, pending payments management, sales analytics, and refunds.
  - **Waiter**: Order taking, table serving, and live order status tracking (with restricted payment access).
  - **Kitchen**: Live order preparation and status updates.
- **Business Intelligence**: Live daily revenue, category breakdowns, tax reports, shift summaries, and audit logs.
- **Thermal Receipt Printing**: ESC/POS USB and network printer support with customizable bill layouts.
- **Offline-First & Resilient**: Continues functioning without interruptions during network degradation.

---

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS v4, Lucide Icons, Recharts
- **Backend**: NestJS, TypeScript, WebSocket (Socket.io), OpenAPI / Swagger
- **Database**: PostgreSQL with Prisma ORM
- **Monorepo Tooling**: Turborepo, pnpm workspaces

---

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- PostgreSQL >= 15

### 1. Clone the Repository

```bash
git clone https://github.com/Niv097/DINR_DEMO_POS.git
cd DINR_DEMO_POS
```

### 2. Environment Configuration

Copy the example environment configuration:

```bash
cp .env.example .env
```

Ensure your PostgreSQL database credentials and ports are properly configured in `.env`.

### 3. Install Dependencies

```bash
pnpm install
```

### 4. Database Setup

Run database migrations and seed default data:

```bash
pnpm --filter @dinr/backend prisma migrate deploy
pnpm --filter @dinr/backend prisma db seed
```

### 5. Start Development Servers

Run both the frontend and backend in development mode:

```bash
pnpm dev
```

- **Frontend POS & Back-office**: [http://localhost:1995](http://localhost:1995)
- **Customer Facing Display**: [http://localhost:1995/customer-display](http://localhost:1995/customer-display)
- **Kitchen Display (KDS)**: [http://localhost:1995/kds](http://localhost:1995/kds)
- **Backend API**: [http://localhost:4001](http://localhost:4001)

---

## License

This project is licensed under the [MIT License](LICENSE).
