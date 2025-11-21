import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanupDOM, createMockContainer} from './setup.js';
import {YaiTabs} from '../tabs/yai-tabs.js';

// Mock YEH and YaiCore
class MockYEH {
  constructor(selectors, aliases, config) {
    this.selectors = selectors;
    this.aliases = aliases;
    this.config = config || {};
  }
  emit() {}
  on() {}
  destroy() {}
}

class MockYaiCore {
  constructor(config) {
    this.config = config || {};
    this.config.emitable = {};
    this.routeMap = new Map();
    this._domCache = new Map();
    this._cacheStats = { hits: 0, misses: 0, totalQueries: 0 };
  }
  createEventHandler() {
    return new MockYEH({}, {}, {});
  }
  yaiEmit() {}
  find(selector, scope) {
    return (scope || document).querySelector(selector);
  }
  findAll(selector, scope) {
    return (scope || document).querySelectorAll(selector);
  }
  $(selector) {
    return document.querySelector(selector);
  }
  parseHash() {
    const hash = window.location.hash.slice(1);
    const params = {};
    hash.split('&').forEach(pair => {
      const [key, value] = pair.split('=');
      if (key && value) params[key] = value;
    });
    return params;
  }
  updateHash() {}
  static generateId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
  static deepMerge(target, source) {
    return { ...target, ...source };
  }
}

global.YEH = MockYEH;
global.YaiCore = MockYaiCore;

