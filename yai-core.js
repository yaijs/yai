"use strict";

/**
 * YaiCore - Foundation class for all Yai components
 * Provides shared utilities, event handler factory, and common patterns
 *
 * @method debounce           this.events.debounce
 * @method throttle           this.events.throttle
 * @method resolveMethodName  this.events.resolveMethodName
 */
class YaiCore {
    constructor(customConfig = {}) {
        // Shared configuration with sensible defaults
        const baseConfig = this.getDefaultConfig();

        this.config = baseConfig;

        this._safeShallowMerge(this.config, customConfig);

        // Handle callbacks alias for callable (backwards compatibility)
        if (customConfig.callbacks && typeof customConfig.callbacks === 'object') {
            if (!this.config.callable) {
                this.config.callable = {};
            }
            this._safeShallowMerge(this.config.callable, customConfig.callbacks);
        }

        // Handle emitable events with safety
        if (customConfig.emitable && typeof customConfig.emitable === 'object') {
            this.config.emitable = {
                ...YaiCore.getBaseEmitableEvents(),
                ...this._safeCopyConfig(customConfig.emitable)
            };
        } else {
            this.config.emitable = YaiCore.getBaseEmitableEvents();
        }

        /**
         * Shared state management
         */
        this.isProcessing = false;
        this.processingContainers = new Set();

        /**
         * Fetch abort controllers for dynamic content loading
         */
        this._fetchControllers = new Map();

        /**
         * High-performance DOM element cache - direct implementation
         */
        this._domCache = new Map();
        this._cacheStats = {
            hits: 0,
            misses: 0,
            totalQueries: 0
        };

        /**
         * Event handler will be created by factory method
         */
        this.events = null;
    }

    /**
     * Default configuration shared across all Yai components
     */
    getDefaultConfig() {
        return {
            // Dynamic content
            dynamicContent: true,
            errorPlaceholder: 'Failed to load content',

            // HTML sanitization - configurable list of elements to remove
            dangerousElements: ['script', 'object', 'embed', 'link[rel="import"]'],

            // Accessibility
            autoAccessibility: true,

            // Common selectors (can be overridden)
            selectors: {
                active: 'active',
                isLoading: 'yai-loading',
            },

            // Event system defaults
            events: {
                autoTargetResolution: true,
                enableDistanceCache: false,
                actionableAttributes: ['data-yai-action'],
                actionableClasses: [],
                actionableTags: [],
                setListener: null,
            },

            // Dispatch
            dispatchName: 'yai.component',

            // Lifecycle callback hooks for eventListeners
            callable: {
                // Event hub, configurable listeners
                // in tabs, where devs can hook in
                eventClick: null,
                eventKeydown: null,
                eventInput: null,
                eventChange: null,
                eventSubmit: null,
                eventBlur: null,
                eventFocus: null,
                eventHashchange: null,
                eventHashchangeSwitched: null,
                // Essential hooks only
                routeLoading: null,     // On hash change, while opening tabs based on location.hash
                routeLoaded: null,      // When hash-based routing completes, remove page loader
                globalMouseWatch: null, // Hook for Mouse events on defined element
                afterInit: null,
                contentLoading: null,   // When dynamic content fetch starts (show loading UI)
                contentPostLoading: null, // After Dynamic content is injected, but still is loading
                contentLoaded: null,    // When dynamic content fetch completes (hide loading UI)
                validateUrl: null,      // Custom URL validation for dynamic content loading
                sanitizeHtml: null,     // Custom HTML sanitization for dynamic content
                contentReady: null,     // When content is ready for animation
                afterLoad: null,        // After everything completes
                tabClicked: null,       // When a tab button gets clicked
                removingActiveContent: null,
            },
        };
    }

    /**
     * Static list of events that don't need data-attributes for auto-generation
     * These events are naturally captured through event delegation
     * Based on YEH's passiveEvents list + keyboard/mouse/focus events
     */
    static getSkipAutoGenerateEvents() {
        return [
            // Window/passive events
            'scroll', 'touchstart', 'touchmove', 'touchend', 'touchcancel',
            'wheel', 'mousewheel', 'pointermove', 'pointerenter', 'pointerleave',
            'resize', 'orientationchange', 'load', 'beforeunload', 'unload', 'hashchange',
            // Keyboard events (naturally captured)
            'keydown', 'keyup', 'keypress',
            // Mouse events (naturally captured)
            'mousedown', 'mousemove', 'mouseup', 'mouseover', 'mouseout', 'mouseenter', 'mouseleave',
            // Focus events (naturally captured)
            'focus', 'blur', 'focusin', 'focusout'
        ];
    }

