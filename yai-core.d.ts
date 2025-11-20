/**
 * 🏗️ **YaiCore - Foundation Architecture for YaiJS Components**
 *
 * Advanced base class built on YEH's O(1) event delegation system.
 * Provides unified component initialization, dynamic content loading, and extensible
 * hook system for building high-performance web components with mathematical scalability.
 *
 * **🚀 Core Features:**
 * - **O(1) Performance**: Single event listener architecture with infinite scalability
 * - **Dynamic Content Loading**: Fetch-based content with comprehensive delay management
 * - **Hook System**: Extensible callback architecture for lifecycle customization
 * - **Memory Management**: Automatic cleanup with AbortController integration
 * - **DOM Caching**: High-performance query caching system reduces DOM traversal
 * - **Accessibility**: WCAG 2.1 AA compliance with dynamic ARIA management
 * - **Framework Agnostic**: Works with React, Vue, Angular, or Vanilla JS
 * - **Zero Dependencies**: Only requires YEH foundation
 *
 * **📊 Performance Benefits:**
 * - **Query Optimization**: DOM caching reduces repeated querySelector calls
 * - **Memory Efficient**: Automatic cleanup prevents memory leaks
 * - **Scalable Architecture**: O(1) performance regardless of component complexity
 * - **Intelligent Batching**: Event delegation minimizes listener overhead
 * - **Lazy Loading**: Dynamic content loading with comprehensive delay controls
 *
 * **🎯 Design Philosophy:**
 * "Mathematical Elegance Meets Developer Experience"
 * - Provide maximum functionality with minimal code
 * - Ensure every feature scales mathematically (O(1) or better)
 * - Make complex interactions feel effortless to implement
 * - Enable infinite extensibility through hooks and configuration
 *
 * @author YaiJS Team - Advanced component architecture
 * @license MIT
 * @see https://github.com/yaijs/Yai/tree/main/tabs
 */

import { EventMapping, HandlerConfig, YEH } from '../../yeh/yeh.js';

/**
 * ⚙️ **Base Configuration Interface**
 *
 * Comprehensive configuration system extending YEH with
 * component-specific functionality and intelligent defaults.
 *
 * @example
 * ```typescript
 * const config: YaiCoreConfig = {
 *   dynamicContent: true,
 *   autoAccessibility: true,
 *   errorPlaceholder: 'Failed to load content',
 *   selectors: {
 *     active: 'active',
 *     isLoading: 'yai-loading'
 *   },
 *   callbacks: {
 *     setLoading: ({ target }) => target?.classList.add('loading'),
 *     contentReady: ({ content }) => content?.classList.add('loaded')
 *   }
 * };
 * ```
 */
export interface YaiCoreConfig extends HandlerConfig {
  /** Enable dynamic content loading via fetch (default: true) */
  dynamicContent?: boolean;

  /** Error message displayed when content loading fails */
  errorPlaceholder?: string;

  /** Automatically set ARIA attributes for accessibility compliance (default: true) */
  autoAccessibility?: boolean;

  /** CSS selector configuration for consistent styling */
  selectors?: {
    /** Active state class name (default: 'active') */
    active?: string;
    /** Loading state class name (default: 'yai-loading') */
    isLoading?: string;
  };

  /** Event system configuration (inherits from YEH) */
  events?: {
    /** Automatically resolve event targets (default: true) */
    autoTargetResolution?: boolean;
    /** Enable distance-based caching for performance (default: false) */
    enableDistanceCache?: boolean;
    /** Attributes that trigger actionable behavior */
    actionableAttributes?: string[];
    /** HTML tags that are inherently actionable */
    actionableTags?: string[];
  };

  /** Base name for dispatched events (default: 'yai.component') */
  dispatchName?: string;

  /** Standardized event names for consistent component communication */
  emitable?: Record<string, string>;

  /** Component lifecycle callback hooks for extensible behavior */
  callbacks?: {
    /** Called when hash-based routing starts, for showing page loaders */
    routeLoading?: ((context: HookContext) => void | Promise<void>) | null;
    /** Called when hash-based routing completes, for hiding page loaders */
    routeLoaded?: ((context: HookContext) => void | Promise<void>) | null;
    /** Called when dynamic content fetch starts (show loading UI) */
    contentLoading?: ((context: HookContext) => void | Promise<void>) | null;
    /** Called when dynamic content fetch completes (hide loading UI) */
    contentLoaded?: ((context: HookContext) => void | Promise<void>) | null;
    /** Called when content is ready for animation/display */
    contentReady?: ((context: HookContext) => void | Promise<void>) | null;
    /** Called after all loading operations complete successfully */
    afterLoad?: ((context: HookContext) => void | Promise<void>) | null;
    /** Custom URL validation for dynamic content loading (default: built-in validation) */
    validateUrl?: ((url: string) => boolean) | null;
    /** Custom HTML sanitization for dynamic content (default: built-in sanitization) */
    sanitizeHtml?: ((html: string) => string) | null;
  };

  /** HTML sanitization - configurable list of elements to remove (default: ['script', 'object', 'embed', 'link[rel="import"]']) */
  dangerousElements?: string[];
}

