"use strict";

/**
 * YEH (Yai Event Hub) - Lightweight multi-handler event system with closest-match DOM resolution.
 * Simplifies event management by centralizing listeners and providing advanced event delegation and routing options.
 */
class YEH {
    constructor(eventMapping = {}, aliases = {}, config = {}) {
        this.config = {
            enableStats: false,
            methods: null,
            enableGlobalFallback: false,
            methodsFirst: false,
            passiveEvents: null,
            abortController: false,
            autoTargetResolution: false,
            targetResolutionEvents: null,
            enableConfigValidation: false,
            enableHandlerValidation: false,
            stopPropagation: true,
            enableDistanceCache: false,
            autoPreventDefault: [],
            callable: {},
            ...config,
        };
        this.eventMapping = eventMapping;
        this.aliases = aliases;
        this.enableStats = this.config.enableStats;
        this.methods = this.config.methods || {};
        this.enableGlobalFallback = this.config.enableGlobalFallback;
        this.methodsFirst = this.config.methodsFirst;
        this.eventListeners = new Map();
        this.elementHandlers = new WeakMap();
        this.eventHandlerMap = new Map();
        this.throttleTimers = new Map();
        this.debounceTimers = new Map();
        this.userHasInteracted = false;
        this.passiveSupported = false;
        this.passiveEvents = this.config.passiveEvents || [
            'scroll', 'touchstart', 'touchmove', 'touchend', 'touchcancel',
            'wheel', 'mousewheel', 'pointermove', 'pointerenter', 'pointerleave',
            'resize', 'orientationchange', 'load', 'beforeunload', 'unload'
        ];
        this.config.callable.beforeHandleEvent = null;
        this.config.callable.afterHandleEvent = null;
        this.handlerPrefix = this.config.handlerPrefix !== undefined ? this.config.handlerPrefix : 'handle';
        this.abortController = this.config.abortController ? new AbortController() : null;
        this.autoTargetResolution = this.config.autoTargetResolution;
        this.targetResolutionEvents = this.config.targetResolutionEvents || ['click', 'touchstart', 'touchend', 'mousedown', 'mouseup'];

        // DOM Distance Cache for performance optimization
        this.distanceCache = new WeakMap();
        this.enableDistanceCache = this.config.enableDistanceCache; // Default: enabled

        // Configurable actionable target patterns
        this.actionableConfig = {
            attributes: this.config.actionableAttributes || ['data-action'],
            classes: this.config.actionableClasses || ['yeh-event'],
            tags: this.config.actionableTags || [],
            enabled: this.config.enableActionableTargets !== false // Default: enabled
        };

        if (this.config.enableConfigValidation) {
            this.validateConfiguration();
        }

        this.detectPassiveSupport();
        this.registerEvents();
    }

    handleEvent(event) {
        const handlers = this.eventHandlerMap.get(event.type);
        if (!handlers || handlers.length === 0) return;

        this.checkUserInteraction(event);

        // Find the closest handler by checking which element is closest to event.target
        let closestHandler = null;
        let closestDistance = Infinity;

        for (const handlerInfo of handlers) {
            const distance = this.calculateDistanceWithCache(event.target, handlerInfo.element);

            if (distance !== Infinity && distance < closestDistance) {
                closestDistance = distance;
                closestHandler = handlerInfo;
            }
        }

        if (closestHandler) {
            const handler = this.resolveHandler(closestHandler.handler, event.type);
            if (handler) {
                // Use smart target resolution for problematic events if enabled
                let resolvedTarget = event.target;
                if (this.autoTargetResolution && this.targetResolutionEvents.includes(event.type)) {
                    const actionableTarget = this.findActionableTarget(event.target, closestHandler.element);

                    if (actionableTarget) {
                        resolvedTarget = actionableTarget;
                    } else if (this.actionableConfig.enabled) {
                        return; // If no actionable target found
                    }
                }
                // Find the actual closest matching element for this event target
                const actualClosestElement = this.findClosest(event.target, closestHandler.selector);

                // Execute beforeHandleEvent hook
                this._executeHook('beforeHandleEvent', {
                    event,
                    target: resolvedTarget,
                    element: actualClosestElement,
                    eventType: event.type,
                    handler: closestHandler.handler
                });

                // Call the actual handler
                const result = handler.call(this, event, resolvedTarget, actualClosestElement);

                // Execute afterHandleEvent hook
                this._executeHook('afterHandleEvent', {
                    event,
                    target: resolvedTarget,
                    element: actualClosestElement,
                    eventType: event.type,
                    handler: closestHandler.handler,
                    result
                });

                // Auto preventDefault if configured (per-event config takes precedence)
                const eventConfig = closestHandler.config;
                const shouldPreventDefault = typeof eventConfig === 'object' && eventConfig.preventDefault !== undefined
                    ? eventConfig.preventDefault
                    : this.config.autoPreventDefault.includes(event.type);

                if (shouldPreventDefault) {
                    event.preventDefault();
                }

                if (this.config.stopPropagation !== false) {
                    event.stopPropagation();
                }

                return;
            }
        }
    }

