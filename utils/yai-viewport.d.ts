/**
 * 🎯 **YaiViewport 1.0 - Advanced Viewport Tracking System**
 *
 * Built on YEH's O(1) event delegation architecture, YaiViewport provides
 * high-performance viewport visibility tracking with spatial optimization for elements.
 * Designed for seamless integration with the Yai Framework, it enables visibility-driven
 * interactions like lazy loading, animations, or analytics triggers with minimal overhead.
 *
 * **🚀 Key Features:**
 * - **O(1) Performance**: Single event listener for window events with throttled handlers
 * - **Spatial Optimization**: Grid-based element tracking for efficient visibility checks
 * - **Configurable Thresholds**: Fine-tuned control over visibility detection
 * - **WCAG 2.1 AA Support**: Compatible with accessibility-driven UI interactions
 * - **Hook-Based Extensibility**: Lifecycle callbacks for custom behavior
 * - **Framework Agnostic**: Works with React, Vue, Angular, or Vanilla JS
 *
 * **📊 Performance Metrics:**
 * - Initialization: < 50ms for typical use cases
 * - Scroll/Resize Handling: Throttled at 500ms/1000ms by default
 * - Memory Footprint: ~600 LOC, minimal runtime overhead
 * - Scalability: Efficient for dozens of tracked elements with spatial grid
 *
 * @author YaiJS Team - Advanced component architecture
 * @license MIT
 * @see https://github.com/yaijs/yai/blob/main/utils/yai-viewport.js
 */

import { HookContext, LifecycleCallbacks, YEH, YEHConfig } from '@yaijs/core/yeh';

/**
 * 📏 **Viewport Threshold Configuration**
 *
 * Defines pixel-based thresholds for visibility detection and page state triggers.
 */
export interface ViewportThreshold {
  /** Threshold for page top detection (pixels from top) */
  pageTop?: number;
  /** Threshold for page end detection (pixels from bottom) */
  pageEnd?: number;
  /** Threshold for page scrolled detection (pixels scrolled) */
  pageScrolled?: number;
  /** Threshold for element visibility detection (pixel buffer) */
  elementVisible?: number;
  /** Threshold for element hidden detection (pixel buffer) */
  elementHidden?: number;
}

/**
 * 🎨 **Selector Configuration**
 *
 * Defines data attributes and classes for visibility tracking and page state.
 */
export interface ViewportSelector {
  /** Data attribute for tracking element distance from top */
  trackDistance?: string;
  /** Data attribute for visibility state */
  isVisibleAttr?: string;
  /** Class for visible elements */
  isVisibleClass?: string;
  /** Class for page at top state */
  pageTop?: string;
  /** Class for page end state */
  pageEnd?: string;
  /** Class for page scrolled state */
  pageScrolled?: string;
}

/**
 * ⚙️ **YaiViewport Configuration Interface**
 *
 * Comprehensive configuration options extending YEH functionality
 * with viewport-specific features and intelligent defaults.
 */
export interface YaiViewportConfig extends YEHConfig {
  /** Selector configuration for attributes and classes */
  set?: {
    selector?: ViewportSelector;
  };
  /** Throttle settings for event handlers */
  throttle?: {
    resize?: number;
    scroll?: number;
  };
  /** Threshold settings for visibility detection */
  threshold?: ViewportThreshold;
  /** Callback hooks for lifecycle events */
  callbacks?: ViewportLifecycleCallbacks;
}

/**
 * 🎣 **Viewport Hook Context**
 *
 * Extended context object passed to viewport lifecycle hooks with
 * visibility-specific metadata and references.
 */
export interface ViewportHookContext extends HookContext {
  /** Tracked element */
  element?: Element;
  /** Element's bounding client rectangle */
  rect?: DOMRect;
  /** Current visibility state */
  state?: 'visible' | 'hidden';
  /** Percentage of element visible in viewport */
  visiblePercentage?: number;
  /** Viewport dimensions */
  viewport?: { width: number; height: number };
  /** Current scroll position */
  scrollY?: number;
  /** Number of tracked elements */
  trackedElements?: number;
  /** Threshold configuration */
  threshold?: ViewportThreshold;
}

