import {afterEach, describe, expect, it, vi} from 'vitest';
import {YaiTabs} from '../tabs/yai-tabs.js';
import {YaiToggle} from '../utils/yai-toggle.js';
import * as util from '../utils/yai-util.js';

const click = element => element.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
const instances = [];
const make = config => {
    const instance = new YaiToggle(config);
    instances.push(instance);
    return instance;
};

afterEach(() => {
    while (instances.length) instances.pop().destroy();
    document.body.replaceChildren();
});

describe('YaiToggle utilities', () => {
    it('applies the shared token grammar to classes, attributes, and content', () => {
        const element = document.createElement('div');
        element.className = 'primary';
        util.classes(element, 'active, !hidden, primary:success', true);
        util.attrs(element, '!inert, title=closed:open', true);
        expect(element.className).toBe('active success');
        expect(element.hasAttribute('inert')).toBe(false);
        expect(element.getAttribute('title')).toBe('open');

        element.textContent = 'Closed';
        util.content(element, 'Closed:Open', true);
        expect(element.textContent).toBe('Open');
        util.content(element, 'Closed:Open', false);
        expect(element.textContent).toBe('Closed');
    });

    it('creates recursive authored markup and escapes attributes', () => {
        expect(util.createElement({div: {attributes: {'data-x': 'a"b'}, content: [{span: {content: 'ok'}}, {br: {}}]}}))
            .toBe('<div data-x="a&quot;b"><span>ok</span><br></div>');
    });

    it('treats content strings as text and restores original child nodes safely', () => {
        const element = document.createElement('div');
        element.innerHTML = '<strong>Original</strong>';

        util.content(element, '<img src=x onerror=alert(1)>', true);
        expect(element.querySelector('img')).toBeNull();
        expect(element.textContent).toBe('<img src=x onerror=alert(1)>');

        util.content(element, '<img src=x onerror=alert(1)>', false);
        expect(element.querySelector('strong')?.textContent).toBe('Original');

        const trustedNode = document.createElement('em');
        trustedNode.textContent = 'Trusted node';
        util.content(element, trustedNode, true);
        expect(element.querySelector('em')?.textContent).toBe('Trusted node');
    });
});

describe('YaiToggle standalone', () => {
    it('works from authored markup without an initialization scan', () => {
        document.body.innerHTML = `
            <div data-yai-toggle><button class="primary" data-click="toggleTarget"
                data-toggle-target=".box" data-toggle-target-class="!hidden"
                data-toggle-target-attr="!inert" data-toggle-self-class="active, primary:success"
                data-toggle-self-content="Show:Hide">Show</button><div class="box hidden">content</div></div>`;
        make();
        const button = document.querySelector('button');
        const box = document.querySelector('.box');
        click(button);
        expect(box.classList.contains('hidden')).toBe(false);
        expect(box.hasAttribute('inert')).toBe(false);
        expect(button.textContent).toBe('Hide');
        expect(button.className).toBe('active success');
        expect(button.getAttribute('aria-expanded')).toBe('true');
        expect(button.getAttribute('aria-controls')).toBe(box.id);
        click(button);
        expect(box.classList.contains('hidden')).toBe(true);
        expect(button.textContent).toBe('Show');
    });

    it('handles nested targets, dynamic markup, accordion groups, and a veto', () => {
        document.body.innerHTML = `<div data-yai-toggle>
            <button data-click="toggleTarget" data-toggle-group="faq" data-toggle-target="#one" data-toggle-target-class="!hidden">One</button>
            <button data-click="toggleTarget" data-toggle-group="faq" data-toggle-target="#two" data-toggle-target-class="!hidden">Two</button>
            <div id="one" class="hidden"></div><div id="two" class="hidden"></div></div>`;
        const toggle = make();
        const [one, two] = document.querySelectorAll('button');
        click(one); click(two);
        expect(document.querySelector('#one').classList.contains('hidden')).toBe(true);
        expect(document.querySelector('#two').classList.contains('hidden')).toBe(false);

        document.body.insertAdjacentHTML('beforeend', '<button data-click="toggleTarget" data-toggle-target=".late" data-toggle-target-class="!hidden">Late</button><div class="late hidden"></div>');
        const late = document.querySelector('[data-toggle-target=".late"]');
        click(late);
        expect(document.querySelector('.late').classList.contains('hidden')).toBe(false);
        toggle.hook('beforeToggle', () => false);
        click(two);
        expect(two.dataset.toggleState).toBe('on');
    });

    it('does not throw on invalid selectors and stops responding after destroy', () => {
        document.body.innerHTML = '<button data-click="toggleTarget" data-toggle-target=":::bad" data-toggle-self-content="A:B">A</button>';
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const toggle = make();
        const button = document.querySelector('button');
        click(button);
        expect(button.textContent).toBe('B');
        toggle.destroy();
        click(button);
        expect(button.textContent).toBe('B');
        warn.mockRestore();
    });
});

describe('YaiToggle composed with YaiTabs', () => {
    it('uses the tabs hub without adding listeners and does not destroy it', () => {
        document.body.innerHTML = `<div data-yai-tabs data-ref-path="toggle-test"><div data-controller>
            <button data-tab-action="open" data-open="one" data-default>One</button><button data-tab-action="open" data-open="two">Two</button>
            </div><div data-content><div data-tab="one"><button data-click="toggleTarget" data-toggle-target=".box" data-toggle-target-class="!hidden">Toggle</button><div class="box hidden"></div></div><div data-tab="two">Two</div></div></div>`;
        const tabs = new YaiTabs();
        const toggle = make({listen: false}).setInstance(tabs).watchHooks();
        const eventHub = tabs.events;
        const listeners = eventHub.eventListeners.size;
        click(document.querySelector('[data-click]'));
        expect(document.querySelector('.box').classList.contains('hidden')).toBe(false);
        expect(eventHub.eventListeners.size).toBe(listeners);
        const watchedCallback = toggle._watchCallback;
        toggle.destroy();
        expect(tabs.events).toBe(eventHub);
        expect(tabs.config.callable.eventClick).not.toContain(watchedCallback);
        click(document.querySelector('[data-open="two"]'));
        expect(document.querySelector('[data-tab="two"]').classList.contains('active')).toBe(true);
        tabs.destroy();
    });
});
