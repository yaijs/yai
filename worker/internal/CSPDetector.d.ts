/**
 * 🔒 **CSPDetector - Content Security Policy Detection**
 *
 * Sniffs the current execution context to determine whether `blob:` worker URLs
 * are blocked, so `YaiWorker` can transparently fall back to a pre-built static
 * asset worker instead of dynamic Blob injection.
 *
 * Two conditions trigger the fallback:
 * 1. **Chrome Extension context** — Manifest V3 always restricts `blob:` URLs in workers.
 * 2. **Strict CSP meta tag** — a `<meta http-equiv="Content-Security-Policy">` is present,
 *    its `script-src` directive is defined, and it does **not** include `blob:`.
 *
 * @module CSPDetector
 * @internal
 */

/**
 * Detect whether the current environment blocks `blob:` worker URLs.
 *
 * @returns `true` when YaiWorker must use the static-asset CSP fallback path;
 *          `false` when inline Blob workers are allowed.
 *
 * @example
 * ```typescript
 * import { isCSPRestricted } from './CSPDetector.js';
 *
 * if (isCSPRestricted()) {
 *   // Spawn worker from /assets/yai-worker-bridge.js
 * } else {
 *   // Spawn worker from an inline Blob URL
 * }
 * ```
 */
export function isCSPRestricted(): boolean;
