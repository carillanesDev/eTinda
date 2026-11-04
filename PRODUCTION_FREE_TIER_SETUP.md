# eTinda — 100% Free-Tier Production Setup Guide ($0 / Month)
**Vercel Free Tier + Vercel Prisma Database Free Tier**

eTinda is architected so that a Sari-Sari Store (Tindahan) can run in production at **$0.00/month** using **Vercel's Free Tier (Hobby Plan)** and **Vercel's Prisma Database Free Tier (Vercel Prisma Postgres)**, with **no credit card required**.

---

## 1. Free-Tier Production Stack Overview

| Layer | Technology / Service | Free-Tier Quota | Monthly Cost |
| :--- | :--- | :--- | :--- |
| **Web Hosting, CDN & Serverless API** | **Vercel Free Tier (Hobby Plan)** | 100 GB bandwidth/mo, 100,000 serverless invocations/mo, automatic HTTPS & global Edge network | **$0.00 / mo** |
| **Cloud PostgreSQL Database** | **Vercel Prisma Postgres (Free Tier)** *(Vercel Storage / Marketplace)* | Serverless PostgreSQL powered by Prisma on Vercel, 100,000 free operations/mo, up to 5 free databases, zero cold starts, auto-injected `DATABASE_URL` | **$0.00 / mo** |
| **Authentication & Role Management** | **Self-Hosted Auth.js v5 (`next-auth`) + Node `crypto.scryptSync`** | Email + Username + Password sign-up for Store Owners (`ADMIN`) & Owner-created Store Helpers (`HELPER`), zero per-MAU fees | **$0.00 / mo** |
| **Offline-First POS & Sync Engine** | **Browser IndexedDB (`Dexie.js`) + Service Worker (`public/sw.js`)** | Runs 100% on the store's Android/iOS phone, tablet, or laptop browser | **$0.00 / mo** |
| **Total Monthly Production Cost** | | | **₱0.00 ($0.00 / mo)** |

> **Why Offline-First Keeps You Comfortably Inside Vercel + Prisma Free-Tier Quotas:**
> Because daily POS checkouts, product searches, stock checks, and utang lookups execute locally against **IndexedDB (`Dexie.js`)** and only batch-sync mutations via `/api/sync`, your **Vercel Prisma Postgres** database and **Vercel Serverless Functions** use **95% fewer operations and invocations** than a traditional cloud-only POS.

---

## 2. Step-by-Step Zero-Cost Production Deployment on Vercel + Vercel Prisma Database