    _executeHook(hookName, context = {}, instance = this) {
        const callbacks = instance.config?.callable?.[hookName];
        if (!callbacks) return;

        const results = [];
        for (const callback of callbacks) {
            if (typeof callback === 'function') {
                results.push(callback(context, instance));
            }
        }

        return results;
    }

    hook(hookName, callback, instance = this) {
        if (!instance.config.callable) {
            instance.config.callable = {};
        }
        if (!instance.config.callable[hookName]) {
            instance.config.callable[hookName] = [];
        }
        instance.config.callable[hookName].push(callback);
        return instance;
    }

    unhook(hookName, callback, instance = this) {
        const callbacks = instance.config?.callable?.[hookName];
        if (callbacks) {
            instance.config.callable[hookName] = callbacks.filter(cb => cb !== callback);
        }
        return instance;
    }

    clearHooks(hookName, instance = this) {
        if (instance.config?.callable) {
            delete instance.config.callable[hookName];
        }
        return instance;
    }

    /**
     * Register a custom event listener dynamically
     * @param {string} type - Event type to listen for
     * @param {string|Function} handler - Handler method name or function closure
     * @param {string|Element} target - Target selector or element (defaults to 'document')
     * @returns {YEH} - Returns this for chaining
     */
    on(type, handler, target) {
        this.addEvent(target || 'document', { type, handler });
        return this;
    }

    subscribe(type, handler, target) {
        this.on(type, handler, target);
        return this;
    }

    emit(type, detail, target) {
        if (typeof target === 'string') {
            target = document.querySelector(target);
        }
        this.dispatch(type, detail, target || document);
        return this;
    }

    hasUserInteracted() {
        return this.userHasInteracted;
    }

    resetUserInteracted() {
        this.userHasInteracted = false;
    }

    checkUserInteraction(event) {
        if (!this.userHasInteracted && !this.passiveEvents.includes(event.type)) {
            this.userHasInteracted = true;
        }
    }

    /**
     * Calculate DOM distance with caching for performance optimization
     * @private
     */
    calculateDistanceWithCache(target, container) {
        if (!this.enableDistanceCache) {
            return this.calculateDOMDistance(target, container);
        }

        // Early returns for common cases
        if (container === document || container === window) {
            return 1000;
        }

        // Check if target is even contained by container
        if (!container.contains?.(target)) {
            return Infinity;
        }

        // Get or create target's cache
        let targetCache;
        if (this.distanceCache.has(target)) {
            targetCache = this.distanceCache.get(target);
        } else {
            targetCache = new WeakMap();
            this.distanceCache.set(target, targetCache);
        }

        // Check container cache
        if (targetCache.has(container)) {
            return targetCache.get(container);
        }

        const distance = this.calculateDOMDistance(target, container);
        targetCache.set(container, distance);

        return distance;
    }

    /**
     * Calculate actual DOM distance between elements
     * @private
     */
    calculateDOMDistance(target, container) {
        if (container === document || container === window) {
            return 1000; // Low priority for document/window
        }

        if (!container.contains || !container.contains(target)) {
            return Infinity; // Not contained
        }

        let distance = 0;
        let current = target;

        while (current && current !== container) {
            current = current.parentNode;
            distance++;
        }

        return distance;
    }

    /**
     * Clear distance cache (useful for dynamic DOM changes)
     */
    clearDistanceCache() {
        this.distanceCache = new WeakMap();
    }

    /**
     * Validate configuration and provide helpful error messages
     * @private
     */
    validateConfiguration() {
        if (!this.eventMapping || typeof this.eventMapping !== 'object') {
            throw new Error('YEH: eventMapping must be a non-null object');
        }

        for (const [selector, config] of Object.entries(this.eventMapping)) {
            this.validateSelectorConfig(selector, config);
        }

        this.validateActionableConfig();
    }

