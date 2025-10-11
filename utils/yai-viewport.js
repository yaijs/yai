"use strict";

/**
 * YaiViewport - Advanced Viewport Tracking System
 * High-performance viewport visibility tracking with spatial optimization for elements.
 */
class YaiViewport extends YEH {
    constructor(setConfig = {}) {
        const { throttle, ...restConfig } = setConfig;

        super({
            window: [
                { type: 'load',      options: { once: true } },
                { type: 'resize',    throttle: throttle?.resize || 500 },
                { type: 'scroll',    throttle: throttle?.scroll || 250 },
                { type: 'scrollend', throttle: throttle?.scrollend || 250 },
            ]
        });

        const defaultConfig = {
            set: {
                // CSS classes and data attributes for automatic state management
                selector: {
                    // Set null to disable specific marker
                    pageTop: 'yvp-is-page-top',                    // CSS class added to body when at page top
                    pageEnd: 'yvp-is-page-end',                    // CSS class added to body when at page bottom
                    pageScrolled: 'yvp-is-scrolled',               // CSS class added to body when scrolled past threshold

                    trackDistance: 'data-yvp-position',            // Attribute for element's viewport position
                    isVisibleAttr: 'data-yvp-is-visible',          // Boolean attribute for visibility state
                    isVisibleClass: 'yvp-is-visible',              // CSS class when element is visible
                    hasBeenVisibleClass: 'yvp-was-visible',        // CSS class added once element has been visible

                    isLeavingClass: 'yvp-is-leaving',              // CSS class when element starts leaving viewport
                    isLeavingTopClass: 'yvp-is-leaving-top',       // CSS class when element starts leaving from top
                    isLeavingBottomClass: 'yvp-is-leaving-bottom', // CSS class when element starts leaving from bottom

                    hasLeftClass: 'yvp-has-left',                  // CSS class when element left viewport
                    hasLeftTopClass: 'yvp-has-left-top',           // CSS class when element left from top
                    hasLeftBottomClass: 'yvp-has-left-bottom',     // CSS class when element left from bottom
                }
            },
            // Threshold configuration - pixel offsets for detection
            threshold: {
                pageTop: 0,                     // Trigger pageTop when scrollY <= this value
                pageEnd: 50,                    // Trigger pageEnd when near bottom (viewport height - this value)
                pageScrolled: 0,                // Trigger pageScrolled when scrollY > this value

                // Global fallbacks
                elementVisible: 0,              // Element considered visible when within viewport + this buffer
                elementHidden: 0,               // Element considered hidden when outside viewport - this buffer
                elementLeaving: 0,              // Element starts leaving when beyond viewport + this buffer
                elementLeft: 0,                 // Element completely left when beyond viewport + this buffer

                // Direction-specific thresholds
                elementVisibleTop: null,        // Top visibility buffer
                elementVisibleBottom: null,     // Bottom visibility buffer
                elementLeavingTop: null,        // Top leaving threshold
                elementLeavingBottom: null,     // Bottom leaving threshold
                elementLeftTop: null,           // Top left threshold
                elementLeftBottom: null,        // Bottom left threshold
            },
        }

        // Callback functions for lifecycle events
        const callbacks = {
            pageTop: null,              // Called when page reaches top
            pageEnd: null,              // Called when page reaches bottom
            pageScrolled: null,         // Called when page is scrolled past threshold
            afterLoad: null,            // Called once when page finishes loading
            afterResize: null,          // Called after viewport resize
            afterScroll: null,          // Called after scrolling
            elementVisible: null,       // Called when tracked element becomes visible
            elementHidden: null,        // Called when tracked element becomes hidden
            elementVisibleCheck: null,  // Permanent call to check visibility
            elementLeaving: null,       // Called when tracked element starts leaving viewport
            elementLeavingTop: null,    // Called when tracked element starts leaving viewport from top
            elementLeavingBottom: null, // Called when tracked element starts leaving viewport from bottom
            elementLeft: null,          // Called when tracked element completely leaves viewport
            elementLeftTop: null,       // Called when tracked element completely leaves viewport from top
            elementLeftBottom: null,    // Called when tracked element completely leaves viewport from bottom
        };

        this.config = {
            ...this.config,
            ...this._objectMerge(defaultConfig, restConfig),
            callbacks
        };

        // Spatial optimization system
        this._trackedElements = new Map();
        this._positionGrid = new Map();
        this._visibleRegions = new Set();

        // Track scroll position for relative calculations
        this._lastScrollY = 0;
        this._lastScrollEndY = 0;
        this._scrollDirection = 'down';
    }

