/**
 * YEH utilized
 */
import {YEH} from '../yeh/yeh.js';

/**
 * EY: Dynamically create event handlers from event selector config
 * Scans all event types and creates handleClick(), handleInput(), etc.
 *
 * This handlers are core-router for event delegation, and they only exist to
 * route events via data-attributes to the methods set in those data-attributes.
 *
 * The data-click, data-input etc. attributes are not only decorative. They make sure,
 * that events don't interfere with each other, like input and change events would do,
 * if both would be handled via a single data-action attribute.
 *
 * This function generates core handler scoped to eventType. And `attributeAction` could
 * be a method you set as handler in data-attributes, like:
 *
 * <button data-click="attributeAction"/>
 *
 * methods: {
 *     click: {
 *         handleClick: this.handleEventProxy
 *     },
 *     input: {
 *         handleInput: this.handleEventProxy
 *     },
 *     attributeAction: fn
 * }
 */
function createDynamicHandlers(eventSelector, service) {
    if (!eventSelector) return;

    service.methods = {};
    service.attributes = [];

    const processedTypes = new Set();

    Object.entries(eventSelector).forEach(([, events]) => {
        events.forEach(eventConfig => {
            const eventType = typeof eventConfig === 'string'
                ? eventConfig
                : eventConfig.type;

            // Skip duplicates
            if (processedTypes.has(eventType)) return;
            processedTypes.add(eventType);

            const handlerName = `handle${eventType.charAt(0).toUpperCase()}${eventType.slice(1)}`;
            const attributeName = `data-${eventType}`;

            // Initialize event type bucket if needed
            if (!service.methods[eventType]) {
                service.methods[eventType] = {};
            }

            // Create method (overwrites if exists - but shouldn't due to Set)
            service.methods[eventType][handlerName] = function(...args) {
                this.handleEventProxy(eventType, ...args);
            };

            // Store unique attribute
            if (!service.attributes.includes(attributeName)) {
                service.attributes.push(attributeName);
            }
        });
    });
}

/**
 * Util
 */
export class YaiInputUtils extends YEH {
    constructor({ appConfig }) {
        const eventHandler = appConfig.eventHandler;
        const eventMappingService = {
            methods: {},
            attributes: [],
        };

        // Generate dynamic handlers BEFORE YEH gets initiated in super()
        createDynamicHandlers(eventHandler?.selector, eventMappingService);

        // Inject generated methods into config
        if (Object.keys(eventMappingService.methods).length > 0) {
            eventHandler.config.methods = {
                ...eventMappingService.methods,
                ...eventHandler?.config?.methods, // User methods override generated ones
            };
        }

        // EY: User overridable attributes ~ if not overridden, sets attributes auto generated
        // based on the eventHandler configuration. User config takes precedence.
        if (eventMappingService.attributes.length > 0 && !eventHandler?.config?.actionableAttributes) {
            eventHandler.config.actionableAttributes = [
                ...eventMappingService.attributes,
                ...(eventHandler?.config?.addActionableAttributes || []), // just add custom attributes
            ];
        }

        super(
            { ...eventHandler?.selector },
            { ...eventHandler?.aliases },
            { ...eventHandler?.config }
        );

        this.appConfig = {
            emitEvents: false,
            emitHooks: false,
            emitPrefix: 'event',
            ...appConfig,
        };

        this.templateCache = new Map();
        this.templates = appConfig.templates;

        this.init();
    }

    init() {
        this.initHandler();
    }