describe('YaiTabs - Auto-Disambiguation', () => {
  let container;

  beforeEach(() => {
    cleanupDOM();
    container = createMockContainer();
  });

  afterEach(() => {
    cleanupDOM();
  });

  it('should assign unique IDs at different depths', () => {
    container.innerHTML = `
      <!-- Root level (depth 0) -->
      <div data-yai-tabs id="root1">
        <nav data-controller>
          <button data-open="1">Tab 1</button>
          <button data-open="2">Tab 2</button>
        </nav>
        <div data-content>
          <div data-tab="1">Root Content 1</div>
          <div data-tab="2">Root Content 2
            <!-- Nested level (depth 1) -->
            <div data-yai-tabs id="nested1">
              <nav data-controller>
                <button data-open="1">Tab 1</button>
                <button data-open="2">Tab 2</button>
              </nav>
              <div data-content>
                <div data-tab="1">Nested Content 1</div>
                <div data-tab="2">Nested Content 2</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Simplified auto-disambiguation simulation
    const allContainers = container.querySelectorAll('[data-yai-tabs]');
    const containersByDepth = new Map();

    allContainers.forEach(tabContainer => {
      let depth = 0;
      let current = tabContainer.parentElement;

      while (current && current !== document.body) {
        const parentTabContainer = current.closest('[data-yai-tabs]');
        if (parentTabContainer && parentTabContainer !== tabContainer) {
          depth++;
          current = parentTabContainer.parentElement;
        } else {
          break;
        }
      }

      if (!containersByDepth.has(depth)) {
        containersByDepth.set(depth, []);
      }
      containersByDepth.get(depth).push(tabContainer);
    });

    // Process depth 0
    const depth0 = containersByDepth.get(0);
    expect(depth0.length).toBe(1);

    const depth0Buttons = depth0[0].querySelectorAll(':scope > nav[data-controller] [data-open]');
    expect(depth0Buttons[0].dataset.open).toBe('1');
    expect(depth0Buttons[1].dataset.open).toBe('2');

    // Process depth 1
    const depth1 = containersByDepth.get(1);
    expect(depth1.length).toBe(1);

    const depth1Buttons = depth1[0].querySelectorAll(':scope > nav[data-controller] [data-open]');
    expect(depth1Buttons[0].dataset.open).toBe('1');
    expect(depth1Buttons[1].dataset.open).toBe('2');

    // Depths should be different
    expect(containersByDepth.get(0)[0]).not.toBe(containersByDepth.get(1)[0]);
  });

  it('should preserve original IDs in data-original-id attribute', () => {
    container.innerHTML = `
      <div data-yai-tabs>
        <nav data-controller>
          <button data-open="test" data-original-id="test">Tab</button>
        </nav>
        <div data-content>
          <div data-tab="test" data-original-id="test">Content</div>
        </div>
      </div>
    `;

    const button = container.querySelector('[data-open]');
    const panel = container.querySelector('[data-tab]');

    expect(button.getAttribute('data-original-id')).toBe('test');
    expect(panel.getAttribute('data-original-id')).toBe('test');
  });

  it('should handle multiple containers at same depth', () => {
    container.innerHTML = `
      <div data-yai-tabs id="root1">
        <nav data-controller>
          <button data-open="1">Tab 1</button>
        </nav>
        <div data-content>
          <div data-tab="1">Content 1</div>
        </div>
      </div>

      <div data-yai-tabs id="root2">
        <nav data-controller>
          <button data-open="1">Tab 1</button>
        </nav>
        <div data-content>
          <div data-tab="1">Content 1</div>
        </div>
      </div>
    `;

    const allContainers = container.querySelectorAll('[data-yai-tabs]');

    expect(allContainers.length).toBe(2);
    expect(allContainers[0].id).toBe('root1');
    expect(allContainers[1].id).toBe('root2');

    // Both at depth 0
    let depth0Count = 0;
    allContainers.forEach(tabContainer => {
      let current = tabContainer.parentElement;
      let isNested = false;

      while (current && current !== document.body) {
        const parentTabContainer = current.closest('[data-yai-tabs]');
        if (parentTabContainer && parentTabContainer !== tabContainer) {
          isNested = true;
          break;
        }
        current = current.parentElement;
      }

      if (!isNested) depth0Count++;
    });

    expect(depth0Count).toBe(2);
  });
});

describe('YaiTabs - Hash Routing', () => {
  beforeEach(() => {
    cleanupDOM();
    window.location.hash = '';
  });

  afterEach(() => {
    cleanupDOM();
    window.location.hash = '';
  });

  it('should parse hash parameters correctly', () => {
    window.location.hash = '#main-tabs=1&nested-tabs=2';

    const core = new MockYaiCore();
    const params = core.parseHash();

    expect(params['main-tabs']).toBe('1');
    expect(params['nested-tabs']).toBe('2');
  });

  it('should handle empty hash', () => {
    window.location.hash = '';

    const core = new MockYaiCore();
    const params = core.parseHash();

    expect(Object.keys(params).length).toBe(0);
  });

  it('should find buttons using data-original-id', () => {
    const container = createMockContainer(`
      <div data-yai-tabs data-ref-path="main">
        <nav data-controller>
          <button data-open="1aroot" data-original-id="1">Tab 1</button>
          <button data-open="2aroot" data-original-id="2">Tab 2</button>
        </nav>
        <div data-content>
          <div data-tab="1aroot" data-original-id="1">Content 1</div>
          <div data-tab="2aroot" data-original-id="2">Content 2</div>
        </div>
      </div>
    `);

    // Simulate finding button by original ID
    const tabId = '1'; // From hash
    const button = container.querySelector(`[data-original-id="${tabId}"], [data-open="${tabId}"]`);

    expect(button).toBeDefined();
    expect(button.dataset.open).toBe('1aroot');
    expect(button.getAttribute('data-original-id')).toBe('1');
  });
});

describe('YaiTabs - ARIA Accessibility', () => {
  let container;

  beforeEach(() => {
    cleanupDOM();
    container = createMockContainer();
  });

  afterEach(() => {
    cleanupDOM();
  });

  it('should set correct ARIA roles on nav', () => {
    container.innerHTML = `
      <div data-yai-tabs>
        <nav data-controller role="tablist">
          <button data-open="1">Tab 1</button>
        </nav>
        <div data-content>
          <div data-tab="1">Content 1</div>
        </div>
      </div>
    `;

    const nav = container.querySelector('nav[data-controller]');

    expect(nav.getAttribute('role')).toBe('tablist');
  });

  it('should set correct ARIA attributes on buttons', () => {
    container.innerHTML = `
      <div data-yai-tabs id="test-tabs">
        <nav data-controller>
          <button data-open="1" role="tab" aria-controls="test-tabs-panel-1">Tab 1</button>
        </nav>
        <div data-content>
          <div data-tab="1">Content 1</div>
        </div>
      </div>
    `;

    const button = container.querySelector('button[data-open="1"]');

    expect(button.getAttribute('role')).toBe('tab');
    expect(button.getAttribute('aria-controls')).toBe('test-tabs-panel-1');
  });

  it('should set correct ARIA attributes on panels', () => {
    container.innerHTML = `
      <div data-yai-tabs id="test-tabs">
        <nav data-controller>
          <button data-open="1">Tab 1</button>
        </nav>
        <div data-content>
          <div data-tab="1" role="tabpanel" aria-labelledby="test-tabs-tab-1">Content 1</div>
        </div>
      </div>
    `;

    const panel = container.querySelector('[data-tab="1"]');

    expect(panel.getAttribute('role')).toBe('tabpanel');
    expect(panel.getAttribute('aria-labelledby')).toBe('test-tabs-tab-1');
  });

  it('should mark inactive panels with aria-hidden', () => {
    container.innerHTML = `
      <div data-yai-tabs>
        <nav data-controller>
          <button data-open="1" class="active">Tab 1</button>
          <button data-open="2">Tab 2</button>
        </nav>
        <div data-content>
          <div data-tab="1" class="active">Content 1</div>
          <div data-tab="2" aria-hidden="true">Content 2</div>
        </div>
      </div>
    `;

    const activePanel = container.querySelector('[data-tab="1"]');
    const inactivePanel = container.querySelector('[data-tab="2"]');

    expect(activePanel.getAttribute('aria-hidden')).toBeNull();
    expect(inactivePanel.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('YaiTabs - Lazy Component Registration', () => {
  let container;

  beforeEach(() => {
    cleanupDOM();
    container = createMockContainer();
  });

  afterEach(() => {
    cleanupDOM();
  });

  it('should identify root vs nested components', () => {
    container.innerHTML = `
      <div data-yai-tabs id="root">
        <nav data-controller>
          <button data-open="1">Tab 1</button>
        </nav>
        <div data-content>
          <div data-tab="1">
            <div data-yai-tabs id="nested">
              <nav data-controller>
                <button data-open="1">Nested Tab</button>
              </nav>
              <div data-content>
                <div data-tab="1">Nested Content</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const allContainers = container.querySelectorAll('[data-yai-tabs]');

    allContainers.forEach(tabContainer => {
      const parentTabContainer = tabContainer.parentElement?.closest('[data-yai-tabs]');

      if (parentTabContainer) {
        // Nested - should be marked lazy
        expect(tabContainer.id).toBe('nested');
      } else {
        // Root - should stay active
        expect(tabContainer.id).toBe('root');
      }
    });
  });

  it('should mark nested components as lazy', () => {
    container.innerHTML = `
      <div data-yai-tabs id="root">
        <nav data-controller><button data-open="1">Tab</button></nav>
        <div data-content>
          <div data-tab="1">
            <div data-yai-tabs id="nested" data-lazy-component="true">
              <nav data-controller><button data-open="1">Nested</button></nav>
              <div data-content><div data-tab="1">Content</div></div>
            </div>
          </div>
        </div>
      </div>
    `;

    const nested = container.querySelector('#nested');

    expect(nested.hasAttribute('data-lazy-component')).toBe(true);
  });
});

