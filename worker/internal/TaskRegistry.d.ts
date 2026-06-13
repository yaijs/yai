/**
 * 🗂️ **TaskRegistry - Memory-Safe DOM Element Tracking**
 *
 * Maps active task IDs to `WeakRef<HTMLElement>` instances so that `YaiWorker`
 * can dispatch result `CustomEvent`s back to the originating element without
 * preventing garbage collection when that element is later removed from the DOM.
 *
 * The registry is a plain module-level singleton (not a class) intentionally:
 * all `YaiWorker` instances share the same flat lookup table, making cross-instance
 * coordination O(1) by task ID.
 *
 * @module TaskRegistry
 * @internal
 */

/**
 * 🗂️ **TaskRegistry Singleton Interface**
 *
 * Provides `register`, `lookup`, and `unregister` operations keyed on task IDs.
 */
export interface ITaskRegistry {
  /**
   * Associate a task ID with a `WeakRef` to its originating element.
   * Called by `YaiWorker.start()` before the `run` message is posted.
   *
   * @param taskId - Unique task identifier (format: `YAI-<timestamp>-<counter>`).
   * @param weakRef - Weak reference to the `targetElement`.
   */
  register(taskId: string, weakRef: WeakRef<HTMLElement>): void;

  /**
   * Retrieve the `WeakRef` associated with a task ID.
   * Returns `null` when the task ID is not registered.
   *
   * @param taskId - Unique task identifier.
   * @returns The `WeakRef<HTMLElement>`, or `null` if not found.
   */
  lookup(taskId: string): WeakRef<HTMLElement> | null;

  /**
   * Remove a task ID and its `WeakRef` from the registry.
   * Called automatically by `YaiWorker` after task completion or `terminate()`.
   *
   * @param taskId - Unique task identifier to remove.
   */
  unregister(taskId: string): void;
}

/**
 * Singleton registry shared across all `YaiWorker` instances.
 *
 * @example
 * ```typescript
 * import { TaskRegistry } from './TaskRegistry.js';
 *
 * TaskRegistry.register('YAI-1234-1', new WeakRef(element));
 * const ref = TaskRegistry.lookup('YAI-1234-1');
 * const el = ref?.deref(); // null if element was GC'd
 * TaskRegistry.unregister('YAI-1234-1');
 * ```
 */
export declare const TaskRegistry: ITaskRegistry;