    // DRY proxy handler
    handleEventProxy(handling, event, target, container) {
        if (!target) return;

        // Allow global events (on body, document, window) to fire hooks without data attributes
        const isGlobalEvent = container === document.body ||
                             container === document.documentElement ||
                             container === document ||
                             container === window;

        // For non-global events, require dataset (HTMLElements only)
        if (!isGlobalEvent && !target.dataset) return;

        const action = target.dataset?.[handling];

        // action = data-eventType="action" || data-click="actionHandler"
        if (action || isGlobalEvent) {
            // Event passed all tests
            this.handleWiredEvents(`${handling}before`, target, event, container);

            if (action) {
                // Attributables, useful shorties (only for HTMLElements with dataset)
                const { preventDefault, stopPropagation, blur } = target.dataset || {};

                if (typeof blur !== 'undefined') target.blur();
                if (typeof preventDefault !== 'undefined') event.preventDefault();
                if (typeof stopPropagation !== 'undefined') event.stopPropagation();

                if (this[action]) {
                    this[action](target, event, container);
                } else {
                    const resolvedAction = this.resolveHandler(action, event.type);
                    if (resolvedAction) {
                        resolvedAction(target, event, container);
                    }
                }
            }

            if (['input', 'change'].includes(handling)) {
                if (target.minLength > 0 || target.maxLength > 0) {
                    this.inputCounter(target, target.parentNode);
                }
                this.preValidation(target);
            }

            this.handleWiredEvents(`${handling}`, target, event, container);
        }
    }

    handleWiredEvents(eventName, target, event, container) {
        let emitPrefix = this.appConfig.emitPrefix;
        if (typeof emitPrefix !== 'string') return;

        emitPrefix = emitPrefix?.trim() || 'event';

        if (this.appConfig.emitEvents) this.emit(`${emitPrefix}${eventName}`, { target, event, container });
        if (this.appConfig.emitHooks) this._executeHook(`${emitPrefix}${eventName}`, { target, event, container }, this);
    }

    getTemplate(utilName) {
        if (this.templateCache.has(utilName)) {
            return this.templateCache.get(utilName);
        }
        if (!this.templates?.content) {
            throw new Error('Failed to load templates');
        }
        const template = this.templates.content.querySelector(`
            [data-wrapper="${utilName}"],
            [data-util="${utilName}"]
        `);
        if (template) {
            this.templateCache.set(utilName, template);
        }
        return template;
    }

    initHandler() {
        document.querySelectorAll('input, select, textarea').forEach((input, index) => {
            const useWrapper = input.dataset.wrapper;
            const requestedUtils = input.dataset.yaiUtil;
            const labelText = input.dataset.label;

            if (useWrapper) {
                const wrapperTemplate = this.getTemplate(useWrapper);
                if (!wrapperTemplate) return;

                // Auto-generate ID if not set
                if (!input.id) {
                    input.id = `yai-input--${index}`;
                }

                // Clone wrapper and inject input
                const wrapper = wrapperTemplate.cloneNode(true);
                const utilBody = wrapper.querySelector('.yai-util-body');

                if (!utilBody) {
                    throw new Error(`No .yai-util-body found in wrapper for input #${input.id}`);
                }

                input.parentNode.insertBefore(wrapper, input);
                utilBody.appendChild(input);

                if (input.required) {
                    wrapper.classList.add('has-required-input');
                }

                // Add label from <template> if requested
                if (labelText) {
                    const labelWrapperName = input.dataset.labelWrapper || 'label';
                    const labelTemplate = this.getTemplate(labelWrapperName);
                    if (labelTemplate) {
                        const labelEl = labelTemplate.cloneNode(true);
                        const label =
                            labelEl.tagName === 'LABEL'
                                ? labelEl
                                : labelEl.querySelector('label');
                        if (label) {
                            label.textContent = labelText;
                            label.setAttribute('for', input.id);

                            if (input.required) {
                                const getRequiredMarker = this.getTemplate('requiredIndicator');
                                if (getRequiredMarker) {
                                    label.appendChild(getRequiredMarker.cloneNode(true));
                                }
                            }
                        }
                        utilBody.insertBefore(labelEl, input);
                    }
                }

                // Add requested utils
                if (requestedUtils) {
                    requestedUtils.split(' ').forEach((utilName) => {
                        const util = this.getTemplate(utilName);
                        if (util) utilBody.appendChild(util.cloneNode(true));
                    });
                }

                // Auto-enhancements
                this.autoEnhance(input, utilBody);

                this.preValidation(input);
            }
        });
    }

