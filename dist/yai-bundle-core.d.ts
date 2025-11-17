/**
 * YaiJS Core Bundle
 *
 * Essential YaiJS components without utilities.
 * Perfect for production builds where you only need the core functionality.
 *
 * @example
 * ```javascript
 * import { YaiTabs, YEH } from 'https://cdn.jsdelivr.net/npm/@yaijs/bundle/dist/yai-bundle-core.js';
 *
 * const tabs = new YaiTabs();
 * tabs.init();
 * ```
 *
 * Includes:
 * - YEH: Yai Event Hub (event system)
 * - YaiCore: Foundation class with shared utilities
 * - YaiTabs: Tab component with animations and accessibility
 */

export { YEH } from '@yaijs/yeh';
export { YaiCore } from '../yai-core.js';
export { YaiTabs } from '../tabs/yai-tabs.js';

declare global {
    interface Window {
        YaiJS: {
            YEH: typeof YEH;
            YaiCore: typeof import('../yai-core.js').YaiCore;
            YaiTabs: typeof import('../tabs/yai-tabs.js').YaiTabs;
        };
    }
}
