# Deployment Guide

This guide walks you through deploying JobMap to production.

## Overview

- **Web App**: Deploy to Vercel
- **API**: Deploy to Fly.io or Render
- **Database**: Use Neon or Supabase (PostgreSQL with PostGIS)

---

## Step 1: Set Up Database (Neon or Supabase)

### Option A: Neon (Recommended)

1. Go to [neon.tech](https://neon.tech) and sign up
2. Create a new project
3. Copy the connection string (it will look like `postgres://user:pass@host/dbname`)
4. **Enable PostGIS**: Run this SQL in the Neon SQL editor:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```

### Option B: Supabase

1. Go to [supabase.com](https://supabase.com) and create a project
2. In the SQL Editor, run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
3. Copy the connection string from Settings → Database

**Save your `DATABASE_URL` - you'll need it for the API deployment.**

---

## Step 2: Deploy API to Fly.io

### Prerequisites
- Install [Fly CLI](https://fly.io/docs/getting-started/installing-flyctl/)
- Sign up at [fly.io](https://fly.io)

### Steps

1. **Login to Fly.io**:
   ```bash
   fly auth login
   ```

2. **Navigate to API directory**:
   ```bash
   cd apps/api
   ```

3. **Create Fly app**:
   ```bash
   fly launch --no-deploy
   ```
   - When prompted, use the existing `fly.toml` or create a new one
   - Don't deploy yet

4. **Set environment variables**:
   ```bash
   fly secrets set DATABASE_URL="your_database_url_here"
   fly secrets set MAPBOX_TOKEN="your_mapbox_token"
   fly secrets set ADZUNA_APP_ID="your_adzuna_id"
   fly secrets set ADZUNA_APP_KEY="your_adzuna_key"
   fly secrets set USAJOBS_HOST="api.usajobs.gov"
   fly secrets set USAJOBS_USER_AGENT="your_email@example.com"
   fly secrets set USAJOBS_API_KEY="your_usajobs_key"
   fly secrets set WEB_ORIGIN="https://your-vercel-app.vercel.app"
   fly secrets set ADMIN_KEY="your_admin_secret_key"
   ```

5. **Deploy**:
   ```bash
   fly deploy
   ```

6. **Run migrations** (if not auto-run):
   ```bash
   fly ssh console -C "cd /app && pnpm prisma migrate deploy"
   ```

7. **Get your API URL**:
   ```bash
   fly info
   ```
   Your API will be at `https://your-app-name.fly.dev`

---

## Step 3: Deploy API to Render (Alternative)

### Steps

1. Go to [render.com](https://render.com) and sign up
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `jobmap-api`
   - **Root Directory**: `apps/api`
   - **Environment**: `Node`
   - **Build Command**: `pnpm install && pnpm prisma generate && pnpm build`
   - **Start Command**: `pnpm prisma migrate deploy && node dist/index.js`
   - **Plan**: Free or Starter

5. **Set Environment Variables**:
   - `DATABASE_URL` - Your Neon/Supabase connection string
   - `MAPBOX_TOKEN` - Your Mapbox token
   - `ADZUNA_APP_ID` - Your Adzuna app ID
   - `ADZUNA_APP_KEY` - Your Adzuna app key
   - `USAJOBS_HOST` - `api.usajobs.gov`
   - `USAJOBS_USER_AGENT` - Your email
   - `USAJOBS_API_KEY` - Your USAJOBS API key
   - `WEB_ORIGIN` - Your Vercel app URL (set after deploying web)
   - `ADMIN_KEY` - Your admin secret key
   - `NODE_ENV` - `production`
   - `PORT` - `4000`

6. Click "Create Web Service"
7. Wait for deployment to complete
8. Your API will be at `https://your-app-name.onrender.com`

---

## Step 4: Deploy Web App to Vercel

### Prerequisites
- Install [Vercel CLI](https://vercel.com/docs/cli): `npm i -g vercel`
- Or use the Vercel web interface

### Steps

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Navigate to project root**:
   ```bash
   cd /path/to/jobsearchapp
   ```

4. **Deploy**:
   ```bash
   vercel
   ```
   - Follow the prompts
   - Set root directory to project root (not apps/web)
   - Vercel will detect Next.js automatically

5. **Set Environment Variables** in Vercel dashboard:
   - Go to your project → Settings → Environment Variables
   - Add:
     - `NEXT_PUBLIC_API_URL` - Your API URL (from Fly.io or Render)
     - `NEXT_PUBLIC_MAPBOX_TOKEN` - Your Mapbox token

6. **Configure Build Settings**:
   - Root Directory: Leave empty (or set to project root)
   - Build Command: `pnpm install && pnpm --filter @jobmap/web build`
   - Output Directory: `apps/web/.next`
   - Install Command: `pnpm install`

7. **Redeploy** to apply environment variables:
   ```bash
   vercel --prod
   ```

### Alternative: Deploy via GitHub

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "Add New Project"
4. Import your GitHub repository
5. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: Leave empty
   - **Build Command**: `pnpm install && pnpm --filter @jobmap/web build`
   - **Output Directory**: `apps/web/.next`
   - **Install Command**: `pnpm install`
6. Add environment variables (same as above)
7. Click "Deploy"

---

## Step 5: Update API CORS

After deploying the web app, update the API's `WEB_ORIGIN` environment variable:

**Fly.io**:
```bash
fly secrets set WEB_ORIGIN="https://your-vercel-app.vercel.app"
fly deploy
```

**Render**:
- Go to your service → Environment
- Update `WEB_ORIGIN` to your Vercel URL
- Redeploy

---

## Step 6: Run Database Migrations

Migrations should run automatically on deploy, but you can verify:

**Fly.io**:
```bash
fly ssh console -C "cd /app && pnpm prisma migrate deploy"
```

**Render**:
- Check the build logs - migrations run via `startCommand`

**Manual** (if needed):
```bash
cd apps/api
pnpm prisma migrate deploy
```

---

## Step 7: Seed Initial Data (Optional)

To populate the database with sample jobs:

**Fly.io**:
```bash
fly ssh console -C "cd /app && pnpm db:seed"
```

**Render**:
- Use Render Shell or connect via SSH
- Run: `pnpm db:seed`

---

## Step 8: Verify Deployment

1. **Check API health**:
   ```bash
   curl https://your-api-url.fly.dev/health
   # Should return: {"status":"ok"}
   ```

2. **Check web app**:
   - Visit your Vercel URL
   - You should see the map centered on Phoenix
   - Jobs should load (if you've seeded data)

3. **Test job search**:
   - Pan the map
   - Click "Search This Area"
   - Jobs should appear

---

## Environment Variables Summary

### API (Fly.io/Render)
```
DATABASE_URL=postgres://...
MAPBOX_TOKEN=your_token
ADZUNA_APP_ID=your_id
ADZUNA_APP_KEY=your_key
USAJOBS_HOST=api.usajobs.gov
USAJOBS_USER_AGENT=your_email@example.com
USAJOBS_API_KEY=your_key
WEB_ORIGIN=https://your-vercel-app.vercel.app
ADMIN_KEY=your_admin_secret
NODE_ENV=production
PORT=4000
```

### Web (Vercel)
```
NEXT_PUBLIC_API_URL=https://your-api-url.fly.dev
NEXT_PUBLIC_MAPBOX_TOKEN=your_token
```

---

## Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` is correct
- Check that PostGIS extension is enabled
- Ensure database allows connections from your deployment IP

### API Not Starting
- Check logs: `fly logs` or Render logs
- Verify all environment variables are set
- Ensure migrations ran successfully

### Web App Can't Connect to API
- Verify `NEXT_PUBLIC_API_URL` is set correctly
- Check CORS settings in API (`WEB_ORIGIN`)
- Check browser console for errors

### Map Not Loading
- Verify `NEXT_PUBLIC_MAPBOX_TOKEN` is set
- Check Mapbox token has correct permissions
- Check browser console for errors

---

## Post-Deployment

1. **Set up ingestion cron jobs** (optional):
   - Use Fly.io cron or Render cron jobs
   - Schedule `pnpm ingest:all` to run daily

2. **Monitor**:
   - Check API logs regularly
   - Monitor database usage
   - Set up error tracking (Sentry, etc.)

3. **Scale** (if needed):
   - Fly.io: `fly scale count 2` for multiple instances
   - Render: Upgrade plan for better performance

---

## Quick Deploy Checklist

- [ ] Database created (Neon/Supabase)
- [ ] PostGIS extension enabled
- [ ] API deployed (Fly.io/Render)
- [ ] API environment variables set
- [ ] Database migrations run
- [ ] Web app deployed (Vercel)
- [ ] Web environment variables set
- [ ] API CORS updated with web URL
- [ ] Health check passes
- [ ] Map loads on homepage
- [ ] Jobs appear on map

---

## Support

For issues:
- Check deployment logs
- Verify environment variables
- Test API endpoints directly
- Check database connectivity






