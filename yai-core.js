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
        /**
         * Shared configuration with sensible defaults
         */
        const baseConfig = this.getDefaultConfig();

        // Merge base emitable events with any custom emitable events
        if (customConfig.emitable) {
            customConfig.emitable = { ...YaiCore.getBaseEmitableEvents(), ...customConfig.emitable };
        } else {
            // Ensure base config gets base events if no custom emitable provided
            baseConfig.emitable = YaiCore.getBaseEmitableEvents();
        }

        this.config = this.deepMerge(baseConfig, customConfig);

        this.getUserPreferences();

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
                actionableAttributes: ['data-yai'],
                actionableTags: [],
            },

            // Dispatch
            dispatchName: 'yai.component',

            // Standardized emitable events base
            emitable: {
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
                contentError: 'contentError',

                // User interaction events
                change: 'change',
                open: 'open',
                close: 'close',

                // System events
                error: 'error',
                notification: 'notification',
                alert: 'alert',
            },

            // Lifecycle callback hooks
            callbacks: {
                // Essential hooks only
                setLoading: null,       // When loading state should be applied
                removeLoading: null,    // When loading state should be removed
                validateUrl: null,      // Custom URL validation for dynamic content loading
                sanitizeHtml: null,     // Custom HTML sanitization for dynamic content
                contentReady: null,     // When content is ready for animation
                afterLoad: null,        // After everything completes
            },
        };
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

        // Create methods object with component methods
        const methods = {
            click:      {      handleClick: (...args) => this.handleClick(...args) },
            keydown:    {    handleKeydown: (...args) => this.handleKeydown(...args) },
            hashchange: { handleHashchange: (...args) => this.handleHashchange(...args) },
        };

        // Merge with any additional methods from options
        if (options.methods) {
            this.deepMerge(methods, options.methods);
        }

        const finalOptions = {
            ...eventOptions,
            ...options,
            methods: methods,
            enableHandlerValidation: true
        };

        this.events = new YEH(selectors, aliases, finalOptions);
        return this.events;
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
        for (const key in source) {
            if (source[key] instanceof Object && !Array.isArray(source[key])) {
                target[key] = YaiCore.deepMerge(target[key] || {}, source[key]);
            } else {
                target[key] = source[key];
            }
        }
        return target;
    }

    /**
     * Generate unique IDs for components
     */
    static generateId(prefix = 'yai') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
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
            contentError: 'contentError',

            // User interaction events
            change: 'change',
            open: 'open',
            close: 'close',

            // System events
            error: 'error',
            notification: 'notification',
            alert: 'alert',
        };
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

    /**
     * Event dispatch utility (legacy)
     */
    dispatch(eventName, data, target) {
        if (this.events) {
            this.events.dispatch(eventName, data, target || document);
        }
    }

    simulateClick(element) {
        this.constructor.simulateClickEvent(element);
    }

    static simulateClickEvent(element) {
        element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }

    /**
     * Standardized event emission with namespacing
     * @param {string} eventName - Event name from this.config.emitable
     * @param {Object} details - Event details/data
     * @param {Element} target - Event target (default: document)
     */
    yaiEmit(eventName, details = {}, target = document) {
        // Get the standardized event name
        const standardEventName = this.config.emitable[eventName];

        if (!standardEventName) {
            console.warn(`YaiCore: Unknown emitable event '${eventName}'. Available events:`, Object.keys(this.config.emitable));
            return;
        }

        // Dispatch with YpsilonEventHandler
        if (this.events) {
            // Create namespaced event name
            const namespacedEvent = `${this.config.dispatchName}.${standardEventName}`;
            this.events.dispatch(namespacedEvent, details, target);
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

        // Cancel any existing fetch for this container
        this._cancelFetch(container);

        // Create new AbortController for this request
        const controller = new AbortController();
        this._fetchControllers.set(container, controller);

        // Find the trigger element (tab button/link that has data-url)
        const triggerElement = this.find(`[data-url="${url}"]`, container);

        // Show loading state using hook system
        this._executeHook('setLoading', { container: content, isLoading: true, target });

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

            // Apply post-fetch delays (data-post-delay, data-min-loading)
            await this._applyPostFetchDelays(target);

            // Sanitize HTML before injecting
            const sanitizedHtml = this._sanitizeHtml(html);

            if (append) {
                content.insertAdjacentHTML('beforeend', sanitizedHtml);
            } else {
                content.innerHTML = sanitizedHtml;

                // Remove load trigger attributes for DOM caching only if content was viewed
                if (triggerElement && !triggerElement.hasAttribute('data-url-refresh')) {
                    triggerElement.removeAttribute('data-url');
                    triggerElement.removeAttribute('data-target');
                    triggerElement.removeAttribute('data-append');
                }
            }

            // Initialize any nested YaiTabs components in the loaded content
            this._initializeNestedComponents(content);

            // Reset content height after dynamic content settles
            this._resetContentHeight(container);

            // Post-process the loaded content
            this._postProcessContent(content);

            // Execute contentReady hook (perfect timing for animations)
            this._executeHook('contentReady', { html, url, targetSelector, container, append, target, content });

            // Remove loading state (always cleanup, regardless of view status)
            this._executeHook('removeLoading', { container: content, isLoading: false, target });

            // Execute afterLoad hook
            this._executeHook('afterLoad', { html, url, targetSelector, container, append, target, content });

            // Dispatch content loaded event using standardized events
            this.yaiEmit('contentLoaded', { url, targetSelector, container, append });
        }
        catch (error) {
            // Handle AbortError (request was cancelled)
            if (error.name === 'AbortError') {
                return; // Request was cancelled, don't show error
            }

            console.warn('Failed to load content:', error);
            this.createErrorMessage(content, this.config.errorPlaceholder);

            // Execute error cleanup hooks
            this._executeHook('removeLoading', { container: content, isLoading: false, target, error });

            // Dispatch error event using standardized events
            this.yaiEmit('contentError', { url, targetSelector, container, error: error.message });
        }
        finally {
            // Clear ARIA busy state
            content.setAttribute('aria-busy', 'false');

            // Clean up fetch controller
            this._fetchControllers.delete(container);
        }
    }

    /**
     * Error message helper
     */
    createErrorMessage(content, error) {
        // Escape error message to prevent injection
        const errorText = String(error).replace(/[<>'"&]/g, (char) => {
            const escapeMap = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;' };
            return escapeMap[char];
        });
        content.innerHTML = `<div class="alert alert-danger">${errorText}</div>`;
        content.classList.add('error-occurred');
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
            this.dispatch('yai.tabs', {
                type: 'initializeNested',
                container: nestedContainer,
                parentContainer: content.closest('[data-yai-tabs]')
            });
        });
    }

    /**
     * Set loading state callback hook - override in components for custom loading behavior
     * @param {Element} container - The container to set loading state on
     * @param {boolean} isLoading - Whether to show loading state
     * @param {Element} target - The button/element that triggered the loading
     */
    setLoading() {}

    /**
     * Remove loading state callback hook - override in components for custom loading behavior
     * @param {Element} container - The container to remove loading state from
     * @param {Element} target - The button/element that triggered the loading
     */
    removeLoading() {}

    /**
     * Execute a lifecycle callback hook with context data
     * @param {string} hookName - Name of the callback hook
     * @param {Object} context - Context data to pass to the callback
     * @returns {*} Result from callback execution
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
     * @param {string} hookName - Name of the callback hook
     * @param {Function} callback - Callback function to execute
     * @returns {YaiCore} Returns this for chaining
     */
    hook(hookName, callback) {
        if (this.config.callbacks.hasOwnProperty(hookName)) {
            this.config.callbacks[hookName] = callback;
        }
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
        const customValidator = this.config.callbacks.validateUrl;
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

        // Block obviously malicious patterns (data: and javascript: schemes)
        if (url.match(/^(data|javascript):/i)) {
            console.warn(`${this.config.dispatchName}: Blocked potentially dangerous URL scheme:`, url);
            return false;
        }

        // Block URLs with suspicious characters that might indicate injection attempts
        if (url.match(/[<>'"]/)) {
            console.warn(`${this.config.dispatchName}: Blocked URL containing suspicious characters:`, url);
            return false;
        }

        // Allow relative paths (most common use case)
        if (!url.match(/^https?:/i)) {
            return true;
        }

        // For absolute URLs, basic validation
        try {
            new URL(url);
            return true;
        } catch (e) {
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
        const customSanitizer = this.config.callbacks.sanitizeHtml;
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
                if (attr.name.startsWith('on')) {
                    el.removeAttribute(attr.name);
                }
            });

            // Remove javascript: hrefs
            if (el.hasAttribute('href') && el.getAttribute('href').trim().toLowerCase().startsWith('javascript:')) {
                el.removeAttribute('href');
            }

            // Remove javascript: in other attributes
            ['src', 'action', 'formaction'].forEach(attr => {
                if (el.hasAttribute(attr) && el.getAttribute(attr).trim().toLowerCase().startsWith('javascript:')) {
                    el.removeAttribute(attr);
                }
            });
        });

        return temp.innerHTML;
    }

    /**
     * Post-process loaded content (override in components)
     * Base implementation is minimal - components should override for specific processing
     * @param {Element} container - The container with newly loaded content
     */
    _postProcessContent() {}

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

    getUserPreferences() {
        if (typeof window.matchMedia !== 'undefined') {
            return {
                reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
                colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
                highContrast: window.matchMedia('(prefers-contrast: high)').matches,
                touchDevice: window.matchMedia('(pointer: coarse)').matches,
                isMobile: window.matchMedia('(max-width: 768px)').matches
            };
        }

        // Fallback for older browsers
        return {
            reduceMotion: false,
            colorScheme: 'light',
            highContrast: false,
            touchDevice: false,
            isMobile: false
        };
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

// Universal module definition (UMD)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { YaiCore };
    module.exports.default = YaiCore;
} else if (typeof window !== 'undefined') {
    window['YaiCore'] = YaiCore;
}