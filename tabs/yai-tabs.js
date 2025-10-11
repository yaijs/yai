"use strict";
import {YaiCore} from '../yai-core.js';

/**
 * YaiTabs - Yai component
 */
class YaiTabs extends YaiCore {
    constructor(customConfig = {}) {
        // YaiTabs specific config
        const tabsConfig = {
            rootSelector: '[data-yai-tabs]', /** @var string Tabs container selector, can handle multiple */
            closable: true,                  /** @var bool Closable tabs, click on active tab button closes the tab */
            defaultBehavior: 'fade',         /** @var string Default animation behavior if no data-behavior is specified */
            autoFocus: false,                /** @var bool Automatically focus the first container's active tab on init */
            autoAccessibility: true,         /** @var bool Enable comprehensive ARIA accessibility setup */
            autoDisambiguate: true,          /** @var bool Automatically make identical data-open/data-tab values unique to prevent cross-contamination */
            lazyNestedComponents: true,      /** @var bool On init, marks nested tab components as laty "data-yai-tabs-lazy" */
            autoFocusNested: false,          /** @var bool Auto-focus first focusable in nested active tabs */
            timeout: {
                debounce: {
                    hashchange: 500,
                }
            },

            // Override eventHandler configs
            events: {
                autoTargetResolution: true,
                actionableAttributes: ['data-tab-action'],
                actionableClasses: [],
                actionableTags: [],
                setListener: null,
            },

            // Extend base emitable events with YaiTabs-specific ones
            // Base events are automatically merged from YaiCore.getBaseEmitableEvents()
            dispatchName: 'yai.tabs', // prefix for emitables
            emitable: {
                tabOpening:  'tabOpening',
                tabClosing:  'tabClosing',
                tabClosed:   'tabClosed',
                tabSwitched: 'tabSwitched',
                nested:      'nested',
                tabReady:    'tabReady',
                tabs:        'tabs',
                tabClicked:  'tabClicked',
                tabs:        'tabs',
            },

            // Event hooks. Leveraging YEHs event delegation via hooks
            eventHook: {
                events: ['click', 'keydown'] // ['click', 'keydown', 'input', 'change', 'submit', 'blur', 'focus']
            },
        };

        super(YaiCore.deepMerge(tabsConfig, customConfig));

        this.tabOpenAttribute = this.config.autoDisambiguate ? 'data-original-id' : 'data-open';
        this.rootIndex = 0;

        // Set up loading hooks
        this.hook('setLoading', ({ container, isLoading, target }) => {
            this.toggleLoading(container, isLoading, target);
        })
        .hook('removeLoading', ({ container, isLoading, target }) => {
            this.toggleLoading(container, isLoading, target);
        })
        .hook('contentReady', ({ content, target, url }) => {
            if (target) {
                if (target.classList.contains('active')) {
                    content.classList.add('active');
                }
                if (target.style.minWidth) {
                    target.style.minWidth = 'auto';
                }
                if (target.dataset.restoreText) {
                    target.textContent = target.dataset.restoreText;
                }
                // Restore focus to button after dynamic content loading (url exists)
                if (url && document.activeElement !== target && target.classList.contains('active')) {
                    requestAnimationFrame(() => { this.yaiFocus(target) });
                }
            }
        });

        // Prep lazy components
        if (this.config.lazyNestedComponents) {
            this._markLazyComponents();
        }

        /**
         * Create event handler using YaiCore factory | this.events
         * Event selectors & Aliases - simple string format works fine
         * Only root components have listeners, nested rely on delegation
         */
        this.createEventHandler(
            this.config.events.setListener
            || {
                // default listeners
                window: [{ type: 'hashchange', debounce: this.config.timeout.debounce.hashchange }],
                [this.config.rootSelector]: ['click', 'keydown'],
            },
            this.config.events.setAliases,
            this.config.events
        );

        // Activate lazy components after event registration
        if (this.config.lazyNestedComponents) {
            this._activateLazyComponents();
        }

        // Hash routing state
        this.routeMap = new Map();

        // Auto-disambiguate identical IDs before any processing (if enabled)
        if (this.config.autoDisambiguate) {
            this._autoDisambiguateIds();
        }

        // Process hash before initialization
        this.processHashBeforeInit();

        this.init();

        // Final ARIA state update after hash processing and initialization
        // This ensures hash-opened tabs have correct aria-hidden states and manages focusable elements
        setTimeout(() => {
            document.querySelectorAll(this.config.rootSelector).forEach(container => {
                this._updateAriaStates(container);
            });
        }, 50);
    }

    yaiFocus(target, preventScroll = true) {
        target.focus({ preventScroll })
    }

    /**
     * Mark nested components as lazy to prevent event listener proliferation
     * Only root components keep the data-yai-tabs attribute for initial event registration
     */
    _markLazyComponents() {
        const allTabContainers = document.querySelectorAll(this.config.rootSelector);

        allTabContainers.forEach((container, index) => {
            // Check if this container is nested inside another tab container
            const parentTabContainer = container.parentElement?.closest(this.config.rootSelector);

            if (parentTabContainer) {
                // This is a nested component - make it lazy
                const attributeValue = container.getAttribute('data-yai-tabs') || '';
                container.setAttribute('data-yai-tabs-lazy', attributeValue);
                container.removeAttribute('data-yai-tabs');
                container.setAttribute('data-lazy-component', 'true'); // Mark for easy identification
            } else {
                this.rootIndex++;
                // This is a root component
                container.setAttribute('data-root', `r-${this.rootIndex}`); // Mark as root for initialization optimization
            }
        });
    }

    /**
     * Activate lazy components after event registration
     * Converts placeholder attributes back to real ones so YEH delegation works
     */
    _activateLazyComponents() {
        document.querySelectorAll('[data-yai-tabs-lazy]')
            .forEach(container => {
                // Restore original attribute value (usually empty string for boolean attributes)
                const originalValue = container.getAttribute('data-yai-tabs-lazy') || '';
                container.setAttribute('data-yai-tabs', originalValue);
                container.removeAttribute('data-yai-tabs-lazy');
            });
    }

