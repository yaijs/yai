/**
 * YaiAutoSwitch - Generic component testing utility for YaiJS
 *
 * Automatically cycles through interactive elements (tabs, modals, accordions, etc.)
 * to demonstrate animations and test component behavior.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const tester = new YaiAutoSwitch({
 *   target: '#my-tabs',
 *   triggerSelector: 'button[data-open]',
 *   timeout: 1000
 * }).cycle();
 * ```
 *
 * @example
 * ```typescript
 * // Chainable configuration
 * const tester = new YaiAutoSwitch()
 *   .setContainer('#demo-tabs', 'button[data-open]')
 *   .setConfig('timeout', 800)
 *   .on('cycleInit', () => console.log('Starting demo'))
 *   .on('afterLast', () => console.log('Demo complete'))
 *   .cycle();
 * ```
 */

/**
 * Configuration for MouseEvent creation
 */
export interface ClickConfig {
    bubbles?: boolean;
    cancelable?: boolean;
}

/**
 * Callback functions for YaiAutoSwitch lifecycle events
 */
export interface AutoSwitchCallbacks {
    /** Called before cycling starts */
    cycleInit?: ((instance: YaiAutoSwitch) => void) | null;
    /** Called between each trigger click */
    cycleBetween?: ((instance: YaiAutoSwitch) => void) | null;
    /** Called after last trigger */
    afterLast?: ((instance: YaiAutoSwitch) => void) | null;
    /** Called before demo stops */
    beforeStop?: ((instance: YaiAutoSwitch) => void) | null;
    /** Called after demo stops */
    afterStop?: ((instance: YaiAutoSwitch) => void) | null;
}

/**
 * Configuration options for YaiAutoSwitch
 */
export interface AutoSwitchConfig {
    /** CSS selector for container element */
    target?: string;
    /** CSS selector for clickable elements */
    triggerSelector?: string;
    /** Delay before demo starts (ms) */
    initialTimeout?: number;
    /** Delay between each trigger (ms) */
    timeout?: number;
    /** MouseEvent configuration */
    clickConfig?: ClickConfig;
    /** Event callbacks */
    callbacks?: AutoSwitchCallbacks;
}

/**
 * Event names for YaiAutoSwitch callbacks
 */
export type AutoSwitchEventName = 'cycleInit' | 'cycleBetween' | 'afterLast' | 'beforeStop' | 'afterStop';

/**
 * YaiAutoSwitch class for automated component testing and demonstrations
 *
 * This utility automatically cycles through interactive elements to showcase
 * component animations and behavior. Perfect for demos, testing, and presentations.
 *
 * Key Features:
 * - Automatic element discovery with nested container filtering
 * - Loading state detection and waiting
 * - Emergency abort functionality with timeout cleanup
 * - Chainable API for fluent configuration
 * - Lifecycle event callbacks for custom behavior
 * - Disabled element skipping
 *
 * @example
 * ```typescript
 * // Quick demo start
 * new YaiAutoSwitch({ target: '#my-component' }).cycle();
 *
 * // Full configuration
 * const demo = new YaiAutoSwitch({
 *   target: '#tabs-container',
 *   triggerSelector: 'button[data-open]',
 *   initialTimeout: 1000,
 *   timeout: 800,
 *   callbacks: {
 *     cycleInit: (instance) => console.log('Demo starting'),
 *     afterLast: (instance) => console.log('Demo complete')
 *   }
 * });
 *
 * demo.cycle(); // Start the demo
 * demo.abort(); // Emergency stop if needed
 * ```
 */
export declare class YaiAutoSwitch {

    /** Configuration object */
    config: Required<AutoSwitchConfig>;

    /** Target container element */
    container: Element | null;

    /** Whether demo is currently running */
    isRunning: boolean;

    /** Array of active timeout IDs for cleanup */
    timeouts: number[];

    /**
     * Create a new YaiAutoSwitch instance
     *
     * @param config - Configuration options
     * @param config.target - CSS selector for container element (default: '#tabs-component')
     * @param config.triggerSelector - CSS selector for clickable elements (default: 'nav[data-controller] button[data-action]')
     * @param config.initialTimeout - Delay before demo starts in ms (default: 750)
     * @param config.timeout - Delay between each trigger in ms (default: 1000)
     * @param config.clickConfig - MouseEvent configuration (default: { bubbles: true, cancelable: true })
     * @param config.callbacks - Event callbacks (default: all null)
     *
     * @example
     * ```typescript
     * const autoSwitch = new YaiAutoSwitch({
     *   target: '#my-tabs',
     *   timeout: 1200,
     *   callbacks: {
     *     cycleInit: () => console.log('Starting'),
     *     afterLast: () => console.log('Complete')
     *   }
     * });
     * ```
     */
    constructor(config?: AutoSwitchConfig);

