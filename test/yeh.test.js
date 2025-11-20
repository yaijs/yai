import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {cleanupDOM, createMockContainer} from './setup.js';

// Import YEH class - adjust path as needed
const YEHPath = '../yeh/yeh.js';
const YEH = (await import(YEHPath)).default || (await import(YEHPath)).YEH;

describe('YEH (Yai Event Hub)', () => {
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
      const yeh = new YEH();
      expect(yeh).toBeDefined();
      expect(yeh.config).toBeDefined();
      expect(yeh.eventMapping).toBeDefined();
    });

    it('should merge custom config with defaults', () => {
      const yeh = new YEH({}, {}, {
        enableStats: true,
        enableDistanceCache: false,
      });

      expect(yeh.config.enableStats).toBe(true);
      expect(yeh.config.enableDistanceCache).toBe(false);
    });

    it('should detect passive event support', () => {
      const yeh = new YEH();
      expect(typeof yeh.passiveSupported).toBe('boolean');
    });
  });

  describe('Event Registration', () => {
    it('should register events from eventMapping', () => {
      const eventMapping = {
        '.test-button': ['click'],
      };

      container.innerHTML = '<button class="test-button">Test</button>';

      const yeh = new YEH(eventMapping);

      expect(yeh.eventListeners.size).toBeGreaterThan(0);
    });

    it('should handle multiple event types', () => {
      const eventMapping = {
        '.test-input': ['input', 'change', 'blur'],
      };

      container.innerHTML = '<input class="test-input" />';

      const yeh = new YEH(eventMapping);

      // Should register all three event types
      expect(yeh.eventHandlerMap.has('input')).toBe(true);
      expect(yeh.eventHandlerMap.has('change')).toBe(true);
      expect(yeh.eventHandlerMap.has('blur')).toBe(true);
    });

    it('should support throttle configuration', () => {
      const eventMapping = {
        window: [{ type: 'scroll', throttle: 100 }],
      };

      const yeh = new YEH(eventMapping);

      expect(yeh.eventHandlerMap.has('scroll')).toBe(true);
    });

    it('should support debounce configuration', () => {
      const eventMapping = {
        '.search': [{ type: 'input', debounce: 300 }],
      };

      container.innerHTML = '<input class="search" />';

      const yeh = new YEH(eventMapping);

      expect(yeh.eventHandlerMap.has('input')).toBe(true);
    });
  });

  describe('Distance Calculation', () => {
    it('should calculate DOM distance correctly', () => {
      container.innerHTML = `
        <div id="parent">
          <div id="child">
            <button id="target">Click</button>
          </div>
        </div>
      `;

      const yeh = new YEH();
      const parent = document.getElementById('parent');
      const target = document.getElementById('target');

      const distance = yeh.calculateDOMDistance(target, parent);

      expect(distance).toBe(2); // target -> child -> parent
    });

    it('should return Infinity for unrelated elements', () => {
      container.innerHTML = `
        <div id="container1">
          <button id="button1">Click</button>
        </div>
        <div id="container2">
          <button id="button2">Click</button>
        </div>
      `;

      const yeh = new YEH();
      const button1 = document.getElementById('button1');
      const container2 = document.getElementById('container2');

      const distance = yeh.calculateDOMDistance(button1, container2);

      expect(distance).toBe(Infinity);
    });

    it('should cache distance calculations when enabled', () => {
      container.innerHTML = `
      <div id="parent">
          <button id="target">Click</button>
      </div>
      `;

      const yeh = new YEH({}, {}, { enableDistanceCache: true });
      const parent = document.getElementById('parent');
      const target = document.getElementById('target');

      // First call - should cache
      const distance1 = yeh.calculateDistanceWithCache(target, parent);

      // Second call - should use cache (test that it returns same value)
      const distance2 = yeh.calculateDistanceWithCache(target, parent);

      expect(distance1).toBe(distance2);
      expect(distance1).toBeGreaterThan(0); // Should have calculated a distance

      // Verify cache is being used by checking it has the target element
      expect(yeh.distanceCache.has(target)).toBe(true);

      // Verify nested cache structure (target -> container -> distance)
      const targetCache = yeh.distanceCache.get(target);
      expect(targetCache.has(parent)).toBe(true);
      expect(targetCache.get(parent)).toBe(distance1);
    });


  });

  describe('Event Handling', () => {
    it('should handle click events', () => {
      return new Promise((resolve) => {
        let clicked = false;

        const eventMapping = {
          '.test-button': ['click'],
        };

        const methods = {
          click: {
            handleClick: () => {
              clicked = true;
            },
          },
        };

        container.innerHTML = '<button class="test-button" data-action="open">Click</button>';

        const yeh = new YEH(eventMapping, {}, { methods });
        const button = container.querySelector('.test-button');

        // Trigger click
        button.click();

        // Check after a short delay to ensure event has propagated
        setTimeout(() => {
          expect(clicked).toBe(true);
          resolve();
        }, 50);
      });
    });
  });

  describe('Public API', () => {
    it('should support .on() method', async () => {
      const yeh = new YEH();
      let called = false;

      yeh.methods = {
        handleCustomEvent: () => {
          called = true;
        }
      };

      yeh.on('custom-event', 'handleCustomEvent');

      yeh.emit('custom-event', {});

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(called).toBe(true);
    });
  });

  describe('Auto Target Resolution', () => {
    it('should find actionable targets', () => {
      container.innerHTML = `
        <div class="wrapper">
          <button data-action="open">
            <span class="icon">Icon</span>
            Click Me
          </button>
        </div>
      `;

      const yeh = new YEH({}, {}, {
        autoTargetResolution: true,
        actionableAttributes: ['data-action'],
      });

      const icon = container.querySelector('.icon');
      const button = container.querySelector('button');
      const wrapper = container.querySelector('.wrapper');

      const actionableTarget = yeh.findActionableTarget(icon, wrapper);

      expect(actionableTarget).toBe(button);
    });

    it('should return null if no actionable target found', () => {
      container.innerHTML = `
        <div class="wrapper">
          <span class="text">No action here</span>
        </div>
      `;

      const yeh = new YEH({}, {}, {
        autoTargetResolution: true,
        actionableAttributes: ['data-action'],
      });

      const text = container.querySelector('.text');
      const wrapper = container.querySelector('.wrapper');

      const actionableTarget = yeh.findActionableTarget(text, wrapper);

      expect(actionableTarget).toBeNull();
    });
  });

  describe('Throttle & Debounce', () => {
    it('should throttle function calls', (done) => {
      const yeh = new YEH();
      let callCount = 0;

      const throttled = yeh.throttle(() => {
        callCount++;
      }, 100);

      // Call multiple times rapidly
      throttled();
      throttled();
      throttled();

      // Should only execute once immediately
      expect(callCount).toBe(1);

      // Wait for throttle period
      setTimeout(() => {
        throttled();
        expect(callCount).toBe(2);
        done();
      }, 150);
    });

    it('should debounce function calls', (done) => {
      const yeh = new YEH();
      let callCount = 0;

      const debounced = yeh.debounce(() => {
        callCount++;
      }, 100);

      // Call multiple times rapidly
      debounced();
      debounced();
      debounced();

      // Should not execute yet
      expect(callCount).toBe(0);

      // Wait for debounce period
      setTimeout(() => {
        expect(callCount).toBe(1); // Only called once after delay
        done();
      }, 150);
    });
  });

  describe('Cleanup', () => {
    it('should destroy and cleanup event listeners', () => {
      const eventMapping = {
        '.test-button': ['click'],
      };

      container.innerHTML = '<button class="test-button">Test</button>';

      const yeh = new YEH(eventMapping);

      expect(yeh.eventListeners.size).toBeGreaterThan(0);

      yeh.destroy();

      expect(yeh.eventListeners.size).toBe(0);
    });

    it('should abort all ongoing operations on destroy', () => {
      const yeh = new YEH({}, {}, { abortController: true });

      expect(yeh.abortController).toBeDefined();

      const originalAbort = yeh.abortController.abort;
      let abortCalled = false;

      yeh.abortController.abort = () => {
        abortCalled = true;
        originalAbort.call(yeh.abortController);
      };

      yeh.destroy();

      expect(abortCalled).toBe(true);
    });
  });
});