    /**
     * Auto-disambiguate identical data-open/data-tab values across different containers
     * Runs before hash processing to ensure reproducible, deterministic results
     * @param {Element} [scope=document] - Optional scope to limit processing to new content
     */
    _autoDisambiguateIds(scope = document) {
        // For scoped processing, only clear markers within the scope
        if (scope === document) {
            document.querySelectorAll('[data-disambiguated]').forEach(el => {
                el.removeAttribute('data-disambiguated');
            });
        }

        const allContainers = scope.querySelectorAll(this.config.rootSelector);

        // Simple nesting depth calculation - more reliable than path-based
        const containersByDepth = new Map(); // depth -> containers[]

        allContainers.forEach(container => {
            // Calculate nesting depth by counting parent tab containers
            let depth = 0;
            let current = container.parentElement;

            while (current && current !== document.body) {
                const parentTabContainer = current.closest(`${this.config.rootSelector}, [data-yai-tabs-lazy]`);
                if (parentTabContainer && parentTabContainer !== container) {
                    depth++;
                    current = parentTabContainer.parentElement;
                } else {
                    break;
                }
            }

            if (!containersByDepth.has(depth)) {
                containersByDepth.set(depth, []);
            }
            containersByDepth.get(depth).push(container);
        });

        // Process each depth level separately to avoid cross-level conflicts
        containersByDepth.forEach((containers, depth) => {
            const seenIds = new Map(); // Track ID usage within this depth level

            // Collect button-panel pairs within this depth level ONLY
            containers.forEach(container => {
                // Use specific selectors to only find direct children (no nested containers)
                const buttons = container.querySelectorAll(':scope > nav[data-controller] > [data-open]');
                const panels = container.querySelectorAll(':scope > div[data-content] > [data-tab]');

                // Group by ID to keep button-panel pairs together
                const containerPairs = new Map();

                buttons.forEach(button => {
                    const id = button.dataset.open;
                    if (!containerPairs.has(id)) {
                        containerPairs.set(id, { buttons: [], panels: [] });
                    }
                    containerPairs.get(id).buttons.push(button);
                });

                panels.forEach(panel => {
                    const id = panel.dataset.tab;
                    if (!containerPairs.has(id)) {
                        containerPairs.set(id, { buttons: [], panels: [] });
                    }
                    containerPairs.get(id).panels.push(panel);
                });

                // Add pairs to depth-level tracking
                containerPairs.forEach((pair, id) => {
                    if (!seenIds.has(id)) {
                        seenIds.set(id, []);
                    }
                    seenIds.get(id).push({
                        buttons: pair.buttons,
                        panels: pair.panels,
                        container
                    });
                });
            });

            // BRUTE FORCE: Fix ALL IDs in this depth level
            seenIds.forEach((usages, id) => {
                // Sort by container position for consistent alphabetical ordering
                usages.sort((a, b) => containers.indexOf(a.container) - containers.indexOf(b.container));

                usages.forEach((usage, index) => {
                    // Generate safe suffix using base-26 encoding (a-z, aa-zz, aaa-zzz, etc.)
                    let suffix = '';
                    let num = index;

                    do {
                        suffix = String.fromCharCode(97 + (num % 26)) + suffix;
                        num = Math.floor(num / 26) - 1;
                    } while (num >= 0);

                    // Create clean level identifier based on actual depth
                    let levelPrefix;
                    if (depth === 0) {
                        levelPrefix = 'root';
                    } else {
                        levelPrefix = `L${depth}`;
                    }

                    const uniqueId = `${id}${suffix}${levelPrefix}`;

                    // Update ALL buttons and panels in this pair with the SAME unique ID
                    [...usage.buttons, ...usage.panels].forEach(element => {
                        // Skip if already processed (prevents multiple processing)
                        if (element.hasAttribute('data-disambiguated')) {
                            return;
                        }

                        // Store original value for hash routing
                        if (element.dataset.open) {
                            // For buttons: preserve original data-open value
                            element.setAttribute('data-original-id', element.dataset.open);
                            element.setAttribute('data-open', uniqueId);
                        } else {
                            // For panels: preserve original data-tab value
                            element.setAttribute('data-original-id', element.dataset.tab);
                            element.setAttribute('data-tab', uniqueId);
                        }

                        // Mark as processed
                        element.setAttribute('data-disambiguated', 'true');
                    });
                });
            });
        });
    }

    init() {
        this.initializeAllContainers();

        if (!('inert' in HTMLElement.prototype)) {
            console.warn('YaiTabs: `inert` not supported. Hidden panels may be clickable in this browser. Upgrade for full accessibility.');
        }
    }

    /**
     * Unified container initialization system
     * Single DOM scan, complete setup, internal state building
     */
    initializeAllContainers(rootElement = document) {
        // Single DOM scan for all containers using cached query
        const containers = Array.from(this.findAll(this.config.rootSelector, rootElement, {}));
        if (!containers.length) return;

        // Separate root components from nested components for optimized initialization
        const rootContainers = containers.filter(container => container.hasAttribute('data-root'));
        const nestedContainers = containers.filter(container => !container.hasAttribute('data-root'));

        // Full initialization only for root components (they have event listeners)
        const rootInitData = rootContainers.map((container, index) => {
            const containerId = container.id || YaiTabs.generateId('yai-tabs-container');
            if (!container.id) container.id = containerId;

            return {
                container,
                containerId,
                index,
                nestingLevel: this._calculateNestingLevel(container),
                navElement: this.find(':scope > nav[data-controller]', container),
                buttons: Array.from(this.findAll(':scope > nav[data-controller] [data-open]', container)),
                panels: Array.from(this.findAll(':scope > div[data-content] [data-tab]', container)),
                defaultButton: this.find(':scope > nav[data-controller] [data-default]', container),
                isVisible: this._isContainerVisible(container),
                isRoot: true
            };
        });

        // Lightweight initialization for nested components (no event listeners needed)
        const nestedInitData = nestedContainers.map((container, index) => {
            const containerId = container.id || YaiTabs.generateId('yai-tabs-nested');
            if (!container.id) container.id = containerId;

            return {
                container,
                containerId,
                index: rootContainers.length + index, // Continue index from root containers
                nestingLevel: this._calculateNestingLevel(container),
                isRoot: false
            };
        });

        // Process root containers with full initialization
        rootInitData.forEach(data => this._processContainer(data));

        // Process nested containers with lightweight initialization
        nestedInitData.forEach(data => this._processNestedContainer(data));
    }

    /**
     * Process individual container with complete context
     */
    _processContainer(data) {
        const { container, defaultButton, isVisible, index } = data;

        // Set nesting level
        container.setAttribute('data-nesting', data.nestingLevel.toString());

        // Apply default behavior
        if (!container.hasAttribute('data-behavior') && this.config.defaultBehavior) {
            container.setAttribute('data-behavior', this.config.defaultBehavior);
        }

        // Setup complete ARIA accessibility
        if (this.config.autoAccessibility) {
            this._setupCompleteAccessibility(data);
        }

        // Initialize default tab if visible
        if (defaultButton && defaultButton.dataset.open && isVisible) {
            this.openTab(defaultButton, null, container, true);

            // Set initial focus on the first visible container's active tab
            if (this.config.autoFocus && index === 0) {
                this.yaiFocus(defaultButton);
            }
        }
    }

    /**
     * Lightweight initialization for nested components
     * Minimal setup since they rely on root component's event delegation
     */
    _processNestedContainer(data) {
        const { container, defaultButton, isVisible } = data;
        const getInRootContainer = container.closest('[data-root]');

        // Ensure container has an ID before accessibility setup
        if (!container.id) {
            container.id = YaiTabs.generateId('yai-tabs-nested');
        }

        // Set nesting level (essential for proper hierarchy)
        container.setAttribute('data-nesting', data.nestingLevel.toString());

        if (getInRootContainer && getInRootContainer.dataset?.root) {
            container.setAttribute('data-in-root', getInRootContainer.dataset.root);
        }

        if (!container.hasAttribute('data-behavior') && this.config.defaultBehavior) {
            container.setAttribute('data-behavior', this.config.defaultBehavior);
        }

        if (this.config.autoAccessibility) {
            YaiTabs._setupContainerAccessibility(container);
        }

        // Initialize default tab if visible (same logic as _processContainer)
        if (defaultButton && defaultButton.dataset.open && isVisible) {
            this.openTab(defaultButton, null, container, true);
        }
    }

    /**
     * Lazy ARIA orientation detection - only when user interacts with tabs
     * More reliable than initialization-time detection for dynamic content
     */
    _updateAriaOrientation(container) {
        if (!this.config.autoAccessibility) return;

        const nav = this.find(':scope > nav[data-controller]', container);
        if (!nav) return;

        // Check computed CSS layout at interaction time (guaranteed to be accurate)
        const computedStyle = window.getComputedStyle(nav);
        const flexDirection = computedStyle.flexDirection;
        const isVertical = flexDirection === 'column' || flexDirection === 'column-reverse';
        nav.setAttribute('aria-orientation', isVertical ? 'vertical' : 'horizontal');
    }