/**
 * 🎣 **Hook Context Interface**
 *
 * Rich context object passed to all lifecycle hooks containing relevant
 * elements and metadata for the current operation. Enables powerful
 * customization without breaking encapsulation.
 *
 * @example
 * ```typescript
 * // Hook with comprehensive context access
 * component.hook('contentReady', (context: HookContext) => {
 *   const { content, target, container, url, isLoading } = context;
 *
 *   if (content) {
 *     content.classList.add('fade-in');
 *   }
 *
 *   if (target && target.dataset.restoreText) {
 *     target.textContent = target.dataset.restoreText;
 *   }
 *
 *   console.log(`Content loaded from: ${url}`);
 * });
 * ```
 */
export interface HookContext {
  /** Main component container element */
  container?: Element;
  /** Button/element that triggered the action */
  target?: Element;
  /** Content container element */
  content?: Element;
  /** Content URL being loaded (if applicable) */
  url?: string;
  /** Loading state (true = loading, false = complete) */
  isLoading?: boolean;
  /** Error object (if applicable) */
  error?: Error;
  /** Additional context data - extensible for component-specific needs */
  [key: string]: any;
}

/**
 * 🔄 **Lifecycle Callback Functions**
 *
 * Extensible callback system for customizing component behavior at key lifecycle points.
 * Each hook receives a rich context object and can return values for advanced workflows.
 *
 * **Available Hooks:**
 * - `routeLoading`: When hash-based routing starts (show page loader)
 * - `routeLoaded`: When hash-based routing completes (hide page loader)
 * - `contentLoading`: When dynamic content fetch starts
 * - `contentLoaded`: When dynamic content fetch completes
 * - `contentReady`: When content is ready for animation/display
 * - `afterLoad`: When all loading operations complete
 *
 * @example
 * ```typescript
 * const callbacks: LifecycleCallbacks = {
 *   routeLoading: ({ context }) => {
 *     // Show page loader during hash-based navigation
 *     document.getElementById('page-loader')?.classList.add('active');
 *   },
 *
 *   routeLoaded: ({ context }) => {
 *     // Hide page loader when routing completes
 *     document.getElementById('page-loader')?.classList.remove('active');
 *   },
 *
 *   contentLoading: ({ target, isLoading }) => {
 *     target?.classList.toggle('loading', isLoading);
 *     target?.setAttribute('aria-busy', String(isLoading));
 *   },
 *
 *   contentReady: ({ content, target }) => {
 *     content?.classList.add('content-ready');
 *     // Perfect timing for CSS animations
 *     content?.style.animation = 'fadeIn 0.3s ease-out';
 *   },
 *
 *   afterLoad: ({ container, url }) => {
 *     console.log(`Content loaded from ${url} into:`, container);
 *     // Perfect for analytics, notifications, etc.
 *   }
 * };
 * ```
 */
export interface LifecycleCallbacks {
  /** Called when hash-based routing starts - ideal for showing page loaders */
  routeLoading?: (context: HookContext) => void | Promise<void>;
  /** Called when hash-based routing completes - ideal for hiding page loaders */
  routeLoaded?: (context: HookContext) => void | Promise<void>;
  /** Called when loading state should be applied to UI elements */
  contentLoading?: (context: HookContext) => void | Promise<void>;
  /** Called when dynamic content fetch completes (hide loading UI) */
  contentLoaded?: (context: HookContext) => void | Promise<void>;
  /** Called when content is ready for animation/display (perfect timing for CSS transitions) */
  contentReady?: (context: HookContext) => void | Promise<void>;
  /** Called after all loading operations complete successfully */
  afterLoad?: (context: HookContext) => void | Promise<void>;
}

