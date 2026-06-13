# **Pattern: DOM-to-WebWorker Event Bridge**

Event driven data flow architecture bridging DOM events to WebWorker computations:

**Event Chain:**

```
DOM input → handleInput() → worker.postMessage() →
  WebWorker computation → worker.onmessage →
    this.dispatch('worker-result') → displayResult()
```

**Key Innovation:** Seamless DOM-to-WebWorker-to-DOM event bridging through YEH's custom event system. Heavy computations never block the UI.

[Live example on JSFiddle](https://jsfiddle.net/j1u4rzno/).

```html
<h1>DOM-to-WebWorker Event Bridge</h1>
<p>Type in the input to trigger heavy computation in WebWorker:</p>
<input type="text" name="test-placeholder" placeholder="Type anything...">
<span id="is-working"></span>
<div id="output"></div>
<p><a href="https://yaijs.github.io/yai/docs/yeh/">YEH on Github</a></p>

<script type="module">
import { YEH } from 'https://cdn.jsdelivr.net/npm/@yaijs/core@1.1.6/yeh/yeh.min.js';

/**
 * Bridge DOM events to WebWorkers via custom events
 */
class WebWorkerBridge extends YEH {
  constructor() {
    super({ body: [{ type: 'input', handler: 'handleInput' }] });
    this.pendingRequests = 0;

    // Create worker using Blob URL (CSP-safe)
    const blob = new Blob(
      [
        `
            self.onmessage = function(e) {
                // Actually heavy: find primes up to 2 million
                const start = performance.now();
                const primes = [];
                for (let i = 2; i <= 2000000; i++) {
                    let isPrime = true;
                    for (let j = 2; j <= Math.sqrt(i); j++) {
                        if (i % j === 0) { isPrime = false; break; }
                    }
                    if (isPrime) primes.push(i);
                }
                const end = performance.now();

                self.postMessage({
                    type: 'computation-done',
                    result: {
                        primeCount: primes.length,
                        largestPrime: primes[primes.length - 1],
                        duration: (end - start).toFixed(2)
                    },
                    input: e.data
                });
            };
        `,
      ],
      { type: 'application/javascript' },
    );

    this.workerUrl = URL.createObjectURL(blob);
    this.worker = new Worker(this.workerUrl);

    this.worker.onmessage = (e) => {
      this.dispatch('worker-result', e.data);
    };
  }

  handleInput(event, target) {
    this.pendingRequests++;

    if (this.pendingRequests > 1) {
        this.updateOutput('⏳ Still computing previous request...', true);
    } else {
        this.updateOutput('⏳ Computing...', true);
    }

    this.worker.postMessage(target.value);
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate();
      if (this.workerUrl) URL.revokeObjectURL(this.workerUrl);
    }
    super.destroy();
  }

  updateOutput(message, isLoading = false) {
    const loader = document.getElementById('is-working');
    const output = document.getElementById('output');

    if (isLoading) {
        loader.textContent = message;
        return;
    }

    // Add result to history
    const div = document.createElement('div');
    div.className = 'result';
    div.textContent = message;
    output.appendChild(div);

    // Keep only last 10 results
    while (output.children.length > 10) {
      output.removeChild(output.firstChild);
    }

    if (this.pendingRequests === 0 && loader) {
        loader.textContent = '';
    }
  }
}

/**
 * Extend to handle worker results
 */
class WorkerResultHandler extends WebWorkerBridge {
  constructor() {
    super();
    this.addEvent('document', {
      type: 'worker-result',
      handler: 'displayResult',
    });
  }

  displayResult(event) {
    const { result, input } = event.detail;
    this.pendingRequests = Math.max(0, this.pendingRequests - 1);

    const message = `🧠 Found ${result.primeCount.toLocaleString()} primes up to 2,000,000 (largest: ${result.largestPrime.toLocaleString()}) in ${result.duration}ms — input: "${input}"`;
    console.log(message);

    this.updateOutput(message);
  }
}

const app = new WorkerResultHandler();
// Call app.destroy() when done
</script>
```
