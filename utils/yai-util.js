"use strict";

/**
 * Small DOM helpers shared by declarative utilities. Tokens name the on state:
 * `active`, `!hidden`, and `off:on` respectively mean add on, add off, and swap.
 */
const SEPARATORS = {list: ',', pair: ':'};
const tokens = (value, separator = SEPARATORS.list) => String(value ?? '').split(separator).map(token => token.trim()).filter(Boolean);
const each = (value, callback, separator = SEPARATORS.list) => {
    const list = tokens(value, separator);
    list.forEach(callback);
    return list;
};
const pair = (token, separator = SEPARATORS.pair) => {
    const index = token.indexOf(separator);
    return index < 0 ? null : [token.slice(0, index).trim(), token.slice(index + separator.length).trim()];
};

const classes = (element, value, on, separators = SEPARATORS) => {
    if (!element?.classList) return;
    each(value, token => {
        const swap = pair(token, separators.pair);
        if (swap) {
            if (swap[0]) element.classList.toggle(swap[0], !on);
            if (swap[1]) element.classList.toggle(swap[1], on);
            return;
        }
        const inverse = token.startsWith('!');
        const name = (inverse ? token.slice(1) : token).trim();
        if (name) element.classList.toggle(name, inverse ? !on : on);
    }, separators.list);
};

const attrs = (element, value, on, separators = SEPARATORS) => {
    if (!element?.setAttribute) return;
    each(value, token => {
        const index = token.indexOf('=');
        if (index > 0) {
            const name = token.slice(0, index).trim();
            const valuePart = token.slice(index + 1).trim();
            const swap = pair(valuePart, separators.pair) || ['', valuePart];
            const next = on ? swap[1] : swap[0];
            return void (next ? element.setAttribute(name, next) : element.removeAttribute(name));
        }
        const inverse = token.startsWith('!');
        const name = (inverse ? token.slice(1) : token).trim();
        if (!name) return;
        if (name.startsWith('aria-')) element.setAttribute(name, String(inverse ? !on : on));
        else element.toggleAttribute(name, inverse ? !on : on);
    }, separators.list);
};

const POSITIONS = {replace: 'replaceChildren', append: 'append', prepend: 'prepend', before: 'before', after: 'after'};
const nodes = value => {
    if (typeof Node !== 'undefined' && value instanceof Node) return [value];
    const fragment = document.createRange().createContextualFragment(String(value ?? ''));
    return Array.from(fragment.childNodes);
};

/** Raw HTML is intentional: this API is for authored markup, never untrusted input. */
const content = (element, value, on, options = {}) => {
    if (!element || value == null || value === '') return;
    const {position = 'replace', separators = SEPARATORS, stash = 'data-toggle-content-off'} = options;
    const swap = pair(String(value), separators.pair);
    let next;
    if (swap) next = on ? swap[1] : swap[0];
    else {
        if (!element.hasAttribute(stash)) element.setAttribute(stash, element.innerHTML);
        next = on ? value : element.getAttribute(stash);
    }
    const method = POSITIONS[on ? position : 'replace'] || POSITIONS.replace;
    element[method](...nodes(next));
};

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const escapeAttribute = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Build authored HTML from a small declarative object; content strings are raw HTML. */
const createElement = definition => {
    if (definition == null || definition === false) return '';
    if (Array.isArray(definition)) return definition.map(createElement).join('');
    if (typeof definition !== 'object') return String(definition);
    return Object.entries(definition).map(([tag, spec]) => {
        const {attributes = {}, content: children = ''} = (spec && typeof spec === 'object') ? spec : {content: spec};
        const attributesText = Object.entries(attributes)
            .filter(([, value]) => value != null && value !== false)
            .map(([name, value]) => ` ${name}="${escapeAttribute(value === true ? '' : value)}"`)
            .join('');
        return VOID_TAGS.has(tag.toLowerCase()) ? `<${tag}${attributesText}>` : `<${tag}${attributesText}>${createElement(children)}</${tag}>`;
    }).join('');
};

export {SEPARATORS, POSITIONS, tokens, each, pair, classes, attrs, content, nodes, createElement};
export default {SEPARATORS, POSITIONS, tokens, each, pair, classes, attrs, content, nodes, createElement};
