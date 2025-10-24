/**
 * YaiTabsSwype - Swipe/drag navigation utility for YaiTabs
 * @module yai-tabs-swype
 * @version 1.0.0
 * @license MIT
 */

import type { YaiTabs } from '../tabs/yai-tabs';

/**
 * Swipe distance thresholds for different input types
 */
export interface SwypeThreshold {
    /** Distance threshold for touch devices (px) */
    mobile: number;
    /** Distance threshold for mouse devices (px) */
    desktop: number;
}

/**
 * Lifecycle hooks for swipe events
 */
export interface SwypeCallable {
    /** Called when swipe/drag starts */
    swipeStart: ((context: SwipeStartContext, instance: YaiTabsSwype) => void) | null;
    /** Called during swipe/drag movement */
    swipeMove: ((context: SwipeMoveContext, instance: YaiTabsSwype) => void) | null;
    /** Called when swipe/drag ends */
    swipeEnd: ((context: SwipeEndContext, instance: YaiTabsSwype) => void) | null;
    /** Called before tab switch (can return false to cancel) */
    beforeSwitch: ((context: BeforeSwitchContext, instance: YaiTabsSwype) => boolean | void) | null;
    /** Called after tab switch */
    afterSwitch: ((context: AfterSwitchContext, instance: YaiTabsSwype) => void) | null;
    /** Called when drag is cancelled (e.g., global reset) */
    dragCancelled: ((context: DragCancelledContext, instance: YaiTabsSwype) => void) | null;
}

/**
 * Semantic direction names for swipe gestures
 */
export type SemanticDirection = 'left' | 'right' | 'up' | 'down';

/**
 * Context passed to swipeStart hook
 */
export interface SwipeStartContext {
    panel: HTMLElement;
    moveType: MoveType;
    startX: number;
    startY: number;
    event: MouseEvent | TouchEvent;
    target: HTMLElement;
}

/**
 * Context passed to swipeMove hook
 */
export interface SwipeMoveContext {
    panel: HTMLElement;
    moveType: MoveType;
    deltaX: number;
    deltaY: number;
    semanticDirection: SemanticDirection | null;
    lockedAxis: 'x' | 'y' | null;
    event: MouseEvent | TouchEvent;
    target: HTMLElement;
}

/**
 * Context passed to swipeEnd hook
 */
export interface SwipeEndContext {
    panel: HTMLElement;
    moveType: MoveType;
    deltaX: number;
    deltaY: number;
    semanticDirection: SemanticDirection | null;
    absDistance: number;
    threshold: number;
    switched: boolean;
    event: MouseEvent | TouchEvent;
    target: HTMLElement;
}

/**
 * Context passed to beforeSwitch hook
 */
export interface BeforeSwitchContext {
    panel: HTMLElement;
    container: HTMLElement;
    deltaX: number;
    deltaY: number;
    semanticDirection: SemanticDirection;
    moveType: MoveType;
    direction: 'next' | 'prev';
    event: MouseEvent | TouchEvent;
    target: HTMLElement;
}

/**
 * Context passed to afterSwitch hook
 */
export interface AfterSwitchContext {
    panel: HTMLElement;
    container: HTMLElement;
    deltaX: number;
    deltaY: number;
    semanticDirection: SemanticDirection;
    moveType: MoveType;
    direction: 'next' | 'prev';
    switched: boolean;
    event: MouseEvent | TouchEvent;
    target: HTMLElement;
}

/**
 * Context passed to dragCancelled hook
 */
export interface DragCancelledContext {
    /** Reason for cancellation (e.g., 'global_reset') */
    reason: string;
    /** Array of elements that had dragging state removed */
    draggedElements: HTMLElement[];
}

/**
 * Boundary behavior configuration for YaiTabsSwype
 */
export interface BoundaryBehavior {
    /** Loop from last to first tab and vice versa */
    circular?: boolean;
    /** Auto-open first tab of nested component when reaching boundary */
    descendIntoNested?: boolean;
    /** Auto-switch to parent's next tab when reaching nested boundary */
    ascendFromNested?: boolean;
    /** Delay (ms) before switching after showing parent chain (0 to disable) */
    transitionDelay?: number;
}

/**
 * Configuration options for YaiTabsSwype
 */
export interface SwypeConfig {
    /** Swipe distance thresholds */
    threshold: SwypeThreshold;
    /** Allowed swipe directions ('horizontal', 'vertical', 'both', or 'auto' to detect from aria-orientation) */
    axis?: 'horizontal' | 'vertical' | 'both' | 'auto';
    /** Minimum movement to determine axis lock (prevents accidental diagonal swipes) */
    axisLockThreshold?: number;
    /**
     * Reverse swipe direction mapping
     * - false (default): swipe left/up = next, swipe right/down = prev
     * - true: swipe left/up = prev, swipe right/down = next
     */
    reverseDirection?: boolean;
    /** Boundary behavior when reaching first/last tab */
    boundaryBehavior?: BoundaryBehavior;
    /** Lifecycle hooks */
    callable?: Partial<SwypeCallable>;
}

