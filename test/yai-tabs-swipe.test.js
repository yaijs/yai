import {afterEach, describe, expect, it, vi} from 'vitest';
import {YaiTabsSwipe} from '../utils/yai-tabs-swipe.js';

describe('YaiTabsSwipe lifecycle hooks', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes single and array callable hooks', () => {
    const swipe = new YaiTabsSwipe();
    const first = vi.fn(() => 'first');
    const second = vi.fn(() => 'second');
    swipe.config.callable = {swipeStart: [first, null, second]};

    expect(swipe._executeHook('swipeStart', {})).toEqual(['first', 'second']);
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it('supports null-prototype callable configs and clears pending timeouts', () => {
    const swipe = new YaiTabsSwipe();
    swipe.config.callable = Object.assign(Object.create(null), {swipeStart: null});
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    swipe._pendingTimeout = 1;

    expect(() => swipe.hook('swipeStart', vi.fn())).not.toThrow();
    swipe.destroy();

    expect(clearTimeoutSpy).toHaveBeenCalledWith(1);
    expect(swipe._pendingTimeout).toBeNull();
  });
});
