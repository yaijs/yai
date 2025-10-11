// yai-bundle.js - The "kitchen sink" bundle
import {YaiTabs} from '../tabs/yai-tabs.js';
import {YaiViewport} from '../utils/yai-viewport.js';
import {YaiCore} from '../yai-core.js';

export {YaiCore, YaiTabs, YaiViewport};

window.YaiJS = {YaiCore, YaiTabs, YaiViewport};
