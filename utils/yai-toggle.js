"use strict";

import {YaiCore} from '../yai-core.js';
import * as util from './yai-util.js';

/**
 * Declarative, delegation-first toggle utility. State lives on the trigger;
 * targets are derived on demand, so dynamically inserted markup needs no setup.
 */
class YaiToggle extends YaiCore {
    constructor(customConfig = {}) {
        const toggleConfig = {
            rootSelector: 'document',
            listen: true,
            event: 'click',
            action: 'toggleTarget',
            scopeSelector: '[data-yai-toggle]',
            position: 'replace',
            separators: {list: ',', pair: ':'},
            stashAttribute: 'data-toggle-content-off',
            autoAccessibility: true,
            dispatchName: 'yai.toggle',
            emitable: {toggle: 'toggle', toggleOn: 'toggleOn', toggleOff: 'toggleOff'},
            events: {
                autoTargetResolution: true,
                actionableAttributes: ['data-click'],
                actionableClasses: [],
                actionableTags: [],
                setListener: null,
            },
        };
        super(YaiCore.deepMerge(toggleConfig, customConfig));

        // YEH consumes hook arrays. Accept the friendlier single-function form too.
        const callable = {beforeToggle: null, toggled: null, ...this.config.callable};
        Object.keys(callable).forEach(name => {
            callable[name] = YaiCore._normalizeCallable(callable[name]);
        });
        this.config.callable = callable;
        this.host = null;
        this._watchCallback = null;

        if (this.config.listen !== false) {
            this.createEventHandler(
                this.config.events.setListener || {[this.config.rootSelector]: [this.config.event]},
                this.config.events.setAliases,
                this.config.events
            );
        }
    }

    handleEventProxy(event, target, container) {
        const action = target?.dataset?.[event.type];
        this._executeHook(`event${this._capitalize(event.type)}`, {event, target, container, action, context: this});
        if (action === this.config.action) return this.toggle(target, event, container);
    }

    /** Share a host hub (for example YaiTabs) instead of competing with it. */
    setInstance(host) {
        if (!host?.events) throw new Error('YaiToggle: host has no event hub. Create it after host.createEventHandler().');
        if (this.events && this.events !== host.events) this.events.destroy();
        this.host = host;
        this.events = host.events;
        return this;
    }

    watchHooks() {
        if (!this.host) throw new Error('YaiToggle: host instance not set. Call setInstance() first.');
        if (this._watchCallback) return this;
        this._watchCallback = ({event, target, container, action}) => {
            if (action === this.config.action) this.toggle(target, event, container);
        };
        this.host.hook(`event${this._capitalize(this.config.event)}`, this._watchCallback);
        return this;
    }

    toggle(trigger, event = null, container = null, force = null) {
        if (!trigger || this._isDestroyed) return null;
        const spec = this.readSpec(trigger);
        const scope = this.resolveScope(trigger, container);
        const targets = this.resolveTargets(spec.query, scope);
        const on = force === null ? !this.isOn(trigger, spec, targets) : !!force;
        const detail = {trigger, targets, scope, container, event, on, context: this};
        const veto = this._executeHook('beforeToggle', detail);
        if (veto === false || (Array.isArray(veto) && veto.includes(false))) return null;
        if (on) this._releaseGroup(trigger, scope, event, container);
        const position = trigger.dataset.togglePosition || this.config.position;
        this.apply(trigger, spec.self, on, position);
        targets.forEach(target => this.apply(target, spec.target, on, position));
        trigger.dataset.toggleState = on ? 'on' : 'off';
        if (this.config.autoAccessibility) this._aria(trigger, targets, on);
        this._executeHook('toggled', detail);
        this.yaiEmit(on ? 'toggleOn' : 'toggleOff', detail);
        this.yaiEmit('toggle', detail);
        return on;
    }

    readSpec(trigger) {
        const data = trigger.dataset;
        return {
            query: data.toggleTarget || '', group: data.toggleGroup || '',
            self: {class: data.toggleSelfClass, content: data.toggleSelfContent, attr: data.toggleSelfAttr},
            target: {class: data.toggleTargetClass, content: data.toggleTargetContent, attr: data.toggleTargetAttr},
        };
    }

    apply(element, spec, on, position = this.config.position) {
        if (!element || !spec) return;
        const separators = this.config.separators;
        util.classes(element, spec.class, on, separators);
        util.attrs(element, spec.attr, on, separators);
        util.content(element, spec.content, on, {position: element.dataset?.togglePosition || position, separators, stash: this.config.stashAttribute});
    }

    isOn(trigger, spec = this.readSpec(trigger), targets = null) {
        const state = trigger.dataset.toggleState;
        if (state) return state === 'on';
        if (trigger.hasAttribute('aria-expanded')) return trigger.getAttribute('aria-expanded') === 'true';
        const first = targets?.[0];
        const token = util.tokens(spec.target.class, this.config.separators.list)[0];
        if (!first || !token) return false;
        const swap = util.pair(token, this.config.separators.pair);
        if (swap) return first.classList.contains(swap[1]);
        const inverse = token.startsWith('!');
        const name = (inverse ? token.slice(1) : token).trim();
        return inverse ? !first.classList.contains(name) : first.classList.contains(name);
    }

    resolveScope(trigger, container = null) {
        const value = trigger.dataset.toggleScope;
        if (value === 'document') return document;
        if (value === 'parent') return trigger.parentElement || document;
        if (value) return this._closest(trigger, value) || document;
        return this._closest(trigger, this.config.scopeSelector) || container || document;
    }

    resolveTargets(query, scope = document) {
        if (!query) return [];
        try { return Array.from(this.findAll(query, scope, {refresh: true})); }
        catch (error) {
            console.warn('YaiToggle: invalid target selector', query, error);
            return [];
        }
    }

    _releaseGroup(trigger, scope, event, container) {
        const group = trigger.dataset.toggleGroup;
        if (!group) return;
        this.findAll('[data-toggle-group]', scope, {refresh: true}).forEach(other => {
            if (other !== trigger && other.dataset.toggleGroup === group && other.dataset.toggleState === 'on') {
                this.toggle(other, event, container, false);
            }
        });
    }

    _aria(trigger, targets, on) {
        trigger.setAttribute('aria-expanded', String(on));
        if (targets.length) trigger.setAttribute('aria-controls', targets.map(target => target.id || (target.id = YaiCore.generateId('yai-toggle'))).join(' '));
    }

    _closest(element, selector) {
        try { return element.closest(selector); }
        catch (error) {
            console.warn('YaiToggle: invalid scope selector', selector, error);
            return null;
        }
    }

    destroy() {
        if (this._isDestroyed) return this;
        const host = this.host;
        const ownEvents = this.events && this.events !== host?.events ? this.events : null;
        if (host && this._watchCallback) host.events?.unhook?.(`event${this._capitalize(this.config.event)}`, this._watchCallback, host);
        this._watchCallback = null;
        this.host = null;
        this.events = ownEvents;
        return super.destroy();
    }
}

export {YaiToggle};
export default YaiToggle;
