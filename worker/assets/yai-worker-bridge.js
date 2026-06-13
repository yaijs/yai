/**
 * Byte-identical to the string in `src/internal/worker-bridge-src.js::WORKER_BRIDGE_SOURCE`,
 * but as a raw Classic Script for CSP fallbacks.
 */
(function () {
    'use strict';

    var _taskFn = typeof _task !== 'undefined' ? _task : null;

    self.onmessage = async function (e) {
        var msg = e.data;

        if (msg.type === 'init') {
            if (msg.importScripts && msg.importScripts.length) {
                importScripts.apply(self, msg.importScripts);
                // Pick up _task if a trusted imported script exposed it as a global.
                if (typeof _task === 'function') {
                    _taskFn = _task;
                }
            }
            // Dynamic compilation via new Function intentionally removed.
            // Use the workerUrl option to supply pre-compiled worker logic
            // in CSP-restricted environments instead.
            return;
        }

        if (msg.type === 'run') {
            if (typeof _taskFn !== 'function') {
                self.postMessage({
                    taskId: msg.taskId,
                    status: 'error',
                    payload: '[YaiWorker] Task function is not defined or failed to initialize.'
                });
                return;
            }
            try {
                var result = await _taskFn(msg.inputData, msg.taskId, msg.sharedBuffer ?? null);
                self.postMessage({
                    taskId: msg.taskId,
                    status: 'success',
                    payload: result
                });
            } catch (err) {
                self.postMessage({
                    taskId: msg.taskId,
                    status: 'error',
                    payload: err.message || String(err)
                });
            }
        }
    };
}());