    get scrollDirection() {
        return this._scrollDirection;
    }

    get isScrollingDown() {
        return this.scrollDirection === 'down';
    }

    get isScrollingUp() {
        return this.scrollDirection === 'up';
    }

    // YEH Event Handlers
    handleLoad(event) {
        this._updateViewportState();
        this._executeHook('afterLoad', {
            event,
            trackedElementsSize: this._trackedElements.size,
            trackedElements: this._trackedElements,
        });
    }

    handleResize(event) {
        this._refreshElementViewportPositions();
        this._updateViewportState();
        this._executeHook('afterResize', {
            event,
            viewport: { width: window.innerWidth, height: window.innerHeight }
        });
    }

    handleScroll(event) {
        this._scrollDirection = window.scrollY >= this._lastScrollEndY ? 'down' : 'up';
        this._updateViewportState();
        this._executeHook('afterScroll', { event, scrollY: window.scrollY });
        // Fallback for scrollend
        if (!('scrollend' in window)) {
            clearTimeout(this._scrollEndTimer);
            this._scrollEndTimer = setTimeout(() => this.handleScrollend(), 150);
        }
    }

    handleScrollend() {
        this._lastScrollEndY = window.scrollY;
    }

    _objectMerge(...objects) {
        const m = (t, s) => {
            Object.entries(s).forEach(([k, v]) => {
                t[k] = v && typeof v === 'object' ? m(t[k] || {}, v) : v;
            });
            return t;
        }
        return objects.reduce(m, {});
    }

    /**
     * Add elements to viewport tracking with spatial optimization
     */
    track(elements) {
        if (!elements || (typeof elements === 'string' && !elements.length)) return this;

        const elementList = typeof elements === 'string' ?
            document.querySelectorAll(elements) :
            (Array.isArray(elements) ? elements : [elements]);

        elementList.forEach(element => {
            if (!element || !element.getBoundingClientRect) return;

            if (this._trackedElements.has(element)) return;

            const rect = element.getBoundingClientRect();
            const positionKey = this._generatePositionKey(rect);

            // Store element data
            this._trackedElements.set(element, {
                key: positionKey,
                lastState: null,
                rect: rect,
                // Store absolute position for consistent tracking
                absoluteTop: rect.top + window.scrollY
            });

            // Add to spatial grid
            if (!this._positionGrid.has(positionKey)) {
                this._positionGrid.set(positionKey, new Set());
            }
            this._positionGrid.get(positionKey).add(element);

            // Initial state update
            const isVisible = this._isElementInViewport(rect, window.innerHeight, window.innerWidth);
            this._updateElementVisualState(element, rect, isVisible);

            // Set initial state
            const data = this._trackedElements.get(element);
            if (data) {
                data.lastState = isVisible ? 'visible' : 'hidden';
            }
        });

        return this;
    }

    /**
     * Generate spatial position key using RELATIVE viewport coordinates
     */
    _generatePositionKey(rect, gridSize = 1) {
        // Use viewport-relative coordinates that change with scroll
        const relativeTop = rect.top; // This changes as user scrolls
        const relativeLeft = rect.left;

        const x = Math.floor(relativeLeft / gridSize) * gridSize;
        const y = Math.floor(relativeTop / gridSize) * gridSize;
        return `${x},${y}`;
    }

    /**
     * Update body state classes
     */
    _updateBodyState(scrollY, pageHeight) {
        const body = document.body;
        const { pageTop, pageScrolled, pageEnd } = this.config.set.selector;

        const checkIfTop = scrollY <= this.config.threshold.pageTop;
        const checkIfEnd = scrollY + window.innerHeight >= pageHeight - this.config.threshold.pageEnd;
        const checkIfScrolled = scrollY > this.config.threshold.pageScrolled;

        if (checkIfTop) this._executeHook('pageTop', { scrollY: scrollY });
        if (checkIfEnd) this._executeHook('pageEnd', { scrollY: scrollY });
        if (checkIfScrolled) this._executeHook('pageScrolled', { scrollY: scrollY });

        if (pageTop) body.classList.toggle(pageTop, checkIfTop);
        if (pageEnd) body.classList.toggle(pageEnd, checkIfEnd);
        if (pageScrolled) body.classList.toggle(pageScrolled, checkIfScrolled);
    }

