
/**
 * YaiTabsAnalyzer
 */
class YaiTabsAnalyzer {
    constructor() {
        this.selectors = {
            hierarchy: {
                roots: '[data-yai-tabs][data-root]',
                nested: '[data-yai-tabs][data-in-root]',
                all: '[data-yai-tabs]',
                active: '[data-yai-tabs].tab-active',
                deepest: '[data-yai-tabs]:not([data-yai-tabs] [data-yai-tabs])'
            },
            navigation: {
                buttons: {
                    all: '[data-yai-tabs] [data-controller] button[data-open]',
                    active: '[data-yai-tabs] [data-controller] button[data-open].active',
                    default: '[data-yai-tabs] [data-controller] button[data-default]',
                    inview: '[data-yai-tabs] [data-controller] button[data-inview-default]',
                    disabled: '[data-yai-tabs] [data-controller] button[disabled]'
                },
                contents: {
                    all: '[data-yai-tabs] [data-content] [data-tab]',
                    active: '[data-yai-tabs] [data-content] [data-tab].active',
                    visible: '[data-yai-tabs] [data-content] [data-tab]:not([aria-hidden="true"])'
                }
            },
            accessibility: {
                inert: '[data-yai-tabs] [inert]',
                hiddenButtons: '[data-yai-tabs] button[aria-hidden="true"]',
                hiddenContent: '[data-yai-tabs] div[aria-hidden="true"]',
                labelledBy: '[data-yai-tabs] [aria-labelledby]',
                controls: '[data-yai-tabs] [aria-controls]'
            },
            interactions: {
                swypables: '[data-yai-tabs] [data-mousedown]',
                keyboard: '[data-yai-tabs] [tabindex]',
                focusable: '[data-yai-tabs] button, [data-yai-tabs] [tabindex]'
            },
            state: {
                loading: '[data-yai-tabs] [data-loading]',
                error: '[data-yai-tabs] [data-error]',
                dynamic: '[data-yai-tabs] [data-dynamic]'
            }
        };

        this.config = {
            enableAriaValidator: true,
            enablePerformanceMetrics: true,
            maxTreeDepth: 20 // Prevent infinite recursion
        };
    }

    /**
     * Main analysis method - replaces countComponents
     */
    analyze(enableConsole = true, enableUIUpdate = true) {
        if (typeof enableConsole === 'object') enableConsole = true;

        const results = {
            timestamp: new Date().toISOString(),
            summary: {},
            hierarchy: { trees: [] },
            navigation: {},
            accessibility: {},
            performance: {},
            health: {},
            url: {},
            raw: { elements: {}, counts: {} }
        };

        try {
            // Build component trees
            results.hierarchy.trees = this.buildComponentTrees();

            // Calculate all metrics
            results.summary = this.calculateSummaryMetrics(results.hierarchy.trees);
            results.navigation = this.calculateNavigationMetrics();
            results.accessibility = this.calculateAccessibilityMetrics();
            results.performance = this.calculatePerformanceMetrics();
            results.health = this.calculateHealthMetrics(results.hierarchy.trees);
            results.url = this.calculateUrlMetrics();

            // Update UI if requested
            if (enableUIUpdate) {
                this.updateUI(results.summary.total.components);
            }

            // Console output if enabled
            if (enableConsole && this.shouldLogToConsole()) {
                this.outputToConsole(results);
            }

            return results;

        } catch (error) {
            console.error('YaiTabsAnalyzer: Analysis failed:', error);
            return this.getErrorResult(error);
        }
    }

    /**
     * Build tree structure of all components
     */
    buildComponentTrees() {
        const roots = document.querySelectorAll(this.selectors.hierarchy.roots);
        return Array.from(roots).map(root => this.buildTree(root, 0));
    }

    buildTree(element, depth = 0) {
        if (depth > this.config.maxTreeDepth) return null;

        // CRITICAL FIX: Only count direct children of this container
        const directButtons = Array.from(element.querySelectorAll(
            ':scope > nav[data-controller] > [data-open]'
        ));

        const directContents = Array.from(element.querySelectorAll(
            ':scope > [data-content] > [data-tab]'
        ));

        const tree = {
            element: element,
            depth: depth,
            children: [],
            id: element.id || `component-${Math.random().toString(36).substr(2, 9)}`,
            refPath: element.getAttribute('data-ref-path'),
            tabs: {
                buttons: directButtons,  // ONLY direct buttons
                contents: directContents, // ONLY direct contents
                active: {
                    button: directButtons.find(btn => btn.classList.contains('active')),
                    content: directContents.find(content => content.classList.contains('active'))
                }
            },
            state: {
                isActive: element.classList.contains('tab-active'),
                isRoot: element.hasAttribute('data-root'),
                isNested: element.hasAttribute('data-in-root'),
                isDeepest: element.querySelectorAll('[data-yai-tabs]').length === 0
            }
        };

        // Find direct children only (avoid counting nested multiple times)
        const directChildren = Array.from(element.querySelectorAll('[data-yai-tabs]'))
            .filter(child => child !== element && child.parentElement.closest('[data-yai-tabs]') === element);

        tree.children = directChildren
            .map(child => this.buildTree(child, depth + 1))
            .filter(child => child !== null);

        return tree;
    }