    /**
     * Validate individual selector configuration
     * @private
     */
    validateSelectorConfig(selector, config) {
        if (!selector || typeof selector !== 'string') {
            throw new Error(`YEH: Selector must be a non-empty string, got: ${typeof selector}`);
        }

        if (!Array.isArray(config)) {
            throw new Error(`YEH: Config for selector "${selector}" must be an array, got: ${typeof config}`);
        }

        if (config.length === 0) {
            throw new Error(`YEH: Config for selector "${selector}" cannot be empty`);
        }

        config.forEach((eventConfig, index) => {
            this.validateEventConfig(selector, eventConfig, index);
        });
    }

    /**
     * Validate individual event configuration
     * @private
     */
    validateEventConfig(selector, eventConfig, index) {
        if (typeof eventConfig === 'string') {
            if (!eventConfig.trim()) {
                throw new Error(`YEH: Event type for selector "${selector}" at index ${index} cannot be empty`);
            }
            return; // Simple string config is valid
        }

        if (!eventConfig || typeof eventConfig !== 'object') {
            throw new Error(`YEH: Event config for selector "${selector}" at index ${index} must be string or object, got: ${typeof eventConfig}`);
        }

        if (!eventConfig.type || typeof eventConfig.type !== 'string') {
            throw new Error(`YEH: Event config for selector "${selector}" at index ${index} must have a valid "type" property`);
        }

        // Validate throttle/debounce values
        if (eventConfig.throttle !== undefined) {
            if (typeof eventConfig.throttle !== 'number' || eventConfig.throttle <= 0) {
                throw new Error(`YEH: Throttle value for selector "${selector}" at index ${index} must be a positive number, got: ${eventConfig.throttle}`);
            }
        }

        if (eventConfig.debounce !== undefined) {
            if (typeof eventConfig.debounce !== 'number' || eventConfig.debounce <= 0) {
                throw new Error(`YEH: Debounce value for selector "${selector}" at index ${index} must be a positive number, got: ${eventConfig.debounce}`);
            }
        }

        // Can't have both throttle and debounce
        if (eventConfig.throttle && eventConfig.debounce) {
            throw new Error(`YEH: Event config for selector "${selector}" at index ${index} cannot have both throttle and debounce`);
        }

        // Validate handler name if provided
        if (eventConfig.handler !== undefined && typeof eventConfig.handler !== 'string') {
            throw new Error(`YEH: Handler for selector "${selector}" at index ${index} must be a string, got: ${typeof eventConfig.handler}`);
        }
    }

    /**
     * Validate actionable target configuration
     * @private
     */
    validateActionableConfig() {
        if (this.config.actionableAttributes !== undefined) {
            if (!Array.isArray(this.config.actionableAttributes)) {
                throw new Error('YEH: actionableAttributes must be an array of strings');
            }
            for (const attr of this.config.actionableAttributes) {
                if (typeof attr !== 'string' || !attr.trim()) {
                    throw new Error('YEH: actionableAttributes must contain non-empty strings');
                }
            }
        }

        if (this.config.actionableClasses !== undefined) {
            if (!Array.isArray(this.config.actionableClasses)) {
                throw new Error('YEH: actionableClasses must be an array of strings');
            }
            for (const className of this.config.actionableClasses) {
                if (typeof className !== 'string' || !className.trim()) {
                    throw new Error('YEH: actionableClasses must contain non-empty strings');
                }
            }
        }

        if (this.config.actionableTags !== undefined) {
            if (!Array.isArray(this.config.actionableTags)) {
                throw new Error('YEH: actionableTags must be an array of strings');
            }
            for (const tagName of this.config.actionableTags) {
                if (typeof tagName !== 'string' || !tagName.trim()) {
                    throw new Error('YEH: actionableTags must contain non-empty strings');
                }
            }
        }

        if (this.config.enableActionableTargets !== undefined && typeof this.config.enableActionableTargets !== 'boolean') {
            throw new Error('YEH: enableActionableTargets must be a boolean');
        }

        if (this.config.handlerPrefix !== undefined && typeof this.config.handlerPrefix !== 'string') {
            throw new Error('YEH: handlerPrefix must be a string');
        }
    }

    /**
     * Get DOM elements from selector string or element reference
     * @private
     */
    getElements(selector) {
        if (typeof selector === 'string') {
            if (selector === 'document') return [document];
            if (selector === 'window') return [window];
            return Array.from(document.querySelectorAll(selector));
        }
        return selector instanceof Element ? [selector] : [];
    }

