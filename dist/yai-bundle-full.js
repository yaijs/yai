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
import {YEH} from 'https://cdn.jsdelivr.net/npm/@yaijs/yeh@1.0.4/+esm';
import {YaiTabs} from '../tabs/yai-tabs.js';
import {YaiAutoSwitch} from '../utils/yai-auto-switch.js';
import {YaiSearchAndClick} from '../utils/yai-search-and-click.js';
import {YaiTabsSwipe} from '../utils/yai-tabs-swipe.js';
import {YaiViewport} from '../utils/yai-viewport.js';
import {YaiCore} from '../yai-core.js';

export {YaiAutoSwitch, YaiCore, YaiSearchAndClick, YaiTabs, YaiTabsSwipe, YaiViewport, YEH};

window.YaiJS = {YEH, YaiCore, YaiTabs, YaiTabsSwipe, YaiAutoSwitch, YaiViewport, YaiSearchAndClick};