    /**
     * Update all tracked elements efficiently using spatial optimization
     */
    _updateViewportState() {
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const scrollY = window.scrollY;

        // Update body classes
        this._updateBodyState(scrollY, document.documentElement.scrollHeight);

        // Calculate currently visible regions
        this._updateVisibleRegions(viewportHeight);

        // Refresh element positions relative to viewport
        this._refreshElementViewportPositions();

        // Only check elements in potentially visible regions
        this._checkAllElements(viewportHeight, viewportWidth);

        this._lastScrollY = scrollY;
    }

    /**
     * Refresh element viewport-relative positions (called on every scroll)
     */
    _refreshElementViewportPositions() {
        this._positionGrid.clear(); // Clear the grid, we'll rebuild it

        this._trackedElements.forEach((data, element) => {
            if (!document.contains(element)) {
                this._untrackElement(element);
                return;
            }

            // Get fresh viewport-relative position
            const newRect = element.getBoundingClientRect();
            const newKey = this._generatePositionKey(newRect);

            // Update element data
            data.rect = newRect;
            data.key = newKey;

            // Re-add to spatial grid with new position
            if (!this._positionGrid.has(newKey)) {
                this._positionGrid.set(newKey, new Set());
            }
            this._positionGrid.get(newKey).add(element);
        });
    }

    /**
     * Update which spatial regions are currently visible
     */
    _updateVisibleRegions(viewportHeight) {
        this._visibleRegions.clear();

        const viewportTop = 0; // Always 0 in viewport coordinates
        const viewportBottom = viewportHeight;

        const startRegion = Math.floor(viewportTop / viewportHeight);
        const endRegion = Math.floor(viewportBottom / viewportHeight);

        for (let i = startRegion; i <= endRegion; i++) {
            this._visibleRegions.add(`region-${i}`);
        }
    }

    /**
     * Enhanced element state tracking with scroll direction awareness
     */
    _checkAllElements(viewportHeight, viewportWidth) {
        this._trackedElements.forEach((data, element) => {
            if (!document.contains(element)) {
                this._untrackElement(element);
                return;
            }

            const rect = data.rect;
            const isVisible = this._isElementInViewport(rect, viewportHeight, viewportWidth);
            const isLeaving = this._isElementLeaving(rect, viewportHeight, viewportWidth);
            const hasLeft = this._hasElementLeft(rect, viewportHeight, viewportWidth);

            if (isVisible && !data.hasBeenVisible) {
                data.hasBeenVisible = true;
            }

            // Only process transitions if element was previously tracked
            if (data.lastState !== null) {
                // Handle transitions from visible to leaving to hidden
                if (data.lastState === 'visible') {
                    if (isLeaving.leaving && !data.leaving) {
                        this._setElementLeaving(element, true, isLeaving.leavingTop ? 'top' : 'bottom');
                        data.leaving = true;

                        // Fire specific leaving hooks based on direction
                        if (isLeaving.leavingTop) {
                            this._executeHook('elementLeavingTop', { element, rect, state: 'leaving-top' });
                        }
                        if (isLeaving.leavingBottom) {
                            this._executeHook('elementLeavingBottom', { element, rect, state: 'leaving-bottom' });
                        }

                        // Also fire the general leaving hook
                        this._executeHook('elementLeaving', { element, rect, state: 'leaving', direction: isLeaving.leavingTop ? 'top' : 'bottom' });
                    }
                    else if (!isLeaving.leaving && data.leaving) {
                        this._setElementLeaving(element, false);
                        data.leaving = false;
                    }

                    if (hasLeft.left) {
                        this._setElementLeft(element, true, hasLeft.leftTop ? 'top' : 'bottom');
                        // Remove leaving marker
                        this._setElementLeaving(element, false);
                        this._updateElementVisualState(element, rect, false);

                        // FIRE ELEMENT HIDDEN HOOK HERE (when transitioning from visible to hidden)
                        this._executeHook('elementHidden', { element, rect, state: 'hidden', direction: hasLeft.leftTop ? 'top' : 'bottom' });

                        data.lastState = 'hidden';
                        data.leaving = false;

                        if (data.hasBeenVisible) {
                            element.classList.add(this.config.set.selector.hasBeenVisibleClass);
                        }

                        // Fire specific left hooks based on direction
                        if (hasLeft.leftTop) {
                            this._executeHook('elementLeftTop', { element, rect, state: 'left-top' });
                        }
                        if (hasLeft.leftBottom) {
                            this._executeHook('elementLeftBottom', { element, rect, state: 'left-bottom' });
                        }

                        // Also fire the general left hook
                        this._executeHook('elementLeft', { element, rect, state: 'left', direction: hasLeft.leftTop ? 'top' : 'bottom' });
                    }
                }

                // Handle transitions from hidden to visible
                if (data.lastState === 'hidden' && isVisible) {
                    this._setElementLeaving(element, false);
                    this._setElementLeft(element, false);
                    this._updateElementVisualState(element, rect, true);
                    data.lastState = 'visible';
                    data.leaving = false;
                    this._executeHook('elementVisible', { element, rect, state: 'visible' });
                } else if (isVisible) {
                    // Periodic chck
                    this._executeHook('elementVisibleCheck', { element, rect, state: isVisible ? 'visible' : 'hidden', isLeaving });
                }
            } else {
                // Initial state
                data.lastState = isVisible ? 'visible' : 'hidden';
                if (isVisible) {
                    this._updateElementVisualState(element, rect, true);
                    this._executeHook('elementVisible', { element, rect, state: 'visible' });
                } else {
                    this._executeHook('elementHidden', { element, rect, state: 'hidden' });
                }
            }
        });
    }