    /**
     * Create a wrapped handler with throttle/debounce if needed
     * @private
     */
    createWrappedHandler(eventConfig, key, eventType) {
        let handler = this;

        if (typeof eventConfig === 'object') {
            // Warn if mixing debounce/throttle with preventDefault
            if ((eventConfig.debounce || eventConfig.throttle) && eventConfig.preventDefault !== undefined) {
                console.warn(
                    `YEH: Mixing debounce/throttle with preventDefault on '${eventType}' event is not recommended. ` +
                    `preventDefault requires immediate execution, but debounce/throttle delays handler execution. ` +
                    `Use either rate-limiting (debounce/throttle) OR preventDefault, not both.`
                );
            }

            if (eventConfig.throttle) {
                const options = {
                    leading: eventConfig.leading !== false,  // Default true
                    trailing: eventConfig.trailing !== false  // Default true
                };
                handler = {
                    handleEvent: this.throttle(
                        (event) => this.handleEvent(event),
                        eventConfig.throttle,
                        `${key}-${eventType}-throttle`,
                        options
                    )
                };
            } else if (eventConfig.debounce) {
                const options = {
                    leading: eventConfig.leading === true,    // Default false
                    trailing: eventConfig.trailing !== false, // Default true
                    perElement: eventConfig.perElement !== false  // Default true for element isolation
                };

                // Per-element debounce: create dynamic key based on target
                if (options.perElement) {
                    handler = {
                        handleEvent: (event) => {
                            // Generate unique key per element using WeakMap-style approach
                            const elementId = event.target.dataset.yehDid ||
                                            event.target.id ||
                                            event.target.getAttribute('name');

                            // Fallback: use element itself as weak reference via Map
                            const debounceKey = elementId
                                ? `${key}-${eventType}-${elementId}-debounce`
                                : `${key}-${eventType}-debounce`;

                            this.debounce(
                                () => this.handleEvent(event),
                                eventConfig.debounce,
                                debounceKey,
                                options
                            ).call(this);
                        }
                    };
                } else {
                    // Container-level debounce (legacy behavior)
                    handler = {
                        handleEvent: this.debounce(
                            (event) => this.handleEvent(event),
                            eventConfig.debounce,
                            `${key}-${eventType}-debounce`,
                            options
                        )
                    };
                }
            }
        }

        return handler;
    }

    /**
     * Find the actionable target by walking up the DOM tree
     * Solves the SVG-in-button and nested element problems
     * Uses configurable actionable patterns for maximum flexibility
     */
    findActionableTarget(target, boundary) { // Return if resolution is disabled
        if (!this.actionableConfig.enabled) return target;

        let current = target;

        // Walk up the DOM tree until we hit the boundary element
        while (current && current !== boundary && current !== document) {
            // Check for configured actionable attributes
            for (const attr of this.actionableConfig.attributes) {
                if (current.hasAttribute(attr)) {
                    return current;
                }
            }

            // Check for configured actionable classes
            if (current.classList) {
                for (const className of this.actionableConfig.classes) {
                    if (current.classList.contains(className)) {
                        return current;
                    }
                }
            }

            // Check for configured actionable tags
            if (this.actionableConfig.tags.includes(current.tagName)) {
                return current;
            }

            current = current.parentElement;
        }

        // If we reached the boundary and it's actionable, return it
        if (current === boundary) {
            // Check configured actionable attributes on boundary
            for (const attr of this.actionableConfig.attributes) {
                if (boundary.hasAttribute(attr)) {
                    return boundary;
                }
            }

            // Check configured actionable classes on boundary
            if (boundary.classList) {
                for (const className of this.actionableConfig.classes) {
                    if (boundary.classList.contains(className)) {
                        return boundary;
                    }
                }
            }
        }

        return null;
    }

    /**
     * Cross-browser closest() implementation
     * @param {Element} element - Starting element
     * @param {string} selector - CSS selector to match
     * @returns {Element|Document|Window|null} - Closest matching ancestor or null
     */
    findClosest(element, selector) {
        // Handle global selectors (document, window)
        if (selector === 'document') return document;
        if (selector === 'window') return window;

        // Use native closest() if available (modern browsers)
        if (element.closest) {
            return element.closest(selector);
        }

        // Fallback for older browsers (IE11, old Chrome/Firefox)
        let current = element;

        // Simple selector parsing for basic cases
        const isIdSelector = selector.startsWith('#');
        const isClassSelector = selector.startsWith('.');
        const cleanSelector = selector.slice(1); // Remove # or .

        while (current && current !== document) {
            if (isIdSelector && current.id === cleanSelector) {
                return current;
            } else if (isClassSelector && current.classList && current.classList.contains(cleanSelector)) {
                return current;
            } else if (!isIdSelector && !isClassSelector && current.tagName && current.tagName.toLowerCase() === selector.toLowerCase()) {
                return current;
            }

            current = current.parentElement;
        }

        return null;
    }