    /**
     * Universal event proxy - properly routes events to handlers or hooks
     */
    handleEventProxy(event, target, container) {
        if (['keydown', 'hashchange'].includes(event.type)) return;

        const customEvent = this._isCustomEvent(target);
        if (!customEvent) return;

        // 1. Handle tab actions first (open/close) - Core functionality
        const tabAction = target.dataset.tabAction;
        if (tabAction && typeof this[tabAction] === 'function') {
            this._cleanupStaleActiveStates();
            return this[tabAction](target, event, container);
        }

        // 2. Check for event-specific attribute (data-click, data-submit, etc.)
        const action = target.dataset[event.type];

        // Only fire hook if element has the specific event attribute
        if (action) {
            const eventType = event.type.charAt(0).toUpperCase() + event.type.slice(1);
            this._executeHook(`event${eventType}`, {
                event,
                target,
                container,
                action
            }, this);
        }
    }

    /**
     * Check if element has custom event attributes (data-click, data-input, etc.)
     */
    _isCustomEvent(element) {
        return (
            this.events.config.actionableAttributes.some(attr => element.hasAttribute(attr))
            || this.events.config.actionableClasses.some(className => element.classList.contains(className))
        );
    }

    /**
     * Handle hash change events
     */
    handleHashchange() {
        const hashParams = this.parseHash();

        // Sync tabs to hash state
        for (const [refPath, tabId] of Object.entries(hashParams)) {
            const tabContainer = this.$(`${this.config.rootSelector}[data-ref-path="${refPath}"]`);
            if (!tabContainer) continue;

            // Look for button using original ID (before disambiguation) first, then fallback to direct match
            const targetTab = this.find(`[${this.tabOpenAttribute}="${tabId}"]`, tabContainer);
            const currentActive = this.find('.active[data-open]', tabContainer);

            // Only change if different from current active (compare using original IDs)
            const currentOriginalId = currentActive?.getAttribute(this.tabOpenAttribute)|| currentActive?.dataset.open;
            if (targetTab && currentOriginalId !== tabId) {
                this.simulateClick(targetTab);
            }

            this.routeMap.set(refPath, tabId);
        }
    }