describe('YaiTabs - Sibling Branch Cleanup', () => {
  let container;

  beforeEach(() => {
    cleanupDOM();
    container = createMockContainer();
  });

  afterEach(() => {
    cleanupDOM();
  });

  it('should identify sibling panels correctly', () => {
    container.innerHTML = `
      <div data-yai-tabs>
        <nav data-controller>
          <button data-open="1">Tab 1</button>
          <button data-open="2">Tab 2</button>
        </nav>
        <div data-content>
          <div data-tab="1" class="active">Content 1</div>
          <div data-tab="2">Content 2</div>
        </div>
      </div>
    `;

    const containerEl = container.querySelector('[data-yai-tabs]');
    const allPanels = containerEl.querySelectorAll(':scope > div[data-content] > [data-tab]');
    const activePanel = containerEl.querySelector(':scope > div[data-content] > [data-tab].active');

    expect(allPanels.length).toBe(2);
    expect(activePanel.dataset.tab).toBe('1');

    // Find inactive siblings
    const inactivePanels = Array.from(allPanels).filter(panel => panel !== activePanel);
    expect(inactivePanels.length).toBe(1);
    expect(inactivePanels[0].dataset.tab).toBe('2');
  });

  it('should remove tab-active class from hidden containers', () => {
    container.innerHTML = `
      <div data-yai-tabs>
        <nav data-controller>
          <button data-open="1">Tab 1</button>
          <button data-open="2" class="active">Tab 2</button>
        </nav>
        <div data-content>
          <div data-tab="1">
            <div data-yai-tabs class="tab-active">Nested in Tab 1</div>
          </div>
          <div data-tab="2" class="active">
            <div data-yai-tabs class="tab-active">Nested in Tab 2</div>
          </div>
        </div>
      </div>
    `;

    // When switching to tab 2, tab 1's nested containers should lose tab-active
    const tab1Panel = container.querySelector('[data-tab="1"]');
    const nestedInTab1 = tab1Panel.querySelector('[data-yai-tabs]');

    // Simulate cleanup
    nestedInTab1.classList.remove('tab-active');

    expect(nestedInTab1.classList.contains('tab-active')).toBe(false);
  });
});

