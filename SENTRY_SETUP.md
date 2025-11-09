# Sentry Error Tracking Setup

Sentry has been integrated into both the web app and API for production error tracking.

## Free Tier Limits

- **5,000 errors/month** - FREE
- **10,000 performance units/month** - FREE
- Perfect for small/medium projects

## Setup Instructions

### 1. Create a Sentry Account

1. Go to https://sentry.io/signup/
2. Create a free account
3. Create a new project:
   - Select **Next.js** for the web app
   - Select **Node.js** for the API

### 2. Get Your DSN

After creating your project, Sentry will provide you with a DSN. It will look like:

```
https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
```

Copy this DSN - you'll need it for the next step.

### 3. Add Environment Variables

#### For Web App (`apps/web/.env.local` or root `.env`):

Add these to your `.env` or `.env.local` file:

```env
# Sentry Error Tracking
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn_here
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug
```

**Note:**

- Replace `your_sentry_dsn_here` with your actual DSN from Sentry
- You need to set `SENTRY_ORG` and `SENTRY_PROJECT` for source map uploads during build
- To find these values, go to your Sentry project settings → Client Keys (DSN) → they'll be shown there

#### For API (`apps/api/.env` or root `.env`):

You can use the same DSN for the API, or create a separate Node.js project in Sentry:

```env
# Option 1: Use same DSN (simpler)
SENTRY_DSN=your_sentry_dsn_here

# Option 2: Create separate Node.js project and use its DSN
# SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
```

**Note:** Using the same DSN works fine - errors will be tagged by environment (web vs api) automatically.

### 4. Verify Setup

1. **Web App**: Start the dev server and trigger an error. Check your Sentry dashboard.
2. **API**: Start the API server and trigger an error. Check your Sentry dashboard.

## What Gets Tracked

### Web App (Next.js)

- ✅ React component errors (ErrorBoundary)
- ✅ Unhandled exceptions
- ✅ API request failures
- ✅ Client-side errors
- ✅ Session replay (10% of sessions, 100% of errors)

### API (Fastify)

- ✅ Unhandled route errors
- ✅ Database errors
- ✅ Validation errors (500s only)
- ✅ Server startup errors

## Configuration

### Sampling Rates

- **Production**: 10% of transactions traced
- **Development**: 100% of transactions traced

You can adjust these in:

- `apps/web/sentry.client.config.ts`
- `apps/web/sentry.server.config.ts`
- `apps/api/src/lib/sentry.ts`

### Disabling Sentry

If you want to disable Sentry temporarily, simply don't set the `SENTRY_DSN` environment variable. The app will continue to work normally, just without error tracking.

## Monitoring

Once set up, you can:

- View errors in real-time on Sentry dashboard
- Get email/Slack notifications for new errors
- See error trends and frequency
- Debug with full stack traces and context
- Track error resolution

## Cost

**Free tier is sufficient for most projects:**

- 5,000 errors/month is plenty for small/medium apps
- Only pay if you exceed (starts at $26/month)
- You'll get warnings before hitting limits

## Resources

- [Sentry Next.js Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Node.js Docs](https://docs.sentry.io/platforms/node/)
- [Sentry Dashboard](https://sentry.io/)
