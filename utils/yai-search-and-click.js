"use strict";

/**
 * Search & click Utility
 *
 * Follows the Path of the active, and opens
 * whatever Roadmap say search & open.
 */
class YaiSearchAndClick {
    constructor(config = {}, timeouts = {}) {
        this.config = {
            targetRoot: config.target,
            tabOpenAttribute: config.tabOpenAttribute,
            tabTabAttribute: config.tabTabAttribute,
            containerSelector: config.containerSelector,
            scrollIntoView: true,
            collectMetrics: config.collectMetrics || false,  // Enable data collection
            ...config
        };

        this.timeouts = {
            init: 1000,
            ajax: 750,
            goIn: 1500,
            loop: 1500,
            checkInterval: 100,
            maxWait: 10000,
            ...timeouts,
        };

        this.originalTitle = null;
        this.progressState = null;
        this.startTime = null;
        this.endTime = null;

        // YaiTabs instance for metrics collection
        this.tabsInstance = config.instance || null;

        // Metrics data
        this.metrics = {
            loops: 0,
            maxDepth: 0,
            totalElements: 0,
            totalComponents: 0,
            totalTime: 0,
            avgStepTime: 0,
            steps: 0
        };

        this.yaiCore = null;
        if (typeof window?.YaiJS?.YaiCore !== 'undefined') {
            this.yaiCore = window.YaiJS.YaiCore;
        }
    }

    /**
     * Set YaiTabs instance for metrics collection
     * @param {YaiTabs} instance - YaiTabs instance
     * @returns {YaiSearchAndClick} - Returns this for chaining
     */
    setInstance(instance) {
        this.tabsInstance = instance;
        return this;
    }

    run(loopXtimes, roadMap, timeouts) {
        if (timeouts) {
            this.timeouts = { ...this.timeouts, ...timeouts }
        }
        setTimeout(() => this.navigateTabs(roadMap, loopXtimes), this.timeouts.init);
    }

    /**
     * Find the next nested tab container after clicking a tab
     * @param {Element} container - Current container
     * @param {string} tabName - Name of the tab that was just clicked
     * @returns {Element|null} - The nested [data-yai-tabs] container, or null
     */
    getNestedContainer(container, tabName) {
        // Find the active content panel for this tab
        const activePanel = container.querySelector(
            `:scope  [${this.config.tabTabAttribute}="${tabName}"].active`
        );

        if (!activePanel) return null;

        // Find nested tab container inside the active panel
        return activePanel.querySelector(this.config.containerSelector);
    }

    getTargetButton(container, tab) {
        return container.querySelector(`:scope > nav [${this.config.tabOpenAttribute}="${tab}"]`);
    }

    scrollIntoView(currentContainer, options = {}) {
        if (!this.config.scrollIntoView) return;

        const useOptions = {
            behavior: 'smooth',
            block: 'center',
            ...options
        };

        currentContainer.scrollIntoView(useOptions);
    }

    /**
     * Calculate total steps for progress tracking
     */
    calculateTotalSteps(roadMap, maxIterations) {
        const goInSteps = roadMap.goIn.length;
        const loopSteps = roadMap.loop.length * maxIterations;
        return goInSteps + loopSteps;
    }

    /**
     * Initialize progress tracking
     */
    initProgress(totalSteps) {
        this.originalTitle = document.title;
        this.progressState = {
            current: 0,
            total: totalSteps,
            padding: totalSteps.toString().length
        };
        this.updateProgress();
    }

    /**
     * Update document title with current progress
     */
    updateProgress() {
        if (!this.progressState) return;

        const { current, total, padding } = this.progressState;
        const currentPadded = current.toString().padStart(padding, '0');
        const totalPadded = total.toString().padStart(padding, '0');

        document.title = `${currentPadded}/${totalPadded} - ${this.originalTitle}`;
    }

    /**
     * Increment progress counter and update title
     */
    stepProgress() {
        if (!this.progressState) return;

        this.progressState.current++;
        this.updateProgress();
    }

    getProgressState() {
        if (!this.progressState) return;

        return this.progressState;
    }

    /**
     * Restore original document title
     */
    finishProgress() {
        if (this.originalTitle) {
            document.title = this.originalTitle;
        }
        this.progressState = null;
    }

    click(element) {
        if (this.yaiCore) {
            this.yaiCore.simulateClickEvent(element)
        } else {
            element.click();
        }
    }

