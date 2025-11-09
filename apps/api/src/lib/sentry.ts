import * as Sentry from "@sentry/node";

/**
 * Initialize Sentry for the API
 */
export function initSentry() {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.warn("⚠️  SENTRY_DSN not set. Error tracking disabled.");
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    debug: false,
  });

  console.log("✅ Sentry initialized for error tracking");
}

/**
 * Capture an exception
 */
export function captureException(error: Error, context?: Record<string, any>) {
  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value);
      });
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

/**
 * Capture a message
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = "info") {
  Sentry.captureMessage(message, level);
}