    /**
     * Calculate summary metrics
     */
    calculateSummaryMetrics(trees) {
        let totalDepth = 0;
        let componentCount = 0;
        let maxDepth = 0;

        const calculateTreeMetrics = (tree) => {
            maxDepth = Math.max(maxDepth, tree.depth);
            totalDepth += tree.depth;
            componentCount++;

            tree.children.forEach(calculateTreeMetrics);
        };

        trees.forEach(calculateTreeMetrics);

        return {
            total: {
                components: document.querySelectorAll(this.selectors.hierarchy.all).length,
                roots: trees.length,
                maxDepth: maxDepth,
                averageDepth: componentCount > 0 ? (totalDepth / componentCount).toFixed(2) : 0,
                leafNodes: document.querySelectorAll(this.selectors.hierarchy.deepest).length
            },
            trees: trees.length
        };
    }

    /**
     * Calculate navigation-specific metrics
     */
    calculateNavigationMetrics() {
        return {
            buttons: {
                total: document.querySelectorAll(this.selectors.navigation.buttons.all).length,
                active: document.querySelectorAll(this.selectors.navigation.buttons.active).length,
                default: document.querySelectorAll(this.selectors.navigation.buttons.default).length,
                inview: document.querySelectorAll(this.selectors.navigation.buttons.inview).length,
                disabled: document.querySelectorAll(this.selectors.navigation.buttons.disabled).length
            },
            contents: {
                total: document.querySelectorAll(this.selectors.navigation.contents.all).length,
                active: document.querySelectorAll(this.selectors.navigation.contents.active).length,
                visible: document.querySelectorAll(this.selectors.navigation.contents.visible).length
            },
            ratio: {
                buttonsToContents: this.calculateRatio(
                    this.selectors.navigation.buttons.all,
                    this.selectors.navigation.contents.all
                ),
                activeToTotal: this.calculateRatio(
                    this.selectors.navigation.buttons.active,
                    this.selectors.navigation.buttons.all
                )
            }
        };
    }

    /**
     * Calculate accessibility metrics
     */
    calculateAccessibilityMetrics() {
        return {
            inert: document.querySelectorAll(this.selectors.accessibility.inert).length,
            hidden: {
                buttons: document.querySelectorAll(this.selectors.accessibility.hiddenButtons).length,
                content: document.querySelectorAll(this.selectors.accessibility.hiddenContent).length
            },
            relationships: {
                labelledBy: document.querySelectorAll(this.selectors.accessibility.labelledBy).length,
                controls: document.querySelectorAll(this.selectors.accessibility.controls).length
            }
        };
    }

    /**
     * Calculate performance metrics
     */
    calculatePerformanceMetrics() {
        return {
            interactions: {
                swypables: document.querySelectorAll(this.selectors.interactions.swypables).length,
                keyboard: document.querySelectorAll(this.selectors.interactions.keyboard).length,
                focusable: document.querySelectorAll(this.selectors.interactions.focusable).length
            },
            state: {
                loading: document.querySelectorAll(this.selectors.state.loading).length,
                error: document.querySelectorAll(this.selectors.state.error).length,
                dynamic: document.querySelectorAll(this.selectors.state.dynamic).length
            }
        };
    }

    /**
     * Calculate health metrics
     */
    calculateHealthMetrics(trees) {
        return {
            orphaned: document.querySelectorAll('[data-yai-tabs]:not(:has(.active))').length,
            mismatched: this.findMismatchedTabs(trees),
            ariaIssues: this.config.enableAriaValidator ? this.validateAriaStates(trees) : 0,
            depthWarnings: trees.filter(tree => this.getTreeDepth(tree) > 8).length
        };
    }

    /**
     * Calculate URL-related metrics
     */
    calculateUrlMetrics() {
        const params = new URLSearchParams(location.hash.substring(1));
        return {
            hashParams: Object.fromEntries(params),
            paramCount: params.size,
            activeFromHash: Array.from(params.keys()).filter(key =>
                document.querySelector(`[data-ref-path="${key}"]`)
            ).length,
            locationHash: location.hash
        };
    }

