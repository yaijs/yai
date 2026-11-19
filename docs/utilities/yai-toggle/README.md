# YaiToggle

`YaiToggle` is a declarative toggle utility for authored markup. It keeps no registry and performs no initialization scan: one marker on the trigger is the state, while target elements are resolved when an action occurs. This makes injected and removed markup naturally safe.

## Install and use

```js
import {YaiToggle} from '@yaijs/core/toggle';
const toggle = new YaiToggle();
```

```html
<div data-yai-toggle>
  <button data-click="toggleTarget" data-toggle-target=".details"
          data-toggle-target-class="!hidden"
          data-toggle-self-content="Show details:Hide details">Show details</button>
  <div class="details hidden">…</div>
</div>
```

The browser demo is [yai-toggle.html](./yai-toggle.html).

## Attribute grammar

A token always names the **on** state. The same grammar applies to classes, attributes, self changes, and targets.

| Value | Meaning |
| --- | --- |
| `active` | present while on |
| `!hidden` | present while off |
| `primary:success` | `primary` while off, `success` while on |
| `active, primary:success` | multiple independent operations |

Use `data-toggle-self-class`, `data-toggle-self-attr`, and `data-toggle-self-content` for the trigger; use the corresponding `data-toggle-target-*` attributes for targets. Attribute values may use `name=off:on`, for example `data-toggle-target-attr="!inert, !aria-hidden"`.

For content, `Off:On` is an explicit text swap. A single on value keeps cloned original child nodes in a private weak cache and restores them on close; `data-toggle-content-off` is only a marker. Attribute strings are always rendered as text, never interpreted as HTML. For trusted programmatic markup, pass a DOM `Node` to `content()` directly. `createElement()` remains an explicit authored-template helper, so do not pass untrusted values into it.

## Scope, groups, and accessibility

- Targets are found within the closest `[data-yai-toggle]`; separate scopes can reuse selectors safely.
- `data-toggle-scope="document"`, `parent`, or a selector overrides that scope.
- `data-toggle-group="faq"` provides accordion behavior within the scope.
- The trigger receives `data-toggle-state`, `aria-expanded`, and, when targets exist, `aria-controls`. Initial state is read from the marker, then `aria-expanded`, then the first target’s class grammar.

## Inside YaiTabs

YEH routes an event to its closest handler. A standalone document-level toggle hub therefore cannot receive clicks inside a YaiTabs container. Share the tabs hub instead:

```js
const tabs = new YaiTabs();
const nestedToggle = new YaiToggle({listen: false}).setInstance(tabs).watchHooks();
```

This adds no native listener. Destroying `nestedToggle` removes only its hook and leaves `tabs.events` intact.

## API and hooks

`toggle.toggle(trigger, event, container, force)` flips a trigger or forces `true`/`false`. `beforeToggle` can return `false` to veto. `toggled` receives `{trigger, targets, scope, container, event, on, context}` after the DOM update. The component emits `yai.toggle.toggleOn`, `yai.toggle.toggleOff`, and `yai.toggle.toggle`.

`utils/yai-util.js` also exports the small, independent helpers used by the component: `tokens`, `pair`, `classes`, `attrs`, `content`, `nodes`, and `createElement`.
