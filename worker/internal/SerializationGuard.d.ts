/**
 * 🛡️ **SerializationGuard - Pre-flight Task Validation**
 *
 * Validates task functions **before** a worker thread is spawned, converting
 * cryptic in-worker `ReferenceError`s into clear, actionable errors thrown
 * on the calling thread.
 *
 * **Checks performed:**
 * - **Forbidden globals** — rejects tasks that reference `window`, `document`,
 *   `localStorage`, `sessionStorage`, `parent`, `top`, `opener`, or `location`.
 *   Workers have no DOM access; these must be passed as `inputData` instead.
 * - **`this` binding** — rejects non-arrow functions that use `this`, since
 *   serialization loses the original binding. Suppress with `{ allowThis: true }`
 *   when binding is genuinely not required at runtime.
 *
 * @module SerializationGuard
 * @internal
 */

/**
 * ⚙️ **Validation Options**
 */
export interface ValidateTaskOptions {
  /**
   * When `true`, suppresses the error for non-arrow functions that reference `this`.
   * Only set this when the function's behavior does not depend on `this` at runtime.
   * @default false
   */
  allowThis?: boolean;
}

/**
 * Validate a task function or serialized source string before spawning a worker.
 *
 * @param fn - The task to validate — either a `Function` or its `.toString()` source.
 * @param options - Optional validation flags.
 * @returns `true` when all checks pass.
 * @throws {Error} When `fn` references a forbidden main-thread global.
 * @throws {Error} When `fn` is a non-arrow function that uses `this` and `allowThis` is falsy.
 *
 * @example
 * ```typescript
 * import { validateTask } from './SerializationGuard.js';
 *
 * // ✅ Passes — arrow function, no DOM globals
 * validateTask((data: number[]) => data.reduce((a, b) => a + b, 0));
 *
 * // ❌ Throws: references forbidden global "document"
 * validateTask((data) => document.getElementById(data));
 *
 * // ❌ Throws: non-arrow function uses `this`
 * validateTask(function (data) { return this.multiplier * data; });
 *
 * // ✅ Passes with allowThis
 * validateTask(function (data) { return this.multiplier * data; }, { allowThis: true });
 * ```
 */
export function validateTask(fn: Function | string, options?: ValidateTaskOptions): true;
