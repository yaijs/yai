/**
 * Fails fast before spawning, preventing cryptic worker ReferenceErrors.
 */
const FORBIDDEN = /(?<![\w$.])\b(window|document|localStorage|sessionStorage|parent|top|opener|location)\b(?!\s*:)/;

// This is deliberately a small guard, not a JavaScript parser. A linear scanner
// removes comments and quoted literals without a backtracking regular expression.
const stripNonCode = (source) => {
    let code = '';
    let index = 0;

    while (index < source.length) {
        const char = source[index];
        const next = source[index + 1];

        if (char === '/' && next === '/') {
            const lineEnd = source.indexOf('\n', index + 2);
            index = lineEnd === -1 ? source.length : lineEnd;
            code += ' ';
        } else if (char === '/' && next === '*') {
            const commentEnd = source.indexOf('*/', index + 2);
            index = commentEnd === -1 ? source.length : commentEnd + 2;
            code += ' ';
        } else if (char === "'" || char === '"' || char === '`') {
            const quote = char;
            index++;
            while (index < source.length) {
                if (source[index] === '\\') index += 2;
                else if (source[index++] === quote) break;
            }
            code += ' ';
        } else {
            code += char;
            index++;
        }
    }

    return code;
};

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
