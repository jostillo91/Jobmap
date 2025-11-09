# JobMap

A full-stack monorepo for finding jobs on an interactive map. Built with Next.js, Fastify, PostgreSQL, and PostGIS.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Node.js, Fastify, TypeScript, Zod
- **Database**: PostgreSQL with PostGIS extension
- **Monorepo**: pnpm workspaces + Turborepo

## Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- PostgreSQL >= 14 (with PostGIS support)
- Mapbox account and access token (for web app)

## Quick Start

For detailed setup instructions, see [SETUP.md](./SETUP.md).

**Quick setup**:

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Set up database**:
   ```bash
   # Create PostgreSQL database with PostGIS
   createdb jobmap
   psql jobmap -c "CREATE EXTENSION IF NOT EXISTS postgis;"
   ```

3. **Configure environment variables**:
   ```bash
   # Create .env file (see .env.example for template)
   # Required: DATABASE_URL, MAPBOX_TOKEN
   ```

4. **Run migrations**:
   ```bash
   cd apps/api
   pnpm db:migrate
   ```

5. **Start development servers**:
   ```bash
   pnpm dev
   ```
   This will start:
   - Web app on http://localhost:3000
   - API server on http://localhost:4000

See [SETUP.md](./SETUP.md) for complete setup instructions, troubleshooting, and API key configuration.

## Project Structure

```
.
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/           # Fastify backend
├── packages/
│   └── ui/            # Shared UI components and types
└── package.json       # Root workspace config
```

## Available Scripts

- `pnpm dev` - Start all apps in development mode
- `pnpm build` - Build all apps
- `pnpm lint` - Lint all packages
- `pnpm typecheck` - Type check all packages

## Development

### Web App (`apps/web`)

- Runs on port 3000
- Hot reload enabled
- TypeScript strict mode

### API (`apps/api`)

- Runs on port 4000
- TypeScript strict mode
- Environment variables loaded from `.env`

### Shared Package (`packages/ui`)

- Shared TypeScript types
- Tailwind CSS preset
- Reusable UI components (to be added)

## Type Safety

All packages use strict TypeScript configuration. Type-safe imports work across packages using workspace protocol (`workspace:*`).

## Deployment

See [DEPLOY.md](./DEPLOY.md) for detailed deployment instructions.

Quick summary:
- **Web**: Deploy to Vercel
- **API**: Deploy to Fly.io or Render
- **Database**: Use Neon or Supabase (with PostGIS)

## Features

- 🗺️ **Interactive Map**: Browse jobs on an interactive map with clustering
- 🔍 **Advanced Search**: Filter by keyword, company, salary, employment type, and posting date
- 📍 **Precise Locations**: Jobs are geocoded to exact street addresses
- 💾 **Save Jobs**: Save favorite jobs for later
- 📱 **Mobile Responsive**: Optimized for mobile and desktop
- 🌙 **Dark Mode**: Built-in dark mode support
- ♿ **Accessible**: WCAG compliant with keyboard navigation and screen reader support
- 📊 **Export**: Export job listings to CSV

## Job Sources

- Adzuna
- USAJOBS (Federal Government)
- LinkedIn
- Indeed
- ZipRecruiter
- Arizona Job Connection
- Manual job postings

## License

MIT

