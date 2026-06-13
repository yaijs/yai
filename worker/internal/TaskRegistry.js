/**
 * Memory-safe tracking of initiating DOM elements.
 */
const _map = new Map(); // taskId (string) → WeakRef<HTMLElement>

export const TaskRegistry = {
    register(taskId, weakRef) {
        _map.set(taskId, weakRef);
    },
    lookup(taskId) {
        return _map.get(taskId) ?? null;
    },
    unregister(taskId) {
        _map.delete(taskId);
    }
};
