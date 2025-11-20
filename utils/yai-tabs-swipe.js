"use strict";

/**
 * @fileoverview YaiTabsSwipe - Swipe/drag navigation utility for YaiTabs
 * @license MIT
 */

/**
 * @typedef {Object} SwypeThreshold
 * @property {number} mobile - Distance threshold for touch devices (px)
 * @property {number} desktop - Distance threshold for mouse devices (px)
 */

/**
 * @typedef {Object} SwypeConfig
 * @property {SwypeThreshold} threshold - Swipe distance thresholds
 */

/**
 * @typedef {Object} SlideState
 * @property {boolean} isDragging - Whether a drag/swipe is in progress
 * @property {number} startX - Starting X coordinate
 * @property {number} currentX - Current X coordinate
 * @property {number} startY - Starting Y coordinate
 * @property {number} currentY - Current Y coordinate
 * @property {number} startTime - Timestamp when drag started
 * @property {'x'|'y'|null} lockedAxis - Locked movement axis
 */

/**
 * YaiTabsSwipe - Add swipe/drag navigation to YaiTabs
 *
 * Provides mobile-first swipe gestures and desktop drag navigation for tab switching.
 * Works at every nesting level with automatic container scoping.
 *
 * @class
 * @example
 * const tabs = new YaiTabs({
 *     events: {
 *         setListener: {
 *             '[data-yai-tabs]': [
 *                 'click', 'keydown',
 *                 'mousedown', 'mousemove', { type: 'mouseup', debounce: 1 },
 *                 { type: 'touchstart', debounce: 1 },
 *                 { type: 'touchmove', debounce: 1 },
 *                 { type: 'touchend', debounce: 1 }
 *             ]
 *         }
 *     }
 * });
 *
 * const swype = new YaiTabsSwipe({ threshold: { mobile: 50, desktop: 100 } })
 *     .setInstance(tabs)
 *     .watchHooks();
 */
class YaiTabsSwipe {
    /**
     * Creates a new YaiTabsSwipe instance
     * @param {Partial<SwypeConfig>} [customConfig={}] - Custom configuration options
     */
    constructor(customConfig = {}) {
        const swipeConfig = {
            threshold: {
                mobile: 30,
                desktop: 40,
            },
            // Used to configure YaiTabsSwipe using data-attributes expected in [datai-yai-tabs]
            // @example: data-swipe-axis="auto"
            dataConfigKey: 'data-swipe',
            customAttributes: ['data-swipe'],
            // Allowed swipe directions (can be 'horizontal', 'vertical', or 'both', or 'auto' to detect from aria-orientation)
            axis: 'auto',
            // Minimum movement to determine axis lock (prevents accidental diagonal swipes)
            axisLockThreshold: 10,
            // Reverse swipe direction (true: swipe left = prev, swipe right = next)
            reverseDirection: false,
            // Boundary behavior when reaching first/last tab
            boundaryBehavior: {
                circular: false,        // Loop from last to first tab and vice versa
                descendIntoNested: false, // Auto-open first tab of nested component when reaching boundary
                ascendFromNested: false,  // Auto-switch to parent's next tab when reaching nested boundary
                transitionDelay: 2500,     // Delay (ms) before switching after showing parent chain (0 to disable)
            },
            orientationAware: true,     // New: Show orientation hints
            hapticFeedback: 'adaptive', // 'none' | 'light' | 'adaptive' | 'heavy'
            ignoreClosestSelector: null,
            // Lifecycle hooks for swipe/drag events
            callable: {
                swipeStart: null,
                swipeMove: null,
                swipeEnd: null,
                beforeSwitch: null,
                afterSwitch: null,
                dragCancelled: null,
                ...customConfig.callable
            },
            ...customConfig
        };

        /**
         * Internal state tracking for drag/swipe gestures
         * @type {SlideState}
         * @private
         */
        this.swipeState = {
            isDragging: false,
            startX: 0,
            currentX: 0,
            startY: 0,
            currentY: 0,
            startTime: 0,
            lockedAxis: null,
            isDraggingNested: null,
            attributesParsed: false,
        };

        /**
         * Track pending timeout for boundary behavior transitions
         * @type {number|null}
         * @private
         */
        this._pendingTimeout = null;

        /**
         * Reference to YaiTabs instance
         * @type {YaiTabs|null}
         * @private
         */
        this.tabs = null;

        /**
         * Swype configuration
         * @type {SwypeConfig}
         * @private
         */
        this.config = swipeConfig;
    }