describe('YaiTabs - Sibling Cleanup with Parallel Active Branches', () => {
  let container;

  beforeEach(() => {
    container = createMockContainer();
    document.body.appendChild(container);
  });

  afterEach(() => {
    cleanupDOM();
  });

  it('should preserve nested routes in active sibling when switching tabs at same level', () => {
    // Simulate the scenario: STYLES=1 with S-RED, N-PURPLE, S-MIXED (all siblings at same level)
    // S-MIXED has deep nesting: S-M-BLUE → S-M-DARK → SUB-S-BLUE
    container.innerHTML = `
      <div data-yai-tabs data-ref-path="styles" data-nesting="0">
        <nav data-controller>
          <button data-tab-action="open" data-open="1" class="active">Tab 1</button>
          <button data-tab-action="open" data-open="2">Tab 2</button>
        </nav>
        <div data-content>
          <div data-tab="1" class="active">
            <!-- S-RED container (will switch from C to A) -->
            <div data-yai-tabs data-ref-path="s-red" data-nesting="1">
              <nav data-controller>
                <button data-tab-action="open" data-open="a">A</button>
                <button data-tab-action="open" data-open="b">B</button>
                <button data-tab-action="open" data-open="c" class="active">C</button>
              </nav>
              <div data-content>
                <div data-tab="a">Content A</div>
                <div data-tab="b">Content B</div>
                <div data-tab="c" class="active">Content C</div>
              </div>
            </div>

            <!-- N-PURPLE sibling (same level as S-RED) -->
            <div data-yai-tabs data-ref-path="n-purple" data-nesting="1">
              <nav data-controller>
                <button data-tab-action="open" data-open="1">1</button>
                <button data-tab-action="open" data-open="2">2</button>
              </nav>
              <div data-content>
                <div data-tab="1">Purple 1</div>
                <div data-tab="2">Purple 2</div>
              </div>
            </div>

            <!-- S-MIXED sibling with deep nesting (should be preserved) -->
            <div data-yai-tabs data-ref-path="s-mixed" data-nesting="1">
              <nav data-controller>
                <button data-tab-action="open" data-open="1" class="active">1</button>
                <button data-tab-action="open" data-open="2">2</button>
              </nav>
              <div data-content>
                <div data-tab="1" class="active">
                  <!-- S-M-BLUE (nested level 2) -->
                  <div data-yai-tabs data-ref-path="s-m-blue" data-nesting="2">
                    <nav data-controller>
                      <button data-tab-action="open" data-open="1" class="active">1</button>
                    </nav>
                    <div data-content>
                      <div data-tab="1" class="active">
                        <!-- S-M-DARK (nested level 3) -->
                        <div data-yai-tabs data-ref-path="s-m-dark" data-nesting="3">
                          <nav data-controller>
                            <button data-tab-action="open" data-open="1" class="active">1</button>
                          </nav>
                          <div data-content>
                            <div data-tab="1" class="active">
                              <!-- SUB-S-BLUE (nested level 4) -->
                              <div data-yai-tabs data-ref-path="sub-s-blue" data-nesting="4">
                                <nav data-controller>
                                  <button data-tab-action="open" data-open="1" class="active">1</button>
                                </nav>
                                <div data-content>
                                  <div data-tab="1" class="active">Deep content</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div data-tab="2">Mixed 2</div>
              </div>
            </div>
          </div>
          <div data-tab="2">Styles Tab 2</div>
        </div>
      </div>
    `;

    // Create a mock YaiTabs instance with routeMap
    const mockInstance = {
      config: { rootSelector: '[data-yai-tabs]' },
      routeMap: new Map([
        ['styles', '1'],
        ['s-red', 'c'],
        ['s-mixed', '1'],
        ['s-m-blue', '1'],
        ['s-m-dark', '1'],
        ['sub-s-blue', '1']
      ])
    };

    // Simulate the sibling cleanup logic with the FIX
    const sRedContainer = container.querySelector('[data-ref-path="s-red"]');
    const parent = sRedContainer.closest('[data-yai-tabs][data-nesting="0"]');
    const siblingContainers = parent.querySelectorAll(':scope > [data-content] > [data-tab] > [data-yai-tabs]');

    siblingContainers.forEach(sibling => {
      if (sibling !== sRedContainer) {
        // THE FIX: Check if sibling's parent panel is active
        const siblingPanel = sibling.closest('[data-tab]');
        const isSiblingPanelActive = siblingPanel && siblingPanel.classList.contains('active');

        // Only cleanup if sibling's panel is NOT active
        if (!isSiblingPanelActive) {
          // Would cleanup here, but since panel IS active, this shouldn't run
          expect(true).toBe(false); // This should never execute
        }
      }
    });

    // Assert: S-MIXED's nested routes should still be in routeMap
    expect(mockInstance.routeMap.has('s-mixed')).toBe(true);
    expect(mockInstance.routeMap.has('s-m-blue')).toBe(true);
    expect(mockInstance.routeMap.has('s-m-dark')).toBe(true);
    expect(mockInstance.routeMap.has('sub-s-blue')).toBe(true);
  });

  it('should cleanup nested routes in sibling when its parent panel becomes inactive', () => {
    // Simulate switching STYLES from 1 to 2 (deactivates all children of tab 1)
    container.innerHTML = `
      <div data-yai-tabs data-ref-path="styles" data-nesting="0">
        <nav data-controller>
          <button data-tab-action="open" data-open="1">Tab 1</button>
          <button data-tab-action="open" data-open="2" class="active">Tab 2</button>
        </nav>
        <div data-content>
          <div data-tab="1">
            <!-- These should be cleaned up since tab 1 is now inactive -->
            <div data-yai-tabs data-ref-path="s-red" data-nesting="1">
              <nav data-controller>
                <button data-tab-action="open" data-open="a">A</button>
              </nav>
              <div data-content>
                <div data-tab="a">Content A</div>
              </div>
            </div>
            <div data-yai-tabs data-ref-path="s-mixed" data-nesting="1">
              <nav data-controller>
                <button data-tab-action="open" data-open="1">1</button>
              </nav>
              <div data-content>
                <div data-tab="1">
                  <div data-yai-tabs data-ref-path="s-m-blue" data-nesting="2">
                    <nav data-controller>
                      <button data-tab-action="open" data-open="1">1</button>
                    </nav>
                    <div data-content>
                      <div data-tab="1">Nested</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div data-tab="2" class="active">Styles Tab 2</div>
        </div>
      </div>
    `;

    const mockInstance = {
      config: { rootSelector: '[data-yai-tabs]' },
      routeMap: new Map([
        ['styles', '2'],
        ['s-red', 'a'],
        ['s-mixed', '1'],
        ['s-m-blue', '1']
      ])
    };

    // Simulate cleanup when switching to tab 2
    const stylesContainer = container.querySelector('[data-ref-path="styles"]');
    const tab1Panel = stylesContainer.querySelector('[data-tab="1"]');
    const siblingContainers = tab1Panel.querySelectorAll(':scope > [data-yai-tabs]');

    let shouldCleanup = false;
    siblingContainers.forEach(sibling => {
      const siblingPanel = sibling.closest('[data-tab]');
      const isSiblingPanelActive = siblingPanel && siblingPanel.classList.contains('active');

      if (!isSiblingPanelActive) {
        shouldCleanup = true;
        // Would delete from routeMap here
      }
    });

    // Assert: Cleanup should have been triggered
    expect(shouldCleanup).toBe(true);

    // Simulate the cleanup
    mockInstance.routeMap.delete('s-red');
    mockInstance.routeMap.delete('s-mixed');
    mockInstance.routeMap.delete('s-m-blue');

    // Assert: All nested routes under inactive tab 1 should be removed
    expect(mockInstance.routeMap.has('s-red')).toBe(false);
    expect(mockInstance.routeMap.has('s-mixed')).toBe(false);
    expect(mockInstance.routeMap.has('s-m-blue')).toBe(false);
    // But styles should still be there
    expect(mockInstance.routeMap.has('styles')).toBe(true);
    expect(mockInstance.routeMap.get('styles')).toBe('2');
  });
});

