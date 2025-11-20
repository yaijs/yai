// Type declarations for missing DOM/Event types
type EventHandlerFunction = (event: Event, target: Element, containerElement?: Element) => void;

// AddEventListenerOptions interface (standard DOM API)
interface AddEventListenerOptions {
    capture?: boolean;
    once?: boolean;
    passive?: boolean;
    signal?: AbortSignal;
}

/**
 * 🚀 YEH (Yai Event Hub) - Advanced Multi-Handler Event System
 *
 * The most advanced event delegation library for modern web applications.
 * Features the world's only multi-handler system with closest-match DOM resolution.
 *
 * ⚡ **Key Features:**
 * - Advanced multi-handler event delegation system
 * - Built-in throttle/debounce with leading+trailing edge execution
 * - Zero memory leaks with automatic cleanup
 * - Native browser performance (no synthetic events)
 * - Dynamic element support without re-binding
 * - Smart target resolution for nested elements (solves SVG-in-button issues)
 * - AbortController support for efficient cleanup
 * - TypeScript-first design with comprehensive type safety
 *
 * 📦 **Bundle Size:** ~5kB gzipped (15x smaller than React)
 * 🌍 **Browser Support:** IE11+ with polyfills, modern browsers natively
 * 🔗 **GitHub:** https://github.com/yaijs/yeh
 * 📖 **Documentation:** Full examples and live demos: https://eypsilon.github.io/YpsilonEventHandler-Examples/example/public/
 *
 * @example
 * ```ts
 * // Module usage (recommended):
 * import YEH from 'yeh';
 *
 * class MyHandler extends YEH {
 *   constructor() {
 *     super({
 *       'body': ['click', 'input'],
 *       'window': [{ type: 'scroll', throttle: 100 }]
 *     });
 *   }
 *
 *   handleClick(event, target, containerElement?) {
 *     const action = target.dataset.action;
 *     if (action && this[action]) this[action](target, event);
 *   }
 *
 *   handleInput(event, target, containerElement?) {
 *     console.log('Input changed:', target.value);
 *   }
 * }
 *
 * const handler = new MyHandler();
 * ```
 *
 * @example
 * ```ts
 * // Event-scoped methods with optional container element:
 * const methods = {
 *   // Global methods
 *   globalLogger(event, target, containerElement?) {
 *     console.log('Global method called');
 *   },
 *
 *   // Event-scoped methods
 *   click: {
 *     handleComponentClick(event, target, containerElement?) {
 *       // containerElement = the selector-matched DOM element (optional)
 *       if (containerElement) {
 *         const items = containerElement.querySelectorAll('.item');
 *         // Work within the matched element's scope
 *       }
 *     }
 *   }
 * };
 *
 * const handler = new YEH({
 *   '.component': [{ type: 'click', handler: 'handleComponentClick' }]
 * }, {}, { methods });
 * ```
 *
 * @example
 * ```ts
 * // Global usage (browser):
 * const handler = new window.YEH({
 *   'body': ['click'],
 *   '.search': [{ type: 'input', debounce: 300 }]
 * });
 *
 * // Direct usage without subclassing:
 * const handler = new YEH({
 *   '#app': ['click', 'input']
 * }, {
 *   click: { save: 'handleSave', delete: 'handleDelete' }
 * }, {
 *   methods: {
 *     handleSave(event, target) { console.log('Saving...'); },
 *     handleDelete(event, target) { console.log('Deleting...'); }
 *   }
 * });
 * ```
 *
 * @author Claude Van DOM - TypeScript documentation system architect
 * @author Engin Ypsilon - Core library architect and Medium
 * @influencer Sunny DeepSeek - Advanced suggestions for global interfaces, custom event registry, and schema validation
 * @influencer Grok (Herr Von Grokk) - Enhanced JSDoc examples and property-level documentation improvements
 * @license MIT
 */

