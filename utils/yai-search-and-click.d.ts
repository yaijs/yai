/**
 * YaiSearchAndClick - Automated Tab Navigation Testing Utility
 *
 * Automates deep navigation through nested YaiTabs components for testing.
 * Follows a roadmap to click through tab hierarchies, handling async content loading.
 *
 * @example
 * ```javascript
 * const navigator = new YaiSearchAndClick({
 *     init: 1000,
 *     ajax: 750,
 *     goIn: 1500,
 *     loop: 1500
 * });
 *
 * const roadMap = {
 *     goIn: [
 *         { open: '2' },  // Navigate to tab 2
 *         { open: '3' },  // Then to nested tab 3
 *     ],
 *     loop: [
 *         { open: '1' },  // Loop through tab 1
 *         { open: '2' },  // Then tab 2
 *     ]
 * };
 *
 * navigator.run(10, roadMap);
 * ```
 */

/**
 * Configuration for timing delays between navigation actions
 */
export interface Timeouts {
    /** Initial delay before starting navigation (default: 1000ms) */
    init?: number;
    /** Delay after AJAX content loads (default: 750ms) */
    ajax?: number;
    /** Delay between steps during initial goIn phase (default: 1500ms) */
    goIn?: number;
    /** Delay between steps during loop phase (default: 1500ms) */
    loop?: number;
}

/**
 * Navigation step defining which tab to open
 */
export interface RoadMapStep {
    /** Tab ID to open (uses data-original-id for pre-disambiguation value) */
    open: string;
}

/**
 * Navigation roadmap with two phases
 */
export interface RoadMap {
    /** Initial navigation path - executed once at start */
    goIn: RoadMapStep[];
    /** Recursive navigation loop - repeats until maxIterations reached */
    loop: RoadMapStep[];
}

/**
 * YaiSearchAndClick - Automated deep navigation utility for YaiTabs testing
 *
 * Solves the tedious problem of manually clicking through 15+ levels of nested tabs
 * during development and testing. Follows a defined roadmap to navigate tab hierarchies
 * with proper timing for AJAX content loading.
 *
 * **Two-Phase Navigation:**
 * 1. **goIn phase** - Initial path to reach target depth
 * 2. **loop phase** - Recursive exploration with safety limits
 *
 * @example
 * ```javascript
 * const navigator = new YaiSearchAndClick();
 *
 * navigator.run(5, {
 *     goIn: [
 *         { open: '2' },  // Performance tab
 *         { open: '1' },  // First nested level
 *     ],
 *     loop: [
 *         { open: '1' },  // Keep going deeper
 *     ]
 * });
 * ```
 */
export class YaiSearchAndClick {
    /** Current timeout configuration */
    timeouts: Required<Timeouts>;

    /**
     * Creates a new navigation utility
     * @param timeouts - Custom timing configuration (optional)
     */
    constructor(timeouts?: Timeouts);

    /**
     * Start automated navigation
     * @param loopXtimes - Maximum iterations for the loop phase (default: 10)
     * @param roadMap - Navigation roadmap defining goIn and loop paths
     * @param timeouts - Override timeout configuration for this run (optional)
     */
    run(loopXtimes: number, roadMap: RoadMap, timeouts?: Timeouts): void;

    /**
     * Find the next active tab container
     * @param container - Parent container to search within
     * @param selector - Custom selector (default: ':scope .tab-active[data-yai-tabs]')
     * @returns The next active tab container or null
     */
    tabsNext(container: HTMLElement | Document, selector?: string): HTMLElement | null;

    /**
     * Get target button by original tab ID
     * @param container - Tab container to search within
     * @param tab - Tab ID to find (uses data-original-id attribute)
     * @returns The button element or null
     */
    getTargetButton(container: HTMLElement, tab: string): HTMLButtonElement | null;

    /**
     * Navigate through tabs following the roadmap
     * @param roadMap - Navigation roadmap
     * @param maxIterations - Safety limit for loop iterations (default: 10)
     */
    navigateTabs(roadMap: RoadMap, maxIterations?: number): Promise<void>;
}

export default YaiSearchAndClick;