/**
 * 🏗️ **YaiCore - Advanced Component Foundation**
 *
 * Base class for all YaiJS components providing unified architecture, dynamic content
 * loading, lifecycle management, and extensible hook system built on YEH's
 * advanced O(1) event delegation.
 *
 * **🎯 Core Architecture:**
 * - **Event Factory**: Creates YEH instances with component integration
 * - **DOM Caching**: High-performance query system with automatic cache management
 * - **Dynamic Loading**: Comprehensive fetch system with delay controls
 * - **Hook System**: Lifecycle callbacks for extensible behavior
 * - **Memory Management**: Automatic cleanup with AbortController integration
 * - **Accessibility**: Built-in WCAG 2.1 AA compliance utilities
 *
 * **📖 Usage Examples:**
 *
 * @example
 * **Basic Component Extension:**
 * ```typescript
 * class MyComponent extends YaiCore {
 *   constructor(config?: MyComponentConfig) {
 *     super({
 *       dynamicContent: true,
 *       autoAccessibility: true,
 *       selectors: {
 *         active: 'my-active',
 *         isLoading: 'my-loading'
 *       },
 *       callbacks: {
 *         setLoading: ({ target }) => {
 *           target?.classList.add('loading');
 *         },
 *         contentReady: ({ content }) => {
 *           content?.classList.add('ready');
 *         }
 *       },
 *       ...config
 *     });
 *
 *     // Create event handler with component-specific configuration
 *     this.createEventHandler({
 *       '.my-component': ['click', 'keydown']
 *     }, {
 *       click: {
 *         action: 'handleAction'
 *       }
 *     });
 *   }
 *
 *   handleAction(target, event, container) {
 *     // Custom action handler
 *     console.log('Action triggered on:', target);
 *   }
 * }
 * ```
 *
 * @example
 * **Hook-Based Customization:**
 * ```typescript
 * const component = new YaiCore()
 *   .hook('setLoading', ({ target, container }) => {
 *     // Custom loading state
 *     target?.setAttribute('aria-busy', 'true');
 *     container?.classList.add('component-loading');
 *   })
 *   .hook('removeLoading', ({ target, container }) => {
 *     // Custom loading cleanup
 *     target?.setAttribute('aria-busy', 'false');
 *     container?.classList.remove('component-loading');
 *   })
 *   .hook('contentReady', ({ content, target, url }) => {
 *     // Perfect timing for animations
 *     content?.classList.add('fade-in');
 *
 *     // Restore button text if specified
 *     if (target?.dataset.restoreText) {
 *       target.textContent = target.dataset.restoreText;
 *     }
 *
 *     console.log(`Content loaded from: ${url}`);
 *   })
 *   .hook('afterLoad', ({ container, content }) => {
 *     // Post-load operations
 *     component._initializeNestedComponents(content);
 *   });
 * ```
 *
 * @example
 * **Dynamic Content Loading:**
 * ```typescript
 * class ContentLoader extends YaiCore {
 *   async loadSection(url, targetSelector, container) {
 *     try {
 *       await this._loadContent(url, targetSelector, container, false);
 *       console.log('Content loaded successfully');
 *     } catch (error) {
 *       console.error('Loading failed:', error);
 *       // Error handling is automatic via hooks
 *     }
 *   }
 * }
 *
 * // Usage with HTML data attributes for delay control:
 * // <button data-url="content.html"
 * //         data-delay="1000"
 * //         data-post-delay="500"
 * //         data-min-loading="800">
 * //   Load Content
 * // </button>
 * ```
 *
 * @example
 * **Advanced Configuration:**
 * ```typescript
 * const advancedComponent = new YaiCore({
 *   dynamicContent: true,
 *   autoAccessibility: true,
 *   errorPlaceholder: 'Content temporarily unavailable',
 *
 *   selectors: {
 *     active: 'is-active',
 *     isLoading: 'is-loading'
 *   },
 *
 *   events: {
 *     autoTargetResolution: true,
 *     enableDistanceCache: false,
 *     actionableAttributes: ['data-action', 'data-trigger'],
 *     actionableTags: ['button', 'a', 'input']
 *   },
 *
 *   emitable: {
 *     beforeInit: 'component:before-init',
 *     afterInit: 'component:after-init',
 *     contentLoaded: 'component:content-loaded',
 *     error: 'component:error'
 *   },
 *
 *   callbacks: {
 *     setLoading: async ({ target, container }) => {
 *       // Async loading handler
 *       await animateLoading(target);
 *       container?.classList.add('loading-state');
 *     },
 *
 *     contentReady: ({ content, container }) => {
 *       // Content ready for display
 *       content?.setAttribute('data-loaded', 'true');
 *       triggerContentAnimation(content);
 *     }
 *   }
 * });
 * ```
 *
 * **🎯 Performance Features:**
 * - **Query Caching**: Reduces DOM traversal with intelligent cache management
 * - **Event Delegation**: Single listener handles multiple component instances
 * - **Memory Management**: Automatic cleanup prevents leaks in dynamic applications
 * - **Lazy Initialization**: Components initialize only when needed
 * - **Fetch Optimization**: AbortController integration prevents orphaned requests
 *
 * **♿ Accessibility Features:**
 * - **ARIA Management**: Automatic role, state, and property handling
 * - **Focus Control**: Intelligent focus management during dynamic updates
 * - **Screen Reader**: Proper live regions and semantic markup
 * - **Keyboard Navigation**: Full keyboard accessibility support
 * - **WCAG Compliance**: Built-in 2.1 AA compliance utilities
 */
export declare class YaiCore extends YEH {
  /** Component configuration with intelligent defaults */
  protected config: Required<YaiCoreConfig>;

  /** Processing state for async operations */
  protected isProcessing: boolean;

  /** Set of containers currently processing async operations */
  protected processingContainers: Set<Element>;

  /** Active fetch controllers for request management and cancellation */
  protected _fetchControllers: Map<Element, AbortController>;

  /** High-performance DOM element cache for query optimization */
  protected _domCache: Map<string, any>;

  /** DOM cache performance statistics */
  protected _cacheStats: { hits: number; misses: number; totalQueries: number };

  /** YEH instance created by factory */
  protected events: any;

  /**
   * 🏗️ **Create YaiCore Instance**
   *
   * Initialize a new component with optional configuration.
   * Merges provided config with intelligent defaults and sets up core systems.
   *
   * @param config - Optional configuration object
   *
   * @example
   * ```typescript
   * // Minimal setup with defaults
   * const component = new YaiCore();
   *
   * // Custom configuration
   * const component = new YaiCore({
   *   dynamicContent: true,
   *   autoAccessibility: true,
   *   errorPlaceholder: 'Loading failed',
   *   callbacks: {
   *     contentReady: ({ content }) => content?.classList.add('ready')
   *   }
   * });
   * ```
   */
  constructor(config?: YaiCoreConfig);

  /**
   * 🎯 **Get Default Configuration**
   *
   * Returns the default configuration object with intelligent defaults for all options.
   * Override in subclasses to customize default behavior while maintaining extensibility.
   *
   * @returns Default configuration object with all required properties
   *
   * @example
   * ```typescript
   * class CustomComponent extends YaiCore {
   *   getDefaultConfig() {
   *     return {
   *       ...super.getDefaultConfig(),
   *       customProperty: 'customValue',
   *       selectors: {
   *         ...super.getDefaultConfig().selectors,
   *         custom: 'custom-selector'
   *       }
   *     };
   *   }
   * }
   * ```
   */
  getDefaultConfig(): YaiCoreConfig;