    /**
     * Helper methods
     */
    calculateRatio(selectorA, selectorB) {
        const countA = document.querySelectorAll(selectorA).length;
        const countB = document.querySelectorAll(selectorB).length;
        return countB > 0 ? (countA / countB).toFixed(2) : 0;
    }

    findMismatchedTabs(trees) {
        let mismatched = 0;
        trees.forEach(tree => {
            const walkTree = (t) => {
                if (t.tabs.buttons.length !== t.tabs.contents.length) {
                    mismatched++;
                }
                t.children.forEach(walkTree);
            };
            walkTree(tree);
        });
        return mismatched;
    }

    validateAriaStates(trees) {
        // Basic ARIA validation - expand as needed
        let issues = 0;
        trees.forEach(tree => {
            const walkTree = (t) => {
                // Check if active button has corresponding active content
                if (t.tabs.active.button && !t.tabs.active.content) {
                    issues++;
                }
                if (!t.tabs.active.button && t.tabs.active.content) {
                    issues++;
                }
                t.children.forEach(walkTree);
            };
            walkTree(tree);
        });
        return issues;
    }

    getTreeDepth(tree) {
        if (tree.children.length === 0) return tree.depth;
        return Math.max(...tree.children.map(child => this.getTreeDepth(child)));
    }

    /**
     * UI and Console methods
     */
    updateUI(componentCount) {
        const elements = document.querySelectorAll('.total-components-result');
        elements.forEach(el => {
            el.classList.remove('y-fade-in');
            el.textContent = componentCount;
            setTimeout(() => el.classList.add('y-fade-in'), 10);
        });
    }

    shouldLogToConsole() {
        const checkbox = document.querySelector('input[name="listComponentsInConsole"]');
        return checkbox ? checkbox.checked : true;
    }

    outputToConsole(results) {
        console.group('🎯 YaiTabs Component Analysis');
        console.log('Timestamp:', results.timestamp);

        console.group('📊 Summary');
        console.table(results.summary.total);
        console.groupEnd();

        console.group('🧭 Navigation');
        console.table(results.navigation.buttons);
        console.table(results.navigation.contents);
        console.groupEnd();

        console.group('♿ Accessibility');
        console.table(results.accessibility);
        console.groupEnd();

        console.group('⚡ Performance');
        console.table(results.performance.interactions);
        console.groupEnd();

        console.group('❤️ Health');
        console.table(results.health);
        console.groupEnd();

        console.group('🔗 URL State');
        console.log('Hash Parameters:', results.url.hashParams);
        console.log('Active from URL:', results.url.activeFromHash);
        console.groupEnd();

        // Tree visualization
        console.group('🌲 Component Trees');
        results.hierarchy.trees.forEach((tree, index) => {
            this.logTreeStructure(tree, `Root ${index + 1}`);
        });
        console.groupEnd();

        console.groupEnd(); // Main group
    }

    logTreeStructure(tree, prefix = '', depth = 0) {
        const indent = '  '.repeat(depth);
        const status = tree.state.isActive ? '🟢' : '⚪';
        const type = tree.state.isRoot ? 'ROOT' : `NESTED(d${tree.depth})`;
        const id = tree.refPath ? `ref:${tree.refPath}` : tree.id;

        console.log(`${indent}${status} ${prefix} [${type}] ${id}`);
        console.log(`${indent}  📊 ${tree.tabs.buttons.length} buttons, ${tree.tabs.contents.length} contents`);

        tree.children.forEach((child, index) => {
            this.logTreeStructure(child, `└── Child ${index + 1}`, depth + 1);
        });
    }

    getErrorResult(error) {
        return {
            timestamp: new Date().toISOString(),
            error: error.message,
            summary: { total: { components: 0, roots: 0, maxDepth: 0, averageDepth: 0 } },
            hierarchy: { trees: [] },
            navigation: {},
            accessibility: {},
            performance: {},
            health: {},
            url: {}
        };
    }

    /**
     * Quick stats (backward compatibility)
     */
    quickStats() {
        const results = this.analyze(false, false);
        return {
            components: results.summary.total.components,
            roots: results.summary.total.roots,
            maxDepth: results.summary.total.maxDepth,
            activeTabs: results.navigation.buttons.active,
            health: results.health
        };
    }
}

export {YaiTabsAnalyzer};
export default YaiTabsAnalyzer;

// Usage example:
// const analyzer = new YaiTabsAnalyzer();
// const results = analyzer.analyze(true, true);
// const quick = analyzer.quickStats();
