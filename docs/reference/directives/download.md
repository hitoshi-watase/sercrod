### *download / n-download

#### Summary

`*download` turns any element into an accessible download trigger. It evaluates an expression to a download specification, fetches the resource from the given URL, and starts a browser download using a Blob-backed Object URL.:contentReference[oaicite:0]{index=0}:contentReference[oaicite:1]{index=1}

`n-download` is a star-less alias for the same directive. Both forms share one implementation and one manual entry.:contentReference[oaicite:2]{index=2}:contentReference[oaicite:3]{index=3}


#### Basic example

Trigger a CSV export from a server endpoint:

  ```html
  <serc-rod>
    <button type="button" *download="'/api/report.csv'">
      Download report
    </button>
  </serc-rod>
  ```


#### Description

`*download` (and `n-download`) decorates an element so that activating it (mouse click, keyboard Enter/Space) downloads a file from a server endpoint. The directive:

- evaluates its expression once per render to a configuration object,
- normalizes that configuration to a standard `{ url, method, headers, credentials, filename, transport }` shape, and
- binds handlers that perform the network request and trigger a download via an invisible `<a download>` element.:contentReference[oaicite:4]{index=4}:contentReference[oaicite:5]{index=5}:contentReference[oaicite:6]{index=6}

It is purely side-effecting: it does not write into Sercrod data such as `$download` or `$upload`. Those slots are reserved for directives like `*api`, `*fetch`, and `*post`, and are cleared in `_finalize` independently of `*download`.:contentReference[oaicite:7]{index=7}


#### Behavior

At render time:

1. **Read and evaluate the expression**

   Sercrod reads the attribute value from `*download` or `n-download` on the original template element and evaluates it as a JavaScript expression in the current scope:

   - The evaluation runs via `eval_expr(expr, scope, { el: ctx_el, mode: "download" })`.
   - The `scope` is the effective scope after `*let` and other scope modifiers.
   - `ctx_el` is the template element that carried the directive.:contentReference[oaicite:8]{index=8}:contentReference[oaicite:9]{index=9}

2. **Normalize options**

   The result of the expression must be either:

   - a string, interpreted as `{ url: "<string>" }`, or
   - an object, which is normalized by `_normalize_download_opts`.:contentReference[oaicite:10]{index=10}

   Normalization guarantees at least:

   - `url` (required): download URL.
   - `method` (default `"GET"`).
   - `headers` (default `{}`).
   - `credentials` (default `false`).
   - `filename` (default `null`).
   - `transport` (default `"fetch"`, or `"xhr"` for the XHR fallback).:contentReference[oaicite:11]{index=11}

   If the normalized result has no `url`, `_normalize_download_opts` throws an error, which is caught and reported as a `sercrod-error` event with `stage: "download-init"`. The element stays in the DOM but no download handler is bound.:contentReference[oaicite:12]{index=12}:contentReference[oaicite:13]{index=13}

3. **Accessibility and event binding**

   When options are valid, Sercrod:

   - ensures the element is keyboard-accessible by setting `role="button"` and `tabIndex=0` when those attributes are missing, and:contentReference[oaicite:14]{index=14}
   - attaches a shared `on_click` handler to `click` and `keydown` (Enter/Space, non-repeating) events.:contentReference[oaicite:15]{index=15}

4. **Activation**

   When the element is activated:

   - The handler calls `e.preventDefault()`. On an `<a>` element this stops the normal navigation; the download is always driven by the Blob-based URL, not any static `href`.:contentReference[oaicite:16]{index=16}
   - Sercrod dispatches a `CustomEvent("sercrod-download-start", { detail:{ host, el, url }, bubbles:true, composed:true })` from the host.:contentReference[oaicite:17]{index=17}:contentReference[oaicite:18]{index=18}
   - It then performs the network request:

     - If `transport === "xhr"`, it calls `_xhr_download(opt)`:
       - Uses `XMLHttpRequest` with `responseType="blob"`.
       - Applies `opt.method || "GET"`, `opt.url`, `opt.headers`, and `opt.credentials`.:contentReference[oaicite:19]{index=19}
     - Otherwise, it uses `fetch(opt.url, { method, headers, credentials, cache:"no-cache" })`:
       - `method` defaults to `"GET"`.
       - `headers` defaults to `{}`.
       - `credentials` is `"include"` when `opt.credentials` is truthy, `"same-origin"` otherwise.
       - Non-2xx responses throw an error.:contentReference[oaicite:20]{index=20}:contentReference[oaicite:21]{index=21}

   - After a successful response, Sercrod:
     - converts it to a `Blob`,
     - creates an object URL via `URL.createObjectURL(blob)`,
     - creates a temporary `<a>` element, sets its `href` to the object URL and its `download` attribute to `opt.filename || "download"`,:contentReference[oaicite:22]{index=22}
     - programmatically clicks the `<a>`, then removes it and revokes the object URL.:contentReference[oaicite:23]{index=23}

   - Finally, Sercrod emits `CustomEvent("sercrod-downloaded", { detail:{ host, el, url, filename, status }, bubbles:true, composed:true })` on success, or `CustomEvent("sercrod-error", { detail:{ host, el, stage:"download", error }, ... })` on errors during the request.:contentReference[oaicite:24]{index=24}:contentReference[oaicite:25]{index=25}