  /**
   * 🏭 **Create Event Handler Factory**
   *
   * Factory method to create YEH instances with component-specific
   * configuration. Provides method binding and event system integration for O(1) performance.
   *
   * @param selectors - Event listener selectors mapping
   * @param aliases - Event method aliases for cleaner handler names
   * @param options - Additional event handler options
   * @returns Configured YEH instance
   *
   * @example
   * ```typescript
   * // Basic event handler setup
   * this.createEventHandler({
   *   '.component': ['click', 'keydown']
   * }, {
   *   click: {
   *     open: 'openHandler',
   *     close: 'closeHandler'
   *   }
   * });
   *
   * // Advanced configuration
   * this.createEventHandler({
   *   '.tabs': ['click', 'keydown'],
   *   'window': [{ type: 'hashchange', debounce: 500 }]
   * }, {
   *   click: {
   *     'tab-action': 'handleTabAction'
   *   },
   *   keydown: {
   *     'navigation': 'handleKeyNavigation'
   *   }
   * }, {
   *   enableDistanceCache: true,
   *   actionableAttributes: ['data-action']
   * });
   * ```
   */
  createEventHandler(
    selectors: EventMapping,
    aliases?: Record<string, any>,
    options?: any
  ): YEH;

  /**
   * 🧬 **Deep Object Merging Utility**
   *
   * Recursively merges objects with intelligent handling of arrays, functions, and primitives.
   * Essential for configuration object merging and state management.
   *
   * @param target - Target object (will be modified)
   * @param source - Source object to merge
   * @returns Merged object reference
   *
   * @example
   * ```typescript
   * const merged = this.deepMerge(
   *   { a: 1, nested: { x: 1, y: 2 } },
   *   { b: 2, nested: { y: 3, z: 4 } }
   * );
   * // Result: { a: 1, b: 2, nested: { x: 1, y: 3, z: 4 } }
   * ```
   */
  deepMerge(target: any, source: any): any;

  /**
   * 🧬 **Deep Object Merging (Static)**
   *
   * Static version of deep object merging utility for use without component instances.
   * Essential for configuration merging and utility operations.
   *
   * @param target - Target object (will be modified)
   * @param source - Source object to merge
   * @returns Merged object reference
   *
   * @example
   * ```typescript
   * const config = YaiCore.deepMerge(defaultConfig, userConfig);
   * ```
   */
  static deepMerge(target: any, source: any): any;

  /**
   * 🆔 **Generate Unique IDs**
   *
   * Generate unique, collision-resistant IDs with optional prefixes for DOM elements.
   * Uses high-precision timestamps and random suffixes for uniqueness.
   *
   * @param prefix - Optional prefix for the generated ID (default: 'yai')
   * @returns Unique ID string
   *
   * @example
   * ```typescript
   * const id = YaiCore.generateId('tab'); // 'tab-1640995200000-a1b2c3d4e'
   * const genericId = YaiCore.generateId(); // 'yai-1640995200001-f5g6h7i8j'
   *
   * // Usage in component
   * if (!container.id) {
   *   container.id = YaiCore.generateId('component');
   * }
   * ```
   */
  static generateId(prefix?: string): string;

  /**
   * 📡 **Get Base Emitable Events**
   *
   * Returns standardized event names for consistent component communication.
   * Used as foundation for component-specific event systems.
   *
   * @returns Object with standardized event names
   *
   * @example
   * ```typescript
   * const baseEvents = YaiCore.getBaseEmitableEvents();
   * // Returns:
   * // {
   * //   beforeInit: 'beforeInit',
   * //   afterInit: 'afterInit',
   * //   contentLoaded: 'contentLoaded',
   * //   error: 'error',
   * //   ...
   * // }
   * ```
   */
  static getBaseEmitableEvents(): Record<string, string>;

  // === DOM Query and Caching System ===

  /**
   * 🎯 **Get Cached Query Results**
   *
   * Internal caching mechanism for DOM queries. Automatically manages cache lifecycle
   * and provides performance statistics for optimization.
   *
   * @param selector - CSS selector string
   * @param options - Query options including cache behavior
   * @returns Cached query results or null
   */
  protected _getCached(selector: string, options?: any): any;

  /**
   * ✅ **Validate Cached Results**
   *
   * Ensures cached DOM query results are still valid and connected to the document.
   * Prevents stale references from causing runtime errors.
   *
   * @param cached - Cached query results
   * @param multiple - Whether expecting multiple results
   * @returns True if cached results are valid
   */
  protected _validateCached(cached: any, multiple: boolean): boolean;

  /**
   * 🔍 **Enhanced DOM Query System**
   *
   * High-performance DOM querying with automatic caching and scope management.
   * Uses intelligent caching to minimize repeated DOM queries for better performance.
   *
   * @param selector - CSS selector string
   * @param container - Container element for scoped queries (default: document)
   * @param options - Query options including cache refresh
   * @returns First matching element or null
   *
   * @example
   * ```typescript
   * // Basic query with automatic caching
   * const button = this.find('[data-action="open"]');
   *
   * // Scoped query within container
   * const tabContent = this.find('[data-tab="1"]', container);
   *
   * // Force cache refresh
   * const freshResult = this.find('.dynamic-content', container, { refresh: true });
   * ```
   */
  find(selector: string, container?: Document | Element, options?: any): Element | null;

