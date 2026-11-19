export interface Separators { list: string; pair: string; }
export declare const SEPARATORS: Separators;
export declare const POSITIONS: Record<string, 'replaceChildren' | 'append' | 'prepend' | 'before' | 'after'>;
export declare const tokens: (value: unknown, separator?: string) => string[];
export declare const each: (value: unknown, callback: (token: string, index: number) => void, separator?: string) => string[];
export declare const pair: (token: string, separator?: string) => [string, string] | null;
export declare const classes: (element: Element | null, value: unknown, on: boolean, separators?: Separators) => void;
export declare const attrs: (element: Element | null, value: unknown, on: boolean, separators?: Separators) => void;
export declare const nodes: (value: string | Node | DocumentFragment | null | undefined) => Node[];
export declare const content: (element: Element | null, value: string | Node | null | undefined, on: boolean, options?: {position?: keyof typeof POSITIONS; separators?: Separators; stash?: string}) => void;
export declare const createElement: (definition: unknown) => string;
declare const util: {SEPARATORS: typeof SEPARATORS; POSITIONS: typeof POSITIONS; tokens: typeof tokens; each: typeof each; pair: typeof pair; classes: typeof classes; attrs: typeof attrs; content: typeof content; nodes: typeof nodes; createElement: typeof createElement;};
export default util;