    /**
     * Check if element is leaving with direction-specific thresholds
     */
    _isElementLeaving(rect, viewportHeight) {
        const {
            elementLeaving = 0,
            elementLeavingTop = null,
            elementLeavingBottom = null
        } = this.config.threshold;

        // Use direction-specific thresholds or fall back to global
        const topThreshold = elementLeavingTop !== null ? elementLeavingTop : elementLeaving;
        const bottomThreshold = elementLeavingBottom !== null ? elementLeavingBottom : elementLeaving;

        // For top leaving: element's bottom is approaching viewport top
        const leavingTop = rect.bottom + topThreshold <= 0;

        // For bottom leaving: element's top is approaching viewport bottom
        const leavingBottom = rect.top - bottomThreshold >= viewportHeight;

        return {
            leaving: leavingTop || leavingBottom,
            leavingTop,
            leavingBottom,
            topThreshold,
            bottomThreshold
        };
    }

    /**
     * Check if element has completely left with direction-specific thresholds
     */
    _hasElementLeft(rect, viewportHeight) {
        const {
            elementLeft = 0,
            elementLeftTop = null,
            elementLeftBottom = null
        } = this.config.threshold;

        // Use direction-specific thresholds or fall back to global
        const topThreshold = elementLeftTop !== null ? elementLeftTop : elementLeft;
        const bottomThreshold = elementLeftBottom !== null ? elementLeftBottom : elementLeft;

        // For top exit: element's bottom crosses above viewport top
        const leftTop = rect.bottom + topThreshold <= 0;

        // For bottom exit: element's top crosses below viewport bottom
        const leftBottom = rect.top - bottomThreshold >= viewportHeight;

        return {
            left: leftTop || leftBottom,
            leftTop,
            leftBottom,
            topThreshold,
            bottomThreshold
        };
    }

    /**
     * Set element leaving state with direction classes
     */
    _setElementLeaving(element, isLeaving, direction = null) {
        const { isLeavingClass, isLeavingTopClass, isLeavingBottomClass } = this.config.set.selector;

        if (isLeavingClass) {
            element.classList.toggle(isLeavingClass, isLeaving);
        }

        // Remove direction classes first
        if (isLeavingTopClass) {
            element.classList.remove(isLeavingTopClass);
        }

        if (isLeavingBottomClass) {
            element.classList.remove(isLeavingBottomClass);
        }

        // Add direction-specific class if provided
        if (isLeaving && direction) {
            if (direction === 'top' && isLeavingTopClass) {
                element.classList.add(isLeavingTopClass);
            } else if (direction === 'bottom' && isLeavingBottomClass) {
                element.classList.add(isLeavingBottomClass);
            }
        }
    }

