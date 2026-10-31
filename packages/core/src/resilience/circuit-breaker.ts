import CircuitBreaker from 'opossum';

export interface CircuitBreakerOptions {
  name?: string;
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  volumeThreshold?: number;
}

export const DEFAULT_BREAKER_OPTIONS: CircuitBreakerOptions = {
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 10000,
  volumeThreshold: 3
};

export class CircuitBreakerOpenError extends Error {
  public serviceName: string;

  constructor(serviceName: string) {
    super(`Circuit breaker for '${serviceName}' is OPEN. Fast-failing outbound request.`);
    this.name = 'CircuitBreakerOpenError';
    this.serviceName = serviceName;
  }
}

export function createCircuitBreaker<TI extends unknown[], TR>(
  action: (...args: TI) => Promise<TR>,
  options: CircuitBreakerOptions = {}
): CircuitBreaker<TI, TR> {
  const mergedOptions: CircuitBreaker.Options = {
    name: options.name ?? 'default-breaker',
    timeout: options.timeout ?? DEFAULT_BREAKER_OPTIONS.timeout,
    errorThresholdPercentage:
      options.errorThresholdPercentage ?? DEFAULT_BREAKER_OPTIONS.errorThresholdPercentage,
    resetTimeout: options.resetTimeout ?? DEFAULT_BREAKER_OPTIONS.resetTimeout,
    volumeThreshold: options.volumeThreshold ?? DEFAULT_BREAKER_OPTIONS.volumeThreshold
  };

  return new CircuitBreaker(action, mergedOptions);
}

export function createNpmBreaker<TI extends unknown[], TR>(
  action: (...args: TI) => Promise<TR>,
  overrides?: CircuitBreakerOptions
): CircuitBreaker<TI, TR> {
  return createCircuitBreaker(action, {
    name: 'npm-registry',
    timeout: 8000,
    errorThresholdPercentage: 50,
    resetTimeout: 10000,
    volumeThreshold: 3,
    ...overrides
  });
}

export function createGitBreaker<TI extends unknown[], TR>(
  action: (...args: TI) => Promise<TR>,
  overrides?: CircuitBreakerOptions
): CircuitBreaker<TI, TR> {
  return createCircuitBreaker(action, {
    name: 'github-api',
    timeout: 10000,
    errorThresholdPercentage: 50,
    resetTimeout: 10000,
    volumeThreshold: 3,
    ...overrides
  });
}

export function createOllamaBreaker<TI extends unknown[], TR>(
  action: (...args: TI) => Promise<TR>,
  overrides?: CircuitBreakerOptions
): CircuitBreaker<TI, TR> {
  return createCircuitBreaker(action, {
    name: 'ollama-inference',
    timeout: 3000,
    errorThresholdPercentage: 50,
    resetTimeout: 10000,
    volumeThreshold: 2,
    ...overrides
  });
}