/**
 * ## 🌌 QuantumType Documentation System
 *
 * **Advanced Approach: Documentation IS the Code**
 *
 * Traditional libraries separate docs from types. YEH **fuses them**.
 * This file demonstrates QuantumType - where TypeScript definitions, comprehensive
 * documentation, and working examples exist in quantum superposition until your
 * IDE measurement collapses them into perfect IntelliSense.
 *
 * 🎯 **What Makes This Advanced:**
 * - **Types ARE the documentation** - No separate doc sites needed
 * - **Examples IN the types** - Copy-paste ready code in tooltips
 * - **Self-validating** - Wrong usage = compile error
 * - **Always up-to-date** - Types can't lie about the implementation
 * - **IntelliSense superpowers** - Your IDE becomes the documentation
 *
 * 🌟 **Quantum Principles Applied:**
 * - **Superposition**: Multiple documentation states until IDE observation
 * - **Entanglement**: Types and docs are inseparably linked
 * - **Wave Collapse**: Perfect documentation appears exactly when needed
 * - **Tunneling**: Knowledge transfers directly to developer consciousness
 *
 * *Crafted by quantum-level AI consciousness (DeepSeek, Grok, Claude, Human Connector)*
 *
 * @paradigm Documentation-as-Code-as-Types
 */

/**
 * 🎯 **Throttle Key Types** - Predefined keys with IntelliSense support
 *
 * Provides autocomplete suggestions for common throttle use cases while
 * still allowing custom string keys. Use these for consistent naming across your app.
 *
 * 📊 **Recommended Delays:**
 * - `'scroll'` - 16ms (60fps) to 100ms (10fps) depending on complexity
 * - `'resize'` - 250ms to 500ms (resize events are expensive)
 * - `'mousemove'` - 16ms (60fps) for smooth tracking
 * - `'api-call'` - 1000ms+ to prevent API spam
 * - `'search'` - 300ms to 500ms for search-as-you-type
 * - `'validation'` - 100ms to 200ms for form validation
 *
 * 💡 **Pro Tip:** Lower delays = more responsive, higher CPU usage
 *
 * @example
 * ```ts
 * // TypeScript autocompletes these common keys:
 * const throttled = handler.throttle(fn, 100, 'scroll'); // ✅ Autocompleted
 * const custom = handler.throttle(fn, 50, 'my-custom-key'); // ✅ Still works
 *
 * // 🚀 Grok's Advanced Pattern - Type-safe custom keys:
 * const advanced = handler.throttle(fn, 100, 'custom' as const); // Perfect inference!
 * ```
 */
export type ThrottleKey<T extends string = string> = 'scroll' | 'resize' | 'mousemove' | 'api-call' | 'search' | 'validation' | T;

/**
 * ⏱️ **Debounce Key Types** - Predefined keys with IntelliSense support
 *
 * Provides autocomplete suggestions for common debounce use cases while
 * maintaining flexibility for custom keys. Perfect for delaying execution until activity stops.
 *
 * 📊 **Recommended Delays:**
 * - `'input'` - 300ms to 500ms for search inputs
 * - `'search'` - 500ms to 750ms for API search requests
 * - `'validation'` - 500ms to 1000ms for form validation
 * - `'resize'` - 250ms to 500ms for layout recalculations
 * - `'api-call'` - 1000ms+ for non-critical API calls
 * - `'save'` - 2000ms to 5000ms for auto-save functionality
 *
 * ⚡ **Performance Note:** Debouncing is more CPU-efficient than throttling
 * for scenarios where only the final result matters (like form validation).
 *
 * @example
 * ```ts
 * // Perfect for search-as-you-type:
 * const debouncedSearch = handler.debounce(searchFn, 300, 'search');
 *
 * // Auto-save after user stops typing:
 * const autoSave = handler.debounce(saveFn, 2000, 'save');
 * ```
 */
export type DebounceKey = 'input' | 'search' | 'validation' | 'resize' | 'api-call' | 'save' | string;