    /**
     * Main keydown handler for keyboard events. Attribute-based action
     * handlers are fun, but they have their limitations, for example here.
     */
    handleKeydown(event, target, container) {
        // Only handle specific keys
        if (!['Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
            // Keys not used by YoiTabs
            this.handleEventProxy(event, target, container);
            return;
        }

        // Handle ESC key to go up component levels
        if (event.key === 'Escape') {
            event.preventDefault();

            // Find parent tab container
            const parentTabContainer = container.closest('[data-tab]');
            if (parentTabContainer) {
                const parentContainer = parentTabContainer.closest(`${this.config.rootSelector}`);
                if (parentContainer) {
                    // Focus the active button in parent container
                    const parentActiveButton = this.find(':scope > nav[data-controller] button.active', parentContainer);
                    if (parentActiveButton) {
                        this.yaiFocus(parentActiveButton, false);
                        return;
                    }
                }
            }

            // If no parent, blur current focus (escape to document)
            target.blur();
            return;
        }

        // Only handle arrow keys on tab buttons
        if (!target.dataset.open) return;

        event.preventDefault();

        const buttons = Array.from(this.findAll(':scope > nav[data-controller] [data-open]', container));
        const currentIndex = buttons.indexOf(target);

        // Update orientation lazily before keyboard navigation (guaranteed accurate timing)
        this._updateAriaOrientation(container);

        // Get orientation from tablist
        const nav = this.find(':scope > nav[data-controller]', container);
        const orientation = nav?.getAttribute('aria-orientation') || 'horizontal';

        let nextIndex;
        switch (event.key) {
            case 'ArrowLeft':  if (orientation === 'horizontal') nextIndex = currentIndex > 0 ? currentIndex - 1 : buttons.length - 1; break;
            case 'ArrowRight': if (orientation === 'horizontal') nextIndex = currentIndex < buttons.length - 1 ? currentIndex + 1 : 0; break;
            case 'ArrowUp':    if (orientation === 'vertical')   nextIndex = currentIndex > 0 ? currentIndex - 1 : buttons.length - 1; break;
            case 'ArrowDown':  if (orientation === 'vertical')   nextIndex = currentIndex < buttons.length - 1 ? currentIndex + 1 : 0; break;
            case 'Home':       nextIndex = 0; break;
            case 'End':        nextIndex = buttons.length - 1; break;
        }

        if (nextIndex !== undefined && buttons[nextIndex]) {
            // Automatically activate the tab (following ARIA practices)
            if (container.classList.contains('tab-active')) {
                this.openTab(buttons[nextIndex], event, container);
            }
            this.yaiFocus(buttons[nextIndex], false);
        }
    }

    /**
     * Centralized ARIA state management for container and its nested components
     * Uses inert attribute to prevent interaction with hidden content
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/inert
     * Note: inert has good modern browser support but may need polyfill for older browsers
     */
    _updateAriaStates(container) {
        // Skip ARIA updates if autoAccessibility is disabled
        if (!this.config.autoAccessibility) return;

        // Find all tab containers within this container (including itself)
        const allContainers = [container, ...this.findAll(`${this.config.rootSelector}`, container)];

        allContainers.forEach(tabContainer => {
            // Get the active panel in this container
            const activePanel = this.find(':scope > [data-content] > [data-tab].active', tabContainer);
            const allPanels = this.findAll(':scope > [data-content] > [data-tab]', tabContainer);
            const allButtons = this.findAll(':scope > nav[data-controller] [data-open]', tabContainer);

            // Update panels
            allPanels.forEach(panel => {
                const isActive = panel === activePanel;
                const isParentVisible = this._isElementVisible(panel.closest('[data-tab]') || document.body);

                if (isActive && isParentVisible) {
                    // Active panel in visible container
                    panel.removeAttribute('aria-hidden');
                    panel.setAttribute('tabindex', '0');
                    panel.removeAttribute('inert');

                    // Restore focusability for interactive elements in active panel
                    const disabledElements = this.findAll('button[tabindex="-1"], [href][tabindex="-1"], input[tabindex="-1"], select[tabindex="-1"], textarea[tabindex="-1"]', panel);
                    disabledElements.forEach(element => {
                        // Only restore if not in a hidden nested tab
                        const isInHiddenNestedTab = element.closest('[data-tab][aria-hidden="true"]');
                        if (!isInHiddenNestedTab) {
                            element.removeAttribute('tabindex');
                        }
                    });
                } else {
                    // Double-check: Never hide elements that are active or contain active children
                    const hasActiveChildren = panel.querySelector('.active');
                    const isActuallyActive = panel.classList.contains('active');

                    if (isActuallyActive || hasActiveChildren) {
                        // Element or its children are active - must remain visible
                        panel.removeAttribute('aria-hidden');
                        panel.setAttribute('tabindex', '0');

                        // Restore focusability for interactive elements
                        const disabledElements = this.findAll('button[tabindex="-1"], [href][tabindex="-1"], input[tabindex="-1"], select[tabindex="-1"], textarea[tabindex="-1"]', panel);
                        disabledElements.forEach(element => {
                            const isInHiddenNestedTab = element.closest('[data-tab][aria-hidden="true"]');
                            if (!isInHiddenNestedTab) {
                                element.removeAttribute('tabindex');
                            }
                        });
                    } else {
                        // Truly inactive panel
                        panel.setAttribute('aria-hidden', 'true');
                        panel.setAttribute('tabindex', '-1');
                        panel.setAttribute('inert', '');

                        // Disable focusability for interactive elements in hidden panel
                        const focusableElements = this.findAll('button:not([tabindex="-1"]), [href]:not([tabindex="-1"]), input:not([tabindex="-1"]), select:not([tabindex="-1"]), textarea:not([tabindex="-1"])', panel);
                        focusableElements.forEach(element => {
                            // Only disable if not in an active nested tab
                            const nestedActiveTab = element.closest('[data-tab]:not([aria-hidden="true"])');
                            if (!nestedActiveTab || nestedActiveTab === panel) {
                                element.setAttribute('tabindex', '-1');
                            }
                        });
                    }
                }
            });

            // Check if any button in this container is active (more efficient approach)
            const activeButton = this.find(':scope > nav[data-controller] > button.active', tabContainer);
            const hasActiveButton = !!activeButton;

            // Update buttons
            allButtons.forEach((button, index) => {
                const isActive = button.classList.contains('active');
                const isParentVisible = this._isElementVisible(button.closest('[data-tab]') || document.body);

                button.setAttribute('aria-selected', (isParentVisible && isActive) ? 'true' : 'false');

                if (isParentVisible) {
                    // Button in visible container
                    button.removeAttribute('aria-hidden');
                    // For TAB navigation: active button gets tabindex="0",
                    // or first button if no active button exists
                    const shouldBeFocusable = isActive || (!hasActiveButton && index === 0);
                    button.setAttribute('tabindex', shouldBeFocusable ? '0' : '-1');
                } else {
                    // Button in hidden container
                    button.setAttribute('aria-hidden', 'true');
                    button.setAttribute('tabindex', '-1');
                }
            });
        });
    }

    /**
     * Clean up stale active states from hidden containers
     * Prevents cross-contamination between identical nested structures
     */
    _cleanupStaleActiveStates(container = document) {
        // Find all active elements anywhere in the document
        const scope = container === document ? document : container;
        const allActiveButtons = scope.querySelectorAll(`${this.config.rootSelector} nav[data-controller] button.active[data-open]`);
        const allActivePanels = scope.querySelectorAll(`${this.config.rootSelector} [data-tab].active`);
        // const allActiveButtons = container.querySelectorAll(`${this.config.rootSelector} nav[data-controller] button.active[data-open]`);

        // More comprehensive cleanup - check entire hierarchy chain
        [...allActiveButtons, ...allActivePanels].forEach(element => {
            // Check if this element is in a container that's nested in a hidden panel
            const parentContainer = element.closest(`${this.config.rootSelector}`);
            let currentPanel = parentContainer?.closest('[data-tab]');
            let shouldClean = false;

            // Walk up the hierarchy to find any hidden parent panel
            while (currentPanel) {
                if (!currentPanel.classList.contains('active')) {
                    shouldClean = true;
                    break;
                }
                // Go up one more level
                const nextContainer = currentPanel.closest(`${this.config.rootSelector}`)?.parentElement?.closest(`${this.config.rootSelector}`);
                currentPanel = nextContainer?.closest('[data-tab]');
            }

            if (shouldClean) {
                // Remove stale active state
                element.classList.remove('active');
                element.removeAttribute('inert');

                // Reset ARIA states for cleaned elements (only if autoAccessibility is enabled)
                if (this.config.autoAccessibility) {
                    if (element.matches('[data-open]')) {
                        element.setAttribute('aria-selected', 'false');
                        element.setAttribute('tabindex', '-1');
                    }
                    else if (element.matches('[data-tab]')) {
                        element.setAttribute('aria-hidden', 'true');
                        element.setAttribute('tabindex', '-1');
                        element.setAttribute('inert', '');
                    }
                }
            }
        });
    }

    /**
     * Check if an element is visible (not in a hidden parent)
     */
    _isElementVisible(element) {
        if (!element || element === document.body) return true;

        // Check if this element or any parent has aria-hidden="true"
        let current = element;
        while (current && current !== document.body) {
            if (current.getAttribute('aria-hidden') === 'true') {
                return false;
            }
            current = current.parentElement;
        }
        return true;
    }

    /**
     * Check if a container is visible (either root level or parent is active)
     */
    _isContainerVisible(container) {
        // Find the parent tab panel this container is nested in
        const parentTabPanel = container.closest('[data-tab]');
        if (!parentTabPanel) return true; // Root level, always visible

        // Check if parent panel is active
        return parentTabPanel.classList.contains('active');
    }

    /**
     * Safe focus management - removes focus from hidden elements
     */
    _manageFocusForHiddenElements(container) {
        if (!this.config.autoAccessibility) return;

        const hiddenElements = this.findAll('[aria-hidden="true"]', container);

        hiddenElements.forEach(hidden => {
            if (hidden.contains(document.activeElement)) {
                // Move focus to nearest visible tab button
                const visibleTabButton = this.find(
                    ':scope > nav[data-controller] button:not([aria-hidden])',
                    container.closest(`${this.config.rootSelector}`)
                );
                if (visibleTabButton) {
                    this.yaiFocus(visibleTabButton);
                } else {
                    document.activeElement.blur();
                }
            }
        });
    }

    /**
     * Complete ARIA setup for TABS using pre-calculated data
     */
    _setupCompleteAccessibility(data) {
        const { navElement, buttons, panels, container } = data;
        // Use the container's ID as the prefix to ensure consistency
        const containerPrefix = container.id || YaiTabs.generateId('yai-tabs');

        // Setup nav element
        if (navElement) {
            navElement.setAttribute('role', 'tablist');

            if (!navElement.hasAttribute('aria-label') && !navElement.hasAttribute('aria-labelledby')) {
                navElement.setAttribute('aria-label', 'Tab navigation');
            }
        }

        // Setup buttons
        buttons.forEach((button, index) => {
            const tabId = button.dataset.open;
            // Only set data-original-id if not already set (preserve auto-disambiguation values)
            if (button.id && !button.hasAttribute('data-original-id')) {
                button.setAttribute('data-original-id', button.id);
            }

            button.id = `${containerPrefix}-tab-${tabId}`;
            button.setAttribute('role', 'tab');
            button.setAttribute('aria-selected', 'false');
            button.setAttribute('aria-controls', `${containerPrefix}-panel-${tabId}`);
            button.setAttribute('tabindex', index === 0 ? '0' : '-1');
        });

        // Setup panels
        panels.forEach(panel => {
            const tabId = panel.dataset.tab;
            // Only set data-original-id if not already set (preserve auto-disambiguation values)
            if (panel.id && !panel.hasAttribute('data-original-id')) {
                panel.setAttribute('data-original-id', panel.id);
            }

            panel.id = `${containerPrefix}-panel-${tabId}`;
            panel.setAttribute('role', 'tabpanel');
            panel.setAttribute('aria-labelledby', `${containerPrefix}-tab-${tabId}`);
            panel.setAttribute('aria-hidden', 'true');
            panel.setAttribute('tabindex', '-1');
        });
    }

    /**
     * Set class to targeted element
     */
    _markRootContainer(element, add = true, marker = null) {
        const fn = add ? 'add' : 'remove';
        element.classList[fn](marker || 'tab-active');
    }

    /**
     * Short open- cloase tab handler
     */
    close(...args) { this.closeTab(...args) }
    open(...args) { this.openTab(...args) }

    /**
     * Attribute/Alias handlers, can be used with both.
     */
    closeTab(target, _event, container) {
        if (!this.config.closable) return;
        this.yaiEmit('tabClosing', { target, _event, container });

        this._removeActive(target, container);
        this._removeLastActiveTab(container);
        this._cleanupSiblingContainers(container);

        // Update hash routing after closing
        const refPath = container.dataset.refPath;
        if (refPath) {
            // Check if any tab is still active after close (exclude the button being closed)
            const stillActive = this.find(':scope > nav[data-controller] button.active[data-open]', container);

            // Ensure we're not looking at the button being closed (it may still have .active due to animation delay)
            if (stillActive && stillActive !== target) {
                // Update to the still-active tab using original ID for hash routing
                const originalId = stillActive.getAttribute(this.tabOpenAttribute) || stillActive.dataset.open;
                this.routeMap.set(refPath, originalId);
                this.updateHash(container);
            } else {
                // No active tab left, remove from hash AND clean up nested entries
                this.routeMap.delete(refPath);
                this._cleanupNestedHashEntries(container);
                this.updateHash(container);
            }
        }
    }

    openTab(target, event, container, isDefaultInitialization = false) {
        if (target.classList.contains('active')) {
            if (this.config.closable) {
                this.closeTab(target, event, container);
            }
            return;
        }

        // Update ARIA orientation lazily when user interacts (guaranteed accurate timing)
        this._updateAriaOrientation(container);

        // Set processing state
        this._setProcessingState(container, true);
        this._preserveContentHeight(container);
        target.removeAttribute('data-default');

        const tabId = target.dataset.open;
        const content = this.find(`:scope > [data-content] > [data-tab="${tabId}"]`, container);

        this.yaiEmit('tabOpening', { target, event, container, id: tabId }, container);

        if (content) {
            this._removeActive(target, container);

            // Update button states
            if (this.config.autoAccessibility) {
                this.findAll(':scope > nav[data-controller] [data-open]', container).forEach(btn => {
                    btn.setAttribute('aria-selected', 'false');
                    btn.setAttribute('tabindex', '-1');
                });
                target.setAttribute('aria-selected', 'true');
                target.setAttribute('tabindex', '0'); // Active button is focusable
            }

            target.classList.add('active');
            content.classList.add('active');

            // Set opened tab as default for its component
            this._setLastActiveTab(container);

            if (this.config.autoAccessibility) {
                content.removeAttribute('aria-hidden'); // Make visible to screen readers
                content.setAttribute('tabindex', '0'); // Restore tab navigation
            }

            // Update ARIA states for all nested components after DOM changes are complete
            this._updateAriaStates(container);

            // Restore user's previous navigation state within this content
            this._restoreNavigationState(content);

            // Initialize nested default tabs now that this content is visible
            this._initializeNestedDefaults(content);

            // Optional: Move focus to panel for screen readers (only on Enter/Space, NOT arrow keys)
            if (event && (event.key === 'Enter' || event.key === ' ')) {
                this.yaiFocus(content);
            }

            this._markRootContainer(container, true);

            // Clear processing state after animation completes
            setTimeout(() => {
                this._setProcessingState(container, false);
            }, 80); // Match animation duration

            // Load dynamic content if data-url is specified
            if (target.dataset.url) {
                if (this._validateUrl(target.dataset.url)) {
                    const append = target.dataset.append === 'true';
                    content.classList.remove('active');
                    this._loadContent(target.dataset.url, `:scope > div[data-content] > [data-tab="${tabId}"]`, container, append, target);
                } else {
                    // URL validation failed - treat as static content
                    console.error('YaiTabs: Dynamic content loading blocked due to invalid URL:', target.dataset.url);
                    this._executeHook('contentReady', { content, target, container });
                    this._resetContentHeight(container);
                }
            }

            // Clean up sibling branch parameters when switching at same level (always, not just for ref-path containers)
            if (!isDefaultInitialization) {
                this._cleanupSiblingContainers(container);
                // Update hash immediately after cleanup to remove stale parameters
                this.updateHash(container);
            }

            // Emit tab ready event after tab is fully active (for breadcrumbs, analytics, etc.)
            // This fires for ALL tab activations: user clicks, defaults, hash routing
            setTimeout(() => {
                if (!target.dataset.url) {
                    // For static content, manually trigger contentReady hook
                    this._executeHook('contentReady', { content, target, container });
                    this._resetContentHeight(container);
                }
                // Verify tab is still active (avoid race conditions)
                if (target.classList.contains('active') && content.classList.contains('active')) {
                    this.yaiEmit('tabReady', {
                        container,
                        target,
                        content,
                        id: tabId,
                        refPath: container.dataset.refPath,
                        isVisible: this._isElementVisible(container),
                        isDefaultInit: isDefaultInitialization,
                    });
                }
            }, 20); // Small delay to ensure DOM updates complete

            // Update hash routing if container has ref-path (skip for default initialization)
            const refPath = container.dataset.refPath;
            if (refPath && !isDefaultInitialization) {
                // Use original ID for hash routing (before disambiguation)
                const originalTabId = target.dataset.originalId || tabId;
                this.routeMap.set(refPath, originalTabId);
                this.updateHash(container);
            }
        }
    }

    updateHash(container = null, forceReplace = false) {
        if (this.routeMap && this.routeMap.size > 1) {
            const sortedEntries = this._sortRouteEntries(this.routeMap);
            if (sortedEntries) {
                this.routeMap = new Map(sortedEntries);
            }
        }
        return super.updateHash(container, forceReplace);
    }

    _sortRouteEntries(routeMap) {
        const entries = Array.from(routeMap.entries());
        if (!entries.length) return null;

        const withMeta = entries.map(([refPath, tabId]) => {
            const meta = this._getRouteMeta(refPath);
            return {
                refPath,
                tabId,
                depth: meta.depth,
                domOrder: meta.domOrder
            };
        });

        withMeta.sort((a, b) => {
            if (a.depth !== b.depth) return a.depth - b.depth;
            if (a.domOrder !== b.domOrder) return a.domOrder - b.domOrder;
            return a.refPath.localeCompare(b.refPath);
        });

        return withMeta.map(({ refPath, tabId }) => [refPath, tabId]);
    }

    _getRouteMeta(refPath) {
        const fallback = { depth: Number.MAX_SAFE_INTEGER, domOrder: Number.MAX_SAFE_INTEGER };
        if (!refPath) return fallback;

        const container = this.$(`${this.config.rootSelector}[data-ref-path="${refPath}"]`);
        if (!container) return fallback;

        const depthAttr = container.getAttribute('data-nesting');
        const depth = Number.isFinite(parseInt(depthAttr, 10))
            ? parseInt(depthAttr, 10)
            : (typeof this._calculateNestingLevel === 'function'
                ? this._calculateNestingLevel(container)
                : fallback.depth);

        const domOrder = this._getDomOrder(container);

        return {
            depth,
            domOrder
        };
    }

    _getDomOrder(element) {
        if (!element || !element.parentNode) return Number.MAX_SAFE_INTEGER;
        const children = Array.from(element.parentNode.children);
        const index = children.indexOf(element);
        return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
    }

    /**
     * YaiTabs-specific loading state management
     * Adds tab-specific loading indicators to both container and trigger button
     * @param {Element} container - The content container
     * @param {boolean} isLoading - Whether to show loading state
     * @param {Element} target - The tab button that triggered the loading
     */
    toggleLoading(container, isLoading = true, target = null) {
        // Find the tab component container (data-yai-tabs)
        const tabContainer = container.closest(`${this.config.rootSelector}`);
        if (!tabContainer) return;

        // Get ALL navigation buttons in this tab component
        const allNavButtons = this.findAll(':scope > nav[data-controller] [data-open]', tabContainer);

        if (isLoading) {
            // Add loading state to container
            if (this.config.autoAccessibility) {
                container.setAttribute('aria-busy', 'true');
            }
            container.parentNode.classList.add(this.config.selectors.isLoading);
            allNavButtons.forEach(button => {
                // Only disable if not already disabled (preserve app-level disabled state)
                if (!button.hasAttribute('disabled')) {
                    button.setAttribute('disabled', 'true');
                    button.setAttribute('data-loading-disabled', ''); // Mark that WE disabled it
                }
                if (button === target) {
                    button.classList.add(this.config.selectors.isLoading);
                }
            });
        } else {
            // Remove loading state from container
            if (this.config.autoAccessibility) {
                container.removeAttribute('aria-busy');
            }
            container.parentNode.classList.remove(this.config.selectors.isLoading);
            allNavButtons.forEach(button => {
                // Only re-enable if WE disabled it (check our marker)
                if (button.hasAttribute('data-loading-disabled')) {
                    button.removeAttribute('disabled');
                    button.removeAttribute('data-loading-disabled');
                }
                button.classList.remove(this.config.selectors.isLoading);
            });
        }
    }

    /**
     * ARIA cleanup
     */

    _cleanupSiblingContainers(container) {
        // To get the correect parent, we can use nesting, but like the following:
        let currentNestDepth = parseInt(container.dataset.nesting || container.offsetParent?.dataset?.nesting || 0, 10);
        currentNestDepth = currentNestDepth - 1 >= 0 ? currentNestDepth - 1 : 0;

        const parent = container.closest(`${this.config.rootSelector}[data-nesting="${currentNestDepth}"]`);
        if (!parent) return;

        const siblingContainers = parent.querySelectorAll(`:scope > [data-content] > [data-tab] > ${this.config.rootSelector}`);
        siblingContainers.forEach(sibling => {
            if (sibling !== container) {
                // Clean up nested branches in inactive siblings
                this._cleanupSiblingBranchParameters(sibling);
            }
        });
    }

    /**
     * Clean up hash parameters from sibling branches when switching tabs at same level
     * This prevents hash pollution from hidden parallel branches
     * @param {Element} container - The container that's being switched to
     */
    _cleanupSiblingBranchParameters(container) {
        // Preserve current navigation state before stripping active classes
        this._preserveNavigationState(container);

        const allPanels = container.querySelectorAll(':scope > div[data-content] > [data-tab]');
        const activePanel = container.querySelector(':scope > div[data-content] > [data-tab].active');

        allPanels.forEach(panel => {
            if (panel !== activePanel) {
                // Remove lingering active state so reactivation can replay reliably
                if (panel.classList.contains('active')) {
                    panel.classList.remove('active');
                }

                // Reset matching navigation button
                const relatedButton = container.querySelector(`:scope > nav[data-controller] [data-open="${panel.dataset.tab}"]`);
                if (relatedButton && relatedButton.classList.contains('active')) {
                    relatedButton.classList.remove('active');
                    if (this.config.autoAccessibility) {
                        relatedButton.setAttribute('aria-selected', 'false');
                        relatedButton.setAttribute('tabindex', '-1');
                    }
                }

                if (panel.getAttribute('tabindex') !== '-1') {
                    panel.setAttribute('tabindex', '-1');
                }
                if (panel.getAttribute('aria-hidden') !== 'true') {
                    panel.setAttribute('aria-hidden', 'true');
                }
                if (panel.getAttribute('inert') !== '') {
                    panel.setAttribute('inert', '');
                }
            }
        });

        // Clean up NESTED branches in inactive panels
        allPanels.forEach(panel => {
            if (panel === activePanel) return;
            const nestedContainers = panel.querySelectorAll(`${this.config.rootSelector}[data-ref-path]`);

            nestedContainers.forEach(nestedContainer => {
                const nestedRefPath = nestedContainer.dataset.refPath;
                if (nestedRefPath && this.routeMap.has(nestedRefPath)) {
                    this.routeMap.delete(nestedRefPath);
                    nestedContainer.classList.remove('tab-active');
                    this._cleanupNestedHashEntries(nestedContainer);
                }
            });
        });

        // Ensure active panel is properly exposed
        if (activePanel) {
            activePanel.removeAttribute('aria-hidden');
            activePanel.setAttribute('tabindex', '0');
            activePanel.removeAttribute('inert');
        }
    }


    /**
     * Clean up hash entries for nested tab containers when parent closes
     * @param {Element} parentContainer - The parent container that's being closed
     * @param {number} depth - Current recursion depth (internal parameter)
     * @param {Set} visited - Set of visited containers to prevent circular references
     */
    _cleanupNestedHashEntries(parentContainer, depth = 0, visited = new Set()) {
        // Prevent infinite recursion - max depth of 50 levels should be more than enough
        if (depth > 50) {
            console.warn('YaiTabs: Maximum recursion depth reached in _cleanupNestedHashEntries');
            return;
        }

        // Prevent circular references
        if (visited.has(parentContainer)) {
            console.warn('YaiTabs: Circular reference detected in _cleanupNestedHashEntries');
            return;
        }
        visited.add(parentContainer);

        // Preserve navigation state before cleanup
        this._preserveNavigationState(parentContainer);

        // Find all nested tab containers within this parent
        const nestedContainers = this.findAll(`${this.config.rootSelector}[data-ref-path]`, parentContainer);

        nestedContainers.forEach(nestedContainer => {
            const nestedRefPath = nestedContainer.dataset.refPath;
            if (nestedRefPath && this.routeMap.has(nestedRefPath)) {
                // Remove nested container's hash entry
                this.routeMap.delete(nestedRefPath);
                // Remove tab-active class from hidden container so placeholder shows
                nestedContainer.classList.remove('tab-active');

                // CRITICAL FIX: Clear .active classes from buttons and panels
                // so _initializeNestedDefaults will re-trigger them when returning
                const activeButtons = nestedContainer.querySelectorAll(':scope > nav[data-controller] [data-open].active');
                const activePanels = nestedContainer.querySelectorAll(':scope > [data-content] > [data-tab].active');

                activeButtons.forEach(btn => {
                    btn.classList.remove('active');
                    if (this.config.autoAccessibility) {
                        btn.setAttribute('aria-selected', 'false');
                        btn.setAttribute('tabindex', '-1');
                    }
                });

                activePanels.forEach(panel => {
                    panel.classList.remove('active');
                    if (this.config.autoAccessibility) {
                        panel.setAttribute('aria-hidden', 'true');
                        panel.setAttribute('tabindex', '-1');
                    }
                });

                // Recursively clean up any deeper nested containers with depth tracking
                this._cleanupNestedHashEntries(nestedContainer, depth + 1, visited);
            }
        });
    }

    /**
     * Process hash before initialization to override data-default attributes
     */
    processHashBeforeInit() {
        const hashParams = this.parseHash();

        // Remove data-default attributes only from containers that participate in hash routing
        Object.keys(hashParams).forEach(refPath => {
            const container = this.$(`${this.config.rootSelector}[data-ref-path="${refPath}"]`);
            if (container) {
                const defaultElements = container.querySelectorAll('[data-default]');
                defaultElements.forEach(element => {
                    element.removeAttribute('data-default');
                });
            }
        });

        for (const [refPath, tabId] of Object.entries(hashParams)) {
            const container = this.$(`${this.config.rootSelector}[data-ref-path="${refPath}"]`);
            if (!container) continue;

            // Set hash target as new default (data-default attributes already cleared above)
            const hashTarget = this.find(`button[${this.tabOpenAttribute}="${tabId}"]`, container);
            if (hashTarget) {
                hashTarget.setAttribute('data-default', '');
                this.routeMap.set(refPath, tabId);
            }
        }
    }

    _setLastActiveTab(container) {
        const getTabWrapper = container.matches(this.config.rootSelector) ? container : container.closest(`${this.config.rootSelector}`);
        const activeButton = getTabWrapper.querySelector(':scope > nav[data-controller] [data-open].active');
        if (activeButton) {
            getTabWrapper.dataset.lastActive = activeButton.dataset.open;
        }
    }

    /**
     * Preserve user's navigation state by marking active elements with data-temp-default
     * Each level can only have one data-temp-default element (one active tab per container)
     * @param {Element} container to preserve state within
     */
    _removeLastActiveTab(container) {
        if (!container.matches(this.config.rootSelector)) {
            container = container.closest(this.config.rootSelector);
        }

        if (container && typeof container.dataset.lastActive !== 'undefined') {
            const getLastId = container.getAttribute('data-last-active');
            container.removeAttribute('data-last-active');
            this._executeHook('lastActiveClosed', { id: getLastId, container });
        }
    }

    /**
     * Preserve user's navigation state by marking active elements with data-temp-default
     * Each level can only have one data-temp-default element (one active tab per container)
     * @param {Element} containerOrPanel - Container or panel to preserve state within
     */
    _preserveNavigationState(containerOrPanel) {
        this._setLastActiveTab(containerOrPanel)
    }

    /**
     * Restore user's navigation state by initializing containers in correct dependency order
     * @param {Element} content - The panel content that just became visible
     */
    _restoreNavigationState(content) {
        // 1. First, process all root-level containers within this content
        const rootContainers = this._getRootContainers(content);
        rootContainers.forEach(container => {
            this._initializeNestedDefaults(container);
        });

        // 2. Then process nested containers in dependency order (shallowest first)
        const nestedContainers = this._getNestedContainersInOrder(content);
        nestedContainers.forEach(container => {
            this._initializeNestedDefaults(container);
        });
    }

    /**
     * Get root containers within a specific scope
     * @param {Element} scope - The scope to search within
     * @returns {NodeList} Root containers with data-last-active attribute
     */
    _getRootContainers(scope) {
        return scope.querySelectorAll(`${this.config.rootSelector}[data-last-active]`);
    }

    /**
     * Check if a container is a root container
     * @param {Element} container - The container to check
     * @returns {boolean} True if it's a root container
     */
    _isRootContainer(container) {
        const hasRootAttr = container.hasAttribute('data-root');
        const nestingLevel = parseInt(container.dataset.nesting || '0', 10);
        return hasRootAttr && nestingLevel === 0;
    }

    /**
     * Get nested containers in proper dependency order (shallowest first)
     * @param {Element} scope - The scope to search within
     * @returns {Array} Nested containers sorted by DOM depth
     */
    _getNestedContainersInOrder(scope) {
        // Find all nested containers within the scope
        const nestedContainers = Array.from(scope.querySelectorAll(`${this.config.rootSelector}`))
            .filter(container => !this._isRootContainer(container) && container.hasAttribute('data-last-active'));

        // Sort by DOM depth (shallowest first) to ensure parent containers are processed before their children
        return nestedContainers.sort((a, b) => this._getDOMDepth(a) - this._getDOMDepth(b));
    }

    /**
     * Calculate DOM depth of an element
     * @param {Element} element - The element to calculate depth for
     * @returns {number} The depth level
     */
    _getDOMDepth(element) {
        let depth = 0;
        let current = element;
        while (current.parentElement && current.parentElement !== document.body) {
            depth++;
            current = current.parentElement;
        }
        return depth;
    }

    /**
     * Active tabs are marked with a configurable css class.
     * This method removes all relevant `.active` classes in a container.
     */
    _removeActive(target, container, selectors = ['[data-open]', '[data-tab]']) {
        const selectorButton = [ selectors[0] || '[data-open]', selectors[1] || '[data-tab]' ]

        // Use :scope to target direct children within THIS container's elements
        const elements = [
            this.find(`:scope > nav[data-controller] > button.active${selectorButton[0]}`, container),
            this.find(`:scope > div[data-content] > .active${selectorButton[1]}`, container),
        ];

        elements.forEach((el, index) => {
            if (!el) return;

            // For closing tabs, trigger exit animation first
            const isClosing = target.classList.contains('active');

            if (isClosing) {
                // Remove active and exit classes after animation completes
                setTimeout(() => {
                    // Always remove active class when closing
                    el.classList.remove('active');

                    // Handle focus and ARIA after visual state changes complete
                    this._manageFocusForHiddenElements(container);
                    this._updateAriaStates(container);
                }, 50);
            } else {
                // Normal tab switching - immediate removal
                el.classList.remove('active');

                // Handle focus and ARIA after visual state changes
                this._manageFocusForHiddenElements(container);
                this._updateAriaStates(container);
            }

            if (typeof el.dataset.default !== 'undefined') {
                el.removeAttribute('data-default');
            }

            // Remove container marker (tab-active)
            this._markRootContainer(container, false);

            if (this.config.autoAccessibility) {
                YaiTabs._clearInteractiveState(el, isClosing);
            }

            if (elements.length === index+1) {
                const id = el.dataset.tab || el.dataset.open;
                this.yaiEmit('tabClosed', { id, container });
            }
        });
    }

    /**
     * Initialize nested default tabs when their parent becomes active
     * Priority: data-last-active (user state) > data-default > nothing
     * Processes only DIRECT children to avoid cascade issues
     */
    _initializeNestedDefaults(content) {
        // Find ALL nested containers within this content panel
        const nestedContainers = this.findAll(`${this.config.rootSelector}`, content);

        nestedContainers.forEach(container => {
            // Check if container has data-last-active attribute (user state has priority)
            const lastActiveId = container.dataset.lastActive;
            let targetButton = null;

            if (lastActiveId) {
                // Find button with matching data-open value
                targetButton = this.find(`nav[data-controller] [data-open="${lastActiveId}"]`, container);
            }

            // If no last-active state, look for data-default button
            if (!targetButton) {
                targetButton = this.find('nav[data-controller] [data-default]', container);
            }

            // Only activate if we found a button (don't activate first button if nothing is set)
            if (targetButton && targetButton.dataset.open) {
                // Check if BUTTON is actually active (button state is the source of truth)
                if (!targetButton.classList.contains('active')) {
                    targetButton.removeAttribute('data-default');
                    this.simulateClick(targetButton);
                }
            }
        });
    }

    static _setupContainerAccessibility(container) {
        // Ensure we ALWAYS use the container's existing ID
        if (!container.id) {
            container.id = YaiTabs.generateId('yai-tabs-static');
        }
        const containerPrefix = container.id;

        // Find the nav element and set tablist role on it (correct ARIA pattern)
        const nav = container.querySelector(':scope > nav[data-controller]');
        if (nav) {
            nav.setAttribute('role', 'tablist');

            // Add aria-label if not already present
            if (!nav.hasAttribute('aria-label') && !nav.hasAttribute('aria-labelledby')) {
                nav.setAttribute('aria-label', 'Tab navigation');
            }
        }

        // Setup buttons with forced safe IDs
        const buttons = container.querySelectorAll(':scope > nav[data-controller] [data-open]');
        buttons.forEach((button, index) => {
            // Only set data-original-id if not already set (preserve auto-disambiguation values)
            if (button.id && !button.hasAttribute('data-original-id')) {
                button.setAttribute('data-original-id', button.id);
            }

            const tabId = button.dataset.open;

            // Always set our controlled ID
            button.id = `${containerPrefix}-tab-${tabId}`;
            button.setAttribute('type', 'button');
            button.setAttribute('role', 'tab');
            button.setAttribute('aria-selected', 'false');
            button.setAttribute('aria-controls', `${containerPrefix}-panel-${tabId}`);
            button.setAttribute('tabindex', index === 0 ? '0' : '-1'); // First tab is focusable by default
        });

        // Setup panels with forced safe IDs
        const panels = container.querySelectorAll(':scope > div[data-content] [data-tab]');
        panels.forEach(panel => {
            // Only set data-original-id if not already set (preserve auto-disambiguation values)
            if (panel.id && !panel.hasAttribute('data-original-id')) {
                panel.setAttribute('data-original-id', panel.id);
            }

            const tabId = panel.dataset.tab;

            panel.id = `${containerPrefix}-panel-${tabId}`;
            panel.setAttribute('role', 'tabpanel');
            panel.setAttribute('aria-labelledby', `${containerPrefix}-tab-${tabId}`);
            panel.setAttribute('aria-hidden', 'true'); // All panels start hidden from screen readers
            panel.setAttribute('tabindex', '-1'); // Not focusable when hidden
        });
    }

    static _clearInteractiveState(element, isClosing = false) {
        // Only clear dynamic states, keep ARIA roles and relationships intact
        if (element.matches('[data-open]')) {
            // Tab button - only clear interactive state
            element.setAttribute('aria-selected', 'false');

            // For closing tabs, keep them focusable to maintain roving tabindex
            if (isClosing) {
                element.setAttribute('tabindex', '0'); // Closed tab remains focusable
                element.classList.remove('active');
            } else {
                element.setAttribute('tabindex', '-1');
            }
        }

        if (element.matches('[data-tab]')) {
            // Tab panel - only clear interactive state
            element.setAttribute('aria-hidden', 'true');
            element.setAttribute('tabindex', '-1');
        }
    }

    /**
     * Override YaiCore post-processing to initialize nested tab components
     * Uses unified initialization system for consistent setup
     */
    _postProcessContent(container) {
        // Call parent method for basic post-processing
        super._postProcessContent(container);

        // Auto-disambiguate any new tab containers within the provided scope
        if (this.config.autoDisambiguate) {
            this._autoDisambiguateIds(container);
        }

        // Use unified initialization for any dynamically loaded containers
        this.initializeAllContainers(container);

        // // Activate any data-default buttons in the dynamically loaded content
        this._activateDefaultTabs(container);
    }

    /**
     * Activate data-default buttons in dynamically loaded content
     * @param {Element} container - The container element that holds the new tab content
     */
    _activateDefaultTabs(container) {
        // Find all data-default buttons within the provided scope that aren't active yet
        const defaultButtons = container.querySelectorAll('[data-content] button[data-default]:not(.active)');
        // Small delay to ensure DOM is settled after initialization
        setTimeout(() => {
            defaultButtons.forEach(button => {
                if (!button.classList.contains('active')) {
                    this.simulateClick(button);
                }
            });
        }, 20);
    }

    /**
     * Get route data for a given data-ref-path
     *
     * @param {string} targetRef - The ref-path to find (e.g., "lvl-2-tabs-repeat")
     * @param {Element} [containerElement=document] - Root element to search within
     * @returns {Object} Path data with parents, target, and reconstruction info
     */
    static getRefPath(targetRef, containerElement = document) {
        if (!targetRef) {
            return { parents: [], target: null, fullPath: [], error: 'No target reference provided' };
        }

        // Find the target tab container with the specified ref-path
        const targetContainer = containerElement.querySelector(`[data-yai-tabs][data-ref-path="${targetRef}"]`);
        if (!targetContainer) {
            return { parents: [], target: null, fullPath: [], error: `Target ref-path "${targetRef}" not found` };
        }

        const pathChain = [];
        let currentElement = targetContainer;

        // Walk up the DOM to find parent tab containers
        while (currentElement) {
            // Find the tab panel that contains this container
            const parentTabPanel = currentElement.closest('[data-tab]');
            if (!parentTabPanel) break;

            // Find the tab container that owns this panel
            const parentTabContainer = parentTabPanel.closest(`[data-yai-tabs]`);
            if (!parentTabContainer) break;

            // Get the ref-path of the parent container
            const parentRefPath = parentTabContainer.dataset.refPath;
            if (parentRefPath) {
                pathChain.unshift(parentRefPath); // Add to beginning for correct order
            }

            // Move up: start from the parent tab panel, then look for the next level up
            currentElement = parentTabPanel.parentElement?.closest(`[data-yai-tabs]`);
        }

        return {
            parents: pathChain,
            target: targetRef,
            fullPath: [...pathChain, targetRef],
            container: targetContainer
        };
    }

    /**
     * Reconstruct full URL hash from a target ref-path
     *
     * @param {string} targetRef - The ref-path to build URL for
     * @param {string|number} [targetValue] - The value for the target tab (if not provided, uses default/first button)
     * @param {Element} [containerElement=document] - Root element to search within
     * @returns {string} Complete URL hash (e.g., "#main-tabs=3&lvl-1-tabs=4&lvl-2-tabs-repeat=2")
     */
    static reconstructUrlFromRef(targetRef, targetValue, containerElement = document) {
        // Handle parameter overloading: (targetRef, containerElement)
        if (targetValue && typeof targetValue === 'object' && targetValue.nodeType) {
            containerElement = targetValue;
            targetValue = undefined;
        }

        // Cache key based on parameters
        const cacheKey = `${targetRef}|${targetValue || 'default'}|${containerElement === document ? 'document' : 'custom'}`;

        // Initialize cache if it doesn't exist
        if (!YaiTabs._urlReconstructionCache) {
            YaiTabs._urlReconstructionCache = new Map();
        }

        // Return cached result if available
        if (YaiTabs._urlReconstructionCache.has(cacheKey)) {
            return YaiTabs._urlReconstructionCache.get(cacheKey);
        }
        const pathData = YaiTabs.getRefPath(targetRef, containerElement);

        if (pathData.error) {
            console.warn(`YaiTabs.reconstructUrlFromRef: ${pathData.error}`);
            return '';
        }

        // Start from the target and work backwards to find which tabs contain it
        const urlParts = [];
        let currentContainer = pathData.container;

        // Process from deepest (target) to shallowest (root)
        for (let i = pathData.fullPath.length - 1; i >= 0; i--) {
            const refPath = pathData.fullPath[i];

            if (i === pathData.fullPath.length - 1) {
                // For the target itself, use provided value or find default/first available
                let finalTargetValue;
                if (targetValue !== undefined) {
                    finalTargetValue = targetValue;
                } else {
                    const defaultButton = currentContainer.querySelector(':scope > nav[data-controller] [data-default]');
                    const firstButton = currentContainer.querySelector(':scope > nav[data-controller] button[data-open]');
                    finalTargetValue = defaultButton?.dataset.originalId || firstButton?.dataset.originalId ||
                                     defaultButton?.dataset.open || firstButton?.dataset.open || '1';
                }
                urlParts.unshift(`${refPath}=${finalTargetValue}`);
            } else {
                // For parent containers, find which tab contains the current container
                const parentContainer = containerElement.querySelector(`[data-yai-tabs][data-ref-path="${refPath}"]`);
                if (!parentContainer) {
                    urlParts.unshift(`${refPath}=1`);
                    continue;
                }

                // Find which tab panel contains our current container
                const allTabPanels = parentContainer.querySelectorAll(':scope > div[data-content] > [data-tab]');
                let containingTabValue = '1'; // default

                for (const panel of allTabPanels) {
                    if (panel.contains(currentContainer)) {
                        // For panels, we want the data-tab value, which corresponds to the URL routing
                        // Find the corresponding button to get its original data-open value
                        const tabValue = panel.dataset.tab;
                        const correspondingButton = parentContainer.querySelector(
                            `:scope > nav[data-controller] button[data-open="${tabValue}"]`
                        );
                        // Use the button's original data-open value (preserved in data-original-id)
                        containingTabValue = correspondingButton?.dataset.originalId || tabValue;
                        break;
                    }
                }

                urlParts.unshift(`${refPath}=${containingTabValue}`);
                currentContainer = parentContainer;
            }
        }

        const result = urlParts.length > 0 ? '#' + urlParts.join('&') : '';

        // Cache the result for future calls
        YaiTabs._urlReconstructionCache.set(cacheKey, result);

        return result;
    }
}

export {YaiTabs};
export default YaiTabs;