    /**
     * Resolve method name using event-type specific aliases
     * @param {string} methodName - Original method name
     * @param {string} eventType - Event type for scoped alias lookup
     * @returns {string} - Resolved method name (or original if no alias)
     */
    resolveMethodName(methodName, eventType) {
        const eventAliases = this.aliases[eventType];
        return (eventAliases && eventAliases[methodName]) || methodName;
    }

    /**
     * Enhanced handler resolution with methods object and global fallback support
     * @param {string|Function} handlerName - Handler method name to resolve or function closure
     * @param {string} eventType - Event type for scoped alias lookup
     * @returns {Function|null} - Resolved handler function or null if not found
     */
    resolveHandler(handlerName, eventType) {
        // Support direct function references (closures)
        if (typeof handlerName === 'function') {
            return handlerName;
        }

        // First resolve any aliases
        const resolvedName = this.resolveMethodName(handlerName, eventType);

        // Define resolution order based on methodsFirst setting
        const resolutionOrder = this.methodsFirst
            ? ['methods', 'class', 'global']
            : ['class', 'methods', 'global'];

        for (const source of resolutionOrder) {
            if (source === 'class') {
                if (typeof this[resolvedName] === 'function') {
                    return this[resolvedName];
                }
            } else if (source === 'methods') {
                if (this.methods) {
                    // First check event-scoped methods: methods.click.clickHandler
                    if (this.methods[eventType] && typeof this.methods[eventType][resolvedName] === 'function') {
                        return this.methods[eventType][resolvedName];
                    }
                    // Then check global methods: methods.globalHandler
                    if (typeof this.methods[resolvedName] === 'function') {
                        return this.methods[resolvedName];
                    }
                }
            } else if (source === 'global') {
                if (this.enableGlobalFallback && typeof window !== 'undefined' && typeof window[resolvedName] === 'function') {
                    return window[resolvedName];
                }
            }
        }

        return null;
    }

    /**
     * Validate that a resolved handler exists and is callable
     * @param {string|Function} handlerName - Original handler name for error reporting (or function closure)
     * @param {string} eventType - Event type for context
     * @param {Function|null} resolvedHandler - The resolved handler function
     * @param {string} resolvedName - The resolved method name after alias processing
     * @returns {boolean} - True if valid, false if validation disabled or handler missing
     * @private
     */
    validateResolvedHandler(handlerName, eventType, resolvedHandler, resolvedName) {
        // Skip validation for function closures
        if (typeof handlerName === 'function') {
            return true;
        }

        if (!this.config.enableHandlerValidation) {
            return !!resolvedHandler; // Skip validation but return boolean
        }

        if (!resolvedHandler) {
            const aliasMsg = resolvedName !== handlerName ? ` (resolved from alias '${handlerName}')` : '';
            console.warn(`YEH: Handler method '${resolvedName}'${aliasMsg} not found for event '${eventType}' (checked class, methods object, and global scope)`);
            return false;
        }

        return true;
    }

    /**
     * Dynamically add a single event listener to existing instance
     * @param {string} target - CSS selector for target element
     * @param {string|object} eventConfig - Event type string or config object
     * @returns {boolean} - True if added, false if already exists
     */
    addEvent(target, eventConfig) {
        // Normalize the event config
        const normalizedConfig = typeof eventConfig === 'string'
            ? { type: eventConfig }
            : eventConfig;

        // Check if event already exists to prevent duplicates
        if (this.hasEvent(target, normalizedConfig.type)) {
            return false; // Already exists
        }

        // Add to eventMapping
        if (!this.eventMapping[target]) {
            this.eventMapping[target] = [];
        }
        this.eventMapping[target].push(normalizedConfig);

        // Register the new event
        this.registerSingleEvent(target, normalizedConfig);

        return true; // Successfully added
    }

    /**
     * Remove a specific event listener from target
     * @param {string} target - CSS selector for target element
     * @param {string} eventType - Event type to remove
     * @returns {boolean} - True if removed, false if not found
     */
    removeEvent(target, eventType) {
        if (!this.eventMapping[target]) return false;

        // Find and remove from eventMapping
        const initialLength = this.eventMapping[target].length;
        this.eventMapping[target] = this.eventMapping[target].filter(config => {
            const configType = typeof config === 'string' ? config : config.type;
            return configType !== eventType;
        });

        // If nothing was removed, return false
        if (this.eventMapping[target].length === initialLength) {
            return false;
        }

        // Clean up empty target
        if (this.eventMapping[target].length === 0) {
            delete this.eventMapping[target];
        }

        // Remove from internal tracking
        this.unregisterSingleEvent(target, eventType);

        return true; // Successfully removed
    }

