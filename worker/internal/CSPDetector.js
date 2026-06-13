/**
 * Sniffs for Chrome Extension contexts or strict CSP blocking `blob:` URLs.
 */
export function isCSPRestricted() {
    // Check 1: Chrome Extension context (MV3 always restricts blob:)
    if (typeof chrome !== 'undefined' && chrome?.runtime?.id) {
        return true;
    }
    // Check 2: <meta http-equiv="Content-Security-Policy"> present and excludes blob:
    const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (meta) {
        const content = meta.content;
        if (/script-src/.test(content) && !/blob:/.test(content)) {
            return true;
        }
    }
    return false;
}