    /**
     * Set the YaiTabs instance to attach swipe handlers to
     * @param {YaiTabs} tabsInstance - YaiTabs instance
     * @returns {YaiTabsSwipe} Returns this for chaining
     * @example
     * const swype = new YaiTabsSwipe().setInstance(tabs);
     */
    setInstance(tabsInstance) {
        this.tabs = tabsInstance;
        return this;
    }

    /**
     * Get the closest tabs container element
     * @param {HTMLElement} target - Starting element
     * @returns {HTMLElement|null} The [data-yai-tabs] container or null
     * @private
     */
    getTabsContainer(target) {
        const container = target.closest('[data-yai-tabs][data-swipe]');
        // Check if container has active tab instead of relying on container class
        return container && container.querySelector('[data-open].active') ? container : null;
    }

    /**
     * Get the active tab panel or closest tab panel
     * @param {HTMLElement} target - Starting element
     * @returns {HTMLElement|null} The active [data-tab] panel or null
     * @private
     */
    getTabsPanel(target) {
        const container = target.closest('[data-yai-tabs][data-swipe]');
        if (!container) return null;

        // Check if this container has active navigation (buttons with active class)
        const hasActiveNav = container.querySelector('[data-open].active') !== null;

        // If no active navigation, this container isn't "swipeable" right now
        if (!hasActiveNav) return null;

        return container.querySelector(':scope > [data-content] > [data-tab].active') || container.querySelector(':scope > [data-content] > [data-tab]');
    }

    /**
     * Check if element should be ignored for swype gestures
     * @param {Event} event - The mouse/touch event
     * @returns {boolean} - True if swype should be ignored
     * @private
     */
    shouldIgnoreSwype(event) {
        const target = event.target;

        if (target.matches('[data-open]')) return true;

        if (this.config.ignoreClosestSelector) {
            if (target.closest(this.config.ignoreClosestSelector)) return true;
        }

        if (target.matches('input, textarea, select, button:not([data-open])')) return true;

        const ignoredElement = target.closest(
            '[data-swipe-ignore], [data-tabs-header], [data-tabs-footer]'
        );
        if (ignoredElement && !ignoredElement.hasAttribute('data-swipe-allow')) {
            return true;
        }

        return false;
    }

    /**
     * Switch to a relative tab (next/previous)
     * @param {HTMLElement} container - Tabs container element
     * @param {number} offset - Offset from current tab (-1 for previous, 1 for next)
     * @returns {boolean} True if tab was switched, false otherwise
     * @private
     */
    switchToRelativeTab(container, offset) {
        const tabs = Array.from(container.querySelectorAll(':scope > nav[data-controller] [data-open]'));
        const currentIndex = tabs.findIndex(tab => tab.classList.contains('active'));
        const targetIndex = currentIndex + offset;

        if (targetIndex >= 0 && targetIndex < tabs.length) {
            const targetTab = tabs[targetIndex];
            if (targetTab && !targetTab.classList.contains('active')) {
                targetTab.click();
                this.clearSelection();
                return true;
            }
        }

        return false;
    }

    /**
     * Reset container to first tab (for clean state after ascension)
     * @param {HTMLElement} container - Tabs container element
     * @private
     */
    resetToFirstTab(container) {
        const tabs = Array.from(container.querySelectorAll(':scope > nav[data-controller] [data-open]'));
        if (tabs.length > 0) {
            const firstTab = tabs[0];
            const lastTab = tabs[tabs.length - 1];
            const activeTab = tabs.find(tab => tab.classList.contains('active'));

            // Only switch if first tab is not already active
            if (activeTab && activeTab === lastTab) {
                firstTab.click();
            }
        }
    }