  /**
   * 🔍 **Enhanced DOM Query All System**
   *
   * High-performance DOM querying for multiple elements with automatic caching.
   * Returns live NodeList that updates automatically when DOM changes.
   *
   * @param selector - CSS selector string
   * @param container - Container element for scoped queries (default: document)
   * @param options - Query options including cache refresh
   * @returns NodeList of matching elements
   *
   * @example
   * ```typescript
   * // Get all tab buttons
   * const buttons = this.findAll('[data-action="open"]');
   *
   * // Scoped query for content panels
   * const panels = this.findAll('[data-tab]', container);
   * ```
   */
  findAll(selector: string, container?: Document | Element, options?: any): NodeListOf<Element>;

  /**
   * 🔄 **Refresh Query Cache**
   *
   * Manually refresh cached DOM queries for specific selectors or entire cache.
   * Useful when DOM structure changes significantly.
   *
   * @param selector - Specific selector to refresh (null for entire cache)
   *
   * @example
   * ```typescript
   * // Refresh specific selector
   * this.refreshCache('[data-tab]');
   *
   * // Clear entire cache
   * this.refreshCache();
   * ```
   */
  refreshCache(selector?: string | null): void;

  /**
   * 📊 **Get Cache Performance Statistics**
   *
   * Returns performance metrics for the DOM query cache system.
   * Useful for optimization and debugging.
   *
   * @returns Object with hit/miss ratios and query counts
   *
   * @example
   * ```typescript
   * const stats = this.getCacheStats();
   * console.log(`Cache efficiency: ${(stats.hits / stats.totalQueries * 100).toFixed(2)}%`);
   * ```
   */
  getCacheStats(): { hits: number; misses: number; totalQueries: number };

  // === Event and Interaction System ===

  /**
   * 🎯 **Resolve Dynamic Selectors**
   *
   * Replace placeholder tokens in selectors with actual values for dynamic targeting.
   * Enables flexible selector patterns for reusable components.
   *
   * @param selector - Selector string with replacement tokens
   * @param replacements - Object with token-value pairs
   * @returns Resolved selector string
   *
   * @example
   * ```typescript
   * const selector = this.resolveSelector(
   *   '[data-tab="{tabId}"] .{className}',
   *   { tabId: 'main', className: 'content' }
   * );
   * // Result: '[data-tab="main"] .content'
   * ```
   */
  resolveSelector(selector: string, replacements?: Record<string, string>): string;

  /**
   * 🔗 **Resolve Event Aliases**
   *
   * Convert event alias names to actual method names using component configuration.
   * Enables clean, semantic event handler mapping.
   *
   * @param alias - Event alias name
   * @param eventType - Type of event (click, keydown, etc.)
   * @returns Actual method name or null if not found
   *
   * @example
   * ```typescript
   * // With aliases: { click: { open: 'openHandler' } }
   * const method = this.resolveAlias('open', 'click');
   * // Returns: 'openHandler'
   * ```
   */
  resolveAlias(alias: string, eventType: string): string | null;

  /**
   * 📡 **Dispatch Component Events**
   *
   * Dispatch standardized component events with rich payload data.
   * Integrates with YEH's event system for consistent communication.
   *
   * @param eventName - Name of the event to dispatch
   * @param data - Event payload data
   * @param target - Target element for event dispatch
   *
   * @example
   * ```typescript
   * // Dispatch component lifecycle event
   * this.dispatch('contentLoaded', {
   *   url: 'content.html',
   *   loadTime: 250
   * }, container);
   * ```
   */
  dispatch(eventName: string, data: any, target: Element): void;

  /**
   * 🖱️ **Simulate Click Events**
   *
   * Programmatically trigger click events on elements with full event propagation.
   * Useful for testing and programmatic interaction.
   *
   * @param element - Element to simulate click on
   *
   * @example
   * ```typescript
   * const button = this.find('[data-action="open"]');
   * if (button) this.simulateClick(button);
   * ```
   */
  simulateClick(element: Element): void;

  /**
   * 🖱️ **Simulate Click Events (Static)**
   *
   * Static version of click simulation for use without component instances.
   *
   * @param element - Element to simulate click on
   */
  static simulateClickEvent(element: Element): void;

  /**
   * 📻 **Component Event Broadcasting**
   *
   * Broadcast component events using standardized naming and rich payload data.
   * Creates CustomEvent with detailed information for external listeners.
   *
   * @param eventName - Type of event to broadcast
   * @param details - Event payload data (default: {})
   * @param target - Target element for event dispatch (default: document)
   * @returns Created CustomEvent instance
   *
   * @example
   * ```typescript
   * // Broadcast component state change
   * this.yaiEmit('stateChange', {
   *   component: 'YaiTabs',
   *   state: 'active',
   *   tabId: 'tab-1'
   * }, container);
   *
   * // Listen for events
   * document.addEventListener('yai.component', (event) => {
   *   console.log('Component event:', event.detail);
   * });
   * ```
   */
  yaiEmit(eventName: string, details?: any, target?: Element): CustomEvent;

  // === Processing State Management ===

  /**
   * 🚦 **Set Processing State**
   *
   * Manage async operation state for containers to prevent race conditions
   * and provide visual feedback during long-running operations.
   *
   * @param container - Container element to update state for
   * @param isProcessing - Whether container is processing (true) or idle (false)
   *
   * @example
   * ```typescript
   * this._setProcessingState(container, true);
   * try {
   *   await longRunningOperation();
   * } finally {
   *   this._setProcessingState(container, false);
   * }
   * ```
   */
  protected _setProcessingState(container: Element, isProcessing: boolean): void;

