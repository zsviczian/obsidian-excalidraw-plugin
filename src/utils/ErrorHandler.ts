import { Notice } from "obsidian";
import { debug, DEBUGGING } from "./debugHelper";

/**
 * Centralized error handling for the Excalidraw plugin
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: Array<{error: Error, context: string, timestamp: number}> = [];
  private errorNoticeTimeout: number = 10000; // 10 seconds
  private maxLogEntries: number = 100;
  
  private constructor() {}
  
  /**
   * Get singleton instance of ErrorHandler
   */
  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handles errors consistently across the plugin
   * @param error The error object
   * @param context Context information about where the error occurred
   * @param showNotice Whether to show a user-facing notice
   * @param timeout How long to show the notice (in ms)
   */
  public handleError(
    error: Error | string, 
    context: string, 
    showNotice = true,
    timeout?: number
  ): void {
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    
    // Log to console with better formatting
    console.error(`[Excalidraw Error] in ${context}:`, errorObj);
    
    // Add to error log with timestamp
    this.errorLog.push({
      error: errorObj,
      context,
      timestamp: Date.now()
    });
    
    // Trim log if it gets too large
    if (this.errorLog.length > this.maxLogEntries) {
      this.errorLog = this.errorLog.slice(this.errorLog.length - this.maxLogEntries);
    }
    
    // Show notice to user if required
    if (showNotice) {
      const formattedError = this.formatErrorForUser(errorObj, context);
      new Notice(formattedError, timeout || this.errorNoticeTimeout);
    }

    // Debug output if debugging is enabled
    if ((process.env.NODE_ENV === 'development') && DEBUGGING) {
      debug(this.handleError, `ErrorHandler.handleError: ${context}`, errorObj);
    }
  }

  /**
   * Safely evaluates code with error handling
   * @param code The code to evaluate
   * @param context The context where evaluation is happening
   * @param win The window object for evaluation context
   * @param fallback Optional fallback value if evaluation fails
   */
  public safeEval<T>(code: string, context: string, win: Window, fallback?: T): T {
    try {
      return win.eval.call(win, code) as T;
    } catch (error) {
      this.handleError(error, `SafeEval in ${context}`);
      if (fallback !== undefined) {
        return fallback;
      }
      throw error; // Re-throw if no fallback provided
    }
  }

  /**
   * Wraps a function with try/catch and error handling
   * @param fn Function to wrap
   * @param context Context for error reporting
   * @param fallback Optional fallback value if function fails
   */
  public wrapWithTryCatch<T>(fn: () => T, context: string, fallback?: T): T {
    try {
      return fn();
    } catch (error) {
      this.handleError(error, context);
      if (fallback !== undefined) return fallback;
      throw error; // Re-throw if no fallback provided
    }
  }

  /**
   * Format error message for user-facing notifications
   */
  private formatErrorForUser(error: Error, context: string): string {
    // Shorten and simplify the message for users
    let message = error.message;
    
    // Special handling for common error types
    if (message.includes("Cannot read properties of undefined")) {
      message = "A required object was not available. This might be due to a plugin loading issue.";
    } else if (message.includes("is not a function")) {
      message = "A required function was not available. This might be due to a plugin version mismatch.";
    } else if (message.length > 100) {
      // Truncate very long messages
      message = message.substring(0, 100) + "...";
    }
    
    return `Excalidraw Error: ${message} (in ${context})`;
  }

  /**
   * Get recent errors for debugging
   */
  public getErrorLog(): Array<{error: Error, context: string, timestamp: number}> {
    return [...this.errorLog];
  }

  /**
   * Clear error log
   */
  public clearErrorLog(): void {
    this.errorLog = [];
  }
}

export const errorHandler = ErrorHandler.getInstance();
