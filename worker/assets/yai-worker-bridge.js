(function () {
  'use strict';

  var _taskFn = typeof _task !== 'undefined' ? _task : null;
  var _nativePostMessage = self.postMessage.bind(self);
  var _activeTaskId = null;
  var _activeRunId = null;

  // User tasks keep their existing (inputData, taskId, sharedBuffer) signature.
  // Add runId only to their YaiWorker progress envelopes while an operation is active.
  self.postMessage = function (message, transferables) {
    if (message && message.taskId === _activeTaskId && message.runId === undefined) {
      message = Object.assign({}, message, {runId: _activeRunId});
    }
    _nativePostMessage(message, transferables);
  };

  self.onmessage = async function (e) {
    var msg = e.data;

    // ── RUN ────────────────────────────────────────────────────────────
    if (msg.type === 'run') {
      _activeTaskId = msg.taskId;
      _activeRunId = msg.runId;
      if (typeof _taskFn !== 'function') {
        self.postMessage({
          taskId: msg.taskId,
          runId: msg.runId,
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
          runId: msg.runId,
          status: 'success',
          payload: result
        });
      } catch (err) {
        self.postMessage({
          taskId: msg.taskId,
          runId: msg.runId,
          status: 'error',
          payload: err.message || String(err)
        });
      }
    }
  };
}());
