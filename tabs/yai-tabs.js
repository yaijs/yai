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
            autoFocus: true,                 /** @var bool Automatically focus the first container's active tab on init */
            autoAccessibility: true,         /** @var bool Enable comprehensive ARIA accessibility setup */
            autoDisambiguate: false,         /** @var bool Automatically make identical data-open/data-tab values unique to prevent cross-contamination */
            lazyNestedComponents: true,      /** @var bool On init, marks nested tab components as laty "data-yai-tabs-lazy" */
            autoFocusNested: true,          /** @var bool Auto-focus first focusable in nested active tabs */
            maxNestedReconstruction: 150,     /** @var int Maximum nested components to reconstruct (prevents freeze with deep nesting) */
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
            },

            // Extend base emitable events with YaiTabs-specific ones
            // Base events are automatically merged from YaiCore.getBaseEmitableEvents()
            dispatchName: 'yai.tabs', // prefix for emitables
            emitable: {
                tabs:         'tabs',
                tabClicked:   'tabClicked',
                tabOpening:   'tabOpening',
                tabOpened:    'tabOpened',
                tabSwitched:  'tabSwitched',
                tabSwitching: 'tabSwitching',
                tabReady:     'tabReady',
                tabClosing:   'tabClosing',
                tabClosed:    'tabClosed',
                nested:       'nested',
            },

            // Event hooks. Leveraging YEHs event delegation via hooks
            eventHook: {
                events: ['click', 'keydown'] // ['click', 'keydown', 'input', 'change', 'submit', 'blur', 'focus']
            },
        };

        super(YaiCore.deepMerge(tabsConfig, customConfig));

        this.tabOpenAttribute = this.config.autoDisambiguate ? 'data-original-id' : 'data-open';
        this.tabTabAttribute = this.config.autoDisambiguate ? 'data-original-id' : 'data-tab';
        this.rootIndex = 0;

        // Mark root containers
        this._markRootContainers();

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

        this.handleHooks();

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
            this._executeHook('afterInit', { context: this }, this);
        }, 50);
    }

    /**
     * Auto handled hooks
     */
    handleHooks() {
        // Set up loading hooks
        this.hook('contentLoading', ({ container, isLoading, target }) => {
            this.toggleLoading(container, isLoading, target);
        })
        .hook('contentLoaded', ({ container, isLoading, target }) => {
            this.toggleLoading(container, isLoading, target);
        })
        .hook('removingActiveContent', ({ button, content }) => {
            if (typeof button.dataset.urlRefresh !== 'undefined' && content) {
                setTimeout(() => { content.innerHTML = '' }, 250);
            }
        })
        .hook('tabSwitching', ({ action }) => {
            if (action === 'switching') {
                document.activeElement.blur();
            }
        })
        .hook('contentReady', ({ event, content, target, url, container }) => {
            if (target) {
                if (target.style.minWidth) {
                    target.style.minWidth = 'auto';
                }
                if (target.dataset.restoreText) {
                    target.textContent = target.dataset.restoreText;
                }
                if (target.classList.contains('active')) {
                    content.classList.add('active');

                    if (this.config.autoFocus) {
                        setTimeout(() => { this.yaiFocus(target) }, 150);
                    }
                }
            }
            this._updateAriaStates(container);
        });
    }

    /**
     * Mark root containers and optionally apply lazy component optimization
     * Always sets data-root on root containers, and conditionally makes nested components lazy
     */
    _markRootContainers() {
        const allTabContainers = document.querySelectorAll(this.config.rootSelector);

        allTabContainers.forEach((container) => {
            // Check if this container is nested inside another tab container
            const parentTabContainer = container.parentElement?.closest(this.config.rootSelector);

            if (parentTabContainer) {
                // This is a nested component
                if (this.config.lazyNestedComponents) {
                    // Make it lazy - move attribute and mark as lazy
                    const attributeValue = container.getAttribute('data-yai-tabs') || '';
                    container.setAttribute('data-yai-tabs-lazy', attributeValue);
                    container.removeAttribute('data-yai-tabs');
                    container.setAttribute('data-lazy-component', 'true'); // Mark for easy identification
                }
            } else {
                this.rootIndex++;
                // This is a root component - always mark with data-root
                container.setAttribute('data-root', `r-${this.rootIndex}`);
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
                const buttons = container.querySelectorAll(':scope > nav[data-controller] [data-open]');
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
                isVisible: this.isContainerVisible(container),
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
     * Check if element has custom event attributes (data-click, data-input, etc.)
     */
    _isCustomEvent(element) {
        return (
            this.events.config.actionableAttributes.some(attr => element.hasAttribute(attr))
            || this.events.config.actionableClasses.some(className => element.classList.contains(className))
        );
    }

    /**
     * Universal event proxy - properly routes events to handlers or hooks
     */
    handleEventProxy(event, target, container) {
        if (['keydown', 'hashchange'].includes(event.type)) return;

        const customEvent = this._isCustomEvent(target);

        if (customEvent) {
            // 1. Handle tab actions first (open/close) - Core functionality
            const tabAction = target.dataset.tabAction;
            if (tabAction && typeof this[tabAction] === 'function') {
                this._executeHook('tabClicked', { target, event, container });
                return this[tabAction](target, event, container);
            }

            // 2. Check for event-specific attribute (data-click, data-submit, etc.)
            const action = target.dataset[event.type];
            if (action) {
                this._executeHook(`event${this._capitalize(event.type)}`, {
                    event, target, container, action, context: this
                });
            }
        }
    }

    /**
     * Handle hash change events
     */
    handleHashchange(event, target) {
        this._executeHook('eventHashchange', { event, target, context: this });
        const hashParams = this.parseHash();

        // Close all active tabs by simulating clicks (triggers proper closeTab behavior)
        let allActiveTabs = document.querySelectorAll(`[data-yai-tabs][data-ref-path] .active[${this.tabOpenAttribute}]`);

        if (allActiveTabs.length) {
            allActiveTabs = [...allActiveTabs].reverse();

            allActiveTabs.forEach(activeTab => {
                const container = activeTab.closest(this.config.rootSelector);
                const refPath = container.dataset.refPath;
                if (!(hashParams[refPath] && hashParams[refPath] === activeTab.getAttribute(this.tabOpenAttribute))) {
                    this.simulateClick(activeTab);
                }
            });
        }

        // Sync tabs to hash state
        for (const [refPath, tabId] of Object.entries(hashParams)) {
            const tabContainer = this.$(`${this.config.rootSelector}[data-ref-path="${refPath}"]`);
            if (!tabContainer) continue;

            // Look for button using original ID (before disambiguation) first, then fallback to direct match
            const targetTab = this.find(`[data-controller] [${this.tabOpenAttribute}="${tabId}"]`, tabContainer);
            const currentActive = this.find(`[data-controller] .active[${this.tabOpenAttribute}]`, tabContainer);

            // Only change if different from current active (compare using original IDs)
            const currentOriginalId = currentActive?.getAttribute(this.tabOpenAttribute)|| currentActive?.dataset.open;
            if (targetTab && currentOriginalId !== tabId && !targetTab.classList.contains('active')) {
                this.simulateClick(targetTab);
            }

            this.routeMap.set(refPath, tabId);
        }

        this._executeHook('eventHashchangeSwitched', { event, target, context: this });
    }

    /**
     * Main keydown handler for keyboard events. Attribute-based action
     * handlers are fun, but they have their limitations, for example here.
     */
    handleKeydown(event, target, container) {
        // Only handle specific keys
        if (!['Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
            // Keys not used by YoiTabs, share it
            if (this.config.callable?.eventKeydown) {
                const action = target.dataset[event.type] || null;
                this._executeHook('eventKeydown', { event, target, container, action, context: this });
            }
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
     * Check if an element is visible (not in a hidden parent)
     */
    isElementVisible(element) {
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
    isContainerVisible(container) {
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
     * Check if tabs in a container are closable
     * @param {HTMLElement} container - Tabs container element
     * @returns {boolean} True if tabs are closable
     * @description Checks data-closable attribute on container, falls back to config.closable
     */
    getIsClosable(container) {
        const isClosable = container.dataset.closable;
        if (isClosable) return isClosable === 'true';
        return this.config.closable;
    }

    /**
     * Short open- cloase tab handler
     */
    close(...args) { this.closeTab(...args) }
    open(...args) { this.openTab(...args) }

    /**
     * Attribute/Alias handlers, can be used with both.
     */
    closeTab(target, event, container) {
        if (!this.getIsClosable(container)) return;
        this.yaiEmit('tabClosing', { target, event, container });
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
        if (this.isAnyProcessing()) {
            requestAnimationFrame(() => {
                if (!this._loggedProcessing?.has(container)) {
                    this._loggedProcessing = this._loggedProcessing || new WeakSet();
                    this._loggedProcessing.add(container);
                    return;
                }
            });
        }
        this._loggedProcessing?.delete(container);

        this._updateAriaStates(container);

        if (target.classList.contains('active')) {
            if (this.getIsClosable(container)) {
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
        target.removeAttribute('data-inview-default');

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

            if (!target.dataset.url) {
                // Restore user's previous navigation state within this content
                this._restoreNavigationState(content);
            }

            // Initialize nested default tabs now that this content is visible
            this._initializeNestedDefaults(content);

            this._markRootContainer(container, true);

            this._setProcessingState(container, false);

            // Load dynamic content if data-url is specified
            if (target.dataset.url) {
                if (this._validateUrl(target.dataset.url)) {
                    const append = target.dataset.append === 'true';
                    content.classList.remove('active');
                    this._loadContent(target.dataset.url, `:scope > div[data-content] > [data-tab="${tabId}"]`, container, append, target);
                } else {
                    // URL validation failed - treat as static content
                    console.error('YaiTabs: Dynamic content loading blocked due to invalid URL:', target.dataset.url);
                    this._resetContentHeight(container);
                    this._executeHook('contentReady', { content, target, container });
                }
            }

            // Clean up sibling branch parameters when switching at same level (always, not just for ref-path containers)
            if (!isDefaultInitialization) {
                this._cleanupSiblingContainers(container);
                // Update hash immediately after cleanup to remove stale parameters
                this.updateHash(container);
            }

            // Emit tab ready event after tab is fully active (for breadcrumbs, analytics, etc.)
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
                    isVisible: this.isElementVisible(container),
                    isDefaultInit: isDefaultInitialization,
                });
            }

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

        return { depth, domOrder };
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
        const activeButton = getTabWrapper.querySelector(`:scope > nav[data-controller] [${this.tabOpenAttribute}].active`);
        if (activeButton) {
            getTabWrapper.dataset.lastActive = activeButton.getAttribute(this.tabOpenAttribute);
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
            this.find(`:scope > nav[data-controller] button.active${selectorButton[0]}`, container),
            this.find(`:scope > div[data-content] > .active${selectorButton[1]}`, container),
        ];

        // For closing tabs, trigger exit animation first
        const isClosing = target.classList.contains('active');
        const [button, content] = elements;

        this._executeHook('tabSwitching', { target, container, button, content, action: isClosing ? 'closing' : 'switching' });

        elements.forEach((el, index) => {
            if (!el) return;

            if (typeof el.dataset.open !== 'undefined') {
                this._executeHook('removingActiveContent', { target, container, button, content, action: isClosing ? 'closing' : 'switching' });
            }

            if (isClosing) {
                setTimeout(() => {
                    // Always remove active class when closing
                    el.classList.remove('active');
                }, 50);
            } else {
                // Normal tab switching - immediate removal
                el.classList.remove('active');
            }

            if (typeof el.dataset.default !== 'undefined') {
                el.removeAttribute('data-default');
            }

            if (index === 0) {
                // Remove container marker (tab-active)
                this._markRootContainer(container, false);
            }

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
                targetButton = this.find(`nav[data-controller] [${this.tabOpenAttribute}="${lastActiveId}"]`, container);
            }

            // If no last-active state, look for data-default button
            if (!targetButton) {
                targetButton = this.find(`
                    nav[data-controller] [data-default],
                    nav[data-controller] [data-inview-default]
                `, container);
            }

            // Only activate if we found a button (don't activate first button if nothing is set)
            if (targetButton
                && targetButton.dataset.open
                && this.isElementVisible(targetButton)
                && !targetButton.classList.contains('active')
            ) {
                targetButton.removeAttribute('data-default');
                targetButton.removeAttribute('data-inview-default');
                this.simulateClick(targetButton);
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

        // Activate any data-default buttons in the dynamically loaded content
        this._activateDefaultTabs(container);
    }

    /**
     * Activate data-default buttons in dynamically loaded content
     * @param {Element} container - The container element that holds the new tab content
     */
    _activateDefaultTabs(container) {
        // Find all data-default buttons within the provided scope that aren't active yet
        const defaultButtons = container.querySelectorAll(`
            [data-content] button[data-default]:not(.active),
            [data-content] button[data-inview-default]:not(.active)
        `);
        // Small delay to ensure DOM is settled after initialization
        setTimeout(() => {
            defaultButtons.forEach(button => {
                if (!button.classList.contains('active') && this.isElementVisible(button)) {
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
        let openerChain = {};
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
                // Get the opener ID
                openerChain[parentRefPath] = parentTabPanel.dataset.originalId || parentTabPanel.dataset.tab;
            }

            // Move up: start from the parent tab panel, then look for the next level up
            currentElement = parentTabPanel.parentElement?.closest(`[data-yai-tabs]`);
        }

        return {
            opener: openerChain,
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

        // Build URL by looking up each ref-path and getting its active tab
        const urlParts = [];

        // Process from deepest (target) to shallowest (root)
        for (let i = pathData.fullPath.length - 1; i >= 0; i--) {
            const refPath = pathData.fullPath[i];
            let tabValue = undefined; // default

            // Check if explicit value provided for target
            if (i === pathData.fullPath.length - 1 && targetValue !== undefined) {
                tabValue = targetValue;
            } else {
                tabValue = pathData.opener[refPath];
            }

            if (tabValue !== undefined) {
                urlParts.unshift(`${refPath}=${tabValue}`);
            }
        }

        const result = urlParts.length > 0 ? '#' + urlParts.join('&') : '';

        // Cache the result for future calls
        YaiTabs._urlReconstructionCache.set(cacheKey, result);

        return result;
    }

    /**
     * Updates ARIA attributes and tabindex for buttons and panels in a container.
     * @param {HTMLElement} container - The tab container to update
     */
    _updateAriaStates(container) {
        const buttons = container.querySelectorAll(':scope > nav[data-controller] button[data-open]');
        const panels = container.querySelectorAll(':scope > div[data-content] > [data-tab]');

        let hasActive = false;
        buttons.forEach(btn => {
            const isActive = btn.classList.contains('active');
            if (isActive) hasActive = true;
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
            btn.setAttribute('tabindex', isActive ? '0' : '-1');
        });
        if (!hasActive && buttons.length) {
            if (this.isElementVisible(buttons[0])) {
                buttons[0].setAttribute('tabindex', '0');
            }
        }

        panels.forEach(panel => {
            const isActive = panel.classList.contains('active');
            panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
            if (!isActive && !this.isContainerVisible(panel)) {
                panel.setAttribute('inert', '');
            } else {
                panel.removeAttribute('inert');
            }
        });

        // Recursively update nested containers
        const nestedContainers = container.querySelectorAll(':scope [data-yai-tabs]');
        nestedContainers.forEach(nested => {
            if (this.isContainerVisible(nested)) {
                this._updateAriaStates(nested);
            }
        });
    }

    /**
     * Validates the state of all tabs, buttons, and nested components.
     * Resource-intensive, for debugging only. Checks active states, ARIA, focus, inert, hash routing, and nested consistency.
     * @returns {Object} Validation result with errors and summary
     */
    validateTabStates() {
        const errors = [];
        let checkedContainers = 0;
        let checkedButtons = 0;
        let checkedPanels = 0;

        const containers = document.querySelectorAll(this.config.rootSelector);
        checkedContainers = containers.length;

        // Track the last visible active button for focus validation
        let lastVisibleActiveButton = null;
        if (this.config.autoFocus || this.config.autoFocusNested) {
            const allActiveButtons = document.querySelectorAll(`${this.config.rootSelector} > nav[data-controller] button.active`);
            for (const btn of allActiveButtons) {
                const container = btn.closest(this.config.rootSelector);
                if (this.isElementVisible(btn) && (!lastVisibleActiveButton || this._getContainerDepth(container) <= this._getContainerDepth(lastVisibleActiveButton.closest(this.config.rootSelector)))) {
                    lastVisibleActiveButton = btn;
                }
            }
        }

        containers.forEach((container, index) => {
            // Use container ID or fallback to unique identifier
            const refPath = container.dataset.refPath || container.id || `yai-tabs-${index + 1}`;
            const depth = this._getContainerDepth(container);

            // 1. Active button state
            const buttons = container.querySelectorAll(':scope > nav[data-controller] button[data-open]');
            const activeButtons = Array.from(buttons).filter(btn => btn.classList.contains('active'));
            checkedButtons += buttons.length;

            if (activeButtons.length > 1) {
                errors.push({
                    type: 'active_button',
                    container: refPath,
                    depth,
                    message: `Multiple active buttons (${activeButtons.length}) found in container ${refPath}`,
                });
            }
            if (activeButtons.length === 0 && !this.config.closable) {
                errors.push({
                    type: 'active_button',
                    container: refPath,
                    depth,
                    message: `No active button found in container ${refPath} (closable: false)`,
                });
            }

            // 2. Active panel state
            const panels = container.querySelectorAll(':scope > div[data-content] > [data-tab]');
            const activePanels = Array.from(panels).filter(panel => panel.classList.contains('active'));
            checkedPanels += panels.length;

            if (activePanels.length > 1) {
                errors.push({
                    type: 'active_panel',
                    container: refPath,
                    depth,
                    message: `Multiple active panels (${activePanels.length}) found in container ${refPath}`,
                });
            }
            if (activePanels.length === 0 && !this.config.closable) {
                errors.push({
                    type: 'active_panel',
                    container: refPath,
                    depth,
                    message: `No active panel found in container ${refPath} (closable: false)`,
                });
            }

            // 3. Button-panel correspondence
            if (activeButtons.length === 1 && activePanels.length === 1) {
                const activeButton = activeButtons[0];
                const activePanel = activePanels[0];
                const buttonOpen = activeButton.dataset.open;
                const panelTab = activePanel.dataset.tab;

                if (buttonOpen !== panelTab) {
                    errors.push({
                        type: 'mismatch',
                        container: refPath,
                        depth,
                        message: `Active button (data-open="${buttonOpen}") does not match active panel (data-tab="${panelTab}") in ${refPath}`,
                    });
                }
            }

            // 4. ARIA attributes
            if (this.config.autoAccessibility) {
                buttons.forEach(btn => {
                    const isActive = btn.classList.contains('active');
                    const ariaSelected = btn.getAttribute('aria-selected') === 'true';
                    const tabindex = btn.getAttribute('tabindex') || '0';

                    if (isActive && !ariaSelected) {
                        errors.push({
                            type: 'aria',
                            container: refPath,
                            depth,
                            message: `Active button ${btn.dataset.open} in ${refPath} lacks aria-selected="true"`,
                        });
                    }
                    if (!isActive && ariaSelected) {
                        errors.push({
                            type: 'aria',
                            container: refPath,
                            depth,
                            message: `Inactive button ${btn.dataset.open} in ${refPath} has aria-selected="true"`,
                        });
                    }
                    if (isActive && tabindex !== '0') {
                        errors.push({
                            type: 'focus',
                            container: refPath,
                            depth,
                            message: `Active button ${btn.dataset.open} in ${refPath} has incorrect tabindex="${tabindex}" (expected 0)`,
                        });
                    }
                    if (!isActive && tabindex !== '-1') {
                        errors.push({
                            type: 'focus',
                            container: refPath,
                            depth,
                            message: `Inactive button ${btn.dataset.open} in ${refPath} has incorrect tabindex="${tabindex}" (expected -1)`,
                        });
                    }
                });

                panels.forEach(panel => {
                    const isActive = panel.classList.contains('active');
                    const ariaHidden = panel.getAttribute('aria-hidden') === 'true';
                    const isInert = panel.hasAttribute('inert');

                    if (isActive && ariaHidden) {
                        errors.push({
                            type: 'aria',
                            container: refPath,
                            depth,
                            message: `Active panel ${panel.dataset.tab} in ${refPath} has aria-hidden="true"`,
                        });
                    }
                    if (!isActive && !ariaHidden) {
                        errors.push({
                            type: 'aria',
                            container: refPath,
                            depth,
                            message: `Inactive panel ${panel.dataset.tab} in ${refPath} lacks aria-hidden="true"`,
                        });
                    }
                    if (!isActive && !isInert && this.isContainerVisible(panel)) {
                        errors.push({
                            type: 'inert',
                            container: refPath,
                            depth,
                            message: `Inactive panel ${panel.dataset.tab} in ${refPath} lacks inert attribute but is in visible container`,
                        });
                    }
                });
            }

            // 5. Focus states (only check last visible active button)
            if ((this.config.autoFocus && depth === 0) || (this.config.autoFocusNested && depth > 0)) {
                const activeButton = activeButtons[0];
                if (activeButton && document.activeElement !== activeButton && activeButton === lastVisibleActiveButton) {
                    errors.push({
                        type: 'focus',
                        container: refPath,
                        depth,
                        message: `Active button ${activeButton.dataset.open} in ${refPath} is not focused (autoFocus: ${this.config.autoFocus})`,
                    });
                }
                if (this.config.autoFocusNested && depth > 0) {
                    const nestedActive = container.querySelector(':scope > div[data-content] > [data-tab].active [data-yai-tabs]');
                    if (nestedActive && !nestedActive.querySelector('button.active:focus') && nestedActive.querySelector('button.active') === lastVisibleActiveButton) {
                        errors.push({
                            type: 'focus_nested',
                            container: refPath,
                            depth,
                            message: `Nested active container in ${refPath} lacks focused button (autoFocusNested: ${this.config.autoFocusNested})`,
                        });
                    }
                }
            }

            // 6. Hash routing (only validate if container is visible and refPath is in hash)
            const activeButton = activeButtons[0];
            if (activeButton && this.isContainerVisible(container)) {
                const currentHash = window.location.hash || '#';
                const hashParams = new URLSearchParams(currentHash.replace('#', ''));
                // Only validate if refPath is expected in the hash
                if (hashParams.has(refPath)) {

                    console.log(this.tabOpenAttribute , activeButton.getAttribute(this.tabOpenAttribute) )

                    const expectedKeyValue = `${refPath}=${activeButton.getAttribute(this.tabOpenAttribute)}`;
                    if (hashParams.get(refPath) !== activeButton.getAttribute(this.tabOpenAttribute)) {
                        errors.push({
                            type: 'hash',
                            container: refPath,
                            depth,
                            message: `Hash ${currentHash} does not reflect active button ${activeButton.getAttribute(this.tabOpenAttribute)} in ${refPath} (expected ${expectedKeyValue})`,
                        });
                    }
                }
            }
        });

        console.group('YaiTabs State Validation');
        console.log(`Checked ${checkedContainers} containers, ${checkedButtons} buttons, ${checkedPanels} panels`);
        if (errors.length === 0) {
            console.log('%cAll states valid! 🎉', 'color: green; font-weight: bold;');
        } else {
            console.warn(`Found ${errors.length} issues:`);
            errors.forEach((error, i) => {
                console.warn(`[${i + 1}] ${error.type.toUpperCase()} (Depth ${error.depth}, ${error.container}): ${error.message}`);
            });
        }
        console.groupEnd();

        return {
            valid: errors.length === 0,
            errors,
            stats: { containers: checkedContainers, buttons: checkedButtons, panels: checkedPanels }
        };
    }

    /**
     * Helper to get container depth
     * @param {HTMLElement} container
     * @returns {number} Depth level
     */
    _getContainerDepth(container) {
        let depth = 0;
        let current = container;
        while (current && current !== document.body) {
            if (current.matches(this.config.rootSelector)) {
                depth++;
            }
            current = current.parentElement.closest(this.config.rootSelector);
        }
        return depth - 1;
    }

}

export {YaiTabs};
export default YaiTabs;