  /**
   * ⏳ **Check Global Processing State**
   *
   * Determine if any containers are currently processing async operations.
   * Useful for global UI state management.
   *
   * @returns True if any container is processing
   *
   * @example
   * ```typescript
   * if (!this.isAnyProcessing()) {
   *   // Safe to perform global operations
   *   this.updateGlobalUI();
   * }
   * ```
   */
  isAnyProcessing(): boolean;

  /**
   * 🔍 **Check Container Processing State**
   *
   * Check if a specific container is currently processing async operations.
   * Prevents duplicate operations on the same container.
   *
   * @param container - Container element to check
   * @returns True if container is processing
   *
   * @example
   * ```typescript
   * if (!this.isContainerProcessing(container)) {
   *   await this.loadContent(url, container);
   * }
   * ```
   */
  isContainerProcessing(container: Element): boolean;

  // === URL and Hash Management ===

  /**
   * 🔗 **Parse URL Hash Parameters**
   *
   * Extract and parse hash parameters from current URL for component state management.
   * Supports multiple parameter formats for flexible routing.
   *
   * @returns Object with parsed hash parameters
   *
   * @example
   * ```typescript
   * // URL: #main-tabs=dashboard&settings-tabs=profile
   * const params = this.parseHash();
   * // Returns: { 'main-tabs': 'dashboard', 'settings-tabs': 'profile' }
   * ```
   */
  parseHash(): Record<string, string>;

  // === Content Height Management ===

  /**
   * 📏 **Preserve Content Height**
   *
   * Maintain container height during content transitions to prevent layout shift.
   * Essential for smooth animations and user experience.
   *
   * @param container - Container to preserve height for
   * @param selector - Selector for content area (default: '[data-content]')
   *
   * @example
   * ```typescript
   * // Preserve height during content swap
   * this._preserveContentHeight(container);
   * await this.updateContent(newContent);
   * this._resetContentHeight(container);
   * ```
   */
  protected _preserveContentHeight(container: Element, selector?: string): void;

  /**
   * 🔄 **Reset Content Height**
   *
   * Remove height preservation and allow natural content height.
   * Called after content transitions complete.
   *
   * @param container - Container to reset height for
   * @param selector - Selector for content area (default: '[data-content]')
   */
  protected _resetContentHeight(container: Element, selector?: string): void;

  // === Dynamic Content Loading System ===

  /**
   * 🛑 **Cancel Fetch Operations**
   *
   * Cancel active fetch requests for a container to prevent memory leaks
   * and race conditions during rapid interactions.
   *
   * @param container - Container to cancel fetch operations for
   *
   * @example
   * ```typescript
   * // Cancel before starting new load
   * this._cancelFetch(container);
   * await this._loadContent(newUrl, targetSelector, container);
   * ```
   */
  protected _cancelFetch(container: Element): void;

  /**
   * 🌐 **Dynamic Content Loading**
   *
   * Advanced fetch-based content loading with comprehensive delay management, error handling,
   * and lifecycle hooks. Supports pre-fetch delays, post-fetch delays, and minimum loading times.
   *
   * **Features:**
   * - AbortController integration for request cancellation
   * - Comprehensive delay management (data-delay, data-post-delay, data-min-loading)
   * - Automatic loading state management
   * - Error handling with fallback content
   * - Lifecycle hook integration
   * - Content append/replace modes
   *
   * @param url - Content URL to fetch
   * @param targetSelector - CSS selector for target content container
   * @param container - Component container element
   * @param append - Whether to append (true) or replace (false) content
   * @param target - Button/element that triggered the loading
   * @returns Promise resolving when content is fully loaded and processed
   *
   * @example
   * ```typescript
   * // Basic content loading
   * await this._loadContent(
   *   'api/tab-content.html',
   *   '[data-tab="dynamic"]',
   *   container
   * );
   *
   * // Advanced loading with context
   * await this._loadContent(
   *   'api/content.html',
   *   '.content-area',
   *   container,
   *   false, // replace content
   *   triggerButton // for delay attributes
   * );
   *
   * // HTML attributes for delay control:
   * // <button data-url="content.html"
   * //         data-delay="1000"          // Wait 1s before fetching
   * //         data-post-delay="500"      // Wait 500ms after content loads
   * //         data-min-loading="800">    // Show loading for minimum 800ms
   * //   Load Content
   * // </button>
   * ```
   */
  protected _loadContent(
    url: string,
    targetSelector: string,
    container: Element,
    append?: boolean,
    target?: Element
  ): Promise<void>;

  /**
   * ❌ **Create Error Messages**
   *
   * Generate user-friendly error messages for content loading failures.
   * Integrates with component configuration for consistent error handling.
   *
   * @param content - Error context or content
   * @param error - Error object with details
   * @returns Formatted error message string
   */
  createErrorMessage(content: string, error: Error): string;

  // === Security and Validation ===

  /**
   * 🔒 **Validate URL for Dynamic Content Loading**
   *
   * Validates URLs before fetching dynamic content. Supports custom validation
   * via callback with sensible defaults that block dangerous schemes.
   *
   * @param url - The URL to validate
   * @returns True if URL is safe to load, false otherwise
   *
   * @example
   * ```typescript
   * // Custom validation via callback
   * const tabs = new YaiTabs({
   *   callbacks: {
   *     validateUrl: (url) => {
   *       return url.startsWith('/api/') || url.startsWith('https://trusted.com');
   *     }
   *   }
   * });
   *
   * // Default validation blocks javascript: and data: schemes
   * if (this._validateUrl(url)) {
   *   this._loadContent(url, selector, container);
   * }
   * ```
   */
  protected _validateUrl(url: string): boolean;

