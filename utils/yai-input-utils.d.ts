import { YEH } from '../yeh/yeh.js';

/**
 * Event handler configuration for YaiInputUtils
 */
export interface EventHandlerConfig {
  /** Event selector mapping: { '#app': ['click', 'input'] } */
  selector?: Record<string, (string | EventConfig)[]>;
  /** Event aliases: { click: { save: 'handleSave' } } */
  aliases?: Record<string, Record<string, string>>;
  /** YEH configuration options */
  config?: {
    /** External method map organized by event type */
    methods?: Record<string, Record<string, Function>>;
    /** Check methods object before class methods */
    methodsFirst?: boolean;
    /** Actionable data attributes (e.g., ['data-click', 'data-input']) */
    actionableAttributes?: string[];
    /** Additional actionable attributes to append */
    addActionableAttributes?: string[];
    /** Enable automatic target resolution for nested elements */
    autoTargetResolution?: boolean;
    /** Enable performance statistics */
    enableStats?: boolean;
    /** Enable global fallback to window functions */
    enableGlobalFallback?: boolean;
    /** Override default passive events */
    passiveEvents?: string[];
    /** Enable AbortController support */
    abortController?: boolean;
    /** Enable DOM distance caching */
    enableDistanceCache?: boolean;
  };
}

/**
 * Event configuration with options
 */
export interface EventConfig {
  /** Event type (e.g., 'click', 'input') */
  type: string;
  /** Debounce delay in milliseconds */
  debounce?: number;
  /** Throttle delay in milliseconds */
  throttle?: number;
  /** Automatically call preventDefault */
  preventDefault?: boolean;
}

/**
 * Application configuration for YaiInputUtils
 */
export interface YaiInputUtilsConfig {
  /** Event handler configuration */
  eventHandler?: EventHandlerConfig;
  /** Emit custom events to document */
  emitEvents?: boolean;
  /** Execute hooks on events */
  emitHooks?: boolean;
  /** Prefix for emitted events/hooks (default: 'event') */
  emitPrefix?: string;
  /** Template element containing HTML templates */
  templates?: HTMLTemplateElement;
}

/**
 * Constructor options for YaiInputUtils
 */
export interface YaiInputUtilsOptions {
  /** Application configuration */
  appConfig: YaiInputUtilsConfig;
}

/**
 * Validation configuration
 */
export interface ValidationConfig {
  /** Element to mark with error classes (defaults to input itself) */
  mark?: HTMLElement;
}

/**
 * YaiInputUtils - Form input enhancement utility extending YEH
 *
 * Provides automatic form enhancement with:
 * - Dynamic event handler generation from config
 * - Template-based wrapper and label injection
 * - Automatic validation with error classes
 * - Password toggle, input counter, and clear utilities
 * - Event-driven architecture with before/after hooks
 *
 * @example
 * ```javascript
 * const formUtils = new YaiInputUtils({
 *   appConfig: {
 *     eventHandler: {
 *       selector: {
 *         '#form': ['click', { type: 'input', debounce: 300 }]
 *       },
 *       config: {
 *         methods: {
 *           click: {
 *             handleClick: function(event, target, container) {
 *               // Custom click handler
 *             }
 *           }
 *         },
 *         methodsFirst: true
 *       }
 *     },
 *     templates: document.getElementById('templates'),
 *     emitHooks: true
 *   }
 * });
 * ```
 */
export class YaiInputUtils extends YEH {
  /** Application configuration */
  appConfig: {
    emitEvents: boolean;
    emitHooks: boolean;
    emitPrefix: string;
  } & YaiInputUtilsConfig;

  /** Template cache for performance */
  templateCache: Map<string, HTMLElement>;

  /** Template element containing HTML templates */
  templates: HTMLTemplateElement;

  /**
   * Creates a new YaiInputUtils instance
   *
   * @param options - Configuration options
   *
   * @example
   * ```javascript
   * new YaiInputUtils({
   *   appConfig: {
   *     eventHandler: {
   *       selector: { '#app': ['click', 'input'] }
   *     },
   *     templates: document.getElementById('templates')
   *   }
   * });
   * ```
   */
  constructor(options: YaiInputUtilsOptions);

  /**
   * Initialize the utility
   * Called automatically by constructor
   */
  init(): void;

  /**
   * Proxy handler for all events
   * Routes events to appropriate handlers based on data attributes
   *
   * **Global Event Support:**
   * For events attached to body/document/documentElement/window, hooks fire without
   * requiring data attributes. This allows global event handling (keyboard shortcuts,
   * scroll/load events, document-level interactions) while maintaining strict
   * data-attribute requirements for element-specific events.
   *
   * @param handling - Event type being handled (e.g., 'click', 'input')
   * @param event - DOM event object
   * @param target - Event target (element, document, or window)
   * @param container - Container where listener is attached
   *
   * @example
   * ```javascript
   * // Element-specific events - require data attributes
   * eventHandler: {
   *   selector: {
   *     '#app': ['click'] // Requires data-click="action" on elements
   *   }
   * }
   * ```
   *
   * @example
   * ```javascript
   * // Global events on body - hooks fire without data attributes
   * eventHandler: {
   *   selector: {
   *     'body': ['keydown'] // Fires hooks for all keydown events
   *   }
   * }
   *
   * inputUtils.hook('eventkeydown', (event) => {
   *   if (YaiInputUtils.hasActiveInput()) return;
   *   // Handle global keyboard shortcuts
   * });
   * ```
   *
   * @example
   * ```javascript
   * // Global events on document/window - for scroll, load, etc.
   * eventHandler: {
   *   selector: {
   *     document: [
   *       { type: 'scroll', throttle: 240 },
   *       { type: 'load', options: { once: true } }
   *     ]
   *   }
   * }
   *
   * inputUtils.hook('eventscroll', (event) => {
   *   console.log('Document scrolled', window.scrollY);
   * });
   *
   * inputUtils.hook('eventload', (event) => {
   *   console.log('Document loaded');
   * });
   * ```
   */
  handleEventProxy(handling: string, event: Event, target: EventTarget, container: EventTarget): void;