/**
 * Internal state for tracking drag/swipe gestures
 */
export interface SlideState {
    /** Whether a drag/swipe is currently in progress */
    isDragging: boolean;
    /** Starting X coordinate */
    startX: number;
    /** Current X coordinate */
    currentX: number;
    /** Starting Y coordinate */
    startY: number;
    /** Current Y coordinate */
    currentY: number;
    /** Timestamp when drag started (ms) */
    startTime: number;
    /** Locked movement axis ('x' or 'y') - determined after initial movement */
    lockedAxis: 'x' | 'y' | null;
}

/**
 * Event type discriminator for mouse vs touch events
 */
type MoveType = 'mouse' | 'touch';

/**
 * YaiTabsSwype - Add swipe/drag navigation to YaiTabs
 *
 * Provides mobile-first swipe gestures and desktop drag navigation for tab switching.
 * Works at every nesting level with automatic container scoping.
 *
 * @example
 * ```typescript
 * import { YaiTabs } from '@yaijs/core';
 * import { YaiTabsSwype } from '@yaijs/core/utils/yai-tabs-swype';
 *
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
 * const swype = new YaiTabsSwype({ threshold: { mobile: 50, desktop: 100 } })
 *     .setInstance(tabs)
 *     .watchHooks();
 * ```
 */
export declare class YaiTabsSwype {
    /**
     * Internal state tracking for drag/swipe gestures
     * @private
     */
    private slideState: SlideState;

    /**
     * Track pending timeout for boundary behavior transitions
     * @private
     */
    private _pendingTimeout: number | null;

    /**
     * Reference to YaiTabs instance
     * @private
     */
    private tabs: YaiTabs | null;

    /**
     * Swype configuration
     * @private
     */
    private config: SwypeConfig;

    /**
     * Creates a new YaiTabsSwype instance
     * @param customConfig - Custom configuration options (partial)
     */
    constructor(customConfig?: Partial<SwypeConfig>);

    /**
     * Set the YaiTabs instance to attach swipe handlers to
     * @param tabsInstance - YaiTabs instance
     * @returns Returns this for chaining
     * @example
     * ```typescript
     * const swype = new YaiTabsSwype().setInstance(tabs);
     * ```
     */
    setInstance(tabsInstance: YaiTabs): this;

    /**
     * Execute a lifecycle callback hook with context data
     * @param hookName - Name of the callback hook
     * @param context - Context data to pass to the callback
     * @param instance - Optional instance to check for hooks (defaults to this)
     * @returns Result from callback execution
     * @private
     */
    private _executeHook(hookName: string, context: any, instance?: YaiTabsSwype): any;

    /**
     * Set a lifecycle callback hook
     * @param hookName - Name of the callback hook ('swipeStart', 'swipeMove', 'swipeEnd', 'beforeSwitch', 'afterSwitch')
     * @param callback - Callback function to execute
     * @param instance - Optional instance to set hook on (defaults to this)
     * @returns Returns instance for chaining
     * @example
     * ```typescript
     * swype.hook('swipeStart', ({ panel, moveType }) => {
     *     console.log('Swipe started:', moveType);
     * });
     *
     * swype.hook('beforeSwitch', ({ direction }) => {
     *     console.log('Switching to:', direction);
     *     return false; // Cancel switch
     * });
     * ```
     */
    hook(hookName: keyof SwypeCallable, callback: SwypeCallable[keyof SwypeCallable], instance?: YaiTabsSwype): this;

    /**
     * Get the closest tabs container element
     * @param target - Starting element
     * @returns The [data-yai-tabs] container or null
     * @private
     */
    private getTabsContainer(target: HTMLElement): HTMLElement | null;

    /**
     * Get the active tab panel or closest tab panel
     * @param target - Starting element
     * @returns The active [data-tab] panel or null
     * @private
     */
    private getTabsPanel(target: HTMLElement): HTMLElement | null;

    /**
     * Switch to a relative tab (next/previous)
     * @param container - Tabs container element
     * @param offset - Offset from current tab (-1 for previous, 1 for next)
     * @returns True if tab was switched, false otherwise
     * @private
     */
    private switchToRelativeTab(container: HTMLElement, offset: number): boolean;

