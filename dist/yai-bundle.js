/**
 * YaiJS Bundle - Recommended Mix
 *
 * The "healthy mix" of required and most commonly useful components.
 * Perfect for most production use cases without testing utilities.
 *
 * @example
 * ```javascript
 * import { YEH, YaiTabs, YaiTabsSwipe } from 'https://cdn.jsdelivr.net/npm/@yaijs/core@latest/dist/yai-bundle.js';
 *
 * const tabs = new YaiTabs();
 * ```
 *
 * Bundle Strategy:
 * - yai-bundle-core.js: Minimal (YEH, YaiCore, YaiTabs)
 * - yai-bundle.js: Recommended (adds YaiTabsSwipe, YaiViewport) ← You are here
 * - yai-bundle-full.js: Everything (adds YaiAutoSwitch, YaiSearchAndClick)
 */
import {YaiTabs} from '../tabs/yai-tabs.js';
import {YaiTabsSwipe} from '../utils/yai-tabs-swipe.js';
import {YaiViewport} from '../utils/yai-viewport.js';
import {YaiCore} from '../yai-core.js';
import {YEH} from '../yeh/yeh.js';

export {YaiCore, YaiTabs, YaiTabsSwipe, YaiViewport, YEH};
