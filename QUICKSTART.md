# Quick Start Checklist

Follow these steps to get JobMap running locally:

## ✅ Prerequisites Check

- [ ] Node.js >= 18 installed (`node --version`)
- [ ] pnpm >= 8 installed (`pnpm --version`)
- [ ] PostgreSQL >= 14 installed and running
- [ ] PostGIS extension available
- [ ] Mapbox account created

## ✅ Setup Steps

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Create database**
   ```bash
   createdb jobmap
   psql jobmap -c "CREATE EXTENSION IF NOT EXISTS postgis;"
   ```

3. **Create `.env` file** (in project root)
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/jobmap
   MAPBOX_TOKEN=your_mapbox_token_here
   WEB_ORIGIN=http://localhost:3000
   ADMIN_KEY=generate_random_secret_here
   ```

4. **Run migrations**
   ```bash
   cd apps/api
   pnpm db:migrate
   ```

5. **Seed database (optional)**
   ```bash
   pnpm db:seed
   ```

6. **Start dev servers**
   ```bash
   cd ../..  # Back to project root
   pnpm dev
   ```

## ✅ Verify

- [ ] API health check: http://localhost:4000/health returns `{"status":"ok"}`
- [ ] Web app loads: http://localhost:3000 shows map
- [ ] Map displays Phoenix, Arizona
- [ ] Jobs appear on map (if seeded)

## 🐛 Common Issues

**Database connection error?**
- Check PostgreSQL is running
- Verify `DATABASE_URL` is correct
- Ensure PostGIS extension is enabled

**Map not loading?**
- Check `NEXT_PUBLIC_MAPBOX_TOKEN` is set
- Verify Mapbox token is valid
- Check browser console for errors

**API not starting?**
- Check port 4000 is available
- Verify all environment variables are set
- Check API logs for errors

For detailed troubleshooting, see [SETUP.md](./SETUP.md).