    autoEnhance(input, container) {
        if (input.type === 'text' || input.type === 'password' || input.tagName === 'TEXTAREA') {
            // Auto counter for text inputs with length constraints
            if (input.minLength > 0 || input.maxLength > 0) {
                const counter = this.getTemplate("counter");
                if (counter) {
                    container.appendChild(counter.cloneNode(true));
                    // Initialize counter
                    this.inputCounter(input, container);
                }
            }
        }
    }

    togglePassword(target) {
        const passwordWrapper = target.closest('.yai-util-body') || target.parentNode;
        if (!passwordWrapper) return;

        const input = passwordWrapper.querySelector('input[type="password"], input[type="text"]');
        if (!input) return;

        const isPassword = input.type === 'password';

        input.type = isPassword ? 'text' : 'password';
        if (!target.hasAttribute('data-default-content')) {
            target.setAttribute('data-default-content', target.textContent.trim());
        }

        input.classList.toggle('password-revealed', !!isPassword);

        target.textContent = isPassword ? target.dataset.toggleContent : target.dataset.defaultContent;

        if (typeof target.dataset.autoFocus !== "undefined") input.focus();
    }

    clearInput(target) {
        const passwordWrapper = target.parentNode;
        if (!passwordWrapper) return;

        const input = passwordWrapper.querySelector('input[type], select, textarea');
        if (!input) return;

        input.value = '';

        this.inputCounter(input, passwordWrapper);

        if (typeof target.dataset.autoFocus !== "undefined") input.focus();
    }

    inputCounter(input, container) {
        if (input.minLength > 0 || input.maxLength > 0) {
            const counter = container?.querySelector('[data-role="counter"]');
            if (counter) {
                const current = input.value.length;
                counter.textContent = input.maxLength > 0 ? `${current}/${input.maxLength}` : current;
            }
        }
    }

    preValidation(input, config) {
        const currentValue = input.value;
        const marker = config?.mark || input;
        const wrapper = marker.parentNode;

        // Clear existing error classes
        marker.classList.remove('yai-error-minlength', 'yai-error-maxLength', 'yai-error-required', 'yai-error');

        // Check min length
        if (input.minLength > 0) {
            const isMinLengthError = currentValue.length < parseInt(input.minLength, 10);
            if (isMinLengthError) {
                marker.classList.add('yai-error-minlength');
            }
        }

        // Check max length
        if (input.maxLength > 0) {
            const isMaxLengthError = currentValue.length > parseInt(input.maxLength, 10);
            if (isMaxLengthError) {
                marker.classList.add('yai-error-maxLength');
            }
        }

        // Check required field
        if (input.required) {
            const isRequiredError = currentValue.trim() === '';

            if (isRequiredError) {
                marker.classList.add('yai-error-required');
            }
        }

        // Check if any validation errors exist
        const hasError = marker.classList.contains('yai-error-minlength') ||
                         marker.classList.contains('yai-error-maxLength') ||
                         marker.classList.contains('yai-error-required');

        if (hasError) {
            marker.classList.add('yai-error');
            marker.setAttribute('aria-invalid', 'true');

            // Add error message, if setted via data-error-message
            if (marker.dataset.errorMessage) {
                let errorElement = wrapper.querySelector('[data-wrapper="error-message"]');

                if (!errorElement) {
                    errorElement = this.getTemplate("error-message");
                    if (errorElement) wrapper.append(errorElement);
                }

                if (errorElement) {
                    errorElement.textContent = marker.dataset.errorMessage;
                }
            }
        } else {
            marker.removeAttribute('aria-invalid');
            const getErrorMessage = wrapper.querySelector('[data-wrapper="error-message"]');
            if (getErrorMessage) getErrorMessage.remove();
        }
    }

    scrollToTop() {
        window.scrollTo({ top: 0 });
    }

    static hasActiveInput() {
        const activeElement = document.activeElement;
        const formInputs = ['INPUT', 'TEXTAREA', 'SELECT'];

        return activeElement && (
            formInputs.includes(activeElement.tagName) ||
            activeElement.isContentEditable
        );
    }
}