/**
 * 🔄 **Viewport Lifecycle Callbacks**
 *
 * Lifecycle hooks for viewport-specific events, extending base YEH callbacks.
 */
export interface ViewportLifecycleCallbacks extends LifecycleCallbacks {
  /** Called after window load event */
  afterLoad?: (context: ViewportHookContext) => void | Promise<void>;
  /** Called after window resize event */
  afterResize?: (context: ViewportHookContext) => void | Promise<void>;
  /** Called after window scroll event */
  afterScroll?: (context: ViewportHookContext) => void | Promise<void>;
  /** Called when an element becomes visible */
  elementVisible?: (context: ViewportHookContext) => void | Promise<void>;
  /** Called when an element becomes hidden */
  elementHidden?: (context: ViewportHookContext) => void | Promise<void>;
  /** Called when page is at top */
  pageTop?: (context: ViewportHookContext) => void | Promise<void>;
  /** Called when page is at end */
  pageEnd?: (context: ViewportHookContext) => void | Promise<void>;
  /** Called when page is scrolled */
  pageScrolled?: (context: ViewportHookContext) => void | Promise<void>;
}

/**
 * 🏗️ **YaiViewport Class - Advanced Viewport Tracking**
 *
 * High-performance viewport tracking system built on YEH's O(1) architecture.
 * Provides efficient element visibility detection with spatial optimization and hook-based extensibility.
 *
 * **🎯 Core Architecture:**
 * - Single event listener for window events (load, resize, scroll)
 * - Spatial grid optimization for efficient visibility checks
 * - Throttled event handling for performance
 * - Hook-based extensibility for custom behavior
 * - Dynamic class and attribute management for visibility states
 *
 * **📖 Usage Examples:**
 *
 * @example
 * **Basic Usage:**
 * ```typescript
 * // Initialize with default configuration
 * const viewport = new YaiViewport();
 *
 * // Track elements
 * viewport.track('.section, .box');
 * ```
 *
 * @example
 * **Custom Configuration:**
 * ```typescript
 * const viewport = new YaiViewport({
 *   throttle: { resize: 500, scroll: 300 },
 *   threshold: { elementVisible: 100, elementHidden: 100 },
 *   set: {
 *     selector: {
 *       isVisibleClass: 'visible',
 *       trackDistance: 'data-distance'
 *     }
 *   }
 * });
 * ```
 *
 * @example
 * **Hook-Based Customization:**
 * ```typescript
 * const viewport = new YaiViewport()
 *   .hook('elementVisible', ({ element, visiblePercentage }) => {
 *     console.log(`Element ${element} is ${visiblePercentage}% visible`);
 *     element.classList.add('fade-in');
 *   })
 *   .hook('pageTop', ({ scrollY }) => {
 *     console.log(`Page is at top, scrollY: ${scrollY}`);
 *   });
 * ```
 *
 * @example
 * **HTML Structure:**
 * ```html
 * <!-- Trackable Elements -->
 * <div class="section" data-yvp-position data-yvp-is-visible>
 *   Track me when visible!
 * </div>
 * <div class="box" style="margin-top: 200vh;">
 *   I appear later!
 * </div>
 * ```
 *
 * **🎯 Performance Features:**
 * - **Spatial Optimization**: Grid-based tracking reduces visibility checks
 * - **Throttled Events**: Configurable delays for scroll and resize
 * - **Memory Management**: Automatic cleanup of removed elements
 * - **Scalability**: Efficient for dozens of elements with O(1) event handling
 *
 * **♿ Accessibility Features:**
 * - **Dynamic Attributes**: Updates `data-yvp-is-visible` for screen reader support
 * - **Customizable Classes**: Enables accessible visual state management
 * - **Hook Integration**: Supports accessibility-driven interactions
 */