    /**
     * Set element left state with direction classes
     */
    _setElementLeft(element, hasLeft, direction = null) {
        const { hasLeftClass, hasLeftTopClass, hasLeftBottomClass } = this.config.set.selector;

        if (hasLeftClass) {
            element.classList.toggle(hasLeftClass, hasLeft);
        }

        // Remove direction classes first
        if (hasLeftTopClass) {
            element.classList.remove(hasLeftTopClass);
        }

        if (hasLeftBottomClass) {
            element.classList.remove(hasLeftBottomClass);
        }

        // Add direction-specific class if provided
        if (hasLeft && direction) {
            if (direction === 'top' && hasLeftTopClass) {
                element.classList.add(hasLeftTopClass);
            } else if (direction === 'bottom' && hasLeftBottomClass) {
                element.classList.add(hasLeftBottomClass);
            }
        }
    }

    /**
     * Update individual element's visual state
     */
    _updateElementVisualState(element, rect, isVisible) {
        const { trackDistance, isVisibleClass, isVisibleAttr } = this.config.set.selector;

        if (trackDistance) {
            const distanceTop = Math.max(0, rect.top);
            element.setAttribute(trackDistance, Math.round(distanceTop));
        }

        if (isVisibleClass) {
            element.classList.toggle(isVisibleClass, isVisible);
        }

        if (isVisibleAttr) {
            element.setAttribute(isVisibleAttr, isVisible ? 'true' : 'false');
        }
    }

    /**
     * Check if element is in viewport
     */
    _isElementInViewport(rect, viewportHeight, viewportWidth) {
        const {
            elementVisible = 0,
            elementVisibleTop = null,
            elementVisibleBottom = null
        } = this.config.threshold;

        // Use direction-specific thresholds or fall back to global
        const visibleTop = elementVisibleTop !== null ? elementVisibleTop : elementVisible;
        const visibleBottom = elementVisibleBottom !== null ? elementVisibleBottom : elementVisible;

        // Apply direction-specific thresholds to create "buffer zones"
        return (
            rect.top < viewportHeight + visibleBottom &&
            rect.bottom > 0 - visibleTop &&
            rect.left < viewportWidth &&
            rect.right > 0
        );
    }

    /**
     * Calculate visible percentage with threshold
     */
    _getVisiblePercentage(rect, viewportHeight) {
        const { elementVisible, elementHidden } = this.config.threshold;

        const visibleTop = Math.max(rect.top, 0 - elementHidden);
        const visibleBottom = Math.min(rect.bottom, viewportHeight + elementVisible);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);

        const percentage = (visibleHeight / rect.height) * 100;
        return Math.round(Math.max(0, Math.min(100, percentage)));
    }

    /**
     * Remove element from tracking
     */
    _untrackElement(element) {
        const data = this._trackedElements.get(element);
        if (data) {
            // Remove from spatial grid
            const gridSet = this._positionGrid.get(data.key);
            if (gridSet) {
                gridSet.delete(element);
                if (gridSet.size === 0) {
                    this._positionGrid.delete(data.key);
                }
            }
            this._trackedElements.delete(element);
        }
    }

    /**
     * Execute a lifecycle callback hook with context data
     */
    _executeHook(hookName, context = {}) {
        const callback = this.config.callbacks[hookName];
        if (typeof callback === 'function') {
            const scrollDirection = this._scrollDirection;
            return callback.call(this, context, scrollDirection, this);
        }
        return undefined;
    }

    /**
     * Set a lifecycle callback hook
     */
    hook(hookName, callback) {
        if (this.config.callbacks.hasOwnProperty(hookName)) {
            this.config.callbacks[hookName] = callback;
        }
        return this;
    }

    /**
     * Public API to refresh tracking (useful after dynamic content changes)
     */
    refresh() {
        this._refreshElementViewportPositions();
        this._updateViewportState();
        return this;
    }

    /**
     * Clean up
     */
    destroy() {
        this._trackedElements.clear();
        this._positionGrid.clear();
        this._visibleRegions.clear();
        super.destroy();
    }
}

export {YaiViewport};
export default YaiViewport;
