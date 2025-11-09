/**
 * User-friendly error messages
 */

export interface AppError {
  message: string;
  title?: string;
  action?: string;
  retry?: () => void;
  icon?: string;
  suggestions?: string[];
}

/**
 * Converts API errors to user-friendly messages
 */
export function getErrorMessage(error: unknown): AppError {
  // Network errors
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return {
      title: "Connection Error",
      message: "Unable to connect to the server. Please check your internet connection and try again.",
      action: "Try Again",
      icon: "📡",
      suggestions: [
        "Check your internet connection",
        "Make sure you're not offline",
        "Try refreshing the page",
      ],
    };
  }

  // API errors
  if (error instanceof Error) {
    // 400 - Bad Request
    if (error.message.includes("400")) {
      return {
        title: "Invalid Request",
        message: "There was a problem with your search. Please check your filters and try again.",
        action: "Adjust Filters",
        icon: "🔍",
        suggestions: [
          "Check your search terms",
          "Verify your filter settings",
          "Try clearing filters and starting over",
        ],
      };
    }

    // 401 - Unauthorized
    if (error.message.includes("401")) {
      return {
        title: "Authentication Required",
        message: "You need to be logged in to access this feature.",
        action: "Sign In",
        icon: "🔐",
      };
    }

    // 403 - Forbidden
    if (error.message.includes("403")) {
      return {
        title: "Access Denied",
        message: "You don't have permission to perform this action.",
        action: "Go Back",
        icon: "🚫",
      };
    }

    // 404 - Not Found
    if (error.message.includes("404")) {
      return {
        title: "Not Found",
        message: "The requested job could not be found. It may have been removed or the link is invalid.",
        action: "Browse Jobs",
        icon: "🔍",
        suggestions: [
          "The job may have been removed",
          "Try searching for similar jobs",
          "Check your saved jobs list",
        ],
      };
    }

    // 408 - Request Timeout
    if (error.message.includes("408")) {
      return {
        title: "Request Timeout",
        message: "The request took too long to complete. This might be due to a slow connection.",
        action: "Try Again",
        icon: "⏱️",
        suggestions: [
          "Check your internet speed",
          "Try again in a moment",
          "Reduce your search area on the map",
        ],
      };
    }

    // 429 - Rate Limited
    if (error.message.includes("429")) {
      return {
        title: "Too Many Requests",
        message: "You're making requests too quickly. Please wait a moment before trying again.",
        action: "Wait and Retry",
        icon: "⏳",
        suggestions: [
          "Wait 10-30 seconds before retrying",
          "Try refreshing the page",
          "Reduce the number of filters you're using",
        ],
      };
    }

    // 500 - Server Error
    if (error.message.includes("500")) {
      return {
        title: "Server Error",
        message: "Something went wrong on our end. We've been notified and are working on fixing it.",
        action: "Try Again Later",
        icon: "⚠️",
        suggestions: [
          "Wait a few minutes and try again",
          "Check our status page if available",
          "Contact support if the problem persists",
        ],
      };
    }

    // 502 - Bad Gateway
    if (error.message.includes("502")) {
      return {
        title: "Service Temporarily Unavailable",
        message: "The server is temporarily unavailable. Please try again in a few moments.",
        action: "Retry",
        icon: "🔄",
        suggestions: [
          "Wait a moment and refresh",
          "Try again in a few minutes",
        ],
      };
    }

    // 503 - Service Unavailable
    if (error.message.includes("503")) {
      return {
        title: "Service Unavailable",
        message: "The service is temporarily unavailable due to maintenance or high traffic. Please try again shortly.",
        action: "Retry",
        icon: "🔧",
        suggestions: [
          "Wait a few minutes",
          "Check back later",
        ],
      };
    }

    // 504 - Gateway Timeout
    if (error.message.includes("504")) {
      return {
        title: "Request Timeout",
        message: "The server took too long to respond. This might be due to high traffic or server issues.",
        action: "Try Again",
        icon: "⏱️",
        suggestions: [
          "Wait a moment and retry",
          "Try reducing your search area",
          "Check back in a few minutes",
        ],
      };
    }

    // Generic API error
    if (error.message.includes("API error")) {
      const statusMatch = error.message.match(/\d{3}/);
      if (statusMatch) {
        // Try to get specific error for the status code
        return getErrorMessage(new Error(statusMatch[0]));
      }
      return {
        title: "Request Failed",
        message: "We couldn't complete your request. Please try again in a moment.",
        action: "Retry",
        icon: "❌",
        suggestions: [
          "Check your internet connection",
          "Try refreshing the page",
          "Clear your browser cache if the problem persists",
        ],
      };
    }

    // Timeout errors
    if (error.message.includes("timeout") || error.message.includes("Timeout")) {
      return {
        title: "Request Timeout",
        message: "The request took too long to complete. Please try again.",
        action: "Retry",
        icon: "⏱️",
        suggestions: [
          "Check your internet connection",
          "Try reducing your search area",
          "Wait a moment and try again",
        ],
      };
    }

    // Generic error
    return {
      title: "Something Went Wrong",
      message: error.message || "An unexpected error occurred. Please try again.",
      action: "Retry",
      icon: "⚠️",
      suggestions: [
        "Try refreshing the page",
        "Clear your browser cache",
        "Contact support if the problem continues",
      ],
    };
  }

  // Unknown error
  return {
    title: "Unexpected Error",
    message: "Something unexpected happened. Please refresh the page and try again.",
    action: "Refresh Page",
    icon: "🔄",
    suggestions: [
      "Refresh the page (F5 or Cmd+R)",
      "Clear your browser cache",
      "Try using a different browser",
    ],
  };
}

/**
 * Checks if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return true; // Network errors are retryable
  }

  if (error instanceof Error) {
    // 5xx errors are retryable
    if (error.message.includes("500") || error.message.includes("502") || error.message.includes("503")) {
      return true;
    }
    // Rate limits are retryable after waiting
    if (error.message.includes("429")) {
      return true;
    }
  }

  return false;
}