### Step 1: Import Repository into Vercel Free Tier (Hobby Plan)
1. Push your `eTinda` repository to a free **GitHub** repository.
2. Sign in to [https://vercel.com](https://vercel.com) on the **Hobby (Free) Plan** (no credit card required) and click **Add New → Project**.
3. Import your GitHub repository into Vercel.

---

### Step 2: Provision Vercel's Prisma Database Free Tier (Vercel Prisma Postgres)
1. Inside your Vercel Project Dashboard, open the **Storage** tab (or **Marketplace → Storage**).
2. Click **Create Database** and select **Prisma Postgres** (*Instant Serverless Postgres powered by Prisma*).
3. Select the **Free Plan ($0.00 / month)**:
   - **Database Name:** `etinda-pos-db`
   - **Region:** `Asia Pacific (Singapore) — ap-southeast-1` (lowest latency for the Philippines)
4. Click **Create** and then **Connect Project** to link the database to your `eTinda` Vercel project across **Production**, **Preview**, and **Development** environments.
   - Vercel automatically injects `DATABASE_URL` and `PRISMA_DATABASE_URL` into your project's environment variables (`src/lib/db/prisma.ts` automatically resolves `DATABASE_URL` / `PRISMA_DATABASE_URL` / `POSTGRES_PRISMA_URL`).

---

### Step 3: Add Auth & Prisma Persistence Environment Variables in Vercel
1. Generate a free 64-character `AUTH_SECRET` locally in Node.js:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. In your Vercel Project Dashboard → **Settings → Environment Variables**, confirm `DATABASE_URL` (auto-added by Vercel Prisma Postgres in Step 2) and add the following variables:

| Name | Value | Notes |
| :--- | :--- | :--- |
| `DATABASE_URL` | *(Auto-injected by Vercel Prisma Postgres)* | Connection URL from Vercel Storage → Prisma Postgres |
| `ETINDA_USE_PRISMA_DB` | `true` | Enables authoritative PostgreSQL writes via Prisma |
| `AUTH_SECRET` | Your 64-character hex string | Signs Auth.js JWT sessions |
| `AUTH_TRUST_HOST` | `true` | Required for Auth.js on Vercel `.vercel.app` domains |

---

### Step 4: Apply the Prisma Database Schema & Seed Initial Store Data
Pull your Vercel Prisma Database credentials locally (or copy `DATABASE_URL` from the Vercel Storage → Prisma Postgres **`.env.local`** tab) and run the migration:

```bash
# Option A: Pull environment variables automatically via Vercel CLI
npx vercel env pull .env

# Option B: Or set your Vercel Prisma DATABASE_URL directly in PowerShell
$env:DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=YOUR_VERCEL_PRISMA_KEY"

# 1. Deploy the production migration (creates stores, users with email+username, devices, products, sales, utang, sync ledgers)
npm run db:migrate:deploy

# 2. (Optional) Seed initial baseline store data
npm run db:seed
```

---

### Step 5: Deploy on Vercel
1. Trigger a deployment in Vercel (or push to `main`).
2. Vercel automatically executes `prisma generate && next build` (configured in `vercel.json` and `package.json`).
3. Within ~60 seconds, your tindahan web app is live at `https://your-store.vercel.app`.

---

## 3. Store Owner Sign-Up & Creating Helper / User Accounts

### A. Store Owner Sign-Up (`/register`) — Email, Username & Password
1. Open `/login` and click **"Create New Store Owner Account / Setup Store"** (or navigate directly to `/register`).
2. Sign up using:
   - **Owner Full Name** (e.g., *Rosa Mendoza*)
   - **Email Address** (e.g., `rosa@etinda.ph`)
   - **Username** (e.g., `rosa.owner`)
   - **Password** & **Confirm Password** (hashed on the server using Node `crypto.scryptSync` with a random 16-byte cryptographic salt; raw passwords are never stored in IndexedDB)
   - **Sari-Sari Store Profile** (Store Name, Barangay / Address, and Store Mobile Number)
3. Submit to register the Store Owner (`ADMIN`) account and proceed directly to the **Owner User Creation Page (`/users`)**.

### B. Owner User Creation Page (`/users`) — Creating Helpers & Users for the Tindahan
1. While signed in as the **Store Owner (`ADMIN`)**, click **Users & Helpers (`/users`)** in the sidebar navigation (or click **"User Creation Page"** inside `/settings`).
2. In the **Create Helper or Store User Account** form on `/users`, enter:
   - **Full Name** (e.g., *Ate Lorna Cruz*)
   - **Email Address** (e.g., `lorna.helper@etinda.ph`)
   - **Username** (e.g., `lorna_helper`)
   - **Assigned Store Role**:
     - **Store Helper (`HELPER`)**: Permitted to process POS sales, receive stock-in deliveries, and record customer utang payments; restricted from viewing net profit margins, voiding sales, or managing users/devices.
     - **Store Owner (`ADMIN`)**: Full access to catalog pricing, financial reports, user creation, and device authorization.
   - **Password** & **Confirm Password**
3. Click **Create Store Helper Account**.
4. The newly created Helper or User account appears immediately in the **Registered Store Team Accounts** directory on `/users` and on the `/login` screen, where operators can sign in using their **Email or Username** and **Password**.
