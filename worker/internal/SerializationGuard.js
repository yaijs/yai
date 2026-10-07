/**
 * Fails fast before spawning, preventing cryptic worker ReferenceErrors.
 */
const FORBIDDEN = /(?<![\w$.])\b(window|document|localStorage|sessionStorage|parent|top|opener|location)\b(?!\s*:)/;

// This is deliberately a small guard, not a JavaScript parser. Remove comments and
// quoted literals first so ordinary prose and property names do not reject a task.
const stripNonCode = (source) => source.replace(
    /\/\*[\s\S]*?\*\/|\/\/[^\n\r]*|(['"`])(?:\\.|(?!\1)[^\\])*\1/g,
    ' '
);

export function validateTask(fn, {allowThis = false} = {}) {
    const src = typeof fn === 'function' ? fn.toString() : fn;

    const code = stripNonCode(src);
    if (FORBIDDEN.test(code)) {
        const match = code.match(FORBIDDEN)[0];
        throw new Error(
            `[YaiWorker] Task references forbidden main-thread global "${match}". ` +
            `Workers have no DOM access. Pass data as inputData instead.`
        );
    }

    // Non-arrow functions start with `function` or `async function`.
    // Checking the negative is unambiguous and avoids backtracking on long inputs.
    const isArrow = /=>/.test(code);
    if (!allowThis && !isArrow && /\bthis\b/.test(code)) {
        throw new Error(
            `[YaiWorker] Task uses "this" which loses binding when serialized. ` +
            `Use an arrow function, or pass { allowThis: true } to suppress.`
        );
    }
    return true;
}
