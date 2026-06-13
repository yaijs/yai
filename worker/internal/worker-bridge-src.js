/**
 * Exports the classic worker logic as a string constant for zero-build Blob injection.
 */
export const WORKER_BRIDGE_SOURCE = `
(function () {
  'use strict';

  // In asset fallback mode, _task starts undefined and is built from 'init' message.
  // In blob mode, _task is injected by the template before this script runs.
  var _taskFn = typeof _task !== 'undefined' ? _task : null;

  self.onmessage = async function (e) {
    var msg = e.data;

    // ── INIT (CSP fallback path only) ──────────────────────────────────
    if (msg.type === 'init') {
      if (msg.importScripts && msg.importScripts.length) {
        importScripts.apply(self, msg.importScripts);
      }
      try {
        _taskFn = (new Function('return (' + msg.code + ')'))();
      } catch (err) {
        _taskFn = null;
      }
      return; // Wait for 'run'
    }

    // ── RUN ────────────────────────────────────────────────────────────
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
        // MICRO-ADJUSTMENT 2: Pass taskId as 2nd arg so user task can send progress updates
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
`;