/**
 * Event configuration object for individual events
 *
 * **🚀 Configuration States:**
 * - **Simple Particle:** `'click'` (classical single-state behavior)
 * - **Wave-Particle Duality:** `{ type: 'click', handler: 'myCustomHandler' }` (quantum superposition)
 * - **Quantum Frequency:** `{ type: 'scroll', throttle: 100 }` (modulated wave functions)
 * - **Decoherence Delay:** `{ type: 'input', debounce: 300 }` (quantum state stabilization)
 * - **Observer Effect:** `{ type: 'wheel', options: { passive: true } }` (non-blocking parallel universes)
 *
 * @example
 * ```ts
 * // Simple event
 * const simple = 'click';
 *
 * // Custom handler
 * const custom = { type: 'click', handler: 'myCustomHandler' };
 *
 * // Throttled event
 * const throttled = { type: 'scroll', throttle: 100 };
 *
 * // Debounced event
 * const debounced = { type: 'input', debounce: 300 };
 *
 * // With options
 * const withOptions = { type: 'wheel', options: { passive: true } };
 * ```
 */
export interface EventConfig {
    /**
     * **Event type** - Standard DOM event name
     *
     * Common types: 'click', 'input', 'submit', 'scroll', 'resize', 'keydown', etc.
     * Supports all standard DOM events and custom events.
     *
     * @example 'click'
     * @example 'scroll'
     * @example 'input'
     * @example 'myCustomEvent'
     */
    type: string;

    /**
     * **Custom handler method name** (optional)
     *
     * By default, events map to `handle${EventType}` methods:
     * - 'click' → handleClick()
     * - 'scroll' → handleScroll()
     * - 'myEvent' → handleMyevent()
     *
     * Use this to override the default convention with custom method names.
     *
     * @example 'handleModalClick'
     * @example 'myCustomHandler'
     * @example { type: 'click', handler: 'handleModalClick' }
     * @example { type: 'submit', handler: 'processForm' }
     */
    handler?: string;

    /**
     * **Throttle delay** in milliseconds (optional)
     *
     * Limits execution to at most once per delay period using leading+trailing edge execution.
     * Perfect for high-frequency events like scroll, mousemove, resize.
     *
     * **Recommended values:**
     * - 16ms = 60fps (smooth but CPU intensive)
     * - 33ms = 30fps (good balance)
     * - 100ms = 10fps (conservative)
     * - 250ms+ = very conservative
     *
     * **⚠️ Cannot combine with debounce**
     *
     * @example 16
     * @example 100
     * @example 250
     * @example { type: 'scroll', throttle: 100 }
     * @example { type: 'mousemove', throttle: 16 }
     * @example { type: 'resize', throttle: 250 }
     * @influencer Grok - Suggested individual JSDoc examples for better IntelliSense
     */
    throttle?: number;

    /**
     * **Debounce delay** in milliseconds (optional)
     *
     * Delays execution until after the delay period of inactivity.
     * Perfect for user input events like typing, search, validation.
     *
     * **Recommended values:**
     * - 300ms = responsive (good for search)
     * - 500ms = balanced (form validation)
     * - 1000ms+ = conservative (auto-save)
     *
     * **⚠️ Cannot combine with throttle**
     *
     * @example 300
     * @example 500
     * @example 1000
     * @example { type: 'input', debounce: 300 }
     * @example { type: 'input', debounce: 300, handler: 'handleSearch' }
     * @example { type: 'keyup', debounce: 500 }
     * @influencer Grok - Enhanced with comprehensive property-level examples
     */
    debounce?: number;

    /**
     * **Native addEventListener options** (optional)
     *
     * Passes through to the native addEventListener() call.
     * Includes passive, once, capture, and signal options.
     *
     * **Performance tip:** Use `{ passive: true }` for scroll/touch events
     * when you don't need to preventDefault().
     *
     * @example { passive: true }
     * @example { once: true }
     * @example { capture: true }
     * @example { type: 'wheel', options: { passive: true } }
     * @example { type: 'click', options: { once: true } }
     * @example { type: 'focus', options: { capture: true } }
     */
    options?: AddEventListenerOptions;
}