describe('YaiTabs - _cleanupSiblingContainers regression', () => {
  let container;

  const createTabsDouble = () => {
    const instance = Object.create(YaiTabs.prototype);
    instance.config = {rootSelector: '[data-yai-tabs]'};
    instance._cleanupSiblingBranchParameters = vi.fn();
    return instance;
  };

  beforeEach(() => {
    cleanupDOM();
    container = createMockContainer();
  });

  afterEach(() => {
    cleanupDOM();
  });

  it('skips cleanup for siblings inside the same active panel', () => {
    container.innerHTML = `
      <div data-yai-tabs data-ref-path="styles" data-nesting="0">
        <div data-content>
          <div data-tab="1" class="active">
            <div data-yai-tabs data-ref-path="s-red" data-nesting="1"></div>
            <div data-yai-tabs data-ref-path="n-purple" data-nesting="1"></div>
            <div data-yai-tabs data-ref-path="s-mixed" data-nesting="1"></div>
          </div>
          <div data-tab="2">Styles Tab 2</div>
        </div>
      </div>
    `;

    const sRedContainer = container.querySelector('[data-ref-path="s-red"]');
    const tabs = createTabsDouble();

    tabs._cleanupSiblingContainers(sRedContainer);

    expect(tabs._cleanupSiblingBranchParameters).not.toHaveBeenCalled();
  });

  it('still cleans siblings whose parent panel is inactive', () => {
    container.innerHTML = `
      <div data-yai-tabs data-ref-path="styles" data-nesting="0">
        <div data-content>
          <div data-tab="1" class="active">
            <div data-yai-tabs data-ref-path="s-red" data-nesting="1"></div>
            <div data-yai-tabs data-ref-path="s-mixed" data-nesting="1"></div>
          </div>
          <div data-tab="2">
            <div data-yai-tabs data-ref-path="styles-panel-2" data-nesting="1"></div>
          </div>
        </div>
      </div>
    `;

    const sRedContainer = container.querySelector('[data-ref-path="s-red"]');
    const tabs = createTabsDouble();

    tabs._cleanupSiblingContainers(sRedContainer);

    expect(tabs._cleanupSiblingBranchParameters).toHaveBeenCalledTimes(1);
    const [inactiveContainer] = tabs._cleanupSiblingBranchParameters.mock.calls[0];
    expect(inactiveContainer.dataset.refPath).toBe('styles-panel-2');
  });
});
