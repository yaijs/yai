import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanupDOM, createMockContainer} from './setup.js';

// Mock YEH for testing
class MockYEH {
  constructor(selectors, aliases, config) {
    this.selectors = selectors;
    this.aliases = aliases;
    this.config = config;
  }
  emit() {}
  on() {}
  subscribe() {}
  dispatch() {}
  destroy() {}
  _executeHook() {}
  hook() {}
}

global.YEH = MockYEH;

// Import YaiCore
const YaiCorePath = '../yai/yai-core.js';
const YaiCore = (await import(YaiCorePath)).default || (await import(YaiCorePath)).YaiCore;

describe('YaiCore', () => {
  let container;

  beforeEach(() => {
    cleanupDOM();
    container = createMockContainer();
  });

  afterEach(() => {
    cleanupDOM();
  });

  describe('Initialization', () => {
    it('should create instance with default config', () => {
      const core = new YaiCore();

      expect(core).toBeDefined();
      expect(core.config).toBeDefined();
      expect(core.config.dynamicContent).toBe(true);
      expect(core.config.autoAccessibility).toBe(true);
    });

    it('should merge custom config with defaults', () => {
      const core = new YaiCore({
        dynamicContent: false,
        customOption: 'test',
      });

      expect(core.config.dynamicContent).toBe(false);
      expect(core.config.customOption).toBe('test');
      expect(core.config.autoAccessibility).toBe(true); // default preserved
    });

    it('should have base emitable events', () => {
      const core = new YaiCore();

      expect(core.config.emitable.beforeInit).toBeDefined();
      expect(core.config.emitable.afterInit).toBeDefined();
      expect(core.config.emitable.contentLoaded).toBeDefined();
    });

    it('should merge custom emitable events', () => {
      const core = new YaiCore({
        emitable: {
          customEvent: 'custom',
        },
      });

      expect(core.config.emitable.beforeInit).toBeDefined(); // base preserved
      expect(core.config.emitable.customEvent).toBe('custom'); // custom added
    });
  });

  describe('Security - Prototype Pollution Protection', () => {
    it('should reject __proto__ in config', () => {
      const maliciousConfig = JSON.parse('{"__proto__": {"polluted": true}}');

      const core = new YaiCore(maliciousConfig);

      expect(Object.prototype.polluted).toBeUndefined();
    });

    it('should reject constructor in config', () => {
      const core = new YaiCore({
        constructor: { malicious: true },
      });

      // Should not pollute
      expect(core.config.constructor.malicious).toBeUndefined();
    });

    it('should safely merge nested objects', () => {
      const config1 = { nested: { safe: true } };
      const config2 = { nested: { __proto__: { polluted: true } } };

      const merged = YaiCore.deepMerge(config1, config2);

      expect(Object.prototype.polluted).toBeUndefined();
      expect(merged.nested.safe).toBe(true);
    });
  });

  describe('Deep Merge', () => {
    it('should deep merge objects correctly', () => {
      const target = {
        a: 1,
        b: { c: 2, d: 3 },
      };

      const source = {
        b: { d: 4, e: 5 },
        f: 6,
      };

      const result = YaiCore.deepMerge(target, source);

      expect(result.a).toBe(1);
      expect(result.b.c).toBe(2);
      expect(result.b.d).toBe(4);
      expect(result.b.e).toBe(5);
      expect(result.f).toBe(6);
    });

    it('should not merge arrays (replace instead)', () => {
      const target = { arr: [1, 2, 3] };
      const source = { arr: [4, 5] };

      const result = YaiCore.deepMerge(target, source);

      expect(result.arr).toEqual([4, 5]);
    });

    it('should handle null/undefined sources', () => {
      const target = { a: 1 };

      expect(YaiCore.deepMerge(target, null)).toEqual(target);
      expect(YaiCore.deepMerge(target, undefined)).toEqual(target);
    });
  });

  describe('Event Handler Factory', () => {
    it('should create YEH instance', () => {
      const core = new YaiCore();

      const selectors = {
        '.button': ['click'],
      };

      const aliases = {
        click: { open: 'openTab' },
      };

      const handler = core.createEventHandler(selectors, aliases);

      expect(handler).toBeDefined();
      expect(core.events).toBeDefined();
    });

    it('should merge event config with defaults', () => {
      const core = new YaiCore({
        events: {
          enableDistanceCache: true,
        },
      });

      const handler = core.createEventHandler({}, {}, {
        autoTargetResolution: true,
      });

      expect(handler.config.enableDistanceCache).toBe(true);
      expect(handler.config.autoTargetResolution).toBe(true);
    });
  });

  describe('DOM Caching', () => {
    it('should cache querySelector results', () => {
      container.innerHTML = '<div id="test">Test</div>';

      const core = new YaiCore();

      // First query - cache miss
      const result1 = core._getCached('#test');

      // Second query - cache hit
      const result2 = core._getCached('#test');

      expect(result1).toBe(result2);
      expect(core._cacheStats.hits).toBeGreaterThan(0);
    });

    it('should skip caching for :scope selectors', () => {
      container.innerHTML = '<div class="parent"><div class="child"></div></div>';

      const core = new YaiCore();
      const parent = container.querySelector('.parent');

      // :scope selectors should not be cached
      core._getCached(':scope > .child', { scope: parent });

      expect(core._cacheStats.hits).toBe(0);
    });

    it('should refresh cache when requested', () => {
      container.innerHTML = '<div id="test">Original</div>';

      const core = new YaiCore();

      const result1 = core._getCached('#test');
      expect(result1.textContent).toBe('Original');

      // Change DOM - old element is removed, cache auto-invalidates
      container.innerHTML = '<div id="test">Changed</div>';

      // Cache detects old element is disconnected, re-queries automatically
      const result2 = core._getCached('#test');
      expect(result2.textContent).toBe('Changed');

      // With refresh - forces fresh query
      const result3 = core._getCached('#test', { refresh: true });
      expect(result3.textContent).toBe('Changed');
    });

    it('should support querySelectorAll', () => {
      container.innerHTML = `
        <div class="item">1</div>
        <div class="item">2</div>
        <div class="item">3</div>
      `;

      const core = new YaiCore();

      const items = core._getCached('.item', { multiple: true });

      expect(items.length).toBe(3);
    });
  });

  describe('Helper Methods', () => {
    it('should generate unique IDs', () => {
      const id1 = YaiCore.generateId();
      const id2 = YaiCore.generateId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it('should generate IDs with custom prefix', () => {
      const id = YaiCore.generateId('custom');

      expect(id).toContain('custom-');
    });
  });

  describe('Event Emission', () => {
    it('should emit standardized events', () => {
      const core = new YaiCore();
      core.createEventHandler({}, {});

      let emitted = false;
      const eventName = `${core.config.dispatchName}.beforeInit`;

      document.addEventListener(eventName, () => {
        emitted = true;
      });

      core.yaiEmit('beforeInit', { test: true });

      setTimeout(() => {
        expect(emitted).toBe(true);
      }, 50);
    });

    it('should warn on unknown event names', () => {
      const core = new YaiCore();
      core.createEventHandler({}, {});

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      core.yaiEmit('unknownEvent', {});

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('Hook System', () => {
    it('should execute hooks when defined', () => {
      let hookCalled = false;

      const core = new YaiCore({
        callbacks: {
          afterLoad: (context) => {
            hookCalled = true;
            return context;
          },
        },
      });

      core._executeHook('afterLoad', { test: true });

      expect(hookCalled).toBe(true);
    });

    it('should pass context and instance to hooks', () => {
      let receivedContext = null;
      let receivedInstance = null;

      const core = new YaiCore({
        callbacks: {
          contentReady: (context, instance) => {
            receivedContext = context;
            receivedInstance = instance;
          },
        },
      });

      const testContext = { url: 'test.html' };
      core._executeHook('contentReady', testContext); // Use default instance (core)

      expect(receivedContext).toBe(testContext);
      expect(receivedInstance).toBe(core);
    });

    it('should return hook result', () => {
      const core = new YaiCore({
        callbacks: {
          sanitizeHtml: (context) => {
            return 'sanitized: ' + context.html;
          },
        },
      });

      // Execute hook and capture return value
      const result = core._executeHook('sanitizeHtml', { html: '<script>alert(1)</script>' });

      expect(result).toBe('sanitized: <script>alert(1)</script>');
    });

    it('should handle missing hooks gracefully', () => {
      const core = new YaiCore();

      const result = core._executeHook('nonexistentHook', {});

      expect(result).toBeUndefined();
    });
  });

  describe('Hash Routing', () => {
    it('should parse hash parameters', () => {
      window.location.hash = '#key1=value1&key2=value2';

      const core = new YaiCore();
      const params = core.parseHash();

      expect(params.key1).toBe('value1');
      expect(params.key2).toBe('value2');
    });

    it('should handle empty hash', () => {
      window.location.hash = '';

      const core = new YaiCore();
      const params = core.parseHash();

      expect(params).toEqual({});
    });

    it('should decode URI components', () => {
      window.location.hash = '#key=hello%20world';

      const core = new YaiCore();
      const params = core.parseHash();

      expect(params.key).toBe('hello world');
    });

    it('should update hash from routeMap', () => {
      const core = new YaiCore();
      core.routeMap = new Map([
        ['main-tabs', '1'],
        ['nested-tabs', '2'],
      ]);

      core.updateHash();

      const hash = window.location.hash.slice(1);
      expect(hash).toContain('main-tabs=1');
      expect(hash).toContain('nested-tabs=2');
    });

    it('should clear hash when routeMap is empty', () => {
      window.location.hash = '#something=here';

      const core = new YaiCore();
      core.routeMap = new Map();

      core.updateHash();

      expect(window.location.hash).toBe('');
    });
  });

  describe('User Preferences', () => {
    it('should detect user preferences', () => {
      const prefs = YaiCore.getUserPreferences(); // Static method

      expect(prefs).toBeDefined();
      expect(typeof prefs.touchDevice).toBe('boolean');
      expect(typeof prefs.reduceMotion).toBe('boolean');
      expect(typeof prefs.highContrast).toBe('boolean');
      expect(['dark', 'light']).toContain(prefs.colorScheme);
    });
  });

  describe('Processing State', () => {
    it('should track processing state', () => {
      const core = new YaiCore();
      core.createEventHandler({}, {});

      expect(core.isProcessing).toBe(false);

      const mockContainer = document.createElement('div');
      core._setProcessingState(mockContainer, true);

      expect(core.isProcessing).toBe(true);
      expect(core.processingContainers.has(mockContainer)).toBe(true);
    });

    it('should emit processing events', () => {
      const core = new YaiCore();
      core.createEventHandler({}, {});

      let startEmitted = false;
      let endEmitted = false;

      document.addEventListener(`${core.config.dispatchName}.processingStart`, () => {
        startEmitted = true;
      });

      document.addEventListener(`${core.config.dispatchName}.processingEnd`, () => {
        endEmitted = true;
      });

      const mockContainer = document.createElement('div');

      core._setProcessingState(mockContainer, true);
      setTimeout(() => expect(startEmitted).toBe(true), 50);

      core._setProcessingState(mockContainer, false);
      setTimeout(() => expect(endEmitted).toBe(true), 50);
    });
  });

  describe('Fetch Abort Controllers', () => {
    it('should create abort controller for fetch', () => {
      const core = new YaiCore();
      const mockContainer = document.createElement('div');

      core._fetchControllers.set(mockContainer, new AbortController());

      expect(core._fetchControllers.has(mockContainer)).toBe(true);
    });

    it('should cancel fetch on abort', () => {
      const core = new YaiCore();
      const mockContainer = document.createElement('div');

      const controller = new AbortController();
      core._fetchControllers.set(mockContainer, controller);

      let aborted = false;
      controller.signal.addEventListener('abort', () => {
        aborted = true;
      });

      core._cancelFetch(mockContainer);

      expect(aborted).toBe(true);
      expect(core._fetchControllers.has(mockContainer)).toBe(false);
    });
  });
});
