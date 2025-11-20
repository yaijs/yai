/**
 * YaiJS Core Bundle
 *
 * Essential YaiJS components without utilities.
 * Perfect for production builds where you only need the core functionality.
 *
 * @example
 * ```javascript
 * import { YEH, YaiTabs } from 'https://cdn.jsdelivr.net/npm/@yaijs/core@latest/dist/yai-bundle-core.js';
 *
 * const tabs = new YaiTabs();
 * ```
 *
 * Includes:
 * - YEH: Yai Event Hub (event system)
 * - YaiCore: Foundation class with shared utilities
 * - YaiTabs: Tab component with animations and accessibility
 */
import {YEH} from '../yeh/yeh.js';
import {YaiTabs} from '../tabs/yai-tabs.js';
import {YaiCore} from '../yai-core.js';

export {YaiCore, YaiTabs, YEH};