    /**
     * Check if an event is currently registered
     * @param {string} target - CSS selector for target element
     * @param {string} eventType - Event type to check
     * @returns {boolean} - True if event exists
     */
    hasEvent(target, eventType) {
        if (!this.eventMapping[target]) return false;

        return this.eventMapping[target].some(config => {
            const configType = typeof config === 'string' ? config : config.type;
            return configType === eventType;
        });
    }

    /**
     * Register a single event listener (internal helper)
     * @private
     */
    registerEventListener(element, eventConfig, key, selector) {
        const eventType = typeof eventConfig === 'string' ? eventConfig : eventConfig.type;
        const options = this.getEventOptions(eventConfig);
        const handler = this.createWrappedHandler(eventConfig, key, eventType);

        // Add the event listener
        element.addEventListener(eventType, handler, options);

        // Initialize tracking structures
        if (!this.eventListeners.has(key)) {
            this.eventListeners.set(key, { element, events: [] });
        }

        if (!this.elementHandlers.has(element)) {
            this.elementHandlers.set(element, []);
        }

        // Generate handler method name with configurable prefix
        const handlerMethodName = typeof eventConfig === 'object' && eventConfig.handler
            ? eventConfig.handler
            : this.handlerPrefix
                ? `${this.handlerPrefix}${eventType.charAt(0).toUpperCase() + eventType.slice(1)}`
                : eventType;

        // Validate handler exists using enhanced resolution
        const validatedHandler = this.resolveHandler(handlerMethodName, eventType);
        const resolvedName = this.resolveMethodName(handlerMethodName, eventType);
        this.validateResolvedHandler(handlerMethodName, eventType, validatedHandler, resolvedName);

        // Store tracking info
        this.eventListeners.get(key).events.push({ type: eventType, handler, options });
        this.elementHandlers.get(element).push({ type: eventType, handler, options });

        // Update handler mapping for multi-handler support
        if (!this.eventHandlerMap.has(eventType)) {
            this.eventHandlerMap.set(eventType, []);
        }

        this.eventHandlerMap.get(eventType).push({
            element: element,
            handler: handlerMethodName,
            selector: selector,
            config: eventConfig
        });
    }

    /**
     * Register a single event (internal helper)
     * @private
     */
    registerSingleEvent(selector, eventConfig) {
        const eventType = typeof eventConfig === 'string' ? eventConfig : eventConfig.type;
        const elements = this.getElements(selector);

        if (elements.length === 0) return;

        elements.forEach((element, index) => {
            const key = `${selector}_${eventType}_${index}`;

            // Check if this exact combination is already registered
            if (this.eventListeners.has(key)) return; // Already registered

            this.registerEventListener(element, eventConfig, key, selector);
        });
    }

    /**
     * Unregister a single event (internal helper)
     * @private
     */
    unregisterSingleEvent(selector, eventType) {
        const elements = this.getElements(selector);
        if (elements.length === 0) return;

        elements.forEach((element, index) => {
            const key = `${selector}_${eventType}_${index}`;

            // Remove from event listeners tracking
            const listenerConfig = this.eventListeners.get(key);
            if (listenerConfig) {
                // Remove the actual event listener using the stored handler
                const eventData = listenerConfig.events.find(e => e.type === eventType);
                if (eventData) {
                    element.removeEventListener(eventType, eventData.handler, eventData.options);
                }
            }

            // Clean up tracking
            this.eventListeners.delete(key);

            // Clean up WeakMap entries
            const elementEvents = this.elementHandlers.get(element);
            if (elementEvents) {
                const filteredEvents = elementEvents.filter(e => e.type !== eventType);
                if (filteredEvents.length === 0) {
                    this.elementHandlers.delete(element);
                } else {
                    this.elementHandlers.set(element, filteredEvents);
                }
            }

            // Clean up any timers for this event
            this.cleanupEventTimers(key, eventType);
        });

        // Remove from handler mapping - clean all elements for this selector/eventType
        const elementsToClean = this.getElements(selector);
        elementsToClean.forEach(element => {
            const handlers = this.eventHandlerMap.get(eventType);
            if (handlers) {
                const filteredHandlers = handlers.filter(h => h.element !== element);
                if (filteredHandlers.length === 0) {
                    this.eventHandlerMap.delete(eventType);
                } else {
                    this.eventHandlerMap.set(eventType, filteredHandlers);
                }
            }
        });
    }