    /**
     * Start the automatic cycling demo
     *
     * Begins cycling through all triggers in the target container.
     * Automatically filters out nested component triggers to avoid conflicts.
     * Handles disabled elements, loading states, and proper sequencing.
     *
     * @returns True if started successfully, false if already running or no container
     *
     * @example
     * ```typescript
     * const success = autoSwitch.cycle();
     * if (!success) {
     *   console.log('Demo could not start - already running or no container');
     * }
     * ```
     */
    cycle(): boolean;

    /**
     * Immediately stop the demo and clear all timeouts
     *
     * Emergency stop function that immediately halts all activity,
     * clears pending timeouts, and removes CSS classes. Does not
     * trigger lifecycle callbacks.
     *
     * @returns Returns this for chaining
     *
     * @example
     * ```typescript
     * // Emergency stop
     * autoSwitch.abort();
     *
     * // Chaining after abort
     * autoSwitch.abort().setConfig('timeout', 500).cycle();
     * ```
     */
    abort(): YaiAutoSwitch;

    /**
     * Stop the demo with proper callback lifecycle
     *
     * Gracefully stops the demo by calling beforeStop callback,
     * aborting the demo, then calling afterStop callback.
     *
     * @returns Returns this for chaining
     *
     * @example
     * ```typescript
     * autoSwitch.stopDemo(); // Triggers beforeStop -> abort -> afterStop
     * ```
     */
    stopDemo(): YaiAutoSwitch;

    /**
     * Set a configuration option
     *
     * @param key - Configuration key to set
     * @param value - Value to set
     * @returns Returns this for chaining
     *
     * @example
     * ```typescript
     * autoSwitch
     *   .setConfig('timeout', 1500)
     *   .setConfig('initialTimeout', 2000);
     * ```
     */
    setConfig<K extends keyof AutoSwitchConfig>(key: K, value: AutoSwitchConfig[K]): YaiAutoSwitch;

    /**
     * Set the target container and optionally the trigger selector
     *
     * @param selector - CSS selector for container element
     * @param triggerSelector - Optional CSS selector for triggers
     * @returns Returns this for chaining
     *
     * @example
     * ```typescript
     * autoSwitch.setContainer('#new-tabs', 'button[data-open]');
     * ```
     */
    setContainer(selector: string, triggerSelector?: string): YaiAutoSwitch;

    /**
     * Set an event callback
     *
     * @param event - Event name (cycleInit, cycleBetween, afterLast, beforeStop, afterStop)
     * @param callback - Callback function that receives the YaiAutoSwitch instance
     * @returns Returns this for chaining
     *
     * @example
     * ```typescript
     * autoSwitch
     *   .on('cycleInit', (instance) => {
     *     console.log('Demo starting', instance.config.target);
     *   })
     *   .on('afterLast', (instance) => {
     *     console.log('Demo completed');
     *   });
     * ```
     */
    on(event: AutoSwitchEventName, callback: (instance: YaiAutoSwitch) => void): YaiAutoSwitch;

    /**
     * Create a dispatchable click event
     * @private
     * @returns MouseEvent configured with clickConfig options
     */
    private _dispatchableClick(): MouseEvent;

    /**
     * Check if tab content is currently loading
     * @private
     * @returns True if content is loading, false otherwise
     */
    private _isContentLoading(): boolean;

    /**
     * Wait for loading to complete before proceeding
     * @private
     * @param callback - Function to call when loading completes
     * @param nextTrigger - Next trigger element to check for enabled state
     */
    private _waitForLoadingComplete(callback: () => void, nextTrigger?: Element | null): void;

    /**
     * Clear all active timeouts
     * @private
     */
    private _clearTimeouts(): void;

    /**
     * Execute a callback if it exists
     * @private
     * @param callbackName - Name of callback to execute
     * @returns Returns this for chaining
     */
    private _execCallback(callbackName: keyof AutoSwitchCallbacks): YaiAutoSwitch;
}

/**
 * Export for ES modules and CommonJS compatibility
 */
export default YaiAutoSwitch;

/**
 * Global declaration for browser usage
 */
declare global {
    interface Window {
        YaiAutoSwitch: typeof YaiAutoSwitch;
    }
}