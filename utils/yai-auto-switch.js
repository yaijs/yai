"use strict";

/**
 * YaiAutoSwitch - Generic component testing utility
 *
 * Automatically cycles through interactive elements (autoplay)
 * to demonstrate animations and test component behavior.
 *
 * @example
 * // Basic usage
 * const tester = new YaiAutoSwitch({
 *   target: '#my-tabs',
 *   triggerSelector: 'button[data-open]',
 *   timeout: 1000
 * }).cycle();
 *
 * @example
 * // Chainable configuration
 * const tester = new YaiAutoSwitch()
 *   .setContainer('#demo-tabs', 'button[data-open]')
 *   .setConfig('timeout', 800)
 *   .on('cycleInit', () => console.log('Starting demo'))
 *   .on('afterLast', () => console.log('Demo complete'))
 *   .cycle();
 *
 * @example
 * // Emergency stop
 * tester.abort(); // Immediate stop, clears all timeouts
 */
class YaiAutoSwitch {
    /**
     * Create a new YaiAutoSwitch instance
     * @param {Object} config - Configuration options
     * @param {string} config.target - CSS selector for container element
     * @param {string} config.triggerSelector - CSS selector for clickable elements
     * @param {number} config.initialTimeout - Delay before demo starts (ms)
     * @param {number} config.timeout - Delay between each trigger (ms)
     * @param {Object} config.clickConfig - MouseEvent configuration
     * @param {Object} config.callbacks - Event callbacks
     */
    constructor(config = {}) {
        this.config = {
            target: '#tabs-component',              // Container selector
            triggerSelector: 'nav[data-controller] button[data-action]', // Direct children only
            initialTimeout: 750,                    // Delay before demo starts
            timeout: 1000,                          // Delay between triggers
            clickConfig: { bubbles: true, cancelable: true },
            callbacks: {
                cycleInit: null,        // Called before cycling starts
                cycleBetween: null,     // Called between each trigger click
                afterDispatch: null,    // Called after event dispatched
                afterLast: null,        // Called after last trigger
                beforeStop: null,       // Called before demo stops
                afterStop: null,        // Called after demo stops
            },
            ...config,
            currentTrigger: null,
        }
        this.container = document.querySelector(this.config.target);
        this.isRunning = false;
        this.timeouts = []; // Track active timeouts for cleanup
    }

    /**
     * Immediately stop the demo and clear all timeouts
     * @returns {YaiAutoSwitch} Returns this for chaining
     */
    toggleRunning(add) {
        if (typeof add !== 'boolean') return;

        const execFn = add ? 'add' : 'remove';
        this.isRunning = !!add;

        document.body.classList[execFn]('autoswitch-running');
        if (typeof this.container.classList !== 'undefined') {
            this.container.classList[execFn]('untouchable');
        }
    }

    /**
     * Start the automatic cycling demo
     * @returns {boolean} True if started successfully, false if already running or no container
     */
    cycle() {
        if (this.isRunning || !this.container) return false;

        this._execCallback('cycleInit');

        this.toggleRunning(true);

        // Get triggers and filter out those inside nested tab containers
        const allTriggers = this.container.querySelectorAll(this.config.triggerSelector);
        const triggers = Array.from(allTriggers).filter(trigger => {
            // Check if trigger is inside a nested [data-yai-tabs] container
            let parent = trigger.parentElement;
            while (parent && parent !== this.container) {
                if (parent.matches('[data-yai-tabs]') && parent !== this.container) {
                    return false; // Skip triggers inside nested tab containers
                }
                parent = parent.parentElement;
            }
            return true; // Keep triggers that are only in the current container
        });

        // Start sequential trigger processing
        const processTriggerSequence = (triggerIndex = 0) => {
            if (!this.isRunning || triggerIndex >= triggers.length) return;

            const trigger = triggers[triggerIndex];
            const isFirst = triggerIndex === 0;
            const isLast = triggerIndex === triggers.length - 1;
            this.config.currentTrigger = trigger;

            this._execCallback('cycleBetween');

            const processCurrentTrigger = () => {
                if (!this.isRunning) return;

                // Skip disabled buttons
                if (trigger.hasAttribute('disabled')) {
                    // Still continue to next trigger after timeout
                    const skipTimeoutId = setTimeout(() => processTriggerSequence(triggerIndex + 1), this.config.timeout);
                    this.timeouts.push(skipTimeoutId);
                    return;
                }

                trigger.dispatchEvent(this._dispatchableClick());

                // Wait for loading, then continue sequence
                this._waitForLoadingComplete(() => {
                    this._execCallback('afterDispatch');

                    if (isLast) {
                        // Final trigger - close after demo
                        const finalTimeoutId = setTimeout(() => {
                            if (!this.isRunning) return;

                            trigger.dispatchEvent(this._dispatchableClick()); // Close
                            this.stopDemo();

                            this._execCallback('afterLast');
                        }, this.config.timeout);
                        this.timeouts.push(finalTimeoutId);
                    } else {
                        // Continue to next trigger
                        const nextTimeoutId = setTimeout(() => processTriggerSequence(triggerIndex + 1), this.config.timeout);
                        this.timeouts.push(nextTimeoutId);
                    }
                }, triggers[triggerIndex + 1] || null);
            };

            if (isFirst) {
                // Handle first trigger with initial delay
                if (trigger.classList.contains('active')) {
                    trigger.dispatchEvent(this._dispatchableClick()); // Close first
                }
                const initialTimeoutId = setTimeout(processCurrentTrigger, this.config.initialTimeout);
                this.timeouts.push(initialTimeoutId);
            } else {
                // Process immediately for subsequent triggers
                processCurrentTrigger();
            }
        };

        // Start the sequence
        processTriggerSequence();

        return true;
    }