    /**
     * Reset container to first tab (for clean state after ascension)
     * @param container - Tabs container element
     * @private
     */
    private resetToFirstTab(container: HTMLElement): void;

    /**
     * Ensure all parent containers are visible by activating the tab chain
     * @param container - Starting container
     * @returns Root container or null
     * @private
     */
    private ensureParentChainVisible(container: HTMLElement): HTMLElement | null;

    /**
     * Handle boundary behavior when reaching first/last tab
     * @param container - Tabs container element
     * @param offset - Offset that was attempted (-1 or 1)
     * @param direction - Direction of movement ('next' or 'prev')
     * @param originContainer - Original container where ascension started (for visibility restoration)
     * @returns True if boundary behavior succeeded, false otherwise
     * @private
     */
    private handleBoundaryBehavior(container: HTMLElement, offset: number, direction: 'next' | 'prev', originContainer?: HTMLElement | null): boolean;

    /**
     * Auto-detect axis from container's aria-orientation attribute
     * @param container - Tabs container element
     * @returns Detected axis ('horizontal', 'vertical', or 'both')
     * @private
     */
    private detectAxisFromContainer(container: HTMLElement): 'horizontal' | 'vertical' | 'both';

    /**
     * Extract X coordinate from mouse or touch event
     * @param moveType - Event type ('mouse' or 'touch')
     * @param event - DOM event
     * @returns X coordinate in pixels
     * @private
     */
    private mouseGetXCoords(moveType: MoveType, event: MouseEvent | TouchEvent): number;

    /**
     * Extract Y coordinate from mouse or touch event
     * @param moveType - Event type ('mouse' or 'touch')
     * @param event - DOM event
     * @returns Y coordinate in pixels
     * @private
     */
    private mouseGetYCoords(moveType: MoveType, event: MouseEvent | TouchEvent): number;

    /**
     * Determine semantic direction from deltas
     * @param deltaX - Horizontal movement distance
     * @param deltaY - Vertical movement distance
     * @returns Semantic direction name ('left', 'right', 'up', 'down') or null
     * @private
     */
    private getSemanticDirection(deltaX: number, deltaY: number): SemanticDirection | null;

    /**
     * Get relative tab direction from semantic direction
     * @param semanticDirection - Semantic direction ('left', 'right', 'up', 'down')
     * @returns Relative direction for tab switching ('next' or 'prev')
     * @private
     */
    private getRelativeDirection(semanticDirection: SemanticDirection): 'next' | 'prev';

    /**
     * Handle drag/swipe start event
     * @param moveType - Event type ('mouse' or 'touch')
     * @param event - DOM event
     * @param target - Target element
     * @private
     */
    private mouseIsDown(moveType: MoveType, event: MouseEvent | TouchEvent, target: HTMLElement): void;

    /**
     * Handle drag/swipe move event with visual feedback
     * @param moveType - Event type ('mouse' or 'touch')
     * @param event - DOM event
     * @param target - Target element
     * @private
     */
    private mouseIsMoving(moveType: MoveType, event: MouseEvent | TouchEvent, target: HTMLElement): void;

    /**
     * Handle drag/swipe end event and trigger tab switch if threshold met
     * @param moveType - Event type ('mouse' or 'touch')
     * @param event - DOM event
     * @param target - Target element
     * @private
     */
    private mouseGoesUp(moveType: MoveType, event: MouseEvent | TouchEvent, target: HTMLElement): void;

    /**
     * Attach event hooks to the YaiTabs instance
     *
     * Registers handlers for mouse (desktop) and touch (mobile) events.
     * Must be called after setInstance() to activate swipe navigation.
     *
     * @returns Returns this for chaining
     * @throws {Error} If tabs instance is not set
     * @example
     * ```typescript
     * const swype = new YaiTabsSwype()
     *     .setInstance(tabs)
     *     .hook('swipeStart', ({ panel }) => console.log('Started!'))
     *     .watchHooks();
     * ```
     */
    watchHooks(): this;

    /**
     * Completely reset dragging state and clean up DOM
     *
     * Resets internal state and removes dragging classes from all elements.
     * Useful for cleanup when mouse/touch leaves component area or when
     * stuck states occur.
     *
     * @returns Returns this for chaining
     * @example
     * ```typescript
     * // Cleanup stuck drag states via globalMouseWatch
     * tabs.hook('globalMouseWatch', ({ target }) => {
     *     if (!target.closest('[data-mousedown]')) {
     *         swype.resetDraggingState();
     *     }
     * });
     * ```
     */
    resetDraggingState(): this;

    /**
     * Check if any drag operation is currently active
     * @returns True if dragging is in progress
     */
    isDragging(): boolean;
}

export default YaiTabsSwype;
