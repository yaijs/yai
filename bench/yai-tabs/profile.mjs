/**
 * Manual jsdom attribution profiler for the recursive YaiTabs stress fixture.
 * It reports operation counts, not browser performance. Run: node bench/yai-tabs/profile.mjs 25
 */
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const injections = Number(process.argv[2] || 25);
const fragment = readFileSync(new URL('../../tabs/dynamic/mega-tree-full-max.html', import.meta.url), 'utf8')
    .replace(/\sdata-(delay|post-delay)="[^"]*"/g, '');
const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {url: 'http://localhost/', pretendToBeVisual: true});
const win = dom.window;
for (const key of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'MouseEvent', 'CustomEvent', 'Event', 'history', 'location', 'navigator', 'requestAnimationFrame', 'getComputedStyle']) {
    Object.defineProperty(globalThis, key, {value: win[key], configurable: true, writable: true});
}
globalThis.fetch = async () => ({ok: true, status: 200, text: async () => fragment});

const {YaiTabs} = await import('../../tabs/yai-tabs.js');
const {YaiCore} = await import('../../yai-core.js');
const {YEH} = await import('../../yeh/yeh.js');
const counters = {hops: 0, contains: 0, selectors: 0, closest: 0};
const snapshot = () => ({...counters});
const difference = (from, to) => Object.fromEntries(Object.keys(counters).map(key => [key, to[key] - from[key]]));

for (const property of ['parentNode', 'parentElement']) {
    const descriptor = Object.getOwnPropertyDescriptor(win.Node.prototype, property);
    Object.defineProperty(win.Node.prototype, property, {...descriptor, get() { counters.hops++; return descriptor.get.call(this); }});
}
const count = (prototype, method, metric) => {
    const original = prototype[method];
    if (typeof original === 'function') prototype[method] = function (...args) { counters[metric]++; return original.apply(this, args); };
};
count(win.Node.prototype, 'contains', 'contains');
count(win.Element.prototype, 'closest', 'closest');
for (const prototype of [win.Element.prototype, win.Document.prototype]) {
    count(prototype, 'querySelector', 'selectors'); count(prototype, 'querySelectorAll', 'selectors');
}

const stats = new Map(), stack = [];
const instrument = (Class, label) => {
    for (const method of Object.getOwnPropertyNames(Class.prototype)) {
        const descriptor = Object.getOwnPropertyDescriptor(Class.prototype, method);
        if (method === 'constructor' || typeof descriptor?.value !== 'function') continue;
        const original = descriptor.value;
        Class.prototype[method] = function (...args) {
            const before = snapshot(), frame = {name: `${label}.${method}`, children: {hops: 0, contains: 0, selectors: 0, closest: 0}};
            stack.push(frame);
            try { return original.apply(this, args); }
            finally {
                stack.pop();
                const total = difference(before, snapshot());
                const self = Object.fromEntries(Object.keys(total).map(key => [key, total[key] - frame.children[key]]));
                const stat = stats.get(frame.name) || {calls: 0, self: {hops: 0, contains: 0, selectors: 0, closest: 0}};
                stat.calls++;
                Object.keys(self).forEach(key => stat.self[key] += self[key]);
                stats.set(frame.name, stat);
                if (stack.length) Object.keys(total).forEach(key => stack.at(-1).children[key] += total[key]);
            }
        };
    }
};
instrument(YEH, 'YEH'); instrument(YaiCore, 'YaiCore'); instrument(YaiTabs, 'YaiTabs');

document.querySelector('#app').innerHTML = fragment;
const tabs = new YaiTabs();
const click = element => element.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const deepest = selector => [...document.querySelectorAll(selector)].reduce((best, element) => {
    let depth = 0, parent = element;
    while ((parent = parent.parentElement)) depth++;
    return !best || depth > best.depth ? {element, depth} : best;
}, null).element;
await sleep(60);
for (let index = 0; index < injections; index++) { click(deepest('[data-url]')); await sleep(35); }

const report = (title, element) => {
    stats.clear(); const before = snapshot(), started = performance.now(); click(element);
    const total = difference(before, snapshot());
    console.log(`\n${title}: ${total.hops} parent hops, ${total.contains} contains(), ${total.selectors} selector calls, ${total.closest} closest() — ${(performance.now() - started).toFixed(0)}ms (jsdom)`);
    [...stats.entries()].sort((a, b) => b[1].self.hops + b[1].self.contains * 50 - a[1].self.hops - a[1].self.contains * 50).slice(0, 12)
        .forEach(([name, stat]) => console.log(`${name.padEnd(42)} ${String(stat.calls).padStart(3)} calls  ${String(stat.self.hops).padStart(9)} hops  ${String(stat.self.contains).padStart(7)} contains`));
};
report(`deepest click after ${injections} injections`, deepest('[data-tab-action="open"]:not([data-url])'));
const root = document.querySelector('[data-yai-tabs]');
report('root click / subtree re-activation', root.querySelector(':scope > [data-controller] [data-open="2"]'));
console.log(`\ntree: ${document.querySelectorAll('*').length} elements, ${document.querySelectorAll('[data-yai-tabs]').length} containers, ${tabs.events.eventListeners.size} native listeners`);