    /**
     * Collect metrics from the current DOM state
     */
    collectCurrentMetrics(maxIterations) {
        if (!this.config.collectMetrics) return;

        // Count total tab containers
        const allContainers = document.querySelectorAll('[data-yai-tabs]');
        this.metrics.totalComponents = allContainers.length;

        // Count all buttons and content panels
        const allButtons = document.querySelectorAll('[data-open]');
        const allPanels = document.querySelectorAll('[data-tab]');
        this.metrics.totalElements = allButtons.length + allPanels.length;

        // Get max depth from YaiTabs instance if available
        if (this.tabsInstance && typeof this.tabsInstance.getMaxNestingDepth === 'function') {
            this.metrics.maxDepth = this.tabsInstance.getMaxNestingDepth();
        } else {
            // Calculate depth manually
            this.metrics.maxDepth = this._calculateMaxDepth();
        }

        // Store loops count
        this.metrics.loops = maxIterations;
    }

    /**
     * Calculate maximum nesting depth manually
     * @returns {number} Maximum depth
     */
    _calculateMaxDepth() {
        const containers = document.querySelectorAll('[data-yai-tabs]');
        let maxDepth = 0;

        containers.forEach(container => {
            let depth = 0;
            let current = container;

            while (current) {
                if (current.matches('[data-yai-tabs]')) {
                    depth++;
                }
                current = current.parentElement?.closest('[data-yai-tabs]');
            }

            if (depth > maxDepth) {
                maxDepth = depth;
            }
        });

        return maxDepth;
    }

    /**
     * Log metrics to console in formatted table
     */
    logMetrics() {
        if (!this.config.collectMetrics) return;

        const { loops, maxDepth, totalElements, totalComponents, totalTime, avgStepTime, steps } = this.metrics;

        console.group('🔬 YaiSearchAndClick Performance Metrics');
        console.table({
            'Loops': loops,
            'Max Depth': maxDepth,
            'Total Components': totalComponents,
            'Total Elements': totalElements,
            'Total Steps': steps,
            'Total Time (s)': (totalTime / 1000).toFixed(2),
            'Avg Step Time (ms)': avgStepTime.toFixed(0),
        });

        // Additional formatted output
        console.log(`%c📊 Data Collection Summary`, 'font-weight: bold; font-size: 14px;');
        console.log(`Loops: ${loops} | Levels: ${maxDepth} | Components: ${totalComponents} | Elements: ${totalElements}`);
        console.log(`Time: ${(totalTime / 1000).toFixed(2)}s | Avg/Step: ${avgStepTime.toFixed(0)}ms`);

        console.groupEnd();
    }

    /**
     * Wait for button loading state to complete
     * Watches for .yai-loading class to be removed from the clicked button
     * Falls back to timeout if loading doesn't complete
     */
    async waitForLoading(button) {
        if (!button.classList.contains('yai-loading')) {
            return; // Not in loading state, continue immediately
        }

        return new Promise((resolve) => {
            const startTime = Date.now();

            const intervalId = setInterval(() => {
                // Check if loading finished
                if (!button.classList.contains('yai-loading')) {
                    clearInterval(intervalId);
                    resolve();
                    return;
                }

                // Check timeout
                if (Date.now() - startTime >= this.timeouts.maxWait) {
                    console.warn('YaiSearchAndClick: Loading timeout exceeded', button);
                    clearInterval(intervalId);
                    resolve();
                }
            }, this.timeouts.checkInterval);
        });
    }

