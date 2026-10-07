import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
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

      const yeh = new YEH(eventMapping, {}, {methods: {handleClick: () => {}}});

      expect(yeh.eventListeners.size).toBeGreaterThan(0);
    });

    it('should handle multiple event types', () => {
      const eventMapping = {
        '.test-input': ['input', 'change', 'blur'],
      };

      container.innerHTML = '<input class="test-input" />';

      const yeh = new YEH(eventMapping, {}, {
        methods: {handleInput: () => {}, handleChange: () => {}, handleBlur: () => {}}
      });

      // Should register all three event types
      expect(yeh.eventHandlerMap.has('input')).toBe(true);
      expect(yeh.eventHandlerMap.has('change')).toBe(true);
      expect(yeh.eventHandlerMap.has('blur')).toBe(true);
    });

    it('should support throttle configuration', () => {
      const eventMapping = {
        window: [{ type: 'scroll', throttle: 100 }],
      };

      const yeh = new YEH(eventMapping, {}, {methods: {handleScroll: () => {}}});

      expect(yeh.eventHandlerMap.has('scroll')).toBe(true);
    });

    it('should support debounce configuration', () => {
      const eventMapping = {
        '.search': [{ type: 'input', debounce: 300 }],
      };

      container.innerHTML = '<input class="search" />';

      const yeh = new YEH(eventMapping, {}, {methods: {handleInput: () => {}}});

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

        new YEH(eventMapping, {}, { methods });
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
    it('should support .on() method with string handler', async () => {
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

    it('should support .on() method with function closure', async () => {
      const yeh = new YEH();
      let called = false;
      let eventData = null;

      // Register event listener with closure instead of string name
      yeh.on('custom-event', (event) => {
        called = true;
        eventData = event.detail;
      });

      yeh.emit('custom-event', { testData: 'hello' });

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(called).toBe(true);
      expect(eventData).toEqual({ testData: 'hello' });
    });

    it('should support .subscribe() as alias for .on()', async () => {
      const yeh = new YEH();
      let called = false;

      yeh.subscribe('test-event', () => {
        called = true;
      });

      yeh.emit('test-event');

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(called).toBe(true);
    });
  });

  describe('Hook System', () => {
    it('should register and execute hooks with closures', () => {
      const yeh = new YEH();
      let hookCalled = false;
      let receivedContext = null;

      yeh.hook('beforeHandleEvent', (context) => {
        hookCalled = true;
        receivedContext = context;
      });

      yeh._executeHook('beforeHandleEvent', { testValue: 123 });

      expect(hookCalled).toBe(true);
      expect(receivedContext.testValue).toBe(123);
    });

    it('should support multiple hooks for same event', () => {
      const yeh = new YEH();
      const callOrder = [];

      yeh.hook('test-hook', () => callOrder.push(1));
      yeh.hook('test-hook', () => callOrder.push(2));
      yeh.hook('test-hook', () => callOrder.push(3));

      yeh._executeHook('test-hook');

      expect(callOrder).toEqual([1, 2, 3]);
    });

    it('should unhook specific callbacks', () => {
      const yeh = new YEH();
      let count = 0;

      const callback1 = () => count++;
      const callback2 = () => count++;

      yeh.hook('test-hook', callback1);
      yeh.hook('test-hook', callback2);

      yeh._executeHook('test-hook');
      expect(count).toBe(2);

      yeh.unhook('test-hook', callback1);
      yeh._executeHook('test-hook');
      expect(count).toBe(3); // Only callback2 called

      yeh.unhook('test-hook', callback2);
      yeh._executeHook('test-hook');
      expect(count).toBe(3); // No callbacks called
    });

    it('should clear all hooks for a specific event', () => {
      const yeh = new YEH();
      let called = false;

      yeh.hook('test-hook', () => called = true);
      yeh.hook('test-hook', () => called = true);

      yeh.clearHooks('test-hook');
      yeh._executeHook('test-hook');

      expect(called).toBe(false);
    });

    it('should return instance for chaining', () => {
      const yeh = new YEH();

      const result = yeh
        .hook('hook1', () => {})
        .hook('hook2', () => {})
        .unhook('hook1', () => {})
        .clearHooks('hook2');

      expect(result).toBe(yeh);
    });

    it('should pass instance as second argument to hooks', () => {
      const yeh = new YEH();
      let receivedInstance = null;

      yeh.hook('test-hook', (_context, instance) => {
        receivedInstance = instance;
      });

      yeh._executeHook('test-hook', {});

      expect(receivedInstance).toBe(yeh);
    });

    it('should execute beforeHandleEvent and afterHandleEvent hooks', () => {
      return new Promise((resolve) => {
        const eventMapping = {
          '.test-button': ['click'],
        };

        const beforeCalled = [];
        const afterCalled = [];

        container.innerHTML = '<button class="test-button">Click</button>';

        const yeh = new YEH(eventMapping, {}, {
          methods: {
            click: {
              handleClick: () => {}
            }
          }
        });

        yeh.hook('beforeHandleEvent', (context) => {
          beforeCalled.push(context.eventType);
        });

        yeh.hook('afterHandleEvent', (context) => {
          afterCalled.push(context.eventType);
        });

        const button = container.querySelector('.test-button');
        button.click();

        setTimeout(() => {
          expect(beforeCalled).toContain('click');
          expect(afterCalled).toContain('click');
          resolve();
        }, 50);
      });
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
    it('recovers when a leading throttled callback throws', () => {
      vi.useFakeTimers();
      let calls = 0;
      const throttled = YEH.throttle(() => {
        calls++;
        if (calls === 1) throw new Error('boom');
      }, 20, 'throwing-leading-throttle');

      expect(() => throttled()).toThrow('boom');
      vi.advanceTimersByTime(20);
      throttled();

      expect(calls).toBe(2);
      vi.useRealTimers();
    });

    it('cleans a throttled window after a trailing callback throws', () => {
      vi.useFakeTimers();
      let calls = 0;
      const throttled = YEH.throttle(() => {
        calls++;
        if (calls === 2) throw new Error('boom');
      }, 20, 'throwing-trailing-throttle');

      throttled();
      throttled();
      expect(() => vi.advanceTimersByTime(20)).toThrow('boom');
      throttled();

      expect(calls).toBe(3);
      vi.useRealTimers();
    });

    it('cleans a debounced window after a trailing callback throws', () => {
      vi.useFakeTimers();
      let calls = 0;
      const debounced = YEH.debounce(() => {
        calls++;
        if (calls === 2) throw new Error('boom');
      }, 20, 'throwing-trailing-debounce', {leading: true, trailing: true});

      debounced();
      debounced();
      expect(() => vi.advanceTimersByTime(20)).toThrow('boom');
      debounced();

      expect(calls).toBe(3);
      vi.useRealTimers();
    });

    it('keeps unnamed per-element debounces independent', () => {
      vi.useFakeTimers();
      const handler = vi.fn();
      container.innerHTML = '<input class="input"><input class="input">';
      new YEH({body: [{type: 'input', handler, debounce: 20}]});
      const [first, second] = container.querySelectorAll('.input');

      first.dispatchEvent(new Event('input', {bubbles: true}));
      second.dispatchEvent(new Event('input', {bubbles: true}));
      vi.advanceTimersByTime(20);

      expect(handler).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it('does not carry a stale trailing call into the next throttle window', () => {
      vi.useFakeTimers();
      const calls = [];
      const yeh = new YEH();
      const throttled = yeh.throttle((value) => calls.push(value), 100, 'window-boundary');

      throttled('first');
      vi.advanceTimersByTime(50);
      throttled('trailing');
      vi.advanceTimersByTime(50);
      throttled('next-window');
      vi.advanceTimersByTime(100);

      expect(calls).toEqual(['first', 'trailing', 'next-window']);
      yeh.destroy();
      vi.useRealTimers();
    });

    it('applies the same window boundary rule to static throttles', () => {
      vi.useFakeTimers();
      const calls = [];
      const throttled = YEH.throttle((value) => calls.push(value), 100, 'static-window-boundary');

      throttled('first');
      vi.advanceTimersByTime(50);
      throttled('trailing');
      vi.advanceTimersByTime(50);
      throttled('next-window');
      vi.advanceTimersByTime(100);

      expect(calls).toEqual(['first', 'trailing', 'next-window']);
      vi.useRealTimers();
    });

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

  describe('Auto preventDefault', () => {
    // Note: Form submit tests are skipped due to happy-dom limitations
    // Feature verified working in real browser (see yai-input-utils.html)
    it.skip('should auto preventDefault for globally configured events', () => {
      return new Promise((resolve) => {
        let handlerCalled = false;

        container.innerHTML = '<form id="test-form" data-action="fill"><button type="submit">Submit</button></form>';

        const eventMapping = {
          '#test-form': ['submit'],
        };

        new YEH(eventMapping, {}, {
          autoPreventDefault: ['submit'],
          methods: {
            submit: {
               handleSubmit: () => {
                handlerCalled = true;
              }
            }
          }
        });

        const form = container.querySelector('form');

        // Listen in bubble phase AFTER YEH handler
        document.addEventListener('submit', (e) => {
          expect(handlerCalled).toBe(true); // Verify handler was called
          expect(e.defaultPrevented).toBe(true);
          resolve();
        }, { once: true });

        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(submitEvent);
      });
    });

    it.skip('should allow per-event preventDefault override to true', () => {
      return new Promise((resolve) => {
        container.innerHTML = '<form id="test-form-2"><button type="submit">Submit</button></form>';

        const eventMapping = {
          '#test-form-2': [
            { type: 'submit', handler: 'handleSubmit', preventDefault: true }
          ],
        };

        new YEH(eventMapping, {}, {
          autoPreventDefault: [], // Not in global config
          methods: {
            submit: {
              handleSubmit: () => {}
            }
          }
        });

        const form = container.querySelector('form');

        // Listen in bubble phase AFTER YEH handler
        document.addEventListener('submit', (e) => {
          expect(e.defaultPrevented).toBe(true);
          resolve();
        }, { once: true });

        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(submitEvent);
      });
    });

    it.skip('should allow per-event preventDefault override to false', () => {
      return new Promise((resolve) => {
        container.innerHTML = '<form id="test-form-3"><button type="submit">Submit</button></form>';

        const eventMapping = {
          '#test-form-3': [
            { type: 'submit', handler: 'handleSubmit', preventDefault: false }
          ],
        };

        const yeh = new YEH(eventMapping, {}, {
          autoPreventDefault: ['submit'], // In global config, but overridden
          methods: {
            submit: {
              handleSubmit: () => {}
            }
          }
        });

        const form = container.querySelector('form');

        document.addEventListener('submit', (e) => {
          expect(e.defaultPrevented).toBe(false);
          resolve();
        }, { once: true });

        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(submitEvent);
      });
    });

    it.skip('should not preventDefault when not configured', () => {
      return new Promise((resolve) => {
        container.innerHTML = '<form id="test-form-4"><button type="submit">Submit</button></form>';

        const eventMapping = {
          '#test-form-4': ['submit'],
        };

        const yeh = new YEH(eventMapping, {}, {
          autoPreventDefault: [], // Empty - no auto preventDefault
          methods: {
            submit: {
              handleSubmit: () => {}
            }
          }
        });

        const form = container.querySelector('form');

        document.addEventListener('submit', (e) => {
          expect(e.defaultPrevented).toBe(false);
          resolve();
        }, { once: true });

        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(submitEvent);
      });
    });

    it.skip('should support multiple event types in autoPreventDefault', () => {
      return new Promise((resolve) => {
        container.innerHTML = '<form id="test-form-5"><button type="submit">Submit</button></form>';

        const eventMapping = {
          '#test-form-5': ['submit'],
        };

        new YEH(eventMapping, {}, {
          autoPreventDefault: ['submit'],
          methods: {
            submit: {
              handleSubmit: () => {}
            }
          }
        });

        const form = container.querySelector('form');

        // Listen in bubble phase AFTER YEH handler
        document.addEventListener('submit', (e) => {
          expect(e.defaultPrevented).toBe(true);
          resolve();
        }, { once: true });

        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(submitEvent);
      });
    });

    it('should warn when mixing debounce/throttle with preventDefault', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const eventMapping = {
        'form': [
          { type: 'submit', handler: 'handleSubmit', preventDefault: true, debounce: 500 }
        ],
      };

      container.innerHTML = '<form><button type="submit">Submit</button></form>';

      new YEH(eventMapping, {}, {
        methods: {
          submit: {
            handleSubmit: () => {}
          }
        }
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Mixing debounce/throttle with preventDefault')
      );

      warnSpy.mockRestore();
    });
  });

  describe('Cleanup', () => {
    it('runs overlapping registrations only once for one native event', () => {
      const handler = vi.fn();
      container.innerHTML = '<div id="outer"><div id="inner"><button>Click</button></div></div>';
      new YEH({
        '#outer': [{type: 'click', handler}],
        '#inner': [{type: 'click', handler}]
      }, {}, {stopPropagation: false});

      container.querySelector('button').click();
      expect(handler).toHaveBeenCalledOnce();
    });

    it('preserves hooks supplied in config.callable', () => {
      const before = vi.fn();
      container.innerHTML = '<button class="action">Click</button>';
      new YEH({'.action': [{type: 'click', handler: () => {}}]}, {}, {
        callable: {beforeHandleEvent: [before]}
      });

      container.querySelector('button').click();
      expect(before).toHaveBeenCalledOnce();
    });

    it('does not mutate listener options and accepts signal:false as an opt-out', () => {
      const options = {signal: false};
      container.innerHTML = '<button class="action">Click</button>';
      expect(() => new YEH({'.action': [{type: 'click', handler: () => {}, options}]}, {}, {
        abortController: true
      })).not.toThrow();
      expect(options).toEqual({signal: false});
    });
    it('should destroy and cleanup event listeners', () => {
      const eventMapping = {
        '.test-button': ['click'],
      };

      container.innerHTML = '<button class="test-button">Test</button>';

      const yeh = new YEH(eventMapping, {}, {methods: {handleClick: () => {}}});

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

    it('cancels a pending debounced event when the event is removed', () => {
      vi.useFakeTimers();
      const handler = vi.fn();
      container.innerHTML = '<input class="search">';
      const yeh = new YEH({
        '.search': [{type: 'input', handler, debounce: 100, perElement: false}]
      });

      container.querySelector('.search').dispatchEvent(new Event('input', {bubbles: true}));
      expect(yeh.debounceTimers.size).toBe(1);

      yeh.removeEvent('.search', 'input');
      vi.advanceTimersByTime(100);

      expect(handler).not.toHaveBeenCalled();
      expect(yeh.debounceTimers.size).toBe(0);
      vi.useRealTimers();
    });

    it('removes a detached element using its original listener identity', () => {
      const handler = vi.fn();
      container.innerHTML = '<button class="item">Item</button>';
      const element = container.querySelector('.item');
      const yeh = new YEH({'.item': [{type: 'click', handler}]});

      element.remove();
      expect(yeh.removeEvent('.item', 'click')).toBe(true);
      container.append(element);
      element.click();

      expect(handler).not.toHaveBeenCalled();
      expect(yeh.eventListeners.size).toBe(0);
    });

    it('removes all records after elements are reordered', () => {
      const handler = vi.fn();
      container.innerHTML = '<button class="item">A</button><button class="item">B</button>';
      const yeh = new YEH({'.item': [{type: 'click', handler}]});
      const [first, second] = container.querySelectorAll('.item');
      container.append(first);

      yeh.removeEvent('.item', 'click');
      first.click();
      second.click();

      expect(handler).not.toHaveBeenCalled();
      expect(yeh.eventListeners.size).toBe(0);
    });

    it('keeps a second selector registration when the first is removed', () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      container.innerHTML = '<button class="first second">Both</button>';
      const yeh = new YEH({
        '.first': [{type: 'click', handler: firstHandler}],
        '.second': [{type: 'click', handler: secondHandler}]
      });

      yeh.removeEvent('.first', 'click');
      container.querySelector('button').click();

      expect(firstHandler).not.toHaveBeenCalled();
      expect(secondHandler).toHaveBeenCalledOnce();
    });

    it('cancels a pending throttled callback when its registration is removed', () => {
      vi.useFakeTimers();
      const handler = vi.fn();
      container.innerHTML = '<button class="item">Item</button>';
      const yeh = new YEH({'.item': [{type: 'click', handler, throttle: 100}]});
      const element = container.querySelector('.item');

      element.click();
      element.click();
      yeh.removeEvent('.item', 'click');
      vi.advanceTimersByTime(100);

      expect(handler).toHaveBeenCalledOnce();
      expect(yeh.throttleTimers.size).toBe(0);
      vi.useRealTimers();
    });

    it('cancels a pending debounced callback on destroy', () => {
      vi.useFakeTimers();
      const callback = vi.fn();
      const yeh = new YEH();
      yeh.debounce(callback, 100, 'destroy-test')();

      yeh.destroy();
      vi.advanceTimersByTime(100);

      expect(callback).not.toHaveBeenCalled();
      expect(yeh.debounceTimers.size).toBe(0);
      vi.useRealTimers();
    });

    it('does not retain records for missing handlers or failed native attachment', () => {
      container.innerHTML = '<button class="missing"></button><button class="throws"></button>';
      const missing = new YEH({'.missing': [{type: 'click', handler: 'notDefined'}]});
      expect(missing.eventListeners.size).toBe(0);
      expect(missing.eventHandlerMap.size).toBe(0);

      const throws = container.querySelector('.throws');
      const error = new Error('native listener failed');
      throws.addEventListener = () => { throw error; };
      expect(() => missing.registerEventListener(throws, {type: 'click', handler: () => {}}, '.throws')).toThrow(error);
      expect(missing.eventListeners.size).toBe(0);
      expect(missing.eventHandlerMap.size).toBe(0);
    });
  });

  describe('Handler failure contract', () => {
    const createEvent = (target) => ({
      type: 'click',
      target,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    });

    it('preserves handler errors while applying configured event cleanup', () => {
      container.innerHTML = '<button class="action">Run</button>';
      const after = vi.fn();
      const failure = new Error('handler failed');
      const yeh = new YEH({
        '.action': [{type: 'click', handler: () => { throw failure; }, preventDefault: true}]
      });
      yeh.hook('afterHandleEvent', after);
      const event = createEvent(container.querySelector('.action'));

      expect(() => yeh.handleEvent(event)).toThrow(failure);
      expect(after).not.toHaveBeenCalled();
      expect(event.preventDefault).toHaveBeenCalledOnce();
      expect(event.stopPropagation).toHaveBeenCalledOnce();
    });

    it('preserves before and after hook errors while applying event cleanup', () => {
      container.innerHTML = '<button class="action">Run</button>';
      const handler = vi.fn();
      const yeh = new YEH({'.action': [{type: 'click', handler}]});
      const event = createEvent(container.querySelector('.action'));
      yeh.hook('beforeHandleEvent', () => { throw new Error('before failed'); });

      expect(() => yeh.handleEvent(event)).toThrow('before failed');
      expect(handler).not.toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalledOnce();

      yeh.clearHooks('beforeHandleEvent');
      yeh.hook('afterHandleEvent', () => { throw new Error('after failed'); });
      const afterEvent = createEvent(container.querySelector('.action'));
      expect(() => yeh.handleEvent(afterEvent)).toThrow('after failed');
      expect(handler).toHaveBeenCalledOnce();
      expect(afterEvent.stopPropagation).toHaveBeenCalledOnce();
    });
  });

  describe('Statistics snapshots', () => {
    it('does not expose mutable timer maps', () => {
      const yeh = new YEH({}, {}, {enableStats: true});
      yeh.debounce(() => {}, 100, 'stats-test')();
      const stats = yeh.getStats();

      stats.activeTimers.debounce = 0;
      stats.eventTypes.mutated = 1;

      expect(yeh.debounceTimers.size).toBe(1);
      expect(yeh.getStats().activeTimers.debounce).toBe(1);
      expect(yeh.getStats().eventTypes.mutated).toBeUndefined();
      yeh.destroy();
    });
  });
});
