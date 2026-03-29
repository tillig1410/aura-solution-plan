/**
 * Circuit Breaker pattern for external API calls.
 *
 * Protects the application from cascading failures when external services
 * (Gemini, Telnyx, Stripe, WhatsApp, Messenger, Telegram) are degraded.
 *
 * States:
 * - CLOSED  : normal operation, calls pass through
 * - OPEN    : service is failing, calls are rejected immediately
 * - HALF_OPEN : after resetTimeout, one test call is allowed to probe recovery
 */

import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

export interface CircuitBreakerConfig {
  /** Name used for logging (e.g. "gemini", "stripe"). */
  name: string;
  /** Number of consecutive failures before opening the circuit. Default 5. */
  failureThreshold?: number;
  /** Time in ms to wait before moving from OPEN to HALF_OPEN. Default 30 000. */
  resetTimeout?: number;
  /** Number of successful test calls required in HALF_OPEN before closing. Default 1. */
  halfOpenMaxAttempts?: number;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  nextAttemptTime: number | null;
}

export class CircuitBreakerError extends Error {
  public readonly circuitName: string;
  public readonly state: CircuitState;

  constructor(name: string, state: CircuitState) {
    super(`Circuit breaker "${name}" is ${state} — call rejected`);
    this.name = "CircuitBreakerError";
    this.circuitName = name;
    this.state = state;
  }
}

// ---------------------------------------------------------------------------
// Circuit Breaker class
// ---------------------------------------------------------------------------

export class CircuitBreaker<TArgs extends unknown[], TResult> {
  private readonly serviceName: string;
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly halfOpenMaxAttempts: number;

  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private halfOpenAttempts = 0;

  private readonly fn: (...args: TArgs) => Promise<TResult>;

  constructor(
    fn: (...args: TArgs) => Promise<TResult>,
    config: CircuitBreakerConfig,
  ) {
    this.fn = fn;
    this.serviceName = config.name;
    this.failureThreshold = config.failureThreshold ?? 5;
    this.resetTimeout = config.resetTimeout ?? 30_000;
    this.halfOpenMaxAttempts = config.halfOpenMaxAttempts ?? 1;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Execute the wrapped function through the circuit breaker.
   * Throws `CircuitBreakerError` when the circuit is OPEN.
   */
  async call(...args: TArgs): Promise<TResult> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldTransitionToHalfOpen()) {
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        throw new CircuitBreakerError(this.serviceName, this.state);
      }
    }

    if (this.state === CircuitState.HALF_OPEN && this.halfOpenAttempts >= this.halfOpenMaxAttempts) {
      throw new CircuitBreakerError(this.serviceName, this.state);
    }

    try {
      if (this.state === CircuitState.HALF_OPEN) {
        this.halfOpenAttempts += 1;
      }

      const result = await this.fn(...args);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /** Return a snapshot of the current circuit state and counters. */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime:
        this.state === CircuitState.OPEN && this.lastFailureTime !== null
          ? this.lastFailureTime + this.resetTimeout
          : null,
    };
  }

  /** Manually reset the circuit to CLOSED. */
  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private shouldTransitionToHalfOpen(): boolean {
    if (this.lastFailureTime === null) return false;
    return Date.now() - this.lastFailureTime >= this.resetTimeout;
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.CLOSED);
      return;
    }

    // In CLOSED state, reset failure counter on success
    this.successCount += 1;
    this.failureCount = 0;
  }

  private onFailure(error: unknown): void {
    this.failureCount += 1;
    this.lastFailureTime = Date.now();

    const errorMessage = error instanceof Error ? error.message : String(error);

    if (this.state === CircuitState.HALF_OPEN) {
      logger.warn("circuit_breaker.half_open_failure", {
        service: this.serviceName,
        error: errorMessage,
      });
      this.transitionTo(CircuitState.OPEN);
      return;
    }

    // CLOSED state
    if (this.failureCount >= this.failureThreshold) {
      logger.error("circuit_breaker.threshold_reached", {
        service: this.serviceName,
        failureCount: this.failureCount,
        threshold: this.failureThreshold,
        error: errorMessage,
      });
      this.transitionTo(CircuitState.OPEN);
    } else {
      logger.warn("circuit_breaker.failure", {
        service: this.serviceName,
        failureCount: this.failureCount,
        threshold: this.failureThreshold,
        error: errorMessage,
      });
    }
  }

  private transitionTo(newState: CircuitState): void {
    const previousState = this.state;
    this.state = newState;

    if (newState === CircuitState.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
      this.halfOpenAttempts = 0;
    }

    if (newState === CircuitState.HALF_OPEN) {
      this.halfOpenAttempts = 0;
    }

    logger.info("circuit_breaker.state_change", {
      service: this.serviceName,
      from: previousState,
      to: newState,
    });
  }
}

// ---------------------------------------------------------------------------
// Factory helper
// ---------------------------------------------------------------------------

/**
 * Wrap an async function with a circuit breaker.
 *
 * @example
 * ```ts
 * const safeFetch = withCircuitBreaker(fetchFromApi, { name: "my-api" });
 * const result = await safeFetch("https://api.example.com/data");
 * ```
 */
export const withCircuitBreaker = <TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  config: CircuitBreakerConfig,
): CircuitBreaker<TArgs, TResult> => {
  return new CircuitBreaker(fn, config);
};

// ---------------------------------------------------------------------------
// Pre-configured breakers for common services
// ---------------------------------------------------------------------------

/**
 * Create a circuit breaker tuned for the Gemini AI API.
 * Lower threshold — AI calls are non-critical and can degrade gracefully.
 */
export const geminiBreaker = <TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
): CircuitBreaker<TArgs, TResult> =>
  withCircuitBreaker(fn, {
    name: "gemini",
    failureThreshold: 3,
    resetTimeout: 60_000,
  });

/**
 * Create a circuit breaker tuned for Telnyx Voice / SMS.
 * Moderate threshold — telephony failures should trigger fast fallback.
 */
export const telnyxBreaker = <TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
): CircuitBreaker<TArgs, TResult> =>
  withCircuitBreaker(fn, {
    name: "telnyx",
    failureThreshold: 5,
    resetTimeout: 30_000,
  });

/**
 * Create a circuit breaker tuned for Stripe payment calls.
 * Higher threshold — payment retries are common and expected.
 */
export const stripeBreaker = <TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
): CircuitBreaker<TArgs, TResult> =>
  withCircuitBreaker(fn, {
    name: "stripe",
    failureThreshold: 5,
    resetTimeout: 45_000,
  });

/**
 * Create a circuit breaker tuned for WhatsApp Business API.
 */
export const whatsappBreaker = <TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
): CircuitBreaker<TArgs, TResult> =>
  withCircuitBreaker(fn, {
    name: "whatsapp",
    failureThreshold: 5,
    resetTimeout: 30_000,
  });

/**
 * Create a circuit breaker tuned for Messenger API.
 */
export const messengerBreaker = <TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
): CircuitBreaker<TArgs, TResult> =>
  withCircuitBreaker(fn, {
    name: "messenger",
    failureThreshold: 5,
    resetTimeout: 30_000,
  });

/**
 * Create a circuit breaker tuned for Telegram Bot API.
 */
export const telegramBreaker = <TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
): CircuitBreaker<TArgs, TResult> =>
  withCircuitBreaker(fn, {
    name: "telegram",
    failureThreshold: 5,
    resetTimeout: 30_000,
  });
