/**
 * Fails fast before spawning, preventing cryptic worker ReferenceErrors.
 */
const FORBIDDEN = /\b(window|document|localStorage|sessionStorage|parent|top|opener|location)\b/;

export function validateTask(fn, {allowThis = false} = {}) {
    const src = typeof fn === 'function' ? fn.toString() : fn;

    if (FORBIDDEN.test(src)) {
        const match = src.match(FORBIDDEN)[0];
        throw new Error(
            `[YaiWorker] Task references forbidden main-thread global "${match}". ` +
            `Workers have no DOM access. Pass data as inputData instead.`
        );
    }

    // Detect `this.` usage in non-arrow functions only, unless allowThis is set
    const isArrow = /^(\s*async\s*)?\s*(\w+|\([^)]*\))\s*=>/.test(src);
    if (!allowThis && !isArrow && /\bthis\b/.test(src)) {
        throw new Error(
            `[YaiWorker] Task uses "this" which loses binding when serialized. ` +
            `Use an arrow function, or pass { allowThis: true } to suppress.`
        );
    }
    return true;
}
