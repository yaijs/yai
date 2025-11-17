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
 * ```
 *
 * Includes:
 * - YEH: Yai Event Hub (event system)
 * - YaiCore: Foundation class with shared utilities
 * - YaiTabs: Tab component with animations and accessibility
 */
import {YEH} from 'https://cdn.jsdelivr.net/npm/@yaijs/yeh@1.0.4/+esm';
import {YaiTabs} from '../tabs/yai-tabs.js';
import {YaiCore} from '../yai-core.js';

export {YaiCore, YaiTabs, YEH};

window.YaiJS = {YEH, YaiCore, YaiTabs};