    /**
     * Ensure all parent containers are visible by activating the tab chain
     * @param {HTMLElement} container - Starting container
     * @returns {HTMLElement|null} Root container or null
     * @private
     */
    ensureParentChainVisible(container) {
        const parentContainers = [];
        let current = container;

        // Collect all parent containers up to root
        while (current) {
            const parent = current.parentElement?.closest('[data-yai-tabs][data-swipe]');
            if (parent) {
                parentContainers.push(parent);
                current = parent;
            } else {
                break;
            }
        }

        // Activate tabs from root down to current container
        // This ensures the entire chain is visible
        for (let i = parentContainers.length - 1; i >= 0; i--) {
            const parentContainer = parentContainers[i];
            const parentContent = parentContainer.querySelector(':scope > [data-content]');

            // Find which tab contains the nested structure
            if (parentContent) {
                const tabContainingNested = Array.from(parentContent.querySelectorAll(':scope > [data-tab]'))
                    .find(tab => tab.contains(i === 0 ? container : parentContainers[i - 1]));

                if (tabContainingNested) {
                    const tabId = tabContainingNested.getAttribute('data-tab');
                    const tabButton = parentContainer.querySelector(`:scope > nav[data-controller] [data-open][data-open="${tabId}"]`);

                    if (tabButton && !tabButton.classList.contains('active')) {
                        tabButton.click();
                        tabButton.focus({ preventScroll: true })
                    }
                }
            }
        }

        // Return root container
        return parentContainers.length > 0 ? parentContainers[parentContainers.length - 1] : null;
    }

