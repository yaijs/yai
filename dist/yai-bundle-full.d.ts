/**
 * YaiJS Full Bundle
 *
 * Complete YaiJS bundle including all components and utilities.
 * The "batteries included" option - everything you need in one import.
 *
 * @example
 * ```javascript
 * import { YaiTabs, YaiTabsSwipe, YaiAutoSwitch, YEH } from 'https://cdn.jsdelivr.net/npm/@yaijs/bundle/dist/yai-bundle-full.js';
 *
 * const tabs = new YaiTabs();
 * const swype = new YaiTabsSwipe();
 * const autoswitch = new YaiAutoSwitch();
 *
 * tabs.init();
 * swype.init();
 * autoswitch.start();
 * ```
 *
 * Includes:
 * - YEH: Yai Event Hub (event system)
 * - YaiCore: Foundation class with shared utilities
 * - YaiTabs: Tab component with animations and accessibility
 * - YaiTabsSwipe: Touch/swipe navigation for tabs
 * - YaiAutoSwitch: Automated tab cycling for demos/testing
 * - YaiViewport: Advanced viewport tracking (observer-free)
 * - YaiSearchAndClick: Deep navigation testing utility
 *
 * Bundle size: ~90 KB uncompressed, ~22-28 KB gzipped (via JSDelivr)
 * Tree-shakeable when used with modern bundlers
 */

export { YEH } from '@yaijs/yeh';
export { YaiTabs } from '../tabs/yai-tabs.js';
export { YaiAutoSwitch } from '../utils/yai-auto-switch.js';
export { YaiSearchAndClick } from '../utils/yai-search-and-click.js';
export { YaiTabsSwipe } from '../utils/yai-tabs-swipe.js';
export { YaiViewport } from '../utils/yai-viewport.js';
export { YaiCore } from '../yai-core.js';

declare global {
    interface Window {
        YaiJS: {
            YEH: typeof YEH;
            YaiCore: typeof import('../yai-core.js').YaiCore;
            YaiTabs: typeof import('../tabs/yai-tabs.js').YaiTabs;
            YaiTabsSwipe: typeof import('../utils/yai-tabs-swipe.js').YaiTabsSwipe;
            YaiAutoSwitch: typeof import('../utils/yai-auto-switch.js').YaiAutoSwitch;
            YaiViewport: typeof import('../utils/yai-viewport.js').YaiViewport;
            YaiSearchAndClick: typeof import('../utils/yai-search-and-click.js').YaiSearchAndClick;
        };
    }
}
