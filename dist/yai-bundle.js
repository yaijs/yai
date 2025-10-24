// yai-bundle.js - The "kitchen sink" bundle
import {YaiTabs} from '../tabs/yai-tabs.js';
import {YaiTabsSwype} from '../utils/yai-tabs-swype.js';
import {YaiViewport} from '../utils/yai-viewport.js';
import {YaiCore} from '../yai-core.js';

export {YaiCore, YaiTabs, YaiTabsSwype, YaiViewport};

window.YaiJS = {YaiCore, YaiTabs, YaiTabsSwype, YaiViewport};