Errors during option evaluation or normalization are surfaced as `sercrod-error` with `stage: "download-init"`, while errors during the actual network request use `stage: "download"`.:contentReference[oaicite:26]{index=26}


#### Download options

The directive expression must evaluate to either:

- **string** ? treated as `{ url: "<string>" }` with defaults:
  - `method: "GET"`, `headers: {}`, `credentials: false`, `filename: null`, `transport: "fetch"`.:contentReference[oaicite:27]{index=27}
- **object** ? merged into:

  - `url` (required, string)  
    Absolute or relative URL for the file.

  - `method` (string, default `"GET"`)  
    HTTP method used by `fetch` or XHR.

  - `headers` (object, default `{}`)  
    Additional request headers for both `fetch` and XHR.:contentReference[oaicite:28]{index=28}

  - `credentials` (boolean, default `false`)  
    For `fetch`, `true` maps to `credentials: "include"`, `false` to `"same-origin"`.  
    For XHR, `true` maps to `xhr.withCredentials = true`.:contentReference[oaicite:29]{index=29}:contentReference[oaicite:30]{index=30}

  - `filename` (string or null, default `null`)  
    File name used for the temporary `<a download="...">`. If omitted or `null`, `"download"` is used. Sercrod does not inspect `Content-Disposition`; the server cannot override this name.:contentReference[oaicite:31]{index=31}

  - `transport` (`"fetch"` | `"xhr"`, default `"fetch"`)  
    Selects the network implementation. `"fetch"` uses the Fetch API; `"xhr"` uses `_xhr_download` with `XMLHttpRequest`.:contentReference[oaicite:32]{index=32}:contentReference[oaicite:33]{index=33}

Any extra keys in the object are currently ignored by the `*download` implementation.


#### Evaluation timing

- The directive expression is evaluated **once per render** of the element, not on every click.
- The resulting options are closed over and reused by all activations until the host re-renders (for example, due to data changes).
- A new render creates new DOM nodes, re-evaluates the expression in the then-current scope, and rebinds `*download`.:contentReference[oaicite:34]{index=34}:contentReference[oaicite:35]{index=35}

If you need the URL or headers to reflect changing data, ensure that changes cause the host to call `update()` (usually via normal Sercrod data mutations), so the directive is re-evaluated.


#### Execution model

- Activating a `*download` element performs an asynchronous network request and a Blob-based download, but **does not** touch Sercrod data (`this._data`) anywhere in its implementation.:contentReference[oaicite:36]{index=36}
- There is no automatic call to `update()` after a download succeeds or fails; the DOM stays as it was unless your own event handlers modify data.:contentReference[oaicite:37]{index=37}
- The host’s `_finalize()` step clears `$upload`, `$download`, and any `*into` targets, but `*download` itself never populates those fields.:contentReference[oaicite:38]{index=38}

To react to downloads (for example, to set a “lastDownloadedAt” field), listen to the host events and update data in your own handlers.


#### Variable creation

`*download` does **not** create or modify any Sercrod variables. In particular:

- It does not set `$download` or `$upload`. Those are only written by directives like `*api`, `*fetch`, or `*post`.:contentReference[oaicite:39]{index=39}
- It does not create any new keys on `this._data`.

All state and progress information is exposed via DOM events, not via the data model.


#### Scope layering

The directive expression is evaluated with the same scope rules as other expression-based directives:

- Base scope is the host data (or staged data when `*stage` is active).
- Local variables introduced by `*let` and other scope modifiers around the element are layered on top.
- `$parent` is injected to refer to the nearest parent Sercrod host’s data.:contentReference[oaicite:40]{index=40}
- Methods exposed through `*methods` and internal Sercrod helpers are added if not already present.:contentReference[oaicite:41]{index=41}

This means a `*download` expression can freely use the same variables, helpers, and `$parent` access patterns as any other Sercrod expression.


#### Parent access

Inside a `*download` expression you can:

- read from `$parent` to reference data on an outer Sercrod host,
- use any values from enclosing `*let` scopes,
- call methods injected via `*methods`.

For example, in a nested host you might compute the URL from a parent configuration:

  ```html
  <serc-rod id="outer" data="{ apiBase: '/api' }">
    <serc-rod id="inner" data="{ reportId: 42 }">
      <button
        type="button"
        *download="{ url: $parent.apiBase + '/report/' + reportId + '.csv',
                    filename: 'report-' + reportId + '.csv' }">
        Download report
      </button>
    </serc-rod>
  </serc-rod>
  ```


#### Use with conditionals and loops

`*download` belongs to the group of “own-element” directives in `renderNode` that:

- clone the template element,
- attach specific behavior,
- render children into the clone,
- and then `return`, preventing any later branches from running on the same element.:contentReference[oaicite:42]{index=42}

In particular:

- `*upload`, `*download`, `*websocket`, and `*ws-send` are mutually exclusive on the **same** element; only the first matching branch in the implementation runs (currently `*upload`, then `*download`, then `*websocket`, then `*ws-send`).:contentReference[oaicite:43]{index=43}
- Do not rely on combining these directives on a single tag; treat such combinations as unsupported. Instead, use nested elements.

