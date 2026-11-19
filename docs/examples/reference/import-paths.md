# Example import reference

Examples should exercise the checked-out library source. From a component directory such as `docs/examples/yai-toggle/`, the repository root is three levels up:

```js
import {YaiToggle} from '../../../utils/yai-toggle.js';
import {YaiTabs} from '../../../tabs/yai-tabs.js';
import {YEH} from '../../../yeh/yeh.js';
import {YaiWorker} from '../../../worker/yai-worker.js';
```

From a nested scenario such as `docs/examples/yai-tabs/overview/`, the root is four levels up:

```js
import {YaiTabs} from '../../../../tabs/yai-tabs.js';
import {YaiSearchAndClick} from '../../../../utils/yai-search-and-click.js';
```

Use a package/CDN import only when the purpose of an example is specifically to demonstrate package consumption. Do not mix duplicate imports of the same symbol in one module.