export declare class YaiViewport extends YEH {
  protected config: Required<YaiViewportConfig>;
  protected _trackedElements: Map<Element, any>;
  protected _positionGrid: Map<string, Set<Element>>;
  protected _visibleRegions: Set<string>;
  protected _lastScrollY: number;

  /**
   * 🏗️ **Create YaiViewport Instance**
   *
   * Initialize a new viewport tracker with optional configuration.
   * Automatically sets up event delegation and visibility tracking.
   *
   * @param setConfig - Optional configuration object
   */
  constructor(setConfig?: YaiViewportConfig);

  /**
   * 🚀 **Track Elements**
   *
   * Add elements to viewport tracking with spatial optimization.
   * Supports CSS selectors, single elements, or arrays of elements.
   *
   * @param elements - Elements to track (selector string, Element, or Element[])
   * @returns this for method chaining
   */
  track(elements: string | Element | Element[]): this;

  /**
   * 🔄 **Refresh Tracking**
   *
   * Refresh tracked element positions and visibility states.
   * Useful after dynamic content changes.
   *
   * @returns this for method chaining
   */
  refresh(): this;

  /**
   * 🧹 **Cleanup**
   *
   * Remove all tracked elements and event listeners.
   * Clears internal state for memory management.
   */
  destroy(): void;

  /**
   * 🎣 **Hook Management**
   *
   * Register lifecycle hooks with viewport-specific context support.
   * Extends base YEH hook system with visibility-aware functionality.
   *
   * @param hookName - Name of the lifecycle hook
   * @param callback - Callback function to register
   * @returns this for method chaining
   *
   * @example
   * ```typescript
   * viewport.hook('elementVisible', ({ element, state, visiblePercentage }) => {
   *   console.log(`Element ${element} is ${state} (${visiblePercentage}%)`);
   * });
   * ```
   */
  hook(hookName: keyof ViewportLifecycleCallbacks, callback: ViewportLifecycleCallbacks[keyof ViewportLifecycleCallbacks]): this;

  /**
   * 👁️ **Internal Visibility Check**
   *
   * Determine if an element is visible in the current viewport with threshold support.
   *
   * @param rect - Element's bounding client rectangle
   * @param viewportHeight - Current viewport height
   * @param viewportWidth - Current viewport width
   * @returns True if element is visible
   */
  protected _isElementInViewport(rect: DOMRect, viewportHeight: number, viewportWidth: number): boolean;

  /**
   * 📏 **Calculate Visible Percentage**
   *
   * Calculate the percentage of an element visible in the viewport.
   *
   * @param rect - Element's bounding client rectangle
   * @param viewportHeight - Current viewport height
   * @returns Percentage visible (0-100)
   */
  protected _getVisiblePercentage(rect: DOMRect, viewportHeight: number): number;

  /**
   * 📍 **Generate Position Key**
   *
   * Create a spatial grid key for an element's viewport-relative position.
   *
   * @param rect - Element's bounding client rectangle
   * @param gridSize - Size of spatial grid cells
   * @returns Position key string
   */
  protected _generatePositionKey(rect: DOMRect, gridSize?: number): string;

  /**
   * 🔄 **Refresh Element Positions**
   *
   * Update tracked element positions in the spatial grid.
   * Called on scroll and resize events.
   */
  protected _refreshElementViewportPositions(): void;

  /**
   * 🌐 **Update Visible Regions**
   *
   * Calculate currently visible spatial regions based on viewport position.
   *
   * @param scrollY - Current scroll position
   * @param viewportHeight - Current viewport height
   */
  protected _updateVisibleRegions(scrollY: number, viewportHeight: number): void;