    /**
     * Handle boundary behavior when reaching first/last tab
     * @param {HTMLElement} container - Tabs container element
     * @param {number} offset - Offset that was attempted (-1 or 1)
     * @param {'next'|'prev'} direction - Direction of movement
     * @param {HTMLElement} [originContainer] - Original container where ascension started (for visibility restoration)
     * @returns {boolean} True if boundary behavior succeeded, false otherwise
     * @private
     */
    handleBoundaryBehavior(container, offset, direction, originContainer = null) {
        const effectiveConfig = this.getEffectiveConfig();
        const behavior = effectiveConfig.boundaryBehavior;

        // Track the origin container if this is the first call
        if (!originContainer) {
            originContainer = container;
        }

        // Check if we're in a nested component
        const parentTabContainer = container.parentElement?.closest('[data-yai-tabs][data-swipe]');
        const isNested = !!parentTabContainer;

        // 1. Ascend from nested component (recursively)
        if (isNested && behavior.ascendFromNested) {
            // Reset current container to first tab before ascending
            // This ensures clean state when returning via circular navigation
            this.resetToFirstTab(container);

            // Try to switch tab in parent container
            const switched = this.switchToRelativeTab(parentTabContainer, offset);
            if (switched) {
                this.clearSelection();
                return true;
            }

            // Parent also at boundary - try parent's boundary behavior recursively
            const parentSwitched = this.handleBoundaryBehavior(parentTabContainer, offset, direction, originContainer);
            if (parentSwitched) {
                return true;
            }
        }

        // 2. Circular navigation (current level)
        if (behavior.circular) {
            const tabs = Array.from(container.querySelectorAll(':scope > nav[data-controller] [data-open]'));
            if (tabs.length > 0) {
                // If going next and at end, loop to first
                // If going prev and at start, loop to last
                const targetTab = direction === 'next' ? tabs[0] : tabs[tabs.length - 1];
                if (targetTab && !targetTab.classList.contains('active')) {
                    // Check if we ascended from nested component (originContainer is different from current container)
                    const ascendedFromNested = originContainer !== container && behavior.ascendFromNested;

                    if (ascendedFromNested) {
                        // First ensure parent chain is visible
                        this.ensureParentChainVisible(originContainer);

                        // Add configurable delay before switching to allow user to see the transition
                        const delay = typeof behavior.transitionDelay === 'number' ? behavior.transitionDelay : 300;

                        if (delay > 0) {
                            // Clear any existing timeout
                            if (this._pendingTimeout) {
                                clearTimeout(this._pendingTimeout);
                            }

                            this._pendingTimeout = setTimeout(() => {
                                // Validate element still exists and is valid
                                if (targetTab && document.contains(targetTab)) {
                                    console.log('[YaiTabsSwipe] Delay complete, switching tab');
                                    targetTab.click();
                                    this.clearSelection();
                                }
                                this._pendingTimeout = null;
                            }, delay);
                            return true;
                        }
                    }

                    // No delay needed or no ascension occurred
                    targetTab.click();
                    this.clearSelection();
                    return true;
                }
            }
        }

        // 3. Descend into nested component (going forward only)
        if (direction === 'next' && behavior.descendIntoNested) {
            // Get the active content panel
            const activeContent = container.querySelector(':scope > [data-content] > [data-tab].active');
            if (activeContent) {
                // Check if it has a nested tab component
                const nestedContainer = activeContent.querySelector('[data-yai-tabs]');
                if (nestedContainer) {
                    // Get first tab in nested component
                    const nestedTabs = Array.from(nestedContainer.querySelectorAll(':scope > nav[data-controller] [data-open]'));
                    if (nestedTabs.length > 0) {
                        const firstTab = nestedTabs[0];
                        if (firstTab && !firstTab.classList.contains('active')) {
                            firstTab.click();
                            this.clearSelection();
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    }

    // Orientation hint system
    showOrientationHint(container, detectedAxis) {
        if (!this.config.orientationAware) return;

        // Find the root component
        const getRoot = container.closest('[data-yai-tabs][data-orientation-hint]');
        if (!getRoot) return;

        // Find the content container in root (simple, stable location)
        const contentContainer = getRoot.querySelector(':scope > [data-content]');
        if (!contentContainer) return;

        // Find or create the hint element (always in root's [data-content])
        let hint = contentContainer.querySelector('.yai-orientation-hint');

        if (!hint) {
            // Create hint only once and append to root's content container
            hint = document.createElement('div');
            hint.className = 'yai-orientation-hint';
            hint.dataset.mousedownIgnore = true;
            contentContainer.appendChild(hint);
        }

        // Prepare new hint text
        const newHintText = detectedAxis === 'horizontal'
            ? '← Swipe horizontally →'
            : '↑ Swipe vertically ↓';

        // Skip update if nothing changed (prevents redundant DOM updates)
        if (hint.textContent === newHintText && hint.classList.contains(`yai-orientation-${detectedAxis}`)) {
            return;
        }

        // Update hint content and orientation class
        hint.textContent = newHintText;
        hint.className = `yai-orientation-hint yai-orientation-${detectedAxis}`;
    }

    /**
     * Extract X coordinate from mouse or touch event
     * @param {'mouse'|'touch'} moveType - Event type
     * @param {MouseEvent|TouchEvent} event - DOM event
     * @returns {number} X coordinate in pixels
     * @private
     */
    mouseGetXCoords(moveType, event) {
        if (moveType === 'mouse') {
            return event.clientX;
        }
        // Touch event - validate touches exist
        if (!event.touches || event.touches.length === 0) {
            console.warn('[YaiTabsSwipe] Touch event has no touches');
            return 0;
        }
        return event.touches[0].clientX;
    }

    /**
     * Extract Y coordinate from mouse or touch event
     * @param {'mouse'|'touch'} moveType - Event type
     * @param {MouseEvent|TouchEvent} event - DOM event
     * @returns {number} Y coordinate in pixels
     * @private
     */
    mouseGetYCoords(moveType, event) {
        if (moveType === 'mouse') {
            return event.clientY;
        }
        // Touch event - validate touches exist
        if (!event.touches || event.touches.length === 0) {
            console.warn('[YaiTabsSwipe] Touch event has no touches');
            return 0;
        }
        return event.touches[0].clientY;
    }

    /**
     * Determine semantic direction from deltas
     * @param {number} deltaX - Horizontal movement distance
     * @param {number} deltaY - Vertical movement distance
     * @returns {'left'|'right'|'up'|'down'|null} Semantic direction name
     * @private
     */
    getSemanticDirection(deltaX, deltaY) {
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        // Determine primary axis
        if (absX > absY) {
            // Horizontal movement - deltaX < 0 means moving left, deltaX > 0 means moving right
            return deltaX < 0 ? 'left' : 'right';
        } else if (absY > absX) {
            // Vertical movement - deltaY < 0 means moving up, deltaY > 0 means moving down
            return deltaY < 0 ? 'up' : 'down';
        }

        return null;  // No clear direction
    }

    /**
     * Get relative tab direction from semantic direction
     * @param {'left'|'right'|'up'|'down'} semanticDirection - Semantic direction
     * @returns {'next'|'prev'} Relative direction for tab switching
     * @private
     */
    getRelativeDirection(semanticDirection) {
        // Default behavior (reverseDirection = false):
        //   Swipe left/up = next tab (natural: push content away to reveal next)
        //   Swipe right/down = prev tab (natural: pull content back to reveal previous)

        // Reverse behavior (reverseDirection = true):
        //   Swipe left/up = prev tab
        //   Swipe right/down = next tab

        const isForward = (semanticDirection === 'left' || semanticDirection === 'up');

        if (this.config.reverseDirection) {
            return isForward ? 'prev' : 'next';
        } else {
            return isForward ? 'next' : 'prev';
        }
    }

    /**
     * Auto-detect axis from container's aria-orientation attribute
     * @param {HTMLElement} container - Tabs container element
     * @returns {'horizontal'|'vertical'|'both'} Detected axis
     * @private
     */
    detectAxisFromContainer(container) {
        const effectiveConfig = this.getEffectiveConfig();

        // If config axis is not 'auto', use config value
        if (effectiveConfig.axis !== 'auto') {
            return effectiveConfig.axis;
        }

        // Try to get aria-orientation from nav element or container
        const nav = container.querySelector(':scope > nav[data-controller]');
        const orientation = nav?.getAttribute('aria-orientation') || container.getAttribute('aria-orientation');

        // Map aria-orientation to axis
        if (orientation === 'vertical') {
            return 'vertical';
        } else if (orientation === 'horizontal') {
            return 'horizontal';
        }

        // Default to 'both' if no orientation specified
        return 'both';
    }

    /**
     * Handle drag/swipe start event, ignore elements in "data-swipe-ignore"
     * @param {'mouse'|'touch'} moveType - Event type
     * @param {MouseEvent|TouchEvent} event - DOM event
     * @param {HTMLElement} target - Target element
     * @private
     */
    mouseIsDown(moveType, event, target) {
        if (this.shouldIgnoreSwype(event)) return;

        const panel = this.getTabsPanel(target);
        if (!panel) return;

        const container = panel.closest('[data-yai-tabs]');
        if (!container) return;

        // Cancel any pending boundary transition
        if (this._pendingTimeout) {
            clearTimeout(this._pendingTimeout);
            this._pendingTimeout = null;
        }

        // Parse per-container config on first interaction (store in slideState, don't mutate this.config)
        if (!this.swipeState.attributesParsed) {
            this.swipeState.attributesParsed = true;
            this.swipeState.currentConfig = this.getMergedConfig(container);
        }

        const startX = this.mouseGetXCoords(moveType, event);
        const startY = this.mouseGetYCoords(moveType, event);

        this.swipeState.isDragging = true;
        this.swipeState.startX = startX;
        this.swipeState.currentX = startX;
        this.swipeState.startY = startY;
        this.swipeState.currentY = startY;
        this.swipeState.startTime = Date.now();
        this.swipeState.lockedAxis = null;  // Reset axis lock

        // Get effective config (merged with container attributes)
        const effectiveConfig = this.getEffectiveConfig();

        // Auto-detect axis if set to 'auto'
        if (container && effectiveConfig.axis === 'auto') {
            const detectedAxis = this.detectAxisFromContainer(container);
            // Temporarily store detected axis for this swipe
            this._currentAxis = detectedAxis;
        } else {
            this._currentAxis = effectiveConfig.axis;
        }

        if (container && container.dataset.inRoot && container.id) {
            if (this.swipeState.isDraggingNested === null) {
                this.swipeState.isDraggingNested = {};
            }
            if (!this.swipeState.isDraggingNested?.[container.id]) {
                this.swipeState.isDraggingNested[container.id] = true;
            }
        }

        panel.classList.add('dragging');

        // Execute swipeStart hook
        this._executeHook('swipeStart', {
            panel,
            moveType,
            startX,
            startY,
            event,
            target
        });
    }

    /**
     * Handle drag/swipe move event with visual feedback
     * @param {'mouse'|'touch'} moveType - Event type
     * @param {MouseEvent|TouchEvent} event - DOM event
     * @param {HTMLElement} target - Target element
     * @private
     */
    mouseIsMoving(moveType, event, target) {
        const panel = this.getTabsPanel(target);
        if (!panel) return;

        if (this.swipeState.isDragging) {
            this.swipeState.currentX = this.mouseGetXCoords(moveType, event);
            this.swipeState.currentY = this.mouseGetYCoords(moveType, event);

            const deltaX = this.swipeState.currentX - this.swipeState.startX;
            const deltaY = this.swipeState.currentY - this.swipeState.startY;

            // Get effective config for threshold checks
            const effectiveConfig = this.getEffectiveConfig();

            // Determine axis lock on first significant movement
            if (!this.swipeState.lockedAxis) {
                const absX = Math.abs(deltaX);
                const absY = Math.abs(deltaY);
                const lockThreshold = effectiveConfig.axisLockThreshold || 10;

                if (absX > lockThreshold || absY > lockThreshold) {
                    // Lock to the axis with more movement
                    this.swipeState.lockedAxis = absX > absY ? 'x' : 'y';
                }
            }

            // Apply transform based on locked axis and config
            let transform = '';
            let semanticDirection = this.getSemanticDirection(deltaX, deltaY);

            if (this.swipeState.lockedAxis === 'x' && (this._currentAxis === 'horizontal' || ['horizontal', 'both'].includes(effectiveConfig.axis))) {
                transform = `translateX(${deltaX * .5}px)`;
            }
            else if (this.swipeState.lockedAxis === 'y' && (this._currentAxis === 'vertical' || ['vertical', 'both'].includes(effectiveConfig.axis))) {
                transform = `translateY(${deltaY * .5}px)`;
            }
            else {
                transform = `translateX(${deltaX * .5}px)`;
            }

            panel.style.transform = transform;

            // Execute swipeMove hook
            this._executeHook('swipeMove', {
                panel,
                moveType,
                deltaX,
                deltaY,
                semanticDirection,
                lockedAxis: this.swipeState.lockedAxis,
                event,
                target
            });
        }
    }

    /**
     * Handle drag/swipe end event and trigger tab switch if threshold met
     * @param {'mouse'|'touch'} moveType - Event type
     * @param {MouseEvent|TouchEvent} event - DOM event
     * @param {HTMLElement} target - Target element
     * @private
     */
    mouseGoesUp(moveType, event, target) {
        const panel = this.getTabsPanel(target);
        if (!panel) return;

        if (this.swipeState.isDragging) {
            const deltaX = this.swipeState.currentX - this.swipeState.startX;
            const deltaY = this.swipeState.currentY - this.swipeState.startY;
            const semanticDirection = this.getSemanticDirection(deltaX, deltaY);

            // Get effective config for threshold checks
            const effectiveConfig = this.getEffectiveConfig();

            // Determine which delta to use based on locked axis
            const primaryDelta = this.swipeState.lockedAxis === 'y' ? deltaY : deltaX;
            const absDistance = Math.abs(primaryDelta);

            const threshold = moveType === 'mouse'
                ? effectiveConfig.threshold.desktop
                : effectiveConfig.threshold.mobile;

            // Reset visual state
            panel.classList.remove('dragging');
            panel.style.transform = '';

            let switched = false;

            // Switch tab if threshold exceeded and movement is on allowed axis
            const currentAxis = this._currentAxis || effectiveConfig.axis;
            const isHorizontalSwipe = this.swipeState.lockedAxis === 'x' && (currentAxis === 'horizontal' || currentAxis === 'both');
            const isVerticalSwipe = this.swipeState.lockedAxis === 'y' && (currentAxis === 'vertical' || currentAxis === 'both');

            if (absDistance > threshold && (isHorizontalSwipe || isVerticalSwipe)) {
                const container = this.getTabsContainer(panel);
                if (container && semanticDirection) {
                    const direction = this.getRelativeDirection(semanticDirection);
                    const offset = direction === 'next' ? 1 : -1;

                    // Execute beforeSwitch hook
                    const shouldSwitch = this._executeHook('beforeSwitch', {
                        panel, container, deltaX, deltaY, semanticDirection, moveType, direction, event, target
                    });

                    // Allow hook to cancel switch
                    if (shouldSwitch !== false) {
                        switched = this.switchToRelativeTab(container, offset);

                        // Handle boundary behavior if switch failed
                        if (!switched) {
                            switched = this.handleBoundaryBehavior(container, offset, direction);
                        }

                        // Execute afterSwitch hook
                        this._executeHook('afterSwitch', {
                            panel, container, deltaX, deltaY, semanticDirection, moveType, direction, switched, event, target
                        });
                    }
                }
            }

            this.swipeState.isDragging = false;
            this.swipeState.lockedAxis = null;
            this.swipeState.isDraggingNested = null;
            this.swipeState.attributesParsed = false;

            // Execute swipeEnd hook
            this._executeHook('swipeEnd', {
                panel, moveType, deltaX, deltaY, semanticDirection, absDistance, threshold, switched, event, target
            });
        }
    }

    clearSelection() {
        if (window.getSelection) {
            if (window.getSelection().empty) {
                window.getSelection().empty();
            } else if (window.getSelection().removeAllRanges) {
                window.getSelection().removeAllRanges();
            }
        }
    }

    /**
     * Execute a lifecycle callback hook with context data
     * @param {string} hookName - Name of the callback hook
     * @param {Object} context - Context data to pass to the callback
     * @param {Object} [instance] - Optional instance to check for hooks (defaults to this)
     * @returns {*} Result from callback execution
     * @private
     */
    _executeHook(hookName, context = {}, instance = this) {
        const callback = instance.config?.callable?.[hookName];
        if (typeof callback === 'function') {
            return callback(context, instance);
        }
        return undefined;
    }

    /**
     * Set a lifecycle callback hook
     * @param {string} hookName - Name of the callback hook
     * @param {Function} callback - Callback function to execute
     * @param {Object} [instance] - Optional instance to set hook on (defaults to this)
     * @returns {YaiTabsSwipe} Returns instance for chaining
     * @example
     * swype.hook('swipeStart', ({ panel, moveType }) => {
     *     console.log('Swipe started:', moveType);
     * });
     */
    hook(hookName, callback, instance = this) {
        if (!instance.config.callable) {
            instance.config.callable = {};
        }
        if (instance.config.callable.hasOwnProperty(hookName)) {
            instance.config.callable[hookName] = callback;
        }
        return instance;
    }

    /**
     * Attach event hooks to the YaiTabs instance
     *
     * Registers handlers for mouse (desktop) and touch (mobile) events.
     * Must be called after setInstance() to activate swipe navigation.
     *
     * @returns {YaiTabsSwipe} Returns this for chaining
     * @throws {Error} If tabs instance is not set
     * @example
     * const swype = new YaiTabsSwipe()
     *     .setInstance(tabs)
     *     .hook('swipeStart', ({ panel }) => console.log('Started!'))
     *     .watchHooks();
     */
    watchHooks() {
        if (!this.tabs) {
            throw new Error('YaiTabsSwipe: tabs instance not set. Call setInstance() first.');
        }

        // Mouse events (desktop)
        this.tabs.hook('eventMousedown', ({ event, target }) => {
            this.mouseIsDown('mouse', event, target);
        })
        .hook('eventMousemove', ({ event, target }) => {
            if (!this.swipeState.isDragging) return;
            this.mouseIsMoving('mouse', event, target);
        })
        .hook('eventMouseup', ({ event, target }) => {
            this.mouseGoesUp('mouse', event, target);
        });

        // Touch events (mobile)
        this.tabs.hook('eventTouchstart', ({ event, target }) => {
            this.mouseIsDown('touch', event, target);
        })
        .hook('eventTouchmove', ({ event, target }) => {
            if (!this.swipeState.isDragging) return;
            this.mouseIsMoving('touch', event, target);
        })
        .hook('eventTouchend', ({ event, target }) => {
            this.mouseGoesUp('touch', event, target);
        });

        return this;
    }

    /**
     * Extract configuration from data attributes on the container
     * @param {HTMLElement} container - Tabs container element
     * @returns {Object} Configuration overrides
     * @private
     */
    getConfigFromAttributes(container) {
        if (!container) return {};

        const config = {};
        const dataKey = this.config.dataConfigKey;
        // Axis configuration
        const axis = container.getAttribute(`${dataKey}-axis`);
        if (axis && ['horizontal', 'vertical', 'both', 'auto'].includes(axis)) {
            config.axis = axis;
        }

        // Thresholds
        const mobileThreshold = container.getAttribute(`${dataKey}-threshold-mobile`);
        const desktopThreshold = container.getAttribute(`${dataKey}-threshold-desktop`);
        if (mobileThreshold || desktopThreshold) {
            config.threshold = {
                ...this.config.threshold,
                ...(mobileThreshold && { mobile: parseInt(mobileThreshold) }),
                ...(desktopThreshold && { desktop: parseInt(desktopThreshold) })
            };
        }

        // Boundary behavior
        const circular = container.getAttribute(`${dataKey}-circular`);
        const descend = container.getAttribute(`${dataKey}-descend`);
        const ascend = container.getAttribute(`${dataKey}-ascend`);
        const delay = container.getAttribute(`${dataKey}-delay`);

        if (circular || descend || ascend || delay) {
            config.boundaryBehavior = {
                ...this.config.boundaryBehavior,
                ...(circular !== null && { circular: circular === 'true' }),
                ...(descend !== null && { descendIntoNested: descend === 'true' }),
                ...(ascend !== null && { ascendFromNested: ascend === 'true' }),
                ...(delay !== null && { transitionDelay: parseInt(delay) })
            };
        }

        // Reverse direction
        const reverse = container.getAttribute(`${dataKey}-reverse`);
        if (reverse !== null) {
            config.reverseDirection = reverse === 'true';
        }

        return config;
    }

    /**
     * Get the effective config for the current gesture (merged container config or default)
     * @returns {Object} Configuration object
     * @private
     */
    getEffectiveConfig() {
        return this.swipeState.currentConfig || this.config;
    }

    /**
     * Get merged configuration for a specific container
     * @param {HTMLElement} container - Tabs container element
     * @returns {Object} Merged configuration
     * @private
     */
    getMergedConfig(container) {
        const attributeConfig = this.getConfigFromAttributes(container);
        return {
            ...this.config,
            ...attributeConfig,
            threshold: {
                ...this.config.threshold,
                ...attributeConfig.threshold
            },
            boundaryBehavior: {
                ...this.config.boundaryBehavior,
                ...attributeConfig.boundaryBehavior
            }
        };
    }

    /**
     * Completely reset dragging state and clean up DOM
     * @returns {YaiTabsSwipe} Returns this for chaining
     */
    resetDraggingState() {
        // Cancel any pending boundary transition
        if (this._pendingTimeout) {
            clearTimeout(this._pendingTimeout);
            this._pendingTimeout = null;
        }

        // Reset internal state
        this.swipeState.isDragging = false;
        this.swipeState.startX = 0;
        this.swipeState.currentX = 0;
        this.swipeState.startY = 0;
        this.swipeState.currentY = 0;
        this.swipeState.startTime = 0;
        this.swipeState.lockedAxis = null;
        this.swipeState.attributesParsed = false;

        // Clean up DOM - find ALL elements that might have transforms
        // Target [data-tab] elements inside [data-swipe] containers
        const allTabPanels = document.querySelectorAll('[data-swipe] [data-tab]');

        allTabPanels.forEach(element => {
            // Remove dragging class if present
            element.classList.remove('dragging');

            // Always clear transform and transition (even if class was already removed)
            if (element.style.transform) {
                element.style.transform = '';
            }
            if (element.style.transition) {
                element.style.transition = '';
            }
        });

        // Also clean up any nested dragging state tracking
        if (typeof this.swipeState.isDraggingNested?.yaiArray !== 'undefined') {
            this.swipeState.isDraggingNested.yaiArray.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    const getTab = element.matches('[data-tab]') ? element : element.closest('[data-tab]');
                    if (getTab) {
                        getTab.classList.remove('dragging');
                        getTab.style.transform = '';
                        getTab.style.transition = '';
                        delete this.swipeState.isDraggingNested[id];
                    }
                }
            });
        }

        // Execute cancellation hook
        this._executeHook('dragCancelled', {
            reason: 'global_reset',
            draggedElements: Array.from(allTabPanels)
        });

        this.clearSelection();

        return this;
    }

    /**
     * Check if any drag operation is currently active
     * @returns {boolean} True if dragging is in progress
     */
    isDragging() {
        if (this.swipeState.isDraggingNested !== null) {
            const draggedNested = Object.keys(this.swipeState.isDraggingNested);
            if (draggedNested.length) {
                this.swipeState.isDraggingNested.yaiArray = draggedNested || [];
                this.swipeState.isDragging = true;
            }
        }
        return this.swipeState.isDragging;
    }
}

export {YaiTabsSwipe};
export default YaiTabsSwipe;
