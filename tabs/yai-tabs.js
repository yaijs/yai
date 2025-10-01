"use strict";

/**
 * YaiTabs - Yai component
 */
class YaiTabs extends YaiCore {
    constructor(customConfig = {}) {
        // YaiTabs specific config
        const tabsConfig = {
            rootSelector: '[data-yai-tabs]',     /** @var string Tabs container selector, can handle multiple */
            closable: true,                      /** @var bool Closable tabs, click on active tab button closes the tab */
            openDefault: null,                   /** @var int If no data-default is set, use to open predefined index */
            defaultBehavior: 'fade',             /** @var string Default animation behavior if no data-behavior is specified */
            autoFocus: false,                    /** @var bool Automatically focus the first container's active tab on init */
            autoAccessibility: true,             /** @var bool Enable comprehensive ARIA accessibility setup */
            autoDisambiguate: true,              /** @var bool Automatically make identical data-open/data-tab values unique to prevent cross-contamination */
            lazyNestedComponents: true,          /** @var bool On init, marks nested tab components as laty "data-yai-tabs-lazy" */

            // Override eventHandler configs
            dispatchName: 'yai.tabs',
            events: {
                actionableAttributes: ['data-tab-action'],
                actionableClasses: [],
                actionableTags: [],
            },

            // Extend base emitable events with tabs-specific ones
            // Base events are automatically merged from YaiCore.getBaseEmitableEvents()
            emitable: {
                // YaiTabs-specific events only
                tabClosed: 'tabClosed',
                tabSwitched: 'tabSwitched',
                hashChanged: 'hashChanged',
                nested: 'nested',
                tabReady: 'tabReady',
            },
        };

        super(YaiCore.deepMerge(tabsConfig, customConfig));

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

                // Restore focus to button after dynamic content loading
                // This maintains keyboard navigation flow and accessibility
                // Only restore focus for dynamic content (url exists), not static initialization
                if (url && document.activeElement !== target && target.classList.contains('active')) {
                    setTimeout(() => { target.focus({ preventScroll: true }) }, 10);
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
        this.createEventHandler({
                window: [{ type: 'hashchange', debounce: 500 }],
                [this.config.rootSelector]: ['click', 'keydown'],
            },{
                click: {
                    open:  'openTab',
                    close: 'closeTab',
                },
            }
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

        // Clean up any focusable elements in hidden panels after initialization
        this._cleanupHiddenPanels();

        // Final ARIA state update after hash processing and initialization
        // This ensures hash-opened tabs have correct aria-hidden states
        setTimeout(() => {
            document.querySelectorAll(this.config.rootSelector).forEach(container => {
                this._updateAriaStates(container);
            });
        }, 100);
    }

    /**
     * Mark nested components as lazy to prevent event listener proliferation
     * Only root components keep the data-yai-tabs attribute for initial event registration
     */
    _markLazyComponents() {
        const allTabContainers = document.querySelectorAll(this.config.rootSelector);

        allTabContainers.forEach(container => {
            // Check if this container is nested inside another tab container
            const parentTabContainer = container.parentElement?.closest(this.config.rootSelector);

            if (parentTabContainer) {
                // This is a nested component - make it lazy
                const attributeValue = container.getAttribute('data-yai-tabs') || '';
                container.setAttribute('data-yai-tabs-lazy', attributeValue);
                container.removeAttribute('data-yai-tabs');
                container.setAttribute('data-lazy-component', 'true'); // Mark for easy identification
            } else {
                // This is a root component - keep it active
                container.setAttribute('data-root', 'true'); // Mark as root for initialization optimization
            }
        });
    }

    /**
     * Activate lazy components after event registration
     * Converts placeholder attributes back to real ones so YEH delegation works
     */
    _activateLazyComponents() {
        const lazyContainers = document.querySelectorAll('[data-yai-tabs-lazy]');

        lazyContainers.forEach(container => {
            // Restore the data-yai-tabs attribute
            const attributeValue = container.getAttribute('data-yai-tabs-lazy');
            container.setAttribute('data-yai-tabs', attributeValue);
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
                const parentTabContainer = current.closest('[data-yai-tabs], [data-yai-tabs-lazy]');
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
                    // Generate alphabet-based suffixes (a, b, c, etc.) for ALL pairs
                    const suffix = String.fromCharCode(97 + index); // 97 = 'a'

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

    /**
     * Process hash before initialization to override data-default attributes
     */
    processHashBeforeInit() {
        const hashParams = this.parseHash();

        // Remove data-default attributes only from containers that participate in hash routing
        Object.keys(hashParams).forEach(refPath => {
            const container = this.$(`[data-yai-tabs][data-ref-path="${refPath}"]`);
            if (container) {
                const defaultElements = container.querySelectorAll('[data-default]');

                defaultElements.forEach(element => {
                    element.removeAttribute('data-default');
                });
            }
        });

        for (const [refPath, tabId] of Object.entries(hashParams)) {
            const container = this.$(`[data-yai-tabs][data-ref-path="${refPath}"]`);
            if (!container) continue;

            // Set hash target as new default (data-default attributes already cleared above)
            const hashTarget = this.find(`[data-original-id="${tabId}"], [data-open="${tabId}"]`, container);
            if (hashTarget) {
                hashTarget.setAttribute('data-default', '');
                this.routeMap.set(refPath, tabId);
            }
        }
    }

    init() {
        this.initializeAllContainers();
    }

    /**
     * Clean up focusable elements in hidden panels (fixes Lighthouse accessibility issue)
     * Nesting-aware: Only disables elements that don't belong to active nested tabs
     */
    _cleanupHiddenPanels() {
        // Find all tab containers using cached query
        const containers = this.$$(this.config.rootSelector);

        containers.forEach(container => {
            // Find hidden panels within this specific container
            const hiddenPanels = this.findAll(':scope > div[data-content] > [data-tab][aria-hidden="true"]', container);

            hiddenPanels.forEach(panel => {
                // Find focusable elements, but exclude those in nested active tab containers
                const focusableElements = this.findAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', panel);

                focusableElements.forEach(element => {
                    // Check if this element belongs to an active nested tab container
                    const nestedContainer = element.closest(this.config.rootSelector);
                    const isInNestedActive = nestedContainer
                        && nestedContainer !== container
                        && this.find(':scope > div[data-content] > [data-tab]:not([aria-hidden="true"])', nestedContainer);

                    // Only disable if not part of an active nested tab structure
                    if (!isInNestedActive && this.config.autoAccessibility) {
                        element.setAttribute('tabindex', '-1');
                    }
                });
            });
        });
    }

    /**
     * Unified container initialization system
     * Single DOM scan, complete setup, internal state building
     */
    initializeAllContainers(rootElement = document) {
        // Single DOM scan for all containers using cached query
        const containers = Array.from(this.findAll(this.config.rootSelector, rootElement, { refresh: true }));
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
                defaultButton.focus({ preventScroll: true });
            }
        }
    }

    /**
     * Lightweight initialization for nested components
     * Minimal setup since they rely on root component's event delegation
     */
    _processNestedContainer(data) {
        const { container, defaultButton, isVisible } = data;

        // Ensure container has an ID before accessibility setup
        if (!container.id) {
            container.id = YaiTabs.generateId('yai-tabs-nested');
        }

        // Set nesting level (essential for proper hierarchy)
        container.setAttribute('data-nesting', data.nestingLevel.toString());

        // Apply default behavior if not set
        if (!container.hasAttribute('data-behavior') && this.config.defaultBehavior) {
            container.setAttribute('data-behavior', this.config.defaultBehavior);
        }

        // Basic container accessibility (much lighter than full ARIA setup)
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
     * Main event handler, all events are routed to their correspending `handleEventType() methods`,
     * that validates incoming events and routes the clients to the correct action handler.
     */

    /**
     * Handle hash change events
     */
    handleHashchange() {
        const hashParams = this.parseHash();

        // Sync tabs to hash state
        for (const [refPath, tabId] of Object.entries(hashParams)) {
            const tabContainer = this.$(`[data-yai-tabs][data-ref-path="${refPath}"]`);
            if (!tabContainer) continue;

            // Look for button using original ID (before disambiguation) first, then fallback to direct match
            const targetTab = this.find(`[data-original-id="${tabId}"], [data-open="${tabId}"]`, tabContainer);
            const currentActive = this.find('.active[data-open]', tabContainer);

            // Only change if different from current active (compare using original IDs)
            const currentOriginalId = currentActive?.getAttribute('data-original-id') || currentActive?.dataset.open;
            if (targetTab && currentOriginalId !== tabId) {
                this.openTab(targetTab, null, tabContainer);
            }

            this.routeMap.set(refPath, tabId);
        }
    }

    /**
     * Main click handler. All triggered click events ends here, before final action handler.
     */
    handleClick(event, target, container) {
        const action = target.dataset.tabAction;

        if (action) {
            // PREEMPTIVE: Clean up stale active states BEFORE processing
            this._cleanupStaleActiveStates();

            // Try direct method first
            if (typeof this[action] === 'function') {
                return this[action](target, event, container);
            }

            // If handler not found, try resolving aliases
            const aliasHandler = this.resolveAlias(action, event.type);
            if (aliasHandler && typeof this[aliasHandler] === 'function') {
                return this[aliasHandler](target, event, container);
            }
        }
    }

    /**
     * Main keydown handler for keyboard events. Attribute-based action
     * handlers are fun, but they have their limitations, for example here.
     */
    handleKeydown(event, target, container) {
        // Only handle specific keys
        if (!['Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
            return;
        }

        // Handle ESC key to go up component levels
        if (event.key === 'Escape') {
            event.preventDefault();

            // Find parent tab container
            const parentTabContainer = container.closest('[data-tab]');
            if (parentTabContainer) {
                const parentContainer = parentTabContainer.closest('[data-yai-tabs]');
                if (parentContainer) {
                    // Focus the active button in parent container
                    const parentActiveButton = this.find(':scope > nav[data-controller] button.active', parentContainer);
                    if (parentActiveButton) {
                        parentActiveButton.focus();
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
            buttons[nextIndex].focus();
        }
    }

    /**
     * Centralized ARIA state management for container and its nested components
     */
    _updateAriaStates(container) {
        // Skip ARIA updates if autoAccessibility is disabled
        if (!this.config.autoAccessibility) return;

        // Find all tab containers within this container (including itself)
        const allContainers = [container, ...this.findAll('[data-yai-tabs]', container)];

        allContainers.forEach(tabContainer => {
            // Get the active panel in this container
            const activePanel = this.find(':scope > div[data-content] > [data-tab].active', tabContainer);
            const allPanels = this.findAll(':scope > div[data-content] > [data-tab]', tabContainer);
            const allButtons = this.findAll(':scope > nav[data-controller] [data-open]', tabContainer);

            // Update panels
            allPanels.forEach(panel => {
                const isActive = panel === activePanel;
                const isParentVisible = this._isElementVisible(panel.closest('[data-tab]') || document.body);

                if (isActive && isParentVisible) {
                    // Active panel in visible container
                    panel.removeAttribute('aria-hidden');
                    panel.setAttribute('tabindex', '0');
                } else {
                    // Double-check: Never hide elements that are active or contain active children
                    const hasActiveChildren = panel.querySelector('.active');
                    const isActuallyActive = panel.classList.contains('active');

                    if (isActuallyActive || hasActiveChildren) {
                        // Element or its children are active - must remain visible
                        panel.removeAttribute('aria-hidden');
                        panel.setAttribute('tabindex', '0');
                    } else {
                        // Truly inactive panel
                        panel.setAttribute('aria-hidden', 'true');
                        panel.setAttribute('tabindex', '-1');
                    }
                }
            });

            // Check if any button in this container is active (more efficient approach)
            const activeButton = this.find(':scope > nav[data-controller] button.active', tabContainer);
            const hasActiveButton = !!activeButton;

            // Update buttons
            allButtons.forEach((button, index) => {
                const isActive = button.classList.contains('active');
                const isParentVisible = this._isElementVisible(button.closest('[data-tab]') || document.body);

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
    _cleanupStaleActiveStates() {
        // Find all active elements anywhere in the document
        const allActiveButtons = document.querySelectorAll('[data-yai-tabs] button.active[data-open]');
        const allActivePanels = document.querySelectorAll('[data-yai-tabs] [data-tab].active');

        // More comprehensive cleanup - check entire hierarchy chain
        [...allActiveButtons, ...allActivePanels].forEach(element => {
            // Check if this element is in a container that's nested in a hidden panel
            const parentContainer = element.closest('[data-yai-tabs]');
            let currentPanel = parentContainer?.closest('[data-tab]');
            let shouldClean = false;

            // Walk up the hierarchy to find any hidden parent panel
            while (currentPanel) {
                if (!currentPanel.classList.contains('active')) {
                    shouldClean = true;
                    break;
                }
                // Go up one more level
                const nextContainer = currentPanel.closest('[data-yai-tabs]')?.parentElement?.closest('[data-yai-tabs]');
                currentPanel = nextContainer?.closest('[data-tab]');
            }

            if (shouldClean) {
                // Remove stale active state
                element.classList.remove('active');

                // Reset ARIA states for cleaned elements (only if autoAccessibility is enabled)
                if (this.config.autoAccessibility) {
                    if (element.matches('[data-open]')) {
                        element.setAttribute('aria-selected', 'false');
                        element.setAttribute('tabindex', '-1');
                    } else if (element.matches('[data-tab]')) {
                        element.setAttribute('aria-hidden', 'true');
                        element.setAttribute('tabindex', '-1');
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
        const hiddenElements = this.findAll('[aria-hidden="true"]', container);

        hiddenElements.forEach(hidden => {
            if (hidden.contains(document.activeElement)) {
                // Move focus to nearest visible tab button
                const visibleTabButton = this.find(
                    ':scope > nav[data-controller] button:not([aria-hidden])',
                    container.closest('[data-yai-tabs]')
                );
                if (visibleTabButton) {
                    visibleTabButton.focus({ preventScroll: true });
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
     * Attribute/Alias handlers, can be used with both.
     */
    closeTab(target, _event, container) {
        if (!this.config.closable) return;
        this._removeActive(target, container);

        // Update hash routing after closing
        const refPath = container.dataset.refPath;
        if (refPath) {
            // Check if any tab is still active after close
            const stillActive = this.find(':scope > nav[data-controller] button.active[data-open]', container);

            if (stillActive) {
                // Update to the still-active tab
                this.routeMap.set(refPath, stillActive.dataset.open);
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

        const tabId = target.dataset.open;
        const content = this.find(`:scope > div[data-content] > [data-tab="${tabId}"]`, container);

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
                content.focus({ preventScroll: true });
            }

            this._markRootContainer(container, true);

            // Clear processing state after animation completes
            setTimeout(() => {
                this._setProcessingState(container, false);
            }, 100); // Match animation duration

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
            } else {
                // For static content, manually trigger contentReady hook
                this._executeHook('contentReady', { content, target, container });
                this._resetContentHeight(container);
            }

            // Emit tab ready event after tab is fully active (for breadcrumbs, analytics, etc.)
            // This fires for ALL tab activations: user clicks, defaults, hash routing
            setTimeout(() => {
                // Verify tab is still active (avoid race conditions)
                if (target.classList.contains('active') && content.classList.contains('active')) {
                    this.yaiEmit('tabReady', {
                        id: tabId,
                        container,
                        target,
                        content,
                        refPath: container.dataset.refPath,
                        isVisible: this._isElementVisible(container),
                        isDefaultInit: isDefaultInitialization
                    });
                }
            }, 10); // Small delay to ensure DOM updates complete

            // Clean up sibling branch parameters when switching at same level (always, not just for ref-path containers)
            if (!isDefaultInitialization) {
                this._cleanupSiblingBranchParameters(container);
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

    /**
     * YaiTabs-specific loading state management
     * Adds tab-specific loading indicators to both container and trigger button
     * @param {Element} container - The content container
     * @param {boolean} isLoading - Whether to show loading state
     * @param {Element} target - The tab button that triggered the loading
     */
    toggleLoading(container, isLoading = true, target = null) {
        // Find the tab component container (data-yai-tabs)
        const tabContainer = container.closest('[data-yai-tabs]');
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
                button.setAttribute('disabled', 'true');
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
                button.removeAttribute('disabled');
                button.classList.remove(this.config.selectors.isLoading);
            });
        }
    }

    /**
     * Clean up hash parameters from sibling branches when switching tabs at same level
     * This prevents hash pollution from hidden parallel branches
     * @param {Element} container - The container that's being switched to
     */
    _cleanupSiblingBranchParameters(container) {
        // Find all inactive sibling panels within the SAME container (at the current level)
        const allPanels = container.querySelectorAll(':scope > div[data-content] > [data-tab]');
        const activePanel = container.querySelector(':scope > div[data-content] > [data-tab].active');

        allPanels.forEach(panel => {
            if (panel === activePanel) return; // Skip the currently active panel

            // Find all nested tab containers within this inactive sibling panel
            const nestedContainers = panel.querySelectorAll('[data-yai-tabs][data-ref-path]');

            // Before cleaning up nested containers, preserve user's navigation state
            this._preserveNavigationState(panel);

            nestedContainers.forEach(nestedContainer => {
                const nestedRefPath = nestedContainer.dataset.refPath;
                if (nestedRefPath && this.routeMap.has(nestedRefPath)) {
                    // Remove this inactive branch's parameters from the route map
                    this.routeMap.delete(nestedRefPath);

                    // Remove tab-active class from hidden container so placeholder shows
                    nestedContainer.classList.remove('tab-active');

                    // Recursively clean up any deeper nested parameters
                    this._cleanupNestedHashEntries(nestedContainer);
                }
            });
        });
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
                // Recursively clean up any deeper nested containers with depth tracking
                this._cleanupNestedHashEntries(nestedContainer, depth + 1, visited);
            }
        });
    }

    /**
     * Preserve user's navigation state by marking active elements with data-temp-default
     * Each level can only have one data-temp-default element (one active tab per container)
     * @param {Element} containerOrPanel - Container or panel to preserve state within
     */
    _preserveNavigationState(containerOrPanel) {
        // Find all tab containers within the given scope
        const tabContainers = [
            ...(containerOrPanel.matches('[data-yai-tabs]') ? [containerOrPanel] : []),
            ...containerOrPanel.querySelectorAll('[data-yai-tabs]')
        ];

        tabContainers.forEach(container => {
            // Find the currently active button in this container
            const activeButton = container.querySelector(':scope > nav[data-controller] > [data-open].active');

            // Mark only the active button with temp-default (preserve which tab was open)
            if (activeButton) {
                activeButton.setAttribute('data-temp-default', '');
                activeButton.classList.remove('active');
            }
        });
    }

    /**
     * Restore user's navigation state by clicking buttons marked with data-temp-default
     * Simple approach: just click the buttons and let normal tab logic handle the rest
     * @param {Element} content - The panel content that just became visible
     */
    _restoreNavigationState(content) {
        // Find all buttons with temp-default within the newly visible content
        const tempDefaultButtons = content.querySelectorAll('[data-yai-tabs] [data-temp-default]');

        tempDefaultButtons.forEach(button => {
            // Remove temp-default before clicking to avoid recursion
            button.removeAttribute('data-temp-default');
            // Click the button to restore the tab state (triggers normal tab opening logic)
            setTimeout(() => {
                if (!button.classList.contains('active')) {
                    this.simulateClick(button);
                }
            }, 50);
        });
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
                // Remove tab-active class
                this._markRootContainer(container, false);

                // Remove active and exit classes after animation completes
                setTimeout(() => {
                    // Handle focus and ARIA after visual state changes complete
                    this._manageFocusForHiddenElements(container);
                    this._updateAriaStates(container);

                    if (!this.config.autoAccessibility) {
                        el.classList.remove('active');
                    }
                }, 50);
            } else {
                // Normal tab switching - immediate removal
                el.classList.remove('active');

                // Handle focus and ARIA after visual state changes
                this._manageFocusForHiddenElements(container);
                this._updateAriaStates(container);
            }

            // Only remove container marker for normal tab switching (not closing)
            if (!isClosing) {
                this._markRootContainer(container, false);
            }
            if (this.config.autoAccessibility) {
                YaiTabs._clearInteractiveState(el, isClosing);
            }

            if (elements.length === index+1) {
                const id = el.dataset.tab || el.dataset.open;
                // Emit tabs-specific event
                this.yaiEmit('tabClosed', { id, container });
            }
        });
    }

    /**
     * Initialize nested default tabs when their parent becomes active
     */
    _initializeNestedDefaults(content) {
        // Find all nested tab containers in the content
        const nestedContainers = this.findAll('[data-yai-tabs]', content);
        nestedContainers.forEach(container => {
            // Look for default button in this container
            const defaultButton = this.find(':scope > nav[data-controller] [data-default]', container);
            if (defaultButton && defaultButton.dataset.open) {
                // Check if content panel is actually active (not just button)
                const targetContent = this.find(`[data-tab="${defaultButton.dataset.open}"]`, container);
                const isContentActive = targetContent && targetContent.classList.contains('active');

                // Re-initialize if content is not active, even if button appears active
                if (!isContentActive) {
                    this.openTab(defaultButton, null, container, true);
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
        const defaultButtons = container.querySelectorAll('[data-content] button[data-default]:not(.active)');
        // Small delay to ensure DOM is settled after initialization
        setTimeout(() => {
            defaultButtons.forEach(button => {
                if (!button.classList.contains('active')) {
                    this.simulateClick(button);
                }
            });
        }, 50);
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
            const parentTabContainer = parentTabPanel.closest('[data-yai-tabs]');
            if (!parentTabContainer) break;

            // Get the ref-path of the parent container
            const parentRefPath = parentTabContainer.dataset.refPath;
            if (parentRefPath) {
                pathChain.unshift(parentRefPath); // Add to beginning for correct order
            }

            // Move up: start from the parent tab panel, then look for the next level up
            currentElement = parentTabPanel.parentElement?.closest('[data-yai-tabs]');
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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { YaiTabs };
    module.exports.default = YaiTabs;
} else if (typeof window !== 'undefined') {
    window['YaiTabs'] = YaiTabs;
}