    /**
     * Static base emitable events - consistent across all Yai components
     * These are non-overridable core events that every component should have
     */
    static getBaseEmitableEvents() {
        return {
            // Lifecycle events
            beforeInit: 'beforeInit',
            afterInit: 'afterInit',
            beforeDestroy: 'beforeDestroy',
            afterDestroy: 'afterDestroy',
            // State events
            processingStart: 'processingStart',
            processingEnd: 'processingEnd',
            stateChange: 'stateChange',
            // Content events
            contentLoaded: 'contentLoaded',
            contentReady: 'contentReady',
            contentError: 'contentError',
            loadingContent: 'loadingContent',
            initializeNested: 'initializeNested',
            lastActiveClosed: 'lastActiveClosed',
            // User interaction events
            change: 'change',
            open: 'open',
            close: 'close',
            tabClicked: 'tabClicked',
            hashChanged: 'hashChanged',
            updatingHash: 'updatingHash',
            usereventClick: 'usereventClick',
            userClick: 'userClick',
            userChange: 'userChange',
            userInput: 'userInput',
            userKeydown: 'userKeydown',
            userFocus: 'userFocus',
            userBlur: 'userBlur',
            userSubmit: 'userSubmit',
            // System events
            error: 'error',
            notification: 'notification',
            alert: 'alert',
            nested: "nested",
        }
    }

    /**
     * Factory method to create YpsilonEventHandler with component-specific config
     * @param {Object} selectors - Event listener selectors
     * @param {Object} aliases - Event method aliases
     * @param {Object} options - Additional event handler options
     * @returns {YpsilonEventHandler} Configured event handler instance
     */
    createEventHandler(selectors, aliases, options = {}) {
        const eventOptions = this.deepMerge(this.config.events, options);

        // Default event types required for tabs functionality
        const defaultEvents = ['click', 'keydown', 'hashchange'];

        // Extract event types from selectors (first parameter, not eventOptions!)
        const configuredEvents = this._extractEventTypes(selectors);

        // Find custom events
        const customEvents = configuredEvents.filter(event => !defaultEvents.includes(event));

        // Auto-generate callable hooks for custom events
        this._generateCallableHooks(customEvents);

        // Auto-generate method handlers for custom events if not provided
        this._generateMethodHandlers(customEvents, options);

        // Auto-generate data-attributes for all configured events
        this._autoGenerateActionableAttributes(configuredEvents, eventOptions);

        const methods = {
            click:      { handleClick: (...args) => this.handleEventProxy(...args) },
            keydown:    { handleKeydown: (...args) => this.handleKeydown(...args) },
            hashchange: { handleHashchange: (...args) => this.handleHashchange(...args) },
        };

        if (options.methods) {
            this._safeShallowMerge(methods, options.methods);
        }

        if (typeof this.config.callable.globalMouseWatch !== null) {
            methods.globalMouseWatch = (...args) => this.globalMouseWatch(...args);
        }

        const finalOptions = {
            ...eventOptions,
            ...options,
            actionableAttributes: eventOptions.actionableAttributes,
            methods: methods,
            enableHandlerValidation: true
        };

        this.events = new YEH(selectors, aliases, finalOptions);

        return this.events;
    }

    /**
     * Global Mouse/Touch Watcher - Universal Event Bridge
     *
     * Centralized hook for global mouse/touch events. Enables cross-component
     * coordination, drag cancellation, and stuck state recovery.
     *
     * See TypeScript definitions (yai-core.d.ts) for full documentation.
     *
     * @param {MouseEvent|TouchEvent} event - The original DOM event
     * @param {Element} target - The event target element
     * @param {Element} container - The closest component container element
     */
    globalMouseWatch(event, target, container) {
        this._executeHook('globalMouseWatch', { event, target, container, context: this });
    }

    // Helper method to extract event types from setListener config
    _extractEventTypes(setListener) {
        const events = new Set();

        for (const selector in setListener) {
            const listeners = setListener[selector];
            listeners.forEach(listener => {
                if (typeof listener === 'string') {
                    events.add(listener);
                } else if (listener.type) {
                    events.add(listener.type);
                }
            });
        }

        return Array.from(events);
    }

    _isDangerousKey(key) {
        const dangerous = ['__proto__', 'constructor', 'prototype'];
        return dangerous.includes(key);
    }

    // Generate callable hooks for custom events
    _generateCallableHooks(customEvents) {
        customEvents.forEach(eventType => {
            if (this._isDangerousKey(eventType)) return;

            const callableName = `event${this._capitalize(eventType)}`;

            // Only add if not already defined
            if (!this.config.callable.hasOwnProperty(callableName)) {
                this.config.callable[callableName] = null;
            }
        });
    }

    // Generate default method handlers for custom events if not provided
    _generateMethodHandlers(customEvents, options) {
        if (!options.methods) {
            options.methods = {};
        }

        customEvents.forEach(eventType => {
            if (this._isDangerousKey(eventType)) return;

            const methodName = `handle${this._capitalize(eventType)}`;

            // Only add default handler if not already provided
            if (!options.methods[eventType] || !options.methods[eventType][methodName]) {
                if (!options.methods[eventType]) {
                    options.methods[eventType] = {};
                }
                options.methods[eventType][methodName] = (...args) => {
                    const [event, target, container] = args;
                    const context = this;
                    const action = target.dataset[eventType] || null;

                    this._executeHook(`event${this._capitalize(eventType)}`, { event, target, container, action, context });
                };
            }
        });
    }