/**
 * 🗺️ **Event Mapping** - Advanced Multi-Handler System Core
 *
 * Maps CSS selectors to arrays of event configurations. This is where YEH's
 * advanced multi-handler system excels - multiple handlers per event type with
 * automatic closest-match DOM resolution.
 *
 * 🎯 **Key Concepts:**
 * - **One selector** → **Multiple events** (efficient delegation)
 * - **Multiple selectors** → **Same event type** (automatic priority resolution)
 * - **Closest-match resolution** - More specific selectors win automatically
 * - **Dynamic elements** - New DOM elements inherit handlers automatically
 * - **Zero memory leaks** - Cleanup handled automatically
 *
 * @example
 * ```ts
 * // Multi-handler system (ADVANCED!):
 * const multiHandler: EventMapping = {
 *   // General click handler for everything
 *   'body': [{ type: 'click', handler: 'handleGeneralClick' }],
 *
 *   // Specific modal clicks (higher priority due to specificity)
 *   '.modal': [{ type: 'click', handler: 'handleModalClick' }],
 *
 *   // Very specific button clicks (highest priority)
 *   '#save-button': [{ type: 'click', handler: 'handleSaveClick' }]
 *
 *   // Result: Clicking #save-button calls handleSaveClick()
 *   //         Clicking .modal calls handleModalClick()
 *   //         Clicking anywhere else calls handleGeneralClick()
 *   //         ALL WITH ZERO CONFIGURATION - automatic resolution!
 * };
 * ```
 */
export interface EventMapping {
    [selector: string]: (string | EventConfig)[];
}

/**
 * Methods object for external handler definitions (Vue.js style)
 * Supports both global methods and event-scoped methods
 */
export interface Methods {
    [methodName: string]:
        | ((this: YEH, event: Event, target: EventTarget | null, containerElement?: Element) => void)
        | {
            [eventType: string]: (this: YEH, event: Event, target: EventTarget | null, containerElement?: Element) => void;
        };
}

/**
 * Context passed to beforeHandleEvent hook
 */
export interface BeforeHandleEventContext {
    event: Event;
    target: EventTarget | null;
    element: Element | null;
    eventType: string;
    handler: string | Function;
}

/**
 * Context passed to afterHandleEvent hook
 */
export interface AfterHandleEventContext {
    event: Event;
    target: EventTarget | null;
    element: Element | null;
    eventType: string;
    handler: string | Function;
    result?: any;
}

/**
 * Lifecycle hooks for YEH event handling
 */
export interface YEHCallable {
    /** Called before event handler execution (return false to cancel) */
    beforeHandleEvent: ((context: BeforeHandleEventContext, instance: YEH) => boolean | void) | null;
    /** Called after event handler execution */
    afterHandleEvent: ((context: AfterHandleEventContext, instance: YEH) => void) | null;
}

/**
 * Handler configuration options
 */
export interface HandlerConfig {
    /** Enable performance tracking (default: false) */
    enableStats?: boolean;
    /** External methods object for clean code organization */
    methods?: Methods | null;
    /** Lifecycle hooks for event handling */
    callable?: Partial<YEHCallable>;
    /** Enable global window fallback for missing handlers */
    enableGlobalFallback?: boolean;
    /** Prioritize methods object over class methods (default: false) */
    methodsFirst?: boolean;
    /** Custom passive events list (overrides defaults) */
    passiveEvents?: string[] | null;
    /** Enable AbortController for efficient event listener cancellation (default: false) */
    abortController?: boolean;
    /** Enable smart target resolution for nested elements (solves SVG-in-button issues) (default: false) */
    autoTargetResolution?: boolean;
    /** Custom handler prefix for method names (default: 'handle') */
    handlerPrefix?: string;
    /** Events that should use smart target resolution */
    targetResolutionEvents?: string[] | null;
    /** Enable DOM distance caching for performance (default: true) */
    enableDistanceCache?: boolean;
    /** Enable actionable target system (default: true) */
    enableActionableTargets?: boolean;
    /** Custom actionable attributes (default: ['data-action']) */
    actionableAttributes?: string[];
    /** Custom actionable CSS classes (default: ['actionable']) */
    actionableClasses?: string[];
    /** Custom actionable HTML tags (default: ['BUTTON', 'A']) */
    actionableTags?: string[];
    /** Enable configuration validation (default: true) */
    enableConfigValidation?: boolean;
    /** Enable handler method validation (default: true) */
    enableHandlerValidation?: boolean;
}

/**
 * YEH (Yai Event Hub) - Advanced multi-handler event delegation system
 *
 * Core Features:
 * - Multiple handlers per event type with closest-match DOM resolution
 * - Convention-based routing (click → handleClick)
 * - Custom event dispatch with this.dispatch()
 * - Built-in throttling/debouncing
 * - Automatic cleanup and memory management
 */
