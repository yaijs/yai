/**
 * YaiJS Bundle - Recommended Mix
 *
 * The "healthy mix" of required and most commonly useful components.
 * Perfect for most production use cases without testing utilities.
 *
 * @example
 * ```javascript
 * import { YaiTabs, YaiTabsSwipe, YEH } from 'https://cdn.jsdelivr.net/npm/@yaijs/bundle/dist/yai-bundle.js';
 *
 * // Or use window.YaiJS for script tags
 * const {YaiTabs, YEH} = window.YaiJS;
 * ```
 *
 * Bundle Strategy:
 * - yai-bundle-core.js: Minimal (YEH, YaiCore, YaiTabs)
 * - yai-bundle.js: Recommended (adds YaiTabsSwipe, YaiViewport) ← You are here
 * - yai-bundle-full.js: Everything (adds YaiAutoSwitch, YaiSearchAndClick)
 */

export { YEH } from '@yaijs/yeh';
export { YaiTabs } from '../tabs/yai-tabs.js';
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
            YaiViewport: typeof import('../utils/yai-viewport.js').YaiViewport;
        };
    }
}
