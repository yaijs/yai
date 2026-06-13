# YaiJS Testing Guide

Automated testing infrastructure using Vitest for comprehensive test coverage.

## Quick Start

```bash
# Run all tests
npm test

# Watch mode (re-run on file changes)
npm run test:watch

# Visual UI for tests
npm run test:ui

# Generate coverage report
npm run test:coverage

# Coverage with UI
npm run test:coverage:ui
```

## Test Structure

```
test/
├── setup.js              # Global test setup & utilities
├── yeh.test.js           # YEH (Yai Event Hub) tests
├── yai-core.test.js      # YaiCore foundation tests
├── yai-tabs.test.js      # YaiTabs component tests
└── yai-worker.test.js    # YaiWorker Web Worker manager tests
```

## Test Categories

### YEH Tests (`yeh.test.js`)
- ✅ Initialization & configuration
- ✅ Event registration & handling
- ✅ Distance-based delegation
- ✅ Distance caching
- ✅ Auto target resolution
- ✅ Throttle & debounce
- ✅ Cleanup & destruction
- ✅ Public API (on, emit, subscribe)

### YaiCore Tests (`yai-core.test.js`)
- ✅ Configuration merging
- ✅ Security (prototype pollution protection)
- ✅ Deep merge algorithm
- ✅ Event handler factory
- ✅ DOM caching system
- ✅ Event emission system
- ✅ Hook system
- ✅ Hash routing
- ✅ User preferences
- ✅ Processing state
- ✅ Fetch abort controllers

### YaiTabs Tests (`yai-tabs.test.js`)
- ✅ Auto-disambiguation (depth-based IDs)
- ✅ Hash routing with original IDs
- ✅ ARIA accessibility
- ✅ Lazy component registration
- ✅ Sibling branch cleanup

### YaiWorker Tests (`yai-worker.test.js`)
- ✅ SerializationGuard — forbidden globals detection, `this` binding, string tasks
- ✅ TaskRegistry — register/resolve/remove by taskId, WeakRef memory safety
- ✅ CSPDetector — Chrome Extension detection, CSP meta tag detection
- ✅ WORKER_BRIDGE_SOURCE — exported string, bridge calls task with 3 args (inputData, taskId, sharedBuffer)
- ✅ Constructor — option validation, task serialization, `workerUrl` bypass
- ✅ `start()` — success/error resolution, already-running guard, terminated guard
- ✅ `terminate()` — cleans up blob URL, rejects pending promise with `AbortError`
- ✅ `static run()` — one-shot static wrapper, auto-terminates
- ✅ Progress — `onProgress` callback fires, promise still resolves with final result
- ✅ `targetElement` — dispatches `worker:success` / `worker:error` CustomEvents
- ✅ `AbortSignal` — `terminate()` called when signal fires
- ✅ Mode — `'transient'` auto-terminates, `'persistent'` keeps worker alive

#### MockWorker

`yai-worker.test.js` installs a `MockWorker` class as `global.Worker` before any tests run. The real `Worker` API is unavailable in happy-dom, so `MockWorker` simulates the full message-passing contract synchronously via microtasks.

Key methods:

| Method | Purpose |
|--------|---------|
| `mock.autoSucceed(payload)` | Wire handler: next `postMessage` call auto-responds success |
| `mock.autoFail(message)` | Wire handler: next `postMessage` call auto-responds error |
| `mock.triggerSuccess(payload)` | Directly fire success response (use after `start()` already sent the run message) |
| `mock.triggerError(payload)` | Directly fire error response (same pattern) |
| `mock.triggerThreadError(message)` | Fire an `onerror` event (simulates uncaught worker exception) |
| `mock.sendProgress(payload)` | Immediately call `onmessage` with a progress envelope |
| `MockWorker.last()` | Return the most recently constructed mock instance |
| `MockWorker.succeedNext(payload)` | Static: wire success for the next constructed worker |
| `MockWorker.failNext(message)` | Static: wire failure for the next constructed worker |
| `MockWorker.reset()` | Clear all instances and pending handlers between tests |

## Test Utilities

### Setup Helpers
```javascript
import { createMockContainer, cleanupDOM } from './setup.js';

// Create container with HTML
const container = createMockContainer('<div>Test</div>');

// Clean up after test
cleanupDOM();
```

### Console Suppression
```javascript
import { suppressConsole, restoreConsole } from './setup.js';

// Suppress console output
suppressConsole();

// Restore console
restoreConsole();
```

## Coverage Thresholds

Configured in `vitest.config.js`:
- Lines: 70%
- Functions: 70%
- Branches: 70%
- Statements: 70%

## Writing New Tests

### Basic Test Structure
```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanupDOM, createMockContainer } from './setup.js';

describe('Feature Name', () => {
  let container;

  beforeEach(() => {
    cleanupDOM();
    container = createMockContainer();
  });

  afterEach(() => {
    cleanupDOM();
  });

  it('should do something', () => {
    container.innerHTML = '<div>Test</div>';
    const div = container.querySelector('div');

    expect(div.textContent).toBe('Test');
  });
});
```

### Testing Async Code
```javascript
it('should handle async operations', async () => {
  const result = await someAsyncFunction();
  expect(result).toBe('expected');
});
```

### Testing Events
```javascript
it('should emit events', (done) => {
  document.addEventListener('custom-event', (e) => {
    expect(e.detail.data).toBe('test');
    done();
  });

  // Trigger event
  const event = new CustomEvent('custom-event', { detail: { data: 'test' } });
  document.dispatchEvent(event);
});
```

### Testing with Mocks
```javascript
import { vi } from 'vitest';

it('should call callback', () => {
  const callback = vi.fn();

  someFunction(callback);

  expect(callback).toHaveBeenCalled();
  expect(callback).toHaveBeenCalledWith('expected-arg');
});
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npm test
      - run: npm run test:coverage
```

## Coverage Reports

After running `npm run test:coverage`, coverage reports are generated in:
- `coverage/` - HTML reports (open `coverage/index.html` in browser)
- Console output - Text summary

## Troubleshooting

### Tests not finding modules
- Ensure `"type": "module"` is set in `package.json`
- Check import paths are correct
- Verify Vitest config is properly set up

### DOM not available
- Check `environment: 'happy-dom'` is set in vitest.config.js
- Use `cleanupDOM()` in afterEach hooks

### Async tests timing out
- Increase `testTimeout` in vitest.config.js
- Use `done()` callback or `async/await` properly

## Best Practices

1. **Clean up after each test** - Use `cleanupDOM()` in `afterEach`
2. **Test one thing** - Each test should verify one behavior
3. **Use descriptive names** - Test names should explain what they verify
4. **Mock external dependencies** - Don't rely on real network/file system
5. **Test edge cases** - Empty arrays, null values, etc.
6. **Maintain coverage** - Aim for >70% coverage on new code

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Mocking with Vitest](https://vitest.dev/guide/mocking.html)

---

**License:** MIT