  /**
   * 🖌️ **Update Element Visual State**
   *
   * Apply visibility classes and attributes to tracked elements.
   *
   * @param element - Tracked element
   * @param rect - Element's bounding client rectangle
   * @param isVisible - Current visibility state
   */
  protected _updateElementVisualState(element: Element, rect: DOMRect, isVisible: boolean): void;

  /**
   * 📊 **Update Body State**
   *
   * Apply page state classes (top, end, scrolled) to the body element.
   *
   * @param scrollY - Current scroll position
   * @param pageHeight - Total document height
   */
  protected _updateBodyState(scrollY: number, pageHeight: number): void;

  /**
   * 🧹 **Untrack Element**
   *
   * Remove an element from tracking and clean up its state.
   *
   * @param element - Element to untrack
   */
  protected _untrackElement(element: Element): void;

  /**
   * 🔄 **Update Viewport State**
   *
   * Core method to update all tracked elements and page states.
   * Called on scroll, resize, and load events.
   */
  protected _updateViewportState(): void;

  /**
   * 🔍 **Check All Elements**
   *
   * Check visibility of all tracked elements and trigger hooks as needed.
   *
   * @param viewportHeight - Current viewport height
   * @param viewportWidth - Current viewport width
   */
  protected _checkAllElements(viewportHeight: number, viewportWidth: number): void;

  /**
   * 🔗 **Execute Hook**
   *
   * Execute a registered lifecycle hook with context.
   *
   * @param hookName - Name of the hook to execute
   * @param context - Context object for the hook
   * @returns Result of hook execution
   */
  protected _executeHook(hookName: keyof ViewportLifecycleCallbacks, context?: ViewportHookContext): any;

  /**
   * 🔄 **Object Merge Utility**
   *
   * Deep merge configuration objects for flexible setup.
   *
   * @param objects - Objects to merge
   * @returns Merged object
   */
  protected _objectMerge(...objects: object[]): object;
}

/**
 * 📤 **Module Exports**
 */

// Export main class as default
export default YaiViewport;

// Re-export base types for convenience
export { HookContext, LifecycleCallbacks, YEH, YEHConfig } from 'ypsilon-event-handler';

/**
 * 🎯 **Quick Start Guide**
 *
 * 1. **Basic Setup:**
 *    ```html
 *    <div class="section" data-yvp-position data-yvp-is-visible>
 *      Track me in the viewport!
 *    </div>
 *    ```
 *
 * 2. **JavaScript Initialization:**
 *    ```javascript
 *    import YaiViewport from './yai-viewport.js';
 *    const viewport = new YaiViewport();
 *    viewport.track('.section');
 *    ```
 *
 * 3. **Custom Configuration:**
 *    ```javascript
 *    const viewport = new YaiViewport({
 *      throttle: { resize: 300, scroll: 200 },
 *      threshold: { elementVisible: 50, pageTop: 100 },
 *      set: { selector: { isVisibleClass: 'visible' } }
 *    });
 *    ```
 *
 * **🔧 Advanced Features:**
 * - **Spatial Optimization**: Grid-based tracking for efficient visibility checks
 * - **Threshold Control**: Fine-tune visibility detection with pixel buffers
 * - **Dynamic Attributes**: Updates `data-yvp-position` and `data-yvp-is-visible`
 * - **Custom Hooks**: Use `.hook()` for lifecycle customization
 * - **Page State Management**: Track page top, end, and scrolled states
 *
 * **⚡ Performance Tips:**
 * - Adjust throttle values for high-frequency scrolling devices
 * - Use smaller gridSize for dense element layouts
 * - Leverage thresholds to reduce unnecessary visibility checks
 * - Call `refresh()` after dynamic DOM updates
 *
 * **♿ Accessibility Tips:**
 * - Use `data-yvp-is-visible` for screen reader announcements
 * - Combine with `elementVisible` hooks for accessible interactions
 * - Ensure visible states align with focusable elements
 */