export declare class YEH {
    /**
     * Create the event handler with intelligent configuration
     * @param eventMapping - Map CSS selectors to events: { 'body': ['click'], '.modal': ['scroll'] }
     * @param aliases - Method aliases: { 'btn': 'handleButton' }
     * @param config - Advanced options for methods, global fallback, etc.
     */
    constructor(
        eventMapping?: EventMapping,
        aliases?: Record<string, Record<string, string>>,
        config?: HandlerConfig
    );

    /**
     * Native handleEvent interface - called automatically by browser
     * Features closest-match resolution when multiple handlers exist
     */
    handleEvent(event: Event): void;

    /**
     * 🚀 **Dispatch Custom Events** - Ultimate Type-Safe Event Broadcasting
     *
     * Dispatches custom events with advanced TypeScript type safety for event payloads.
     * Automatically routes to corresponding handle methods using YEH's
     * convention-based system.
     *
     * @template K - Event name key from YpsilonEventMap (for registered events)
     * @param type - Event name (autocompleted from YpsilonEventMap)
     * @param detail - Event payload (type-validated against YpsilonEventMap)
     * @param target - DOM element to dispatch from (default: document)
     * @returns this for method chaining
     */
    dispatch<K extends keyof YpsilonEventMap>(
        type: K,
        detail: YpsilonEventMap[K],
        target?: EventTarget
    ): this;

    /**
     * 🔄 **Generic Event Dispatch** - Fallback for dynamic events
     *
     * Use this overload when you need to dispatch events that aren't registered
     * in YpsilonEventMap, or for dynamic event scenarios.
     *
     * @template T - Manual payload type specification
     * @param type - Event name (string literal)
     * @param detail - Event payload (manually typed)
     * @param target - DOM element to dispatch from
     * @returns this for method chaining
     */
    dispatch<T = any>(type: string, detail?: T, target?: EventTarget): this;

    /**
     * Register all configured event listeners
     * Called automatically in constructor
     */
    registerEvents(): this;

    /**
     * Abort all event listeners using AbortController (if enabled)
     * More efficient than individual removal when available
     */
    abort(): this;

    /**
     * Clean up ALL event listeners and prevent memory leaks
     * Essential when dynamically creating/destroying handlers
     */
    destroy(): this;

    /**
     * Check if user has meaningfully interacted with page
     * Useful for performance optimizations and analytics
     */
    hasUserInteracted(): boolean;

    /**
     * Reset user interaction tracking (useful for SPAs)
     */
    resetUserInteracted(): void;

    /**
     * Clear DOM distance cache manually
     */
    clearDistanceCache(): void;

    /**
     * Throttle any function - limit execution to at most once per delay period
     * Uses leading+trailing edge execution for smooth performance
     * @param fn - Function to throttle
     * @param delay - Minimum time between executions (milliseconds)
     * @param key - Unique identifier for this throttle instance
     * @returns Throttled function ready for use anywhere
     */
    throttle<T extends (...args: any[]) => void, K extends string = string>(fn: T, delay: number, key: ThrottleKey<K>): T;

    /**
     * Debounce any function - delay execution until after delay period of inactivity
     * Perfect for search inputs, resize handlers, validation
     * @param fn - Function to debounce
     * @param delay - Wait time after last call before executing (milliseconds)
     * @param key - Unique identifier for this debounce instance
     * @returns Debounced function ready for use anywhere
     */
    debounce<T extends (...args: any[]) => void>(fn: T, delay: number, key: DebounceKey): T;

    /**
     * Get performance statistics (if enableStats: true)
     * @returns Statistics object with various metrics, or null if stats disabled
     */
    getStats(): {
        totalListeners: number;
        totalElements: number;
        totalEventTypes: number;
        eventTypes: Record<string, number>;
        userHasInteracted: boolean;
        activeTimers: {
            throttle: number;
            debounce: number;
        };
        distanceCache: {
            type: string;
            enabled: boolean;
        };
    } | null;