Example: combine `*for` and `*download` by putting `*for` on a parent and `*download` on a child:

  ```html
  <serc-rod data="{ files: [
    { name: 'a.csv', url: '/api/a.csv' },
    { name: 'b.csv', url: '/api/b.csv' }
  ] }">
    <ul>
      <li *for="file of files">
        <span *print="file.name"></span>
        <button
          type="button"
          *download="{ url: file.url, filename: file.name }">
          Download
        </button>
      </li>
    </ul>
  </serc-rod>
  ```

Similarly, you can gate the presence of a download button with `*if` on an ancestor:

  ```html
  <div *if="user.canDownload">
    <button
      type="button"
      *download="{ url: reportUrl, filename: 'report.csv' }">
      Download report
    </button>
  </div>
  ```


#### Best practices

- **Keep expressions simple**  
  Prefer moving complex option building into data or helper methods, and keep the `*download` expression small.

- **Always set a `filename`**  
  Since Sercrod does not inspect `Content-Disposition`, the browser will use `filename` or `"download"`. Setting it explicitly leads to more user-friendly downloads.:contentReference[oaicite:44]{index=44}

- **Use `transport: "xhr"` only when necessary**  
  Default to `fetch` unless you have a specific environment (for example, corporate proxies) where `XMLHttpRequest` is more reliable.:contentReference[oaicite:45]{index=45}

- **React via events, not data**  
  Listen for `sercrod-download-start`, `sercrod-downloaded`, and `sercrod-error` on the host to drive loading indicators, error banners, or logging.:contentReference[oaicite:46]{index=46}

- **Keyboard accessibility**  
  Sercrod adds `role="button"` and `tabIndex=0` when missing, but you should still write accessible text labels and, when appropriate, ARIA attributes.

- **Avoid mixing with other own-element directives**  
  Do not put `*download` on the same element as `*upload`, `*websocket`, or `*ws-send`. Use nested tags instead, so each directive has its own element.


#### Examples

##### 1. Simple config in data

Move configuration into data and reference it from the directive:

  ```html
  <serc-rod data="{
    downloadSpec: {
      url: '/api/report.csv',
      filename: 'report.csv'
    }
  }">
    <button type="button" *download="downloadSpec">
      Download CSV
    </button>
  </serc-rod>
  ```

##### 2. Secure download with credentials and headers

  ```html
  <serc-rod data="{
    reportUrl: '/api/secure/report',
    csrfToken: '...'
  }">
    <button
      type="button"
      *download="{
        url: reportUrl,
        method: 'POST',
        headers: { 'X-CSRF-Token': csrfToken },
        credentials: true,
        filename: 'secure-report.pdf'
      }">
      Download secure PDF
    </button>
  </serc-rod>
  ```

##### 3. XHR transport fallback

Use XHR when `fetch` is problematic in the target environment:

  ```html
  <serc-rod data="{ url: '/api/proxy/report.csv' }">
    <button
      type="button"
      *download="{ url, transport: 'xhr', filename: 'report.csv' }">
      Download via XHR
    </button>
  </serc-rod>
  ```

##### 4. Listening to download events

Use DOM events on the host to update your own state:

  ```html
  <serc-rod id="app" data="{ url: '/api/report.csv' }">
    <button type="button" *download="{ url, filename: 'report.csv' }">
      Download report
    </button>
  </serc-rod>

  <script>
    const host = document.getElementById('app');

    host.addEventListener('sercrod-download-start', (e) => {
      console.log('Download started:', e.detail.url);
    });

    host.addEventListener('sercrod-downloaded', (e) => {
      console.log('Download finished:', e.detail.filename, e.detail.status);
    });

    host.addEventListener('sercrod-error', (e) => {
      if (e.detail.stage === 'download' || e.detail.stage === 'download-init') {
        console.error('Download error:', e.detail.error);
      }
    });
  </script>
  ```


#### Notes

- `*download` and `n-download` are fully equivalent; they share the same implementation and manual entry. Use `n-download` when the star character is inconvenient in your environment.:contentReference[oaicite:47]{index=47}:contentReference[oaicite:48]{index=48}
- The directive is intended for elements **inside** a Sercrod host. There is currently no special handling for `*download` on the host element itself; host-level behavior is reserved for directives like `*fetch` and `*websocket`.:contentReference[oaicite:49]{index=49}
- When the expression or options are invalid (for example, missing `url`), Sercrod surfaces this via a `sercrod-error` event with `stage: "download-init"` and does not bind a click handler.:contentReference[oaicite:50]{index=50}:contentReference[oaicite:51]{index=51}
- During the download itself, network or HTTP errors are reported via `sercrod-error` with `stage: "download"`. In both cases, the element stays in the DOM; nothing is automatically removed.:contentReference[oaicite:52]{index=52}
- Because downloads are always performed via an in-memory `Blob`, very large files will consume browser memory before the save dialog appears. Consider whether direct links or server-side streaming are more appropriate for very large assets.
