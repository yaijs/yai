import {YaiCore, YaiCoreConfig} from '../yai-core.js';

export interface ToggleDetail { trigger: Element; targets: Element[]; scope: Element | Document; container: Element | null; event: Event | null; on: boolean; context: YaiToggle; }
export interface YaiToggleConfig extends YaiCoreConfig { rootSelector?: string; listen?: boolean; event?: string; action?: string; scopeSelector?: string; position?: 'replace' | 'append' | 'prepend' | 'before' | 'after'; separators?: {list?: string; pair?: string}; stashAttribute?: string; dispatchName?: string; callable?: YaiCoreConfig['callable'] & {beforeToggle?: ((detail: ToggleDetail) => boolean | void) | Array<(detail: ToggleDetail) => boolean | void>; toggled?: ((detail: ToggleDetail) => void) | Array<(detail: ToggleDetail) => void>;}; }

export declare class YaiToggle extends YaiCore {
    host: YaiCore | null;
    constructor(customConfig?: YaiToggleConfig);
    setInstance(host: YaiCore): this;
    watchHooks(): this;
    toggle(trigger: Element, event?: Event | null, container?: Element | null, force?: boolean | null): boolean | null;
    readSpec(trigger: Element): {query: string; group: string; self: Record<string, string | undefined>; target: Record<string, string | undefined>;};
    apply(element: Element, spec: Record<string, string | undefined>, on: boolean, position?: string): void;
    isOn(trigger: Element, spec?: ReturnType<YaiToggle['readSpec']>, targets?: Element[] | null): boolean;
    resolveScope(trigger: Element, container?: Element | null): Element | Document;
    resolveTargets(query: string, scope?: Element | Document): Element[];
    destroy(): this;
}
export default YaiToggle;