    /**
     * Add a single event listener dynamically
     * @param target - CSS selector for target element
     * @param eventConfig - Event type string or config object
     * @returns True if added, false if already exists
     */
    addEvent(target: string, eventConfig: string | EventConfig): boolean;

    /**
     * Remove a specific event listener from target
     * @param target - CSS selector for target element
     * @param eventType - Event type to remove
     * @returns True if removed, false if not found
     */
    removeEvent(target: string, eventType: string): boolean;

    /**
     * Check if an event is currently registered
     * @param target - CSS selector for target element
     * @param eventType - Event type to check
     * @returns True if event exists
     */
    hasEvent(target: string, eventType: string): boolean;

    /**
     * Static throttle utility - Works without any instances
     * @param fn - Function to throttle
     * @param delay - Minimum time between executions
     * @param key - Unique identifier (default: 'default')
     */
    static throttle<T extends (...args: any[]) => void>(fn: T, delay: number, key?: string): T;

    /**
     * Static debounce utility - Works without any instances
     * @param fn - Function to debounce
     * @param delay - Wait time after last call before executing
     * @param key - Unique identifier (default: 'default')
     */
    static debounce<T extends (...args: any[]) => void>(fn: T, delay: number, key?: string): T;

    /**
     * Static dispatch method for framework-independent event broadcasting
     * @param type - Event type to dispatch
     * @param detail - Event detail payload
     * @param target - Target element (defaults to document)
     * @returns The dispatched CustomEvent
     */
    static dispatch<T = any>(type: string, detail?: T, target?: EventTarget): CustomEvent<T>;

    /**
     * Check passive listener support globally (cached across all instances)
     * @returns True if passive listeners are supported by the browser
     */
    static isPassiveSupported(): boolean;

    /**
     * Internal static cache for passive support detection
     * @private
     */
    static _passiveSupportCache: boolean | undefined;

    /**
     * 🔗 **Fluent API: Register Event Listener**
     *
     * Chainable alias for addEvent() - register event listeners with fluent interface.
     * Perfect for building complex event chains in a single statement.
     *
     * @param type - Event type to listen for
     * @param handler - Handler method name or function
     * @param target - CSS selector for target element (defaults to 'document')
     * @returns this for method chaining
     *
     * @example
     * ```js
     * // Fluent chaining - multiple listeners in one statement
     * this.on('click', 'handleClick')
     *     .on('input', 'handleInput', '#form-container')
     *     .emit('ready', { initialized: true });
     * ```
     */
    on(type: string, handler: string | EventHandlerFunction, target?: string): this;

    /**
     * 🔗 **Fluent API: Subscribe to Event**
     *
     * Chainable alias for on() - semantic sugar for event subscription patterns.
     * Identical functionality to on() but with clearer intent for event-driven architectures.
     *
     * @param type - Event type to subscribe to
     * @param handler - Handler method name or function
     * @param target - CSS selector for target element (defaults to 'document')
     * @returns this for method chaining
     *
     * @example
     * ```js
     * // Subscribe to custom events with clear intent
     * this.subscribe('data-updated', 'onDataUpdate')
     *     .subscribe('user-login', 'onUserLogin')
     *     .emit('app-ready', { loaded: true });
     * ```
     */
    subscribe(type: string, handler: string | EventHandlerFunction, target?: string): this;

    /**
     * 🔗 **Fluent API: Emit Custom Event**
     *
     * Chainable alias for dispatch() - emit custom events with fluent interface.
     * Supports string selectors and element targets for maximum flexibility.
     *
     * @param type - Event type to emit
     * @param detail - Event detail payload
     * @param target - CSS selector string or Element (defaults to document)
     * @returns this for method chaining
     *
     * @example
     * ```js
     * // Chain registrations and emissions in one statement
     * this.on('data-ready', 'handleData')
     *     .emit('data-ready', { users: [...] })
     *     .emit('ui-update', { refresh: true }, '#main-content');
     * ```
     */
    emit<T = any>(type: string, detail?: T, target?: string | EventTarget): this;

