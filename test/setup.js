/**
 * Global test setup file
 * Runs before all tests
 */

// Mock console methods to reduce noise (optional)
global.consoleMock = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

// Helper to suppress console output during tests
export function suppressConsole() {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
}

// Helper to restore console output
export function restoreConsole() {
  console.log = global.consoleMock.log;
  console.warn = global.consoleMock.warn;
  console.error = global.consoleMock.error;
}

// DOM helper utilities for tests
export function createMockContainer(html = '') {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

export function cleanupDOM() {
  document.body.innerHTML = '';
}

// Mock window.matchMedia for user preferences
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