    // Auto-generate data-attributes for configured events
    _autoGenerateActionableAttributes(configuredEvents, eventOptions) {
        // Get skip list from static method (can be checked via YaiCore.getSkipAutoGenerateEvents())
        const skipEvents = YaiCore.getSkipAutoGenerateEvents();

        const autoAttributes = configuredEvents
            .filter(eventType => !skipEvents.includes(eventType))
            .map(eventType => `data-${eventType}`);

        // Merge: manual actionableAttributes + auto-generated + customAttributes
        if (!eventOptions.actionableAttributes) {
            eventOptions.actionableAttributes = [];
        }

        const customAttributes = eventOptions.customAttributes || [];

        eventOptions.actionableAttributes = [
            ...new Set([
                ...eventOptions.actionableAttributes,
                ...autoAttributes,
                ...customAttributes
            ])
        ];
    }

    // Utility to capitalize event names (mouseenter -> Mouseenter)
    _capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Safe shallow merge without prototype pollution risk
     */
    _safeShallowMerge(target, source) {
        if (!source || typeof source !== 'object') return;

        for (const key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key) &&
                key !== '__proto__' &&
                key !== 'constructor' &&
                key !== 'prototype') {
                target[key] = source[key];
            }
        }
    }

    /**
     * Deep merge utility for configuration objects
     */
    deepMerge(target, source) {
        return YaiCore.deepMerge(target, source);
    }

    /**
     * Static deep merge utility for configuration objects
     */
    static deepMerge(target, source) {
        // Handle null/undefined sources
        if (source == null || typeof source !== 'object') {
            return target;
        }

        // Always start with a fresh object or use existing target
        const result = target && typeof target === 'object' ? Object.create(null) : {};

        // Copy target properties safely if target is an object
        if (target && typeof target === 'object') {
            for (const key in target) {
                if (Object.prototype.hasOwnProperty.call(target, key) &&
                    key !== '__proto__' &&
                    key !== 'constructor' &&
                    key !== 'prototype') {
                    result[key] = target[key];
                }
            }
        }

        // Merge source properties safely
        for (const key in source) {
            // Skip dangerous keys and prototype properties
            if (!Object.prototype.hasOwnProperty.call(source, key) ||
                key === '__proto__' ||
                key === 'constructor' ||
                key === 'prototype') {
                continue;
            }

            const sourceVal = source[key];
            const targetVal = result[key];

            // Only merge if both values are plain objects (not arrays, not null)
            if (sourceVal && typeof sourceVal === 'object' &&
                !Array.isArray(sourceVal) &&
                targetVal && typeof targetVal === 'object' &&
                !Array.isArray(targetVal)) {
                // Recursive merge for objects
                result[key] = YaiCore.deepMerge(targetVal, sourceVal);
            } else {
                result[key] = sourceVal;
            }
        }

        return result;
    }

    /**
     * Create a safe copy of configuration by removing prototype pollution vectors
     * @param {Object} config - Configuration object to sanitize
     * @returns {Object} - Safe configuration copy
     */
    _safeCopyConfig(config) {
        if (!config || typeof config !== 'object' || Array.isArray(config)) {
            return {};
        }

        const safeConfig = Object.create(null);

        for (const key in config) {
            // Skip prototype properties and dangerous keys
            if (!Object.prototype.hasOwnProperty.call(config, key) ||
                key === '__proto__' ||
                key === 'constructor' ||
                key === 'prototype') {
                continue;
            }

            const value = config[key];

            // Recursively sanitize nested objects (but avoid circular references)
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                safeConfig[key] = this._safeCopyConfig(value);
            } else {
                safeConfig[key] = value;
            }
        }

        return safeConfig;
    }

    /**
     * Generate unique IDs for components
     */
    static generateId(prefix = 'yai') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }

    /**
     * Get element(s) with caching
     * @param {string} selector - CSS selector
     * @param {Object} options - Query options
     * @param {boolean} options.multiple - Return all matches (querySelectorAll)
     * @param {boolean} options.refresh - Force fresh DOM query
     * @param {Element|Document} options.scope - Query scope (default: document)
     * @returns {Element|NodeList|null}
     */
    _getCached(selector, options = {}) {
        this._cacheStats.totalQueries++;

        const {
            multiple = false,
            refresh = false,
            scope = document
        } = options;

        // Skip caching for :scope selectors or any scoped queries (not document-level)
        if (selector.includes(':scope') || scope !== document || refresh) {
            this._cacheStats.misses++;
            const method = multiple ? 'querySelectorAll' : 'querySelector';
            return scope[method](selector);
        }

        // Create cache key for non-scope selectors
        const scopeId = scope === document ? 'doc' : (scope.id || 'scope');
        const cacheKey = `${selector}:${multiple ? 'all' : 'one'}:${scopeId}`;

        // Return cached value if available
        if (this._domCache.has(cacheKey)) {
            const cached = this._domCache.get(cacheKey);
            // Validate cached value - ensure elements are still in DOM
            if (this._validateCached(cached, multiple)) {
                this._cacheStats.hits++;
                return cached;
            } else {
                // Remove invalid cache entry
                this._domCache.delete(cacheKey);
            }
        }

        // Query the DOM if not in cache
        this._cacheStats.misses++;
        const method = multiple ? 'querySelectorAll' : 'querySelector';
        const elements = scope[method](selector);

        // Only cache if we found something and it's not a scope selector
        if (elements && (multiple ? elements.length > 0 : elements.nodeType)) {
            this._domCache.set(cacheKey, elements);
        }

        return elements;
    }

    /**
     * Validate cached elements are still in DOM
     */
    _validateCached(cached, multiple) {
        if (!cached) return false;

        if (multiple) {
            // For NodeList, check if at least one element is still in DOM
            return cached.length > 0 && Array.from(cached).some(el => el.isConnected);
        } else {
            // For single element, check if it's still connected
            return cached.nodeType && cached.isConnected;
        }
    }

    /**
     * Cached DOM queries - performance optimized alternatives to querySelector
     */
    $(selector, options = {}) {
        return this._getCached(selector, { ...options, multiple: false });
    }

    $$(selector, options = {}) {
        return this._getCached(selector, { ...options, multiple: true });
    }

    /**
     * Get elements within a specific container scope
     */
    find(selector, container = document, options = {}) {
        return this._getCached(selector, { ...options, scope: container, multiple: false });
    }

    findAll(selector, container = document, options = {}) {
        return this._getCached(selector, { ...options, scope: container, multiple: true });
    }

    /**
     * Refresh cache for specific selectors or entire cache
     */
    refreshCache(selector = null) {
        if (selector) {
            // Remove all cache entries for this selector
            for (const key of this._domCache.keys()) {
                if (key.startsWith(selector + ':')) {
                    this._domCache.delete(key);
                }
            }
        } else {
            this._domCache.clear();
            this._cacheStats = { hits: 0, misses: 0, totalQueries: 0 };
        }
        return this;
    }

    /**
     * Get cache performance statistics
     */
    getCacheStats() {
        const hitRate = this._cacheStats.totalQueries > 0
            ? (this._cacheStats.hits / this._cacheStats.totalQueries * 100).toFixed(2)
            : 0;

        return {
            ...this._cacheStats,
            hitRate: `${hitRate}%`,
            cacheSize: this._domCache.size
        };
    }

    /**
     * Resolve template selectors with replacements
     */
    resolveSelector(selector, replacements = {}) {
        if (typeof selector !== 'string') throw new TypeError('Selector must be a string');

        let resolved = selector;
        for (const [key, value] of Object.entries(replacements)) {
            resolved = resolved.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        }

        return resolved;
    }

    /**
     * Resolve alias to method name using YpsilonEventHandler's built-in resolver
     */
    resolveAlias(alias, eventType) {
        return this.events ? this.events.resolveMethodName(alias, eventType) : null;
    }

    simulateClick(element) {
        this.constructor.simulateClickEvent(element);
    }

    static simulateClickEvent(element) {
        element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }

    yaiFocus(target, preventScroll = true) {
        if (target) {
            target.focus({ preventScroll })
        }
    }

    /**
     * Event dispatch utility (legacy)
     */
    dispatch(eventName, data, target) {
        if (this.events) {
            this.events.dispatch(eventName, data, target || document);
        }
    }

    /**
     * Standardized event emission with namespacing
     * @param {string} eventName - Event name from this.config.emitable
     * @param {Object} details - Event details/data
     */
    yaiEmit(eventName, details = {}) {
        // Get the standardized event name
        const standardEventName = this.config.emitable[eventName];

        if (!standardEventName) {
            console.warn(`YaiCore: Unknown emitable event '${eventName}'. Available events:`, Object.keys(this.config.emitable));
            return;
        }

        // Dispatch with YpsilonEventHandler
        if (this.events) {
            if (!details.container) {
                details.container = document
            }
            // Create namespaced event name
            const namespacedEvent = `${this.config.dispatchName}.${standardEventName}`;
            // Proxy handler
            this.events.dispatch(namespacedEvent, details);
        }
    }

    debounce(callback, timeout, key = 'debounced') {
        if (this.events) {
            this.events.debounce(() => callback(key), timeout, key).apply();
        } else {
            YEH.debounce(() => callback(), timeout, key).apply();
        }
    }

    /**
     * Processing/Loading state management
     */
    _setProcessingState(container, isProcessing) {
        if (isProcessing) {
            container.classList.add('processing');
            container.style.overflow = 'hidden';
            this.processingContainers.add(container);
            this.isProcessing = true;
        } else {
            container.classList.remove('processing');
            container.style.overflow = '';
            this.processingContainers.delete(container);
            this.isProcessing = this.processingContainers.size > 0;
        }

        // Dispatch processing state change using standardized events
        this.yaiEmit(isProcessing ? 'processingStart' : 'processingEnd', {
            container: container,
            globalProcessing: this.isProcessing
        });
    }

    /**
     * Check if any containers are currently processing
     */
    isAnyProcessing() {
        return this.isProcessing;
    }

    /**
     * Check if specific container is processing
     */
    isContainerProcessing(container) {
        return this.processingContainers.has(container);
    }

    /**
     * Parse URL hash into object
     */
    parseHash() {
        const hash = window.location.hash.slice(1);
        if (!hash) return {};

        try {
            const params = new URLSearchParams(hash);
            return Object.fromEntries(params);
        } catch (e) {
            console.warn('YaiTabs: Failed to parse hash', hash);
            return {};
        }
    }

    /**
     * Update URL hash from routeMap (immediate)
     * @param {Element} container - Optional container to determine history mode
     * @param {boolean} forceReplace - Force replace state (for programmatic sync)
     */
    updateHash(container = null, forceReplace = false) {
        const params = new URLSearchParams();
        for (const [refPath, tabId] of this.routeMap) {
            if (tabId) params.set(refPath, tabId);
        }
        const newHash = params.toString();

        if (newHash !== window.location.hash.slice(1)) {
            this.yaiEmit('updatingHash', {
                newHash, container: container && container.closest('[data-yai-tabs]')
            });
            // Default: 'replace' for cleaner URL history
            const historyMode = container?.dataset.historyMode || 'replace';

            if ((historyMode === 'replace' || forceReplace) && history.replaceState) {
                if (newHash === '') {
                    // Clear hash completely to avoid page scroll
                    const cleanUrl = window.location.origin + window.location.pathname + window.location.search;
                    history.replaceState(null, '', cleanUrl);
                } else {
                    history.replaceState(null, '', '#' + newHash);
                }
            } else {
                // push state (routable mini-app)
                if (newHash === '') {
                    // Clear hash completely to avoid page scroll
                    const cleanUrl = window.location.origin + window.location.pathname + window.location.search;
                    history.pushState(null, '', cleanUrl);
                } else {
                    window.location.hash = newHash;
                }
            }
        }
    }

    /**
     * Set minimum height on content area to prevent layout shifts
     * @param {Element} container - Container element
     * @param {string} selector - Content selector (default: '[data-content]')
     */
    _preserveContentHeight(container, selector='[data-content]') {
        const content = this.find(selector, container);
        if (content) {
            const currentHeight = content.offsetHeight;
            if (currentHeight > 0) {
                content.style.minHeight = currentHeight + 'px';
            }
        }
    }

    /**
     * Reset content height constraints and force recalculation
     * @param {Element} container - Container element
     * @param {string} selector - Content selector (default: '[data-content]')
     */
    _resetContentHeight(container, selector='[data-content]') {
        const content = this.find(selector, container);
        if (content) {
            content.style.minHeight = '';
            content.style.height = '';
            content.offsetHeight;
        }
    }

    /**
     * Cancel any in-flight fetch request for a container
     */
    _cancelFetch(container) {
        const controller = this._fetchControllers.get(container);
        if (controller) {
            controller.abort();
            this._fetchControllers.delete(container);
        }
    }

    /**
     * Dynamic content loading via fetch
     */
    async _loadContent(url, targetSelector, container, append = false, target = null) {
        if (!this.config.dynamicContent) return;

        const content = this.find(targetSelector, container);
        if (!content) return;

        this.yaiEmit('loadingContent', {
            url, targetSelector, container, parentContainer: content.closest('[data-yai-tabs]')
        });

        // Cancel any existing fetch for this container
        this._cancelFetch(container);

        // Create new AbortController for this request
        const controller = new AbortController();
        this._fetchControllers.set(container, controller);

        // Find the trigger element (tab button/link that has data-url)
        const triggerElement = this.find(`[data-url="${url}"]`, container);

        // Show loading state using hook system
        this._executeHook('contentLoading', { container: content, isLoading: true, target });

        if (!content.hasAttribute('aria-live')) {
            content.setAttribute('aria-live', 'polite');
        }

        // Check for delay attribute on the target element
        let delay = 0;
        if (target && target.hasAttribute('data-delay')) {
            delay = parseInt(target.getAttribute('data-delay'), 10) || 0;
        }

        // Apply delay if specified
        if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));

            // Check if request was cancelled during delay
            if (controller.signal.aborted) {
                return;
            }
        }

        try {
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const html = await response.text();

            // Sanitize HTML before injecting
            const sanitizedHtml = this._sanitizeHtml(html);

            if (append) {
                content.insertAdjacentHTML('beforeend', sanitizedHtml);
            } else {
                content.innerHTML = sanitizedHtml;
            }

            // Initialize any nested YaiTabs components in the loaded content
            this._initializeNestedComponents(content);

            // Process content while loading post injection in a hook
            this._executeHook('contentPostLoading', { html, url, targetSelector, container: content, target });

            // Process content async while loading indicator is still visible
            await this._processWhileLoading(content, target, triggerElement);

            // Apply post-fetch delays (data-post-delay, data-min-loading)
            await this._applyPostFetchDelays(target);

            // Remove load trigger attributes for DOM caching only if content was viewed
            if (triggerElement && !triggerElement.hasAttribute('data-url-refresh')) {
                triggerElement.removeAttribute('data-url');
                triggerElement.removeAttribute('data-target');
                triggerElement.removeAttribute('data-append');
            }

            // Post-process the loaded content
            this._postProcessContent(content);

            // Execute contentReady hook (perfect timing for animations)
            this._executeHook('contentReady', { html, url, targetSelector, container, append, target, content });

            // Remove loading state (always cleanup, regardless of view status)
            this._executeHook('contentLoaded', { container: content, isLoading: false, target });

            // Execute afterLoad hook
            this._executeHook('afterLoad', { html, url, targetSelector, container, append, target, content });

            // Dispatch content loaded event using standardized events
            this.yaiEmit('contentLoaded', { url, targetSelector, container, append });
        }
        catch (error) {
            // Handle AbortError (request was cancelled)
            if (error.name === 'AbortError') return;

            console.warn('Failed to load content:', error);
            const errorText = this.createErrorMessage(this.config.errorPlaceholder);

            content.innerHTML = `<div class="alert alert-danger yp-3">${errorText}</div>`;
            content.classList.add('error-occurred');
            content.classList.add('active');

            // Dispatch error event using standardized events
            this.yaiEmit('contentError', { url, targetSelector, container, error: error.message });
        }
        finally {
            // Clear ARIA busy state
            content.setAttribute('aria-busy', 'false');

            // Reset content height after dynamic content settles
            this._resetContentHeight(container);

            // Execute error cleanup hooks
            this._executeHook('contentLoaded', { container: content, isLoading: false, target });

            // Clean up fetch controller
            this._fetchControllers.delete(container);
        }
    }

    /**
     * Error message helper
     */
    createErrorMessage(error) {
        // Escape error message to prevent injection
        return String(error).replace(/[<>'"&]/g, (char) => {
            const escapeMap = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;' };
            return escapeMap[char];
        });
    }

    /**
     * Calculate nesting level more efficiently
     */
    _calculateNestingLevel(container) {
        let level = 0;
        let parent = container.parentElement;
        while (parent) {
            if (parent.matches(this.config.rootSelector)) level++;
            parent = parent.parentElement;
        }
        return level;
    }

    /**
     * Initialize nested components in dynamically loaded content
     */
    _initializeNestedComponents(content) {
        // Find any nested YaiTabs components that need initialization
        const nestedContainers = this.findAll('[data-yai-tabs]', content);

        nestedContainers.forEach(nestedContainer => {
            // Skip if already initialized (has event listeners attached)
            if (nestedContainer.hasAttribute('data-yai-initialized')) return;

            // Mark as initialized to prevent duplicate initialization
            nestedContainer.setAttribute('data-yai-initialized', 'true');

            // Dispatch event to initialize nested component (legacy dispatch for cross-component communication)
            this.yaiEmit('initializeNested', {
                container: nestedContainer,
                parentContainer: content.closest('[data-yai-tabs]')
            });
        });
    }

    /**
     * Content loading start callback hook - override in components for custom loading behavior
     * @param {Element} container - The container to set loading state on
     * @param {boolean} isLoading - Whether to show loading state
     * @param {Element} target - The button/element that triggered the loading
     */
    contentLoading() {}

    /**
     * Content loaded callback hook - override in components for custom loading behavior
     * @param {Element} container - The container to remove loading state from
     * @param {Element} target - The button/element that triggered the loading
     */
    contentLoaded() {}

    /**
     * Execute a lifecycle callback hook with context data
     * @param {string} hookName - Name of the callback hook
     * @param {Object} context - Context data to pass to the callback
     * @param {Object} [instance] - Optional instance to check for hooks (defaults to this)
     * @returns {*} Result from callback execution
     */
    _executeHook(hookName, context = {}, instance = this) {
        if (!this.events) {
            // Events not initialized - check if hook exists in config.callable
            const hook = this.config?.callable?.[hookName];
            if (typeof hook === 'function') {
                return hook(context, instance);
            }
            return undefined;
        }
        return this.events._executeHook(hookName, context, instance);
    }

    /**
     * Set a lifecycle callback hook
     * @param {string} hookName - Name of the callback hook
     * @param {Function} callback - Callback function to execute
     * @returns {YaiCore} Returns this for chaining
     */
    hook(hookName, callback, instance = this) {
        if (!this.events) {
            // Events not initialized - store hook in config.callable directly
            if (!this.config.callable) {
                this.config.callable = {};
            }
            this.config.callable[hookName] = callback;
            return this;
        }
        this.events.hook(hookName, callback, instance);
        return this;
    }

    /**
     * Validate URL for dynamic content loading
     * Supports custom validation via callback, with sensible defaults
     * @param {string} url - The URL to validate
     * @returns {boolean} - True if URL is safe to load
     */
    _validateUrl(url) {
        // Use custom validation callback if provided
        const customValidator = this.config.callable.validateUrl;
        if (typeof customValidator === 'function') {
            return customValidator.call(this, url);
        }

        // Default validation logic
        if (!url || typeof url !== 'string') {
            console.warn(`${this.config.dispatchName}: Invalid URL provided for dynamic content loading`);
            return false;
        }

        // Trim whitespace and normalize
        url = url.trim();

        // Block dangerous URL schemes using the same logic as _isDangerousUrl
        if (this._isDangerousUrl(url)) {
            console.warn(`${this.config.dispatchName}: Blocked potentially dangerous URL scheme:`, url);
            return false;
        }

        // Allow relative paths and absolute URLs with safe schemes
        if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../') ||
            url.startsWith('#') || url.startsWith('?')) {
            return true;
        }

        // For absolute URLs, validate properly
        try {
            const parsedUrl = new URL(url);

            // Only allow http, https, and relative protocols
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                console.warn(`${this.config.dispatchName}: Unsupported URL protocol:`, parsedUrl.protocol);
                return false;
            }

            return true;
        } catch (e) {
            // If URL parsing fails, it might be a relative URL
            if (!url.includes('://') && !url.includes(' ')) {
                return true;
            }

            console.warn(`${this.config.dispatchName}: Invalid URL format:`, url);
            return false;
        }
    }

    /**
     * Sanitize HTML content for dynamic loading
     * Supports custom sanitization via callback, with sensible defaults
     * Preserves safe HTML formatting while blocking dangerous elements
     * @param {string} html - The HTML content to sanitize
     * @returns {string} - Sanitized HTML content
     */
    _sanitizeHtml(html) {
        // Use custom sanitization callback if provided
        const customSanitizer = this.config.callable.sanitizeHtml;
        if (typeof customSanitizer === 'function') {
            return customSanitizer.call(this, html);
        }

        // Default sanitization logic
        if (!html || typeof html !== 'string') {
            return '';
        }

        // Create a temporary DOM element for parsing
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Remove dangerous elements (configurable via config.dangerousElements)
        if (this.config.dangerousElements && this.config.dangerousElements.length > 0) {
            const selector = this.config.dangerousElements.join(', ');
            const dangerousElements = temp.querySelectorAll(selector);
            dangerousElements.forEach(el => el.remove());
        }

        // Remove event handler attributes from all elements
        const allElements = temp.querySelectorAll('*');
        allElements.forEach(el => {
            // Remove all on* event attributes
            Array.from(el.attributes).forEach(attr => {
                if (attr.name.startsWith('on') && attr.name.length > 2) {
                    el.removeAttribute(attr.name);
                }
            });

            // Remove dangerous URLs from href and other attributes
            this._removeDangerousUrls(el);
        });

        return temp.innerHTML;
    }

    /**
     * Check if a URL is dangerous
     * @param {string} url - URL to check
     * @returns {boolean} - True if dangerous
     */
    _isDangerousUrl(url) {
        if (!url || typeof url !== 'string') {
            return false;
        }

        const trimmedUrl = url.trim().toLowerCase();

        // List of dangerous URL schemes
        const dangerousSchemes = [
            'javascript:',
            'vbscript:',
            'data:',
            'file:',
            'jar:',
            'livescript:',
            'mocha:',
            'feed:',
            'about:'
        ];

        // Check for dangerous schemes
        if (dangerousSchemes.some(scheme => trimmedUrl.startsWith(scheme))) {
            return true;
        }

        // Additional check for data: URLs that contain scripts
        if (trimmedUrl.startsWith('data:')) {
            // Block data URLs that might contain scripts or HTML
            const dangerousDataPattern = /^data:(?:text\/(?:javascript|html|xml)|application\/(?:x-javascript|xml|xhtml\+xml|json)|image\/svg\+xml)/i;
            if (dangerousDataPattern.test(trimmedUrl)) {
                return true;
            }

            // Also block base64 encoded data URLs that could be dangerous
            if (trimmedUrl.includes('base64') && trimmedUrl.length > 1000) {
                return true; // Very long base64 data URLs might be suspicious
            }
        }

        return false;
    }

    /**
     * Remove dangerous URLs from an element's attributes
     * @param {Element} el - DOM element to sanitize
     */
    _removeDangerousUrls(el) {
        const urlAttributes = ['href', 'src', 'action', 'formaction', 'background', 'poster', 'cite', 'data', 'codebase', 'profile'];

        urlAttributes.forEach(attr => {
            if (el.hasAttribute(attr)) {
                const url = el.getAttribute(attr);
                if (this._isDangerousUrl(url)) {
                    el.removeAttribute(attr);
                }
            }
        });

        // Special handling for form attributes
        if (el.tagName.toLowerCase() === 'form') {
            const action = el.getAttribute('action');
            if (this._isDangerousUrl(action)) {
                el.setAttribute('action', '#'); // Safe fallback
            }
        }

        // Special handling for object/embed tags
        if (['object', 'embed', 'applet'].includes(el.tagName.toLowerCase())) {
            const data = el.getAttribute('data');
            if (this._isDangerousUrl(data)) {
                el.removeAttribute('data');
            }
        }
    }

    /**
     * Post-process loaded content (override in components)
     * Base implementation is minimal - components should override for specific processing
     * @param {Element} container - The container with newly loaded content
     */
    _postProcessContent() {}

    /**
     * Process content while loading indicator is still visible
     * This phase runs AFTER initialization but BEFORE data-attributes are removed
     * All original data-attributes (data-url, data-target, etc.) are still intact
     *
     * Override this method in subclasses to:
     * - Transform/manipulate data-url or other attributes before cleanup
     * - Extract metadata from data-attributes for later use
     * - Setup observers or event listeners on fresh content
     * - Perform any custom processing during loading phase
     *
     * @param {Element} _content - The content container that received the HTML
     * @param {Element} _target - The button/element that triggered the loading
     * @param {Element} _triggerElement - The element with data-url attribute
     */
    async _processWhileLoading(_content, _target, _triggerElement) {
        // Empty hook - override in subclasses for custom processing
    }

    /**
     * Apply post-fetch delays - override in components for custom delay behavior
     * @param {Element} target - The button/element that triggered the loading
     */
    async _applyPostFetchDelays(target) {
        if (!target) return;

        // Check for post-delay attribute
        const postDelay = parseInt(target.getAttribute('data-post-delay'), 10) || 0;

        // Check for minimum loading time attribute
        const minLoading = parseInt(target.getAttribute('data-min-loading'), 10) || 0;

        // Apply the longer of the two delays
        const delayTime = Math.max(postDelay, minLoading);

        if (delayTime > 0) {
            await new Promise(resolve => setTimeout(resolve, delayTime));
        }
    }

    /**
     * Get user preferences and device capabilities
     * Uses a clean, straightforward approach without complex transforms
     */
    static getUserPreferences() {
        // Pre-check touch capability once (most reliable method)
        const hasTouchCapability = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        const deviceDetectionConfig = {
            reduceMotion: { mediaQuery: '(prefers-reduced-motion: reduce)', fallback: false },
            highContrast: { mediaQuery: '(prefers-contrast: high)',         fallback: false },
            isMobile:     { mediaQuery: '(max-width: 768px)',               fallback: false },
            hasHover:     { mediaQuery: '(hover: hover)',                   fallback: true },
            finePointer:  { mediaQuery: '(pointer: fine)',                  fallback: true },
            dataSaver:    { mediaQuery: '(prefers-reduced-data: reduce)',   fallback: false },
            darkContrast: { mediaQuery: '(prefers-color-scheme: dark) and (prefers-contrast: high)', fallback: false },
            colorScheme:  { mediaQuery: '(prefers-color-scheme: dark)', fallback: 'light', transform: (m) => m ? 'dark' : 'light' },
            touchDevice:  { mediaQuery: '(pointer: coarse)', fallback: hasTouchCapability },
            hasTouch:     { fallback:    hasTouchCapability },
        };

        const prefs = {};
        Object.entries(deviceDetectionConfig).forEach(([key, config]) => {
            if (config.mediaQuery && typeof window.matchMedia !== 'undefined') {
                try {
                    const matches = window.matchMedia(config.mediaQuery).matches;
                    prefs[key] = config.transform ? config.transform(matches) : matches;
                } catch (error) {
                    prefs[key] = config.fallback;
                }
            } else {
                prefs[key] = config.fallback;
            }
        });

        return prefs;
    }

    /**
     * Auto focus helper
     */
    static autoFocusContent(container, setFocus = true) {
        if (setFocus) {
            const activePanel = container.querySelector(':scope > [data-content] > [data-tab].active');
            if (activePanel) {
                const firstFocusable = activePanel.querySelector('button, [href], input, select, textarea, [tabindex="0"]');
                if (firstFocusable) {
                    firstFocusable.focus({ preventScroll: true });
                }
            }
        }
    }

    /**
     * Accessibility utilities
     */
    static _setupAccessibility(container, config = {}) {
        const {
            role = 'region',
            label = 'Interactive component',
            idPrefix = 'yai'
        } = config;

        if (!container.hasAttribute('role')) {
            container.setAttribute('role', role);
        }

        if (!container.hasAttribute('aria-label') && !container.hasAttribute('aria-labelledby')) {
            container.setAttribute('aria-label', label);
        }

        return YaiCore.generateId(idPrefix);
    }

    /**
     * Clear accessibility attributes
     */
    static _clearAccessibilityAttributes(element) {
        const attributes = [
            'role', 'aria-selected', 'aria-controls', 'aria-labelledby',
            'tabindex', 'aria-hidden', 'aria-expanded', 'aria-disabled'
        ];

        attributes.forEach(attr => element.removeAttribute(attr));
    }
}

export {YaiCore};
export default YaiCore;