  /**
   * 🛡️ **Sanitize HTML Content**
   *
   * Sanitizes HTML content for dynamic loading. Supports custom sanitization
   * via callback with configurable dangerous element removal.
   *
   * @param html - The HTML content to sanitize
   * @returns Sanitized HTML content
   *
   * @example
   * ```typescript
   * // Configure dangerous elements to remove
   * const tabs = new YaiTabs({
   *   dangerousElements: ['script', 'iframe', 'object']
   * });
   *
   * // Custom sanitization via callback
   * const tabs = new YaiTabs({
   *   callbacks: {
   *     sanitizeHtml: (html) => DOMPurify.sanitize(html)
   *   }
   * });
   *
   * // Built-in sanitization removes scripts and event handlers
   * const safe = this._sanitizeHtml(untrustedHtml);
   * ```
   */
  protected _sanitizeHtml(html: string): string;

  // === Component Nesting and Hierarchy ===

  /**
   * 📊 **Calculate Nesting Level**
   *
   * Determine the nesting depth of a container within the component hierarchy.
   * Used for performance optimization and accessibility management.
   *
   * @param container - Container to calculate nesting level for
   * @returns Numeric nesting level (0 = root, 1+ = nested)
   *
   * @example
   * ```typescript
   * const level = this._calculateNestingLevel(container);
   * console.log(`Container is at nesting level: ${level}`);
   * ```
   */
  protected _calculateNestingLevel(container: Element): number;

  /**
   * 🌿 **Initialize Nested Components**
   *
   * Discover and initialize child components within loaded content.
   * Maintains component hierarchy and delegation relationships.
   *
   * @param content - Content container to scan for nested components
   *
   * @example
   * ```typescript
   * // After loading dynamic content
   * const content = await this.loadContent(url);
   * this._initializeNestedComponents(content);
   * ```
   */
  protected _initializeNestedComponents(content: Element): void;

  // === Lifecycle Hook System ===

  /**
   * 🎛️ **Content Loading Start Hook (Override)**
   *
   * Lifecycle hook for managing content loading states. Override in components for custom
   * loading behavior (spinners, button states, etc.). Called via hook system when dynamic
   * content fetch starts.
   */
  contentLoading(): void;

  /**
   * 🎛️ **Content Loaded Hook (Override)**
   *
   * Lifecycle hook for cleaning up content loading states. Override in components for custom
   * cleanup behavior. Called via hook system when dynamic content fetch completes.
   */
  contentLoaded(): void;

  /**
   * 🎣 **Execute Lifecycle Hook**
   *
   * Execute a registered lifecycle hook with rich context data. Provides error handling
   * and supports both synchronous and asynchronous hook execution.
   *
   * @param hookName - Name of the hook to execute
   * @param context - Rich context object with operation metadata
   * @returns Promise resolving with hook execution result
   *
   * @example
   * ```typescript
   * // Execute hook with rich context
   * await this._executeHook('contentReady', {
   *   content: loadedContent,
   *   container: targetContainer,
   *   target: triggerButton,
   *   url: contentUrl
   * });
   * ```
   */
  protected _executeHook(hookName: keyof LifecycleCallbacks, context?: HookContext): Promise<void>;

  /**
   * 🎣 **Register Lifecycle Hook**
   *
   * Register a callback function for a specific lifecycle event. Supports method chaining
   * for fluent configuration and runtime hook registration.
   *
   * @param hookName - Name of the lifecycle hook
   * @param callback - Function to execute when hook is triggered
   * @returns this for method chaining
   *
   * @example
   * ```typescript
   * component
   *   .hook('setLoading', ({ target, isLoading }) => {
   *     target?.classList.toggle('loading', isLoading);
   *     target?.setAttribute('aria-busy', String(isLoading));
   *   })
   *   .hook('contentReady', ({ content, target, url }) => {
   *     content?.classList.add('content-loaded');
   *     console.log(`Loaded content from: ${url}`);
   *
   *     // Perfect timing for CSS animations
   *     requestAnimationFrame(() => {
   *       content?.classList.add('animate-in');
   *     });
   *   })
   *   .hook('afterLoad', ({ container, content }) => {
   *     // Initialize nested components
   *     this._initializeNestedComponents(content);
   *   });
   * ```
   */
  hook(hookName: keyof LifecycleCallbacks, callback: LifecycleCallbacks[keyof LifecycleCallbacks]): this;

  /**
   * 🔄 **Content Post-Processing Hook**
   *
   * Lifecycle hook called after content is loaded and DOM is updated, but before
   * final initialization. Override for component-specific content processing.
   *
   * @example
   * ```typescript
   * protected _postProcessContent() {
   *   // Custom post-processing logic
   *   this.initializeCustomFeatures();
   *   this.setupEventDelegation();
   * }
   * ```
   */
  protected _postProcessContent(): void;