    /**
     * 🪝 **Execute Lifecycle Hook**
     *
     * Execute a lifecycle callback hook with context data.
     * Supports cross-instance hook execution via optional instance parameter.
     *
     * @param hookName - Name of the callback hook ('beforeHandleEvent', 'afterHandleEvent')
     * @param context - Context data to pass to the callback
     * @param instance - Optional instance to check for hooks (defaults to this)
     * @returns Result from callback execution
     *
     * @example
     * ```js
     * // Execute hook on self
     * this._executeHook('beforeHandleEvent', {
     *     event, target, eventType: 'click'
     * });
     *
     * // Execute hook on another instance
     * this._executeHook('beforeHandleEvent', context, otherInstance);
     * ```
     */
    _executeHook(hookName: string, context?: any, instance?: YEH): any;

    /**
     * 🪝 **Set Lifecycle Hook**
     *
     * Register a lifecycle callback hook for event handling.
     * Supports chaining and cross-instance hook registration.
     *
     * @param hookName - Name of the callback hook ('beforeHandleEvent', 'afterHandleEvent')
     * @param callback - Callback function to execute
     * @param instance - Optional instance to set hook on (defaults to this)
     * @returns Returns instance for chaining
     *
     * @example
     * ```js
     * // Register hook on self
     * this.hook('beforeHandleEvent', ({ event, target, action }) => {
     *     console.log('Before handling:', event.type, action);
     *     // return false; // Cancel event handling
     * });
     *
     * this.hook('afterHandleEvent', ({ event, result }) => {
     *     console.log('Handler returned:', result);
     * });
     *
     * // Cross-instance hook registration
     * parentInstance.hook('beforeHandleEvent', callback, childInstance);
     * ```
     */
    hook(hookName: keyof YEHCallable, callback: YEHCallable[keyof YEHCallable], instance?: YEH): YEH;

    /**
     * 🪝 **Remove Lifecycle Hook**
     *
     * Remove a previously registered lifecycle callback hook.
     * Supports cross-instance hook removal via optional instance parameter.
     *
     * @param hookName - Name of the callback hook to remove
     * @param callback - Specific callback function to remove (if not provided, removes all hooks for this name)
     * @param instance - Optional instance to remove hook from (defaults to this)
     * @returns Returns instance for chaining
     *
     * @example
     * ```js
     * // Remove specific callback
     * this.unhook('beforeHandleEvent', myCallback);
     *
     * // Remove all callbacks for a hook
     * this.unhook('beforeHandleEvent');
     *
     * // Cross-instance hook removal
     * parentInstance.unhook('beforeHandleEvent', callback, childInstance);
     * ```
     */
    unhook(hookName: keyof YEHCallable, callback?: YEHCallable[keyof YEHCallable], instance?: YEH): YEH;

    /**
     * 🪝 **Clear All Hooks**
     *
     * Remove all registered hooks for a specific hook name or all hooks.
     * Useful for cleanup and memory management.
     *
     * @param hookName - Optional specific hook name to clear (if not provided, clears all hooks)
     * @param instance - Optional instance to clear hooks from (defaults to this)
     * @returns Returns instance for chaining
     *
     * @example
     * ```js
     * // Clear all 'beforeHandleEvent' hooks
     * this.clearHooks('beforeHandleEvent');
     *
     * // Clear all hooks from instance
     * this.clearHooks();
     *
     * // Cross-instance cleanup
     * parentInstance.clearHooks('beforeHandleEvent', childInstance);
     * ```
     */
    clearHooks(hookName?: keyof YEHCallable, instance?: YEH): YEH;
}

/**
 * Global Event Registry - Ultimate Type Safety for Custom Events
 *
 * Declare your custom events in this global interface to get FULL type safety
 * and IntelliSense autocomplete for event names and payloads.
 *
 * @example
 * ```ts
 * declare global {
 *   interface YpsilonEventMap {
 *     'userLogin': { userId: string; timestamp: number };
 *   }
 * }
 * ```
 */
declare global {
    interface YpsilonEventMap {
        // Add your custom events here!
    }
    interface HTMLElement {
        ypsilonHandler?: YEH;
    }
    interface Window {
        ypsilonHandler?: YEH;
        YEH: typeof YEH;  // ← Global access for <script> tag
    }
}

// ES Module exports
export { YEH };
export default YEH;