    getEventOptions(eventConfig) {
        const shouldBePassive = this.passiveSupported && this.passiveEvents.includes(eventConfig.type || eventConfig);

        if (typeof eventConfig === 'string') {
            const options = shouldBePassive ? { passive: true } : {};
            // Add signal if AbortController is enabled
            if (this.abortController) {
                options.signal = this.abortController.signal;
            }
            return Object.keys(options).length > 0 ? options : false;
        }

        const options = eventConfig.options || {};
        // Apply passive if event type supports it, unless explicitly disabled with passive: false
        if (shouldBePassive && options.passive !== false) {
            options.passive = true;
        }

        // Add signal if AbortController is enabled and not explicitly disabled
        if (this.abortController && options.signal !== false) {
            options.signal = this.abortController.signal;
        }

        return Object.keys(options).length > 0 ? options : false;
    }

    registerEvents() {
        Object.entries(this.eventMapping).forEach(([key, config]) => {
            const isSimplified = Array.isArray(config);
            const elementSelector = isSimplified ? key : config.element;
            const events = isSimplified ? config : config.events;

            const elements = this.getElements(elementSelector);
            if (elements.length === 0) return;

            elements.forEach((element, index) => {
                events.forEach(eventConfig => {
                    const eventType = typeof eventConfig === 'string' ? eventConfig : eventConfig.type;

                    // Use the shared registration logic
                    this.registerEventListener(element, eventConfig, `${elementSelector}_${eventType}_${index}`, elementSelector);
                });
            });
        });
        return this;
    }

    /**
     * Clean up throttle/debounce timers for a specific event
     * @private
     */
    cleanupEventTimers(key, eventType) {
        const throttleKey = `${key}-${eventType}-throttle`;
        const debounceKey = `${key}-${eventType}-debounce`;

        if (this.throttleTimers.has(throttleKey)) {
            const timerData = this.throttleTimers.get(throttleKey);
            if (timerData.timeout) clearTimeout(timerData.timeout);
            if (timerData.trailingTimeout) clearTimeout(timerData.trailingTimeout);
            this.throttleTimers.delete(throttleKey);
        }

        if (this.debounceTimers.has(debounceKey)) {
            clearTimeout(this.debounceTimers.get(debounceKey));
            this.debounceTimers.delete(debounceKey);
        }
    }