  /**
   * 🌍 **Global Mouse/Touch Watcher - Universal Event Bridge**
   *
   * Provides a centralized hook system for global mouse/touch events on the document body.
   * This enables cross-component coordination and state management for drag operations,
   * focus management, and other global interactions.
   *
   * **🎯 Primary Use Cases:**
   * - Drag operation cancellation when mouse leaves components
   * - Global focus management and blur handling
   * - Cross-component gesture coordination
   * - Stuck state recovery for interactive elements
   *
   * **⚡ Event Configuration:**
   * ```typescript
   * events: {
   *     setListener: {
   *         'body': [
   *             { type: 'mouseup', handler: 'globalMouseWatch', debounce: 100 },
   *             { type: 'touchend', handler: 'globalMouseWatch', debounce: 100 },
   *             { type: 'touchcancel', handler: 'globalMouseWatch', debounce: 100 }
   *         ]
   *     }
   * }
   * ```
   *
   * **🔧 Hook Payload Structure:**
   * ```typescript
   * {
   *     event: MouseEvent | TouchEvent,  // Original DOM event
   *     target: Element,                 // Event target element
   *     container: Element,              // Closest component container
   *     context: YaiCore                 // Current instance context
   * }
   * ```
   *
   * **💡 Usage Examples:**
   *
   * **Drag Cancellation:**
   * ```typescript
   * tabs.hook('globalMouseWatch', ({ event, target, context }) => {
   *     if (!target.closest('[data-yai-tabs]')) {
   *         // Cancel any active drag operations
   *         swypeInstance.resetDraggingState();
   *     }
   * });
   * ```
   *
   * **Focus Management:**
   * ```typescript
   * tabs.hook('globalMouseWatch', ({ event, target }) => {
   *     // Close dropdowns when clicking outside
   *     if (event.type === 'mouseup' && !target.closest('.dropdown')) {
   *         closeAllDropdowns();
   *     }
   * });
   * ```
   *
   * **Multi-component Coordination:**
   * ```typescript
   * tabs.hook('globalMouseWatch', ({ event, context }) => {
   *     // Notify other components of global interaction
   *     eventBus.emit('globalInteraction', { type: event.type, source: context });
   * });
   * ```
   *
   * **🚀 Performance Notes:**
   * - Uses 100ms debounce to prevent excessive firing
   * - Only triggers on body-level events (efficient delegation)
   * - Passive event listeners where supported
   * - Automatic cleanup with component destruction
   *
   * @param event - The original DOM event (MouseEvent or TouchEvent)
   * @param target - The event target element
   * @param container - The closest component container element
   * @fires globalMouseWatch - Hook event with contextual data
   *
   * @example
   * ```typescript
   * // Cleanup stuck drag states
   * class MyTabs extends YaiCore {
   *   globalMouseWatch(event, target, container) {
   *     if (this.isDragging && !target.closest('[data-draggable]')) {
   *       this.cancelDrag();
   *     }
   *   }
   * }
   * ```
   */
  globalMouseWatch(event: MouseEvent | TouchEvent, target: Element, container: Element): void;

  // === Static Accessibility Utilities ===

  /**
   * ♿ **Setup Accessibility Attributes**
   *
   * Configure ARIA attributes and roles for WCAG 2.1 AA compliance.
   * Handles ID generation, role assignment, and label management.
   *
   * @param container - Container element to configure
   * @param config - Accessibility configuration options
   * @returns Generated unique ID for the container
   *
   * @example
   * ```typescript
   * const id = YaiCore._setupAccessibility(container, {
   *   role: 'tabpanel',
   *   label: 'Main Content',
   *   idPrefix: 'content'
   * });
   * ```
   */
  static _setupAccessibility(container: Element, config?: any): void;

  /**
   * 🧹 **Clear Accessibility Attributes**
   *
   * Remove ARIA attributes from an element for cleanup or reconfiguration.
   * Used during component destruction or state changes.
   *
   * @param element - Element to clear attributes from
   *
   * @example
   * ```typescript
   * // Clean up before reconfiguring
   * YaiCore._clearAccessibilityAttributes(element);
   * YaiCore._setupAccessibility(element, newConfig);
   * ```
   */
  static _clearAccessibilityAttributes(element: Element): void;
}

/**
 * 📤 **Module Exports**
 */

// Export main class as default
export default YaiCore;

/**
 * 🎯 **Quick Start Guide**
 *
 * **1. Basic Component Extension:**
 * ```typescript
 * import YaiCore from './yai-core.js';
 *
 * class MyComponent extends YaiCore {
 *   constructor(config) {
 *     super({
 *       dynamicContent: true,
 *       autoAccessibility: true,
 *       ...config
 *     });
 *   }
 * }
 * ```
 *
 * **2. Hook-Based Customization:**
 * ```typescript
 * const component = new YaiCore()
 *   .hook('setLoading', ({ target }) => target?.classList.add('loading'))
 *   .hook('contentReady', ({ content }) => content?.classList.add('ready'));
 * ```
 *
 * **3. Dynamic Content Loading:**
 * ```typescript
 * await component._loadContent(
 *   'api/content.html',
 *   '.target-area',
 *   container,
 *   false,
 *   triggerButton
 * );
 * ```
 *
 * **🔧 Advanced Features:**
 * - **Event Factory**: Create YEH instances with component integration
 * - **DOM Caching**: High-performance query system with automatic management
 * - **Hook System**: Extensible lifecycle callbacks for custom behavior
 * - **Memory Management**: Automatic cleanup with AbortController integration
 * - **Accessibility**: Built-in WCAG 2.1 AA compliance utilities
 *
 * **⚡ Performance Tips:**
 * - Use DOM caching for repeated queries
 * - Leverage hook system for extensible behavior
 * - Enable memory management for dynamic content
 * - Utilize static utilities for reusable functionality
 */