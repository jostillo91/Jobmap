# JobMap Setup Guide

This guide will walk you through setting up JobMap locally so you can run and develop it.

## Prerequisites

Before you begin, make sure you have:

- **Node.js** >= 18.0.0 ([Download](https://nodejs.org/))
- **pnpm** >= 8.0.0 (Install: `npm install -g pnpm@8`)
- **PostgreSQL** >= 14 with PostGIS extension
  - **Windows**: [PostgreSQL with PostGIS](https://postgis.net/install/)
  - **macOS**: `brew install postgresql postgis`
  - **Linux**: `sudo apt-get install postgresql postgis` (Ubuntu/Debian)
- **Mapbox account** ([Sign up](https://account.mapbox.com/)) - Free tier available

## Step 1: Install Dependencies

```bash
pnpm install
```

This will install all dependencies for the monorepo (web app, API, and shared packages).

## Step 2: Set Up Database

### 2.1 Create PostgreSQL Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE jobmap;

# Connect to the database
\c jobmap

# Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

# Exit psql
\q
```

### 2.2 Get Database Connection String

Your connection string should look like:
```
postgresql://username:password@localhost:5432/jobmap
```

**Note**: Replace `username` and `password` with your PostgreSQL credentials.

## Step 3: Get API Keys

You'll need the following API keys:

### 3.1 Mapbox Token (Required)
1. Go to [Mapbox Account](https://account.mapbox.com/)
2. Sign up or log in
3. Go to "Access tokens"
4. Copy your default public token (or create a new one)
5. Make sure it has these scopes: `styles:read`, `fonts:read`, `datasets:read`

### 3.2 Adzuna API Keys (Optional - for job ingestion)
1. Go to [Adzuna API](https://developer.adzuna.com/)
2. Sign up for a free account
3. Get your App ID and App Key from the dashboard

### 3.3 USAJOBS API Key (Optional - for job ingestion)
1. Go to [USAJOBS Developer](https://developer.usajobs.gov/)
2. Sign up for an account
3. Get your API Key and User-Agent (your email)

## Step 4: Configure Environment Variables

### 4.1 Create `.env` File

In the project root, create a `.env` file:

```bash
# Copy from example (if it exists)
cp .env.example .env

# Or create manually
touch .env
```

### 4.2 Add Environment Variables

Edit `.env` and add the following:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/jobmap

# Mapbox (Required)
MAPBOX_TOKEN=your_mapbox_token_here

# Adzuna API (Optional - leave empty if not using)
ADZUNA_APP_ID=your_adzuna_app_id
ADZUNA_APP_KEY=your_adzuna_app_key

# USAJOBS API (Optional - leave empty if not using)
USAJOBS_HOST=api.usajobs.gov
USAJOBS_USER_AGENT=your_email@example.com
USAJOBS_API_KEY=your_usajobs_api_key

# Web origin for CORS (default: localhost:3000)
WEB_ORIGIN=http://localhost:3000

# Admin Key (generate a random secret)
ADMIN_KEY=your_random_secret_key_here

# Sentry Error Tracking (Optional but recommended)
# Get your DSN from https://sentry.io/
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn_here
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug
SENTRY_DSN=your_sentry_dsn_here

# Redis Caching (Optional but recommended for performance)
# Get free Redis from Upstash: https://upstash.com/
REDIS_URL=redis://default:xxxxx@xxxxx.upstash.io:6379
```

**Important**: 
- Replace `username:password` in `DATABASE_URL` with your PostgreSQL credentials
- Replace `your_mapbox_token_here` with your actual Mapbox token
- Generate a secure random string for `ADMIN_KEY` (you can use: `openssl rand -hex 32`)

### 4.3 Create `.env.local` for Web App (Optional)

For the Next.js web app, you can also create `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token_here
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn_here
```

**Note**: If you don't create this, the web app will use defaults (`http://localhost:4000` for API and read from `process.env.NEXT_PUBLIC_MAPBOX_TOKEN`).

## Step 5: Run Database Migrations

```bash
# Navigate to API directory
cd apps/api

# Run migrations
pnpm db:migrate

# This will:
# 1. Create all database tables
# 2. Set up PostGIS geometry columns
# 3. Create indexes
```

If you see any errors, make sure:
- PostgreSQL is running
- PostGIS extension is enabled
- `DATABASE_URL` is correct in `.env`

## Step 6: Seed Initial Data (Optional)

To populate the database with sample jobs:

```bash
# Still in apps/api directory
pnpm db:seed
```

This will create 5 dummy jobs in Phoenix, Arizona for testing.

## Step 7: Start Development Servers

From the project root:

```bash
pnpm dev
```

This will start:
- **Web app**: http://localhost:3000
- **API server**: http://localhost:4000

You should see:
```
✓ Web app ready on http://localhost:3000
✓ API server running on http://0.0.0.0:4000
```

## Step 8: Verify Everything Works

### 8.1 Check API Health

Open your browser or use curl:

```bash
curl http://localhost:4000/health
```

Should return: `{"status":"ok"}`

### 8.2 Check Web App

1. Open http://localhost:3000 in your browser
2. You should see:
   - A map centered on Phoenix, Arizona
   - A left panel with filters
   - If you seeded data, you should see job markers on the map

### 8.3 Test Job Search

1. Pan or zoom the map
2. Click "Search This Area" button
3. Jobs should appear in the left panel and as markers on the map

## Troubleshooting

### Database Connection Issues

**Error**: `Can't reach database server`

**Solutions**:
- Make sure PostgreSQL is running: `pg_isready` or check services
- Verify `DATABASE_URL` is correct
- Check PostgreSQL is listening on port 5432: `netstat -an | grep 5432`

**Error**: `extension "postgis" does not exist`

**Solutions**:
- Make sure PostGIS is installed: `psql -U postgres -d jobmap -c "CREATE EXTENSION postgis;"`
- On some systems, you may need: `CREATE EXTENSION IF NOT EXISTS postgis;`

### Map Not Loading

**Error**: Map shows blank or error message

**Solutions**:
- Check browser console for errors
- Verify `NEXT_PUBLIC_MAPBOX_TOKEN` is set correctly
- Make sure Mapbox token is valid and has correct permissions
- Check network tab for failed requests to Mapbox API

### API Not Starting

**Error**: `Port 4000 already in use`

**Solutions**:
- Change port in `.env`: `PORT=4001`
- Or kill the process using port 4000:
  - Windows: `netstat -ano | findstr :4000` then `taskkill /PID <pid> /F`
  - macOS/Linux: `lsof -ti:4000 | xargs kill`

**Error**: `Cannot find module` or import errors

**Solutions**:
- Run `pnpm install` again
- Delete `node_modules` and reinstall: `rm -rf node_modules && pnpm install`
- Make sure you're using pnpm, not npm or yarn

### Web App Build Errors

**Error**: TypeScript errors

**Solutions**:
- Run `pnpm typecheck` to see all errors
- Make sure all dependencies are installed
- Check that `apps/web/tsconfig.json` is correct

### No Jobs Appearing

**Possible causes**:
- Database is empty (run `pnpm db:seed` in `apps/api`)
- Map bounds don't match job locations
- Jobs are outside the visible map area
- API is returning errors (check browser Network tab)

**Solutions**:
- Seed the database: `cd apps/api && pnpm db:seed`
- Check API logs for errors
- Try searching a different area (e.g., Phoenix, AZ)
- Check browser console for API errors

## Next Steps

Once everything is working:

1. **Ingest Real Jobs** (if you have API keys):
   ```bash
   cd apps/api
   pnpm ingest:adzuna    # Ingest from Adzuna
   pnpm ingest:usajobs   # Ingest from USAJOBS
   pnpm ingest:all       # Ingest from all sources
   ```

2. **Test Employer Submission**:
   - Go to http://localhost:3000/post
   - Fill out the form and submit a job
   - Check admin panel at http://localhost:3000/admin

3. **Test Admin Moderation**:
   - Go to http://localhost:3000/admin
   - Enter your `ADMIN_KEY` from `.env`
   - Approve or reject pending jobs

4. **Run Tests**:
   ```bash
   pnpm test
   ```

5. **Check Code Quality**:
   ```bash
   pnpm lint
   pnpm typecheck
   ```

## Development Tips

- **Hot Reload**: Both web and API support hot reload. Changes will automatically refresh.
- **Database Studio**: View/edit database: `cd apps/api && pnpm db:studio`
- **API Logs**: Check terminal where `pnpm dev` is running for API request logs
- **Type Safety**: The project uses strict TypeScript. Fix type errors as you develop.

## Need Help?

- Check the [README.md](./README.md) for project overview
- Check [DEPLOY.md](./DEPLOY.md) for deployment instructions
- Review error messages in terminal and browser console
- Check database connection and API keys



