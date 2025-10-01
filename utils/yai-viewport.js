class YaiViewport extends YEH {
    constructor(setConfig = {}) {
        const { throttle, ...restConfig } = setConfig;

        super({
            window: [
                { type: 'load',   options: { once: true } },
                { type: 'resize', throttle: throttle?.resize || 1000 },
                { type: 'scroll', throttle: throttle?.scroll || 500 },
            ]
        });

        const defaultConfig = {
            set: {
                selector: {
                    trackDistance: 'data-yvp-position',
                    isVisibleAttr:  'data-yvp-is-visible',
                    isVisibleClass: 'yvp-is-visible',
                    pageTop: 'yvp-is-top',
                    pageEnd: 'yvp-is-page-end',
                    pageScrolled: 'yvp-is-scrolled',
                    isLeavingClass: 'yvp-is-leaving',
                    hasBeenVisibleClass: 'yvp-was-visible'
                }
            },
            callbacks: {
                afterLoad: null,
                afterResize: null,
                afterScroll: null,
                elementVisible: null,
                elementHidden: null,
                elementLeaving: null,
                elementLeft: null,
                pageTop: null,
                pageEnd: null,
                pageScrolled: null,
            },
            threshold: {
                pageTop: 0,
                pageEnd: 50,
                pageScrolled: 0,
                elementVisible: 0,
                elementHidden: 0,
                elementLeaving: 0,
                elementLeft: 0,
            }
        }

        this.config = { ...this.config, ...this._objectMerge(defaultConfig, restConfig) };

        // Spatial optimization system
        this._trackedElements = new Map();
        this._positionGrid = new Map();
        this._visibleRegions = new Set();

        // Track scroll position for relative calculations
        this._lastScrollY = 0;
    }

    // YEH Event Handlers
    handleLoad(event) {
        this._updateViewportState();
        this._executeHook('afterLoad', {
            event: event,
            trackedElements: this._trackedElements.size
        });
    }

    handleResize(event) {
        // Refresh all element positions on resize
        this._refreshElementViewportPositions();
        this._updateViewportState();
        this._executeHook('afterResize', {
            event: event,
            viewport: { width: window.innerWidth, height: window.innerHeight }
        });
    }

    handleScroll(event) {
        this._updateViewportState();
        this._executeHook('afterScroll', {
            event: event,
            scrollY: window.scrollY
        });
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
    _generatePositionKey(rect, gridSize = 100) {
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
        this._updateVisibleRegions(scrollY, viewportHeight);

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
    _updateVisibleRegions(scrollY, viewportHeight) {
        this._visibleRegions.clear();

        // Calculate visible regions based on viewport coordinates
        const viewportTop = 0; // Always 0 in viewport coordinates
        const viewportBottom = viewportHeight;

        const startRegion = Math.floor(viewportTop / viewportHeight);
        const endRegion = Math.floor(viewportBottom / viewportHeight);

        for (let i = startRegion; i <= endRegion; i++) {
            this._visibleRegions.add(`region-${i}`);
        }
    }

    /**
     * Enhanced element state tracking
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

            // Handle transitions from visible to leaving to hidden
            if (data.lastState === 'visible') {
                if (isLeaving && !data.leaving) {
                    // Element is starting to leave (but still technically visible)
                    this._setElementLeaving(element, true);
                    data.leaving = true;
                    this._executeHook('elementLeaving', { element, rect, state: 'leaving' });
                }
                else if (!isLeaving && data.leaving) {
                    // Element was leaving but came back into full visibility - ABORT LEAVING
                    this._setElementLeaving(element, false);
                    data.leaving = false;
                    this._executeHook('elementVisible', { element, rect, state: 'visible' });
                }

                if (hasLeft) {
                    // Element has completely left - remove both visible and leaving states
                    this._setElementLeaving(element, false);
                    this._updateElementVisualState(element, rect, false);
                    data.lastState = 'hidden';
                    data.leaving = false;

                    // MARK AS "WAS VISIBLE" ONLY WHEN IT LEAVES FOR THE FIRST TIME
                    if (data.hasBeenVisible) {
                        element.classList.add(this.config.set.selector.hasBeenVisibleClass);
                    }

                    this._executeHook('elementLeft', { element, rect, state: 'left' });
                }
            }

            // Handle transitions from hidden to visible
            if (data.lastState === 'hidden' && isVisible) {
                // Remove leaving state if it was set
                this._setElementLeaving(element, false);
                this._updateElementVisualState(element, rect, true);
                data.lastState = 'visible';
                data.leaving = false;
                this._executeHook('elementVisible', { element, rect, state: 'visible' });
            }

            // Handle initial state
            if (data.lastState === null) {
                if (isVisible) {
                    this._updateElementVisualState(element, rect, true);
                    data.lastState = 'visible';
                    this._executeHook('elementVisible', { element, rect, state: 'visible' });
                } else {
                    data.lastState = 'hidden';
                }
            }
        });
    }

    /**
     * Check if element is in the "leaving" zone
     * (uses the same logic as elementHidden threshold but for leaving state)
     */
    _isElementLeaving(rect, viewportHeight, viewportWidth) {
        const { elementLeaving = 0 } = this.config.threshold;

        return (
            rect.top > viewportHeight + elementLeaving ||
            rect.bottom < 0 - elementLeaving ||
            rect.left > viewportWidth + elementLeaving ||
            rect.right < 0 - elementLeaving
        );
    }

    /**
     * Check if element has completely left (uses elementHidden threshold)
     */
    _hasElementLeft(rect, viewportHeight, viewportWidth) {
        const { elementLeft = 0 } = this.config.threshold;

        return (
            rect.bottom <= 0 - elementLeft ||
            rect.top >= viewportHeight + elementLeft ||
            rect.right <= 0 - elementLeft ||
            rect.left >= viewportWidth + elementLeft
        );
    }

    /**
     * Set element leaving state (independent of visibility)
     */
    _setElementLeaving(element, isLeaving) {
        const { isLeavingClass, isVisibleClass } = this.config.set.selector;

        if (isLeavingClass) {
            element.classList.toggle(isLeavingClass, isLeaving);
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
        const { elementVisible, elementHidden } = this.config.threshold;

        // Apply thresholds to create a "buffer zone"
        return (
            rect.top < viewportHeight + elementVisible &&
            rect.bottom > 0 - elementHidden &&
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
            return callback.call(this, context, this);
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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { YaiViewport };
    module.exports.default = YaiViewport;
} else if (typeof window !== 'undefined') {
    window['YaiViewport'] = YaiViewport;
}