    abort() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        return this;
    }

    destroy() {
        // Use AbortController for efficient cleanup if available
        if (this.abortController) {
            this.abort(); // This automatically removes ALL DOM listeners with the signal
        } else {
            // Only do manual removal when AbortController is NOT enabled
            this.eventListeners.forEach((config) => {
                config.events.forEach(({ type, handler, options }) => {
                    config.element.removeEventListener(type, handler, options);
                });
            });
        }

        this.eventListeners.clear();
        this.eventHandlerMap.clear();
        this.distanceCache = new WeakMap();

        // Clean up throttle timers
        this.throttleTimers.forEach((timerData) => {
            if (timerData.timeout) clearTimeout(timerData.timeout);
            if (timerData.trailingTimeout) clearTimeout(timerData.trailingTimeout);
        });
        this.throttleTimers.clear();

        // Clean up debounce timers
        this.debounceTimers.forEach((timerId) => clearTimeout(timerId));
        this.debounceTimers.clear();

        return this;
    }

    /**
     * Get comprehensive statistics about the event handler instance
     * @returns {object|null} - Statistics object with various metrics, or null if stats disabled
     */
    getStats() {
        if (!this.enableStats) return null;

        const configs = Array.from(this.eventListeners.values());
        const events = configs.flatMap(config => config.events);

        // Count event types
        const eventTypes = {};
        events.forEach(event => {
            eventTypes[event.type] = (eventTypes[event.type] || 0) + 1;
        });

        // Count unique elements
        const uniqueElements = new Set(configs.map(config => config.element));

        return {
            totalListeners: this.eventListeners.size,
            totalElements: uniqueElements.size,
            totalEventTypes: Object.keys(eventTypes).length,
            elementsWithListeners: Object.keys(this.eventMapping),
            eventTypes,
            userHasInteracted: this.userHasInteracted,
            activeTimers: {
                debounceMap: this.debounceTimers,
                throttleMap: this.throttleTimers,
                throttle: this.throttleTimers.size,
                debounce: this.debounceTimers.size,
            },
            distanceCache: {
                type: 'WeakMap (disabled by default)',
                enabled: this.enableDistanceCache,
            }
        };
    }

    debounce(fn, delay, key, options) {
        return YEH._debounceImplementation(fn, delay, key, this.debounceTimers, options);
    }

    throttle(fn, delay, key, options) {
        return YEH._throttleImplementation(fn, delay, key, this.throttleTimers, options);
    }

    detectPassiveSupport() {
        this.passiveSupported = YEH.isPassiveSupported();
    }

    dispatch(type, detail = null, target = document) {
        target.dispatchEvent(new CustomEvent(type, { bubbles: true, detail }));
        return this;
    }

    /**
     * Static dispatch method for use without instance
     * @param {string} type - Event type to dispatch
     * @param {any} detail - Event detail payload
     * @param {Element} target - Target element (defaults to document)
     * @returns {CustomEvent} - The dispatched event
     */
    static dispatch(type, detail = null, target = document) {
        const event = new CustomEvent(type, { detail, bubbles: true, cancelable: true });
        target.dispatchEvent(event);
        return event;
    }

    /**
     * Shared debounce implementation used by both instance and static methods
     * Supports leading and trailing edge execution
     * @private
     * @static
     */
    static _debounceImplementation(fn, delay, key, timers, options = {}) {
        const { leading = false, trailing = true } = options;

        return function(...args) {
            const timerData = timers.get(key);
            const hadTimer = !!timerData;

            // Clear existing timer if present
            if (hadTimer) {
                clearTimeout(timerData.timerId);
            }

            // Leading edge: execute immediately on first call
            if (leading && !hadTimer) {
                fn.apply(this, args);
            }

            // Set new timer for trailing edge
            const timerId = setTimeout(() => {
                // Trailing edge: execute with latest arguments (unless leading-only)
                if (trailing && (!leading || hadTimer)) {
                    fn.apply(this, args);
                }
                timers.delete(key);
            }, delay);

            timers.set(key, { timerId, args });
        };
    }

    /**
     * Shared throttle implementation used by both instance and static methods
     * Supports leading and trailing edge execution
     * @private
     * @static
     */
    static _throttleImplementation(fn, delay, key, timers, options = {}) {
        const { leading = true, trailing = true } = options;

        return function(...args) {
            const timerData = timers.get(key);

            if (!timerData || !timerData.timeout) {
                // Leading edge: execute immediately if enabled
                if (leading) {
                    fn.apply(this, args);
                }

                timers.set(key, {
                    timeout: setTimeout(() => { timers.delete(key) }, delay),
                    lastArgs: args
                });
            } else {
                // Update arguments for trailing edge
                timerData.lastArgs = args;

                // Clear existing trailing timeout and set new one if trailing is enabled
                if (trailing) {
                    if (timerData.trailingTimeout) {
                        clearTimeout(timerData.trailingTimeout);
                    }

                    timerData.trailingTimeout = setTimeout(() => {
                        // Trailing edge: execute with latest arguments
                        fn.apply(this, timerData.lastArgs);
                        timers.delete(key);
                    }, delay);
                }
            }
        };
    }

    static debounce(fn, delay, key = 'default', options) {
        if (!YEH._staticDebounceTimers) {
            YEH._staticDebounceTimers = new Map();
        }

        return YEH._debounceImplementation(fn, delay, key, YEH._staticDebounceTimers, options);
    }

    static throttle(fn, delay, key = 'default', options) {
        if (!YEH._staticThrottleTimers) {
            YEH._staticThrottleTimers = new Map();
        }

        return YEH._throttleImplementation(fn, delay, key, YEH._staticThrottleTimers, options);
    }

    /**
     * Check passive support globally (cached result shared across all instances)
     * @returns {boolean} - True if passive listeners are supported
     * @static
     */
    static isPassiveSupported() {
        if (YEH._passiveSupportCache !== undefined) {
            return YEH._passiveSupportCache;
        }

        YEH._passiveSupportCache = false;

        try {
            const opts = Object.defineProperty({}, 'passive', {
                get: () => {
                    YEH._passiveSupportCache = true;
                    return true;
                }
            });
            window.addEventListener('testPassive', null, opts);
            window.removeEventListener('testPassive', null, opts);
        } catch (e) {
            YEH._passiveSupportCache = false;
        }

        return YEH._passiveSupportCache;
    }
}

/**
 * Cache for passive event support detection
 * @type {boolean|undefined}
 * @private
 */
YEH._passiveSupportCache = undefined;

export {YEH};
export default YEH;