    _dispatchableClick() {
        return new MouseEvent('click', this.config.clickConfig);
    }

    /**
     * Check if tab content is currently loading
     */
    _isContentLoading() {
        const container = document.querySelector(this.config.target);
        if (!container) return false;

        const content = container.querySelector('[data-content]');
        return content && content.classList.contains('yai-loading');
    }

    /**
     * Wait for loading to complete before proceeding
     */
    _waitForLoadingComplete(callback, nextTrigger = null) {
        const checkInterval = 250; // Check every 250ms
        const maxWaitTime = 10000; // Max wait 10 seconds for delays
        let waitTime = 0;

        const checkLoading = () => {
            if (!this.isRunning) return; // Demo stopped

            const isLoading = this._isContentLoading();
            const nextTriggerEnabled = !nextTrigger || !nextTrigger.hasAttribute('disabled');

            if (isLoading && waitTime < maxWaitTime) {
                waitTime += checkInterval;
                setTimeout(checkLoading, checkInterval);
            } else if (!nextTriggerEnabled && waitTime < maxWaitTime) {
                // Still waiting for buttons to be re-enabled
                waitTime += checkInterval;
                setTimeout(checkLoading, checkInterval);
            } else {
                callback(); // Loading done and buttons enabled, or timeout reached
            }
        };

        checkLoading();
    }

    _clearTimeouts() {
        this.timeouts.forEach(id => clearTimeout(id));
        this.timeouts = [];
    }

    /**
     * Immediately stop the demo and clear all timeouts
     * @returns {YaiAutoSwitch} Returns this for chaining
     */
    abort() {
        this._clearTimeouts();
        this.toggleRunning(false);
        return this;
    }

    /**
     * Stop the demo with proper callback lifecycle
     * @returns {YaiAutoSwitch} Returns this for chaining
     */
    stopDemo() {
        this._execCallback('beforeStop');
        this.abort();
        this._execCallback('afterStop');
        return this;
    }

    /**
     * Set a configuration option
     * @param {string} key - Configuration key
     * @param {*} value - Configuration value
     * @returns {YaiAutoSwitch} Returns this for chaining
     */
    setConfig(key, value) {
        this.config[key] = value;
        return this;
    }

    /**
     * Set the target container and optionally the trigger selector
     * @param {string} selector - CSS selector for container
     * @param {string} [triggerSelector] - Optional CSS selector for triggers
     * @returns {YaiAutoSwitch} Returns this for chaining
     */
    setContainer(selector, triggerSelector) {
        this.config.target = selector;
        this.container = document.querySelector(selector);

        if (triggerSelector) {
            this.setConfig('triggerSelector', triggerSelector);
        }

        return this;
    }

    _execCallback(callbackName) {
        if (typeof this.config.callbacks[callbackName] === 'function') {
            this.config.callbacks[callbackName].call(this, this);
        }
        return this;
    }

    /**
     * Set an event callback
     * @param {string} event - Event name (cycleInit, cycleBetween, afterLast, beforeStop, afterStop)
     * @param {Function} callback - Callback function
     * @returns {YaiAutoSwitch} Returns this for chaining
     */
    on(event, callback) {
        if (this.config.callbacks.hasOwnProperty(event)) {
            this.config.callbacks[event] = callback;
        }
        return this;
    }
}

export {YaiAutoSwitch};
export default YaiAutoSwitch;
