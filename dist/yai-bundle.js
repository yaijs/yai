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
 * const {YaiTabs} = window.YaiJS;
 * ```
 *
 * Bundle Strategy:
 * - yai-bundle-core.js: Minimal (YEH, YaiCore, YaiTabs)
 * - yai-bundle.js: Recommended (adds YaiTabsSwipe, YaiViewport) ← You are here
 * - yai-bundle-full.js: Everything (adds YaiAutoSwitch, YaiSearchAndClick)
 */
import {YEH} from 'https://cdn.jsdelivr.net/npm/@yaijs/yeh@1.0.4/+esm';
import {YaiTabs} from '../tabs/yai-tabs.js';
import {YaiTabsSwipe} from '../utils/yai-tabs-swipe.js';
import {YaiViewport} from '../utils/yai-viewport.js';
import {YaiCore} from '../yai-core.js';

export {YaiCore, YaiTabs, YaiTabsSwipe, YaiViewport, YEH};

window.YaiJS = {YEH, YaiCore, YaiTabs, YaiTabsSwipe, YaiViewport};