  /**
   * Handle wired events (emit/hooks)
   * Executes before/after hooks for event lifecycle
   *
   * @param eventName - Event name (e.g., 'clickbefore', 'click')
   * @param target - Event target element
   * @param event - DOM event object
   * @param container - Container element where listener is attached
   */
  handleWiredEvents(eventName: string, target: EventTarget, event: Event, container: EventTarget): void;

  /**
   * Get template from cache or DOM
   *
   * @param utilName - Template identifier (data-wrapper or data-util value)
   * @returns Template element or null if not found
   * @throws Error if templates element is not provided
   */
  getTemplate(utilName: string): HTMLElement | null;

  /**
   * Initialize all input elements with enhancements
   * Wraps inputs, adds labels, counters, and validation
   * Called automatically during initialization
   */
  initHandler(): void;

  /**
   * Auto-enhance input with utilities
   * Adds counter for inputs with length constraints
   *
   * @param input - Input element to enhance
   * @param container - Container element for utilities
   */
  autoEnhance(input: HTMLInputElement | HTMLTextAreaElement, container: HTMLElement): void;

  /**
   * Scroll window to top
   * Utility method for form submission/navigation
   */
  scrollToTop(): void;

  /**
   * Toggle password visibility
   * Switches between password and text input types
   *
   * @param target - Toggle button element
   *
   * @example
   * ```html
   * <button data-click="togglePassword"
   *         data-toggle-content="Hide Password"
   *         data-auto-focus>
   *   Show Password
   * </button>
   * ```
   */
  togglePassword(target: HTMLElement): void;

  /**
   * Clear input value
   * Empties the input field and optionally focuses it
   *
   * @param target - Clear button element
   *
   * @example
   * ```html
   * <button data-click="clearInput" data-auto-focus>Clear</button>
   * ```
   */
  clearInput(target: HTMLElement): void;

  /**
   * Update input character counter
   * Shows current/max length for inputs with length constraints
   *
   * @param input - Input element
   * @param container - Container element with [data-role="counter"]
   *
   * @example
   * ```html
   * <input type="text" maxlength="100" />
   * <span data-role="counter"></span> <!-- Auto-updated: "45/100" -->
   * ```
   */
  inputCounter(input: HTMLInputElement | HTMLTextAreaElement, container: HTMLElement): void;

  /**
   * Validate input and apply error classes
   * Checks minLength, maxLength, and required constraints
   *
   * @param input - Input element to validate
   * @param config - Validation configuration
   *
   * @example
   * ```javascript
   * // Auto-applied classes:
   * // .yai-error-minlength - Value too short
   * // .yai-error-maxLength - Value too long
   * // .yai-error-required - Required field empty
   * // .yai-error - Any validation error present
   * ```
   */
  preValidation(input: HTMLInputElement | HTMLTextAreaElement, config?: ValidationConfig): void;

  /**
   * Check if a form input or contenteditable element is currently focused
   * Useful for preventing keyboard shortcuts while user is typing
   *
   * @returns True if INPUT, TEXTAREA, SELECT, or contenteditable element is focused
   * @static
   *
   * @example
   * ```javascript
   * // Prevent keyboard shortcuts while typing in forms
   * handleKeydown(event, target) {
   *   // Don't trigger shortcuts while user is editing
   *   if (YaiInputUtils.hasActiveInput()) return;
   *
   *   if (event.key === 's' && event.ctrlKey) {
   *     event.preventDefault();
   *     this.save();
   *   }
   * }
   * ```
   *
   * @example
   * ```javascript
   * // ESC key: blur input or close modal
   * handleKeydown(event, target) {
   *   if (event.key === 'Escape') {
   *     if (YaiInputUtils.hasActiveInput()) {
   *       // User is editing - just blur the input
   *       document.activeElement.blur();
   *     } else {
   *       // User not editing - close modal
   *       this.closeModal();
   *     }
   *   }
   * }
   * ```
   *
   * @example
   * ```javascript
   * // Arrow key navigation (skip when typing)
   * handleKeydown(event, target) {
   *   if (YaiInputUtils.hasActiveInput()) return;
   *
   *   if (event.key === 'ArrowDown') {
   *     this.selectNextItem();
   *   } else if (event.key === 'ArrowUp') {
   *     this.selectPreviousItem();
   *   }
   * }
   * ```
   */
  static hasActiveInput(): boolean;
}