    async navigateTabs(roadMap, maxIterations = 10) {
        // Start timing
        this.startTime = performance.now();

        // Initialize progress tracking
        const totalSteps = this.calculateTotalSteps(roadMap, maxIterations);
        this.initProgress(totalSteps);

        // Find the root container to start from
        let currentContainer = document.querySelector(this.config.targetRoot);
        if (!currentContainer) {
            console.error('YaiSearchAndClick: Root container not found:', this.config.targetRoot);
            this.finishProgress();
            return;
        }

        try {
            // Initial navigation (goIn phase)
            for (const step of roadMap.goIn) {
                const button = this.getTargetButton(currentContainer, step.open);
                if (!button) {
                    console.warn('YaiSearchAndClick: Button not found for tab:', step.open);
                    break;
                }

                this.click(button);

                // Wait for loading to complete, with fallback timeout
                await this.waitForLoading(button);
                await new Promise(resolve => setTimeout(resolve, this.timeouts.goIn));

                // Update progress
                this.stepProgress();

                this.scrollIntoView(currentContainer, { block: 'start' });

                // Get the nested container inside the newly activated tab
                currentContainer = this.getNestedContainer(currentContainer, step.open);
                if (!currentContainer) break;
            }

            const loopLength = roadMap.loop.length;
            const totalLength = loopLength * maxIterations;
            let iteration = 0;
            let eachIteration = 0;

            // Recursive loop with safety limit
            while (currentContainer && iteration < maxIterations) {
                for (const opener of roadMap.loop) {
                    const button = this.getTargetButton(currentContainer, opener.open);
                    if (!button) {
                        console.warn('YaiSearchAndClick: Button not found in loop for tab:', opener.open);
                        break;
                    }

                    this.click(button);

                    // Wait for loading to complete, with fallback timeout
                    await this.waitForLoading(button);
                    await new Promise(resolve => setTimeout(resolve, this.timeouts.loop));

                    // Update progress
                    this.stepProgress();

                    if (eachIteration === 0
                        || eachIteration === totalLength - 1
                        || eachIteration % 2 === 0
                    ) {
                        const block = eachIteration === totalLength - 1 ? 'start' : 'center';
                        this.scrollIntoView(currentContainer, { block });
                    }
                    eachIteration++;

                    // Get the nested container inside the newly activated tab
                    currentContainer = this.getNestedContainer(currentContainer, opener.open);
                    if (!currentContainer) break;
                }
                iteration++;

                // Extra delay for AJAX loading on the last item
                await new Promise(resolve => setTimeout(resolve, this.timeouts.ajax));
            }
        } finally {
            // End timing and log results
            this.endTime = performance.now();
            const duration = this.endTime - this.startTime;
            const seconds = (duration / 1000).toFixed(2);

            console.log(`YaiSearchAndClick completed: ${totalSteps} steps in ${seconds}s (${duration.toFixed(0)}ms)`);

            // Collect and log metrics if enabled
            if (this.config.collectMetrics) {
                this.metrics.totalTime = duration;
                this.metrics.steps = totalSteps;
                this.metrics.avgStepTime = duration / totalSteps;
                this.collectCurrentMetrics(maxIterations);
                this.logMetrics();
            }

            // Always restore original title, even if navigation fails
            this.finishProgress();

            if (this.tabsInstance) {
                this.tabsInstance._executeHook('searchAndClickFinished', { context: this.tabsInstance });
            }
        }
    }

    /**
     * Calculate estimated nesting depth based on roadmap and loops
     * Static method - can be called without instance
     *
     * @param {Object} roadMap - Navigation roadmap with goIn and loop arrays
     * @param {number} loops - Number of loop iterations
     * @returns {number} Estimated maximum nesting depth
     *
     * @example
     * const expectedDepth = YaiSearchAndClick.calculateEstimatedDepth(
     *     { goIn: [{ open: '4' }, { open: '6' }], loop: [{ open: '4' }, { open: '5' }] },
     *     50
     * );
     * console.log(`Expected depth: ${expectedDepth} levels`);
     */
    static calculateEstimatedDepth(roadMap, loops) {
        if (!roadMap || !roadMap.loop) {
            return 0;
        }

        // goIn steps navigate to the recursion starting point (each step = 1 level)
        const goInSteps = roadMap.goIn ? roadMap.goIn.length : 0;

        // Each loop iteration adds vertical depth
        const loopSteps = roadMap.loop.length;

        // Total estimated depth: goIn navigation + (loops * loop depth)
        const estimatedDepth = goInSteps + (loops * loopSteps);

        return estimatedDepth;
    }

    /**
     * Calculate detailed metrics for a given roadmap and loops
     * Returns estimated depth, steps, and components
     *
     * @param {Object} roadMap - Navigation roadmap
     * @param {number} loops - Number of loop iterations
     * @returns {Object} Estimated metrics { depth, steps, components }
     */
    static calculateEstimatedMetrics(roadMap, loops) {
        const depth = YaiSearchAndClick.calculateEstimatedDepth(roadMap, loops);

        // Calculate total steps
        const goInSteps = roadMap.goIn ? roadMap.goIn.length : 0;
        const loopSteps = roadMap.loop ? roadMap.loop.length : 0;
        const totalSteps = goInSteps + (loops * loopSteps);

        // Estimate component count (very rough approximation based on observed pattern)
        // From benchmarks: ~15 components per loop iteration (varies by roadmap)
        const estimatedComponents = Math.round(depth * 15);

        return {
            depth: depth,
            steps: totalSteps,
            components: estimatedComponents
        };
    }
}

export {YaiSearchAndClick};
export default YaiSearchAndClick;
