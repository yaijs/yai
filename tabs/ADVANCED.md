# YaiTabs - Advanced Usage

Advanced patterns, real-world examples, and architectural deep-dives for YaiTabs.

## Table of Contents

- [Single-Tab Applications](#single-tab-applications)
- [Event Bus Patterns](#event-bus-patterns)
- [Analytics Integration](#analytics-integration)
- [Dynamic Content Management](#dynamic-content-management)
- [Breadcrumb Navigation](#breadcrumb-navigation)
- [State Management](#state-management)
- [Performance Optimization](#performance-optimization)

---

## Single-Tab Applications

Build complete SPAs within a single tab component using event delegation:

```html
<div data-yai-tabs class="app-shell">
    <div data-tab="main">
        <header class="app-header">
            <input type="text" data-action="globalSearch" placeholder="Search...">
        </header>

        <aside class="sidebar">
            <button data-action="loadDashboard">Dashboard</button>
            <button data-action="loadUsers">Users</button>
            <button data-action="loadSettings">Settings</button>
        </aside>

        <main class="content" id="app-content">
            <!-- Dynamic content area -->
        </main>
    </div>
</div>

<script>
const tabs = new YaiTabs({
    events: {
        setListener: {
            '[data-yai-tabs]': [
                'click',
                { type: 'input', debounce: 500 },
                'change',
                'submit',
                'blur',
                'focus'
            ]
        },
        actionableAttributes: ['data-tab-action', 'data-action']
    }
});

// Global search with debouncing
tabs.hook('eventInput', ({ target }) => {
    if (target.matches('[data-action="globalSearch"]')) {
        performGlobalSearch(target.value);
    }
});

// Navigation routing
tabs.hook('eventClick', ({ target }) => {
    const action = target.dataset.action;

    if (action === 'loadDashboard') {
        loadView('dashboard');
    } else if (action === 'loadUsers') {
        loadView('users');
    } else if (action === 'loadSettings') {
        loadView('settings');
    }
});

// Dynamic view loader
async function loadView(viewName) {
    const contentArea = document.getElementById('app-content');
    contentArea.innerHTML = '<div class="loader">Loading...</div>';

    try {
        const response = await fetch(`/views/${viewName}.html`);
        const html = await response.text();
        contentArea.innerHTML = html;

        // Initialize any nested YaiTabs components
        if (html.includes('data-yai-tabs')) {
            tabs.initializeAllContainers(contentArea);
        }
    } catch (error) {
        contentArea.innerHTML = '<p class="error">Failed to load view</p>';
    }
}
</script>
```

---

## Event Bus Patterns

### Super Subscriber

Monitor all events for debugging, analytics, or logging:

```js
class TabsMonitor {
    constructor(tabsInstance) {
        this.tabs = tabsInstance;
        this.eventLog = [];
        this.superSubscribe();
    }

    /**
     * Subscribe to all emitable events
     */
    superSubscribe() {
        const events = this.tabs.config.emitable;

        for (const key in events) {
            this.tabs.on(
                `${this.tabs.config.dispatchName}.${key}`,
                this.handleEvent.bind(this, key)
            );
        }
    }

    handleEvent(eventType, event) {
        const logEntry = {
            type: eventType,
            timestamp: Date.now(),
            detail: event.detail
        };

        this.eventLog.push(logEntry);
        console.log(`[${eventType}]`, event.detail);

        // Send to analytics
        if (this.shouldTrack(eventType)) {
            this.trackEvent(logEntry);
        }
    }

    shouldTrack(eventType) {
        const trackableEvents = ['tabReady', 'tabSwitched', 'contentLoaded'];
        return trackableEvents.includes(eventType);
    }

    trackEvent(logEntry) {
        // Your analytics implementation
        analytics.track(logEntry.type, logEntry.detail);
    }

    getEventHistory(eventType = null) {
        if (eventType) {
            return this.eventLog.filter(e => e.type === eventType);
        }
        return this.eventLog;
    }
}

// Usage
const tabs = new YaiTabs();
const monitor = new TabsMonitor(tabs);

// Later: analyze event history
console.log(monitor.getEventHistory('tabReady'));
```

### Action Dispatcher Pattern

Centralized action handling with middleware support:

```js
class TabsActionDispatcher {
    constructor(tabsInstance) {
        this.tabs = tabsInstance;
        this.actions = new Map();
        this.middleware = [];
        this.setupHooks();
    }

    registerAction(actionName, handler) {
        this.actions.set(actionName, handler);
    }

    use(middlewareFn) {
        this.middleware.push(middlewareFn);
    }

    setupHooks() {
        this.tabs.hook('eventClick', ({ event, target, container }) => {
            const action = target.dataset.action;
            if (action) {
                this.dispatch(action, { event, target, container });
            }
        });
    }

    async dispatch(actionName, context) {
        // Run middleware
        for (const mw of this.middleware) {
            const result = await mw(actionName, context);
            if (result === false) return; // Abort
        }

        // Execute action
        const handler = this.actions.get(actionName);
        if (handler) {
            await handler(context);
        } else {
            console.warn(`No handler for action: ${actionName}`);
        }
    }
}

// Usage
const tabs = new YaiTabs();
const dispatcher = new TabsActionDispatcher(tabs);

// Register middleware
dispatcher.use(async (action, context) => {
    console.log(`Executing action: ${action}`);
    // Add authentication check, logging, etc.
    return true; // Continue
});

// Register actions
dispatcher.registerAction('loadDashboard', async ({ container }) => {
    await loadDashboardData(container);
});

dispatcher.registerAction('saveForm', async ({ target, event }) => {
    event.preventDefault();
    const form = target.closest('form');
    await submitFormData(new FormData(form));
});
```

---

## Analytics Integration

### Tab Navigation Tracking

```js
const tabs = new YaiTabs();

// Track tab views
tabs.on('yai.tabs.tabReady', (event) => {
    const { id, refPath, isVisible, isDefaultInit } = event.detail;

    // Only track user-initiated tab changes
    if (!isDefaultInit && isVisible) {
        analytics.track('Tab Viewed', {
            tabId: id,
            refPath: refPath,
            timestamp: Date.now(),
            userAgent: navigator.userAgent
        });
    }
});

// Track tab switches (user navigated away)
tabs.on('yai.tabs.tabSwitched', (event) => {
    analytics.track('Tab Switched', {
        from: event.detail.previousTab,
        to: event.detail.currentTab,
        container: event.detail.container.id
    });
});

// Track dynamic content loads
tabs.on('yai.tabs.contentLoaded', (event) => {
    analytics.track('Dynamic Content Loaded', {
        url: event.detail.url,
        duration: event.detail.loadTime,
        success: event.detail.success
    });
});
```

### Performance Monitoring

```js
tabs.hook('setLoading', ({ container, target }) => {
    target.dataset.loadStart = Date.now();
});

tabs.hook('removeLoading', ({ container, target }) => {
    const loadTime = Date.now() - parseInt(target.dataset.loadStart);
    delete target.dataset.loadStart;

    // Track performance
    analytics.track('Tab Load Performance', {
        tabId: target.dataset.open,
        duration: loadTime,
        slow: loadTime > 1000
    });

    // Alert if slow
    if (loadTime > 2000) {
        console.warn(`Slow tab load: ${loadTime}ms`);
    }
});
```

---

## Dynamic Content Management

### Smart Content Loader with Caching

```js
class SmartContentLoader {
    constructor(tabsInstance) {
        this.tabs = tabsInstance;
        this.cache = new Map();
        this.setupHooks();
    }

    setupHooks() {
        this.tabs.hook('setLoading', ({ container, target }) => {
            this.showLoader(container, target);
        });

        this.tabs.hook('removeLoading', ({ container, target }) => {
            this.hideLoader(container, target);
        });

        this.tabs.hook('contentReady', ({ content, target, url }) => {
            if (url) {
                this.cacheContent(url, content.innerHTML);
            }
        });
    }

    showLoader(container, target) {
        target.classList.add('loading');
        target.setAttribute('aria-busy', 'true');

        // Show skeleton loader
        const loader = document.createElement('div');
        loader.className = 'skeleton-loader';
        loader.innerHTML = `
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line short"></div>
        `;

        container.appendChild(loader);
    }

    hideLoader(container, target) {
        target.classList.remove('loading');
        target.removeAttribute('aria-busy');

        const loader = container.querySelector('.skeleton-loader');
        if (loader) loader.remove();
    }

    cacheContent(url, html) {
        this.cache.set(url, {
            html,
            timestamp: Date.now()
        });

        // Expire cache after 5 minutes
        setTimeout(() => this.cache.delete(url), 5 * 60 * 1000);
    }

    getCachedContent(url) {
        return this.cache.get(url)?.html;
    }
}

// Usage
const tabs = new YaiTabs();
const loader = new SmartContentLoader(tabs);
```

---

## Breadcrumb Navigation

Generate dynamic breadcrumbs based on active tab hierarchy:

```js
class TabBreadcrumbs {
    constructor(tabsInstance, breadcrumbContainer) {
        this.tabs = tabsInstance;
        this.container = breadcrumbContainer;
        this.setupListeners();
    }

    setupListeners() {
        this.tabs.on('yai.tabs.tabReady', () => {
            this.update();
        });
    }

    update() {
        const crumbs = this.buildCrumbs();
        this.render(crumbs);
    }

    buildCrumbs() {
        const crumbs = [];
        const activeContainers = document.querySelectorAll('[data-yai-tabs].tab-active');

        activeContainers.forEach(container => {
            const refPath = container.dataset.refPath;
            const activeButton = container.querySelector('nav [data-open].active');

            if (refPath && activeButton) {
                crumbs.push({
                    label: activeButton.textContent.trim(),
                    refPath: refPath,
                    tabId: activeButton.dataset.open,
                    url: this.generateUrl(refPath, activeButton.dataset.open)
                });
            }
        });

        return crumbs;
    }

    generateUrl(refPath, tabId) {
        return YaiTabs.reconstructUrlFromRef(refPath, tabId);
    }

    render(crumbs) {
        this.container.innerHTML = crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            return `
                <span class="breadcrumb-item ${isLast ? 'active' : ''}">
                    ${isLast ? crumb.label : `<a href="${crumb.url}">${crumb.label}</a>`}
                </span>
                ${!isLast ? '<span class="separator">/</span>' : ''}
            `;
        }).join('');
    }
}

// Usage
const tabs = new YaiTabs();
const breadcrumbs = new TabBreadcrumbs(tabs, document.getElementById('breadcrumbs'));
```

---

## State Management

### URL State Synchronization

```js
class TabStateManager {
    constructor(tabsInstance) {
        this.tabs = tabsInstance;
        this.state = this.parseState();
        this.setupListeners();
    }

    parseState() {
        const hash = this.tabs.parseHash();
        return {
            tabs: hash,
            filters: this.parseFilters(),
            search: new URLSearchParams(window.location.search).get('q') || ''
        };
    }

    parseFilters() {
        const params = new URLSearchParams(window.location.hash.slice(1));
        const filters = {};

        for (const [key, value] of params) {
            if (key.startsWith('filter_')) {
                filters[key.replace('filter_', '')] = value;
            }
        }

        return filters;
    }

    setupListeners() {
        // Sync state when tabs change
        this.tabs.on('yai.tabs.tabReady', () => {
            this.syncState();
        });

        // Sync filters
        this.tabs.hook('eventChange', ({ target }) => {
            if (target.matches('[data-filter]')) {
                this.updateFilter(target.name, target.value);
            }
        });

        // Sync search
        this.tabs.hook('eventInput', ({ target }) => {
            if (target.matches('[data-search]')) {
                this.updateSearch(target.value);
            }
        });
    }

    syncState() {
        this.state.tabs = this.tabs.parseHash();
        this.saveState();
    }

    updateFilter(name, value) {
        this.state.filters[name] = value;
        this.saveState();
    }

    updateSearch(query) {
        this.state.search = query;
        this.saveState();
    }

    saveState() {
        // Build hash from state
        const params = new URLSearchParams();

        // Add tab parameters
        for (const [refPath, tabId] of Object.entries(this.state.tabs)) {
            params.set(refPath, tabId);
        }

        // Add filter parameters
        for (const [name, value] of Object.entries(this.state.filters)) {
            params.set(`filter_${name}`, value);
        }

        // Update URL
        window.history.replaceState(null, '', `#${params.toString()}`);

        // Update search separately
        if (this.state.search) {
            const searchParams = new URLSearchParams(window.location.search);
            searchParams.set('q', this.state.search);
            window.history.replaceState(null, '', `?${searchParams.toString()}#${params.toString()}`);
        }
    }

    restoreState() {
        // Restore filters
        for (const [name, value] of Object.entries(this.state.filters)) {
            const input = document.querySelector(`[data-filter][name="${name}"]`);
            if (input) input.value = value;
        }

        // Restore search
        if (this.state.search) {
            const searchInput = document.querySelector('[data-search]');
            if (searchInput) searchInput.value = this.state.search;
        }
    }
}

// Usage
const tabs = new YaiTabs();
const stateManager = new TabStateManager(tabs);
stateManager.restoreState();
```

---

## Performance Optimization

### Lazy Image Loading

```js
tabs.hook('contentReady', ({ content }) => {
    const images = content.querySelectorAll('img[data-src]');

    images.forEach(img => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    observer.unobserve(img);
                }
            });
        });

        observer.observe(img);
    });
});
```

### Progressive Enhancement

```js
// Detect slow connections
const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
const isSlow = connection && (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g');

const tabs = new YaiTabs({
    defaultBehavior: isSlow ? 'instant' : 'fade', // Disable animations on slow connections
    events: {
        setListener: {
            '[data-yai-tabs]': [
                'click',
                'keydown',
                { type: 'input', debounce: isSlow ? 1000 : 500 } // Longer debounce on slow connections
            ]
        }
    }
});

// Prefetch on hover for fast connections
if (!isSlow) {
    tabs.hook('eventMouseenter', ({ target }) => {
        if (target.matches('[data-url]') && !target.dataset.prefetched) {
            fetch(target.dataset.url);
            target.dataset.prefetched = 'true';
        }
    });
}
```

---

## See Also

- [README.md](./README.md) - Main documentation
- [Example.html](./Example.html) - Live interactive demo
- [YpsilonEventHandler](https://github.com/yaijs/yeh) - Event delegation foundation
- [YaiTabs GitHub](https://github.com/yaijs/yai) - Source code and components
- [NPM @yaijs/core](https://www.npmjs.com/package/@yaijs/core) - Package installation
- [NPM @yaijs/yeh](https://www.npmjs.com/package/@yaijs/yeh) - Event handler package
