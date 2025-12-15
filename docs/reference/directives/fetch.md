### *fetch

#### Summary

`*fetch` loads JSON from a URL and writes it into Sercrod host data.
The JSON response can either replace the entire root data object or be merged into a specific property path.
`*fetch` has an alias `n-fetch`.

On a Sercrod host element (`<serc-rod>`), `*fetch` is typically used for initial data loading.
On normal elements (such as `<button>` or `<div>`), it can be used for explicit reload buttons or one-time auto fetches.

Key points:

- URL spec is a plain string `URL[:prop]` (no expression evaluation).
- `prop` is optional. If omitted, the entire data root is replaced by the fetched JSON.
- If `prop` is present, that path inside `data` is updated instead.
- For non-clickable elements, `*fetch` auto-runs once per URL (with a special rule for `ts=` query parameters).
- For clickable elements, `*fetch` runs on click only.
- On the host `<serc-rod>`, `*fetch` runs during `connectedCallback` before the first render.


#### Basic example

Initial data load into a host:

```html
<serc-rod id="app" *fetch="/api/items.json:items">
  <h1>Items</h1>
  <ul *each="item of items">
    <li *print="item.name"></li>
  </ul>
</serc-rod>
```

Behavior:

- When the Sercrod host is connected, it calls `fetch("/api/items.json")`.
- The JSON response is written into `data.items`.
- After the fetch completes, Sercrod performs the first render and the list shows the loaded items.


#### URL spec format

The `*fetch` attribute value is interpreted as a simple string in the following format:

- `URL`
- `URL:prop`
- `URL:base[key]`

Parsing rules:

- The runtime splits the spec with `spec.split(":")` and uses:

  - `file`: the first part before the first `:`.
  - `prop`: the second part after the first `:` (if any).

- `file` is passed directly to `fetch(file)`.

- `prop` controls where the JSON is stored:

  - No `prop`: the entire root `data` is replaced with the JSON.
  - `prop` without brackets:

    - Example: `"/api/items.json:items"`  
      The JSON response becomes `data.items`.

  - `prop` with brackets:

    - Example: `"/api/users.json:users[current]"`  
      The JSON response becomes `data.users[current]`.

    - Internally, the runtime uses a simple pattern:

      - It matches `(.+?)\[(.+)\]` to split `base` and `key`.
      - It ensures `data[base]` is an object and writes `data[base][key] = json`.

Important implications:

- Only the first `:` in the spec is treated as the separator between `file` and `prop`.
- If your URL itself contains `:`, the part before the first `:` is used as `file` and the rest is treated as `prop`.
  In practice, you should use relative paths or encoded URLs to avoid ambiguous `:` characters.


#### Behavior

Core behavior:

- `*fetch` always performs an HTTP GET using the global `fetch()` API:

  - `fetch(file).then(r => r.json())`

- The response is expected to be valid JSON.
  If `r.json()` fails, the error is routed to an error event (see “Events” below).

Data writing rules:

- When `prop` is present:

  - If `prop` matches `base[key]`:

    - Ensure `data[base]` exists and is an object.
    - Write `data[base][key] = json`.

  - Otherwise:

    - Write `data[prop] = json`.

- When `prop` is absent:

  - The entire root data object is replaced.
  - The new root is wrapped with Sercrod’s internal proxy wrapper to keep observation consistent.

  Conceptually:

  - `data = json` becomes `data = wrap(json)`.

Update:

- After a successful fetch, Sercrod schedules `update()` on the host using `requestAnimationFrame`.
- The template is re-rendered against the updated data.

Errors:

- On fetch or JSON parse failure, Sercrod does not modify data.
- Instead, it emits a `sercrod-load-error` event (see “Events”).
- `update()` is not automatically called by `*fetch` in the error path.


#### Host vs normal elements

`*fetch` behaves differently depending on whether it is placed on the Sercrod host or on a normal element.

1. On the Sercrod host (`<serc-rod>`):

   - Handled inside `connectedCallback`.
   - Sequence:

     - The host parses `data`.
     - If the parent host is currently loading (for example from its own `*fetch`), the child host waits.
     - If the host has `*fetch` or `n-fetch`:

       - `this._loading` is set to `true`.
       - The spec is read from the attribute.
       - Warnings are temporarily suppressed for the duration of `_do_load`.
       - `_do_load(spec)` is called.

     - On success:

       - Data is updated according to the rules above.
       - `this._loading` is set to `false`.
       - `requestAnimationFrame(() => this.update())` is called.

     - If the host does not have `*fetch`:

       - The host calls `update()` normally.

   Implications:

   - When `*fetch` is on the host, the first Sercrod render happens after the fetch completes.
   - Child hosts can check `parent._loading` and delay their own initialization until the parent is done.

2. On normal elements (button, link, div, etc.):

   - Handled inside the element rendering pipeline.
   - Sercrod clones the element, sets up `*fetch` behavior, appends the clone, and renders its children.

   Clickable vs non-clickable:

   - Clickable elements:

     - Recognized as clickable if:

       - `tagName` is `BUTTON`, or
       - `tagName` is `A` without `download`, or
       - `tagName` is `INPUT` with `type` in `button`, `submit`, `reset`, `image`.

     - For clickable elements:

       - No automatic fetch is performed.
       - A click listener is attached, calling `_do_load(spec)` on each click.

   - Non-clickable elements:

     - For non-clickable tags (such as `div`, `section`, `span`, etc.):

       - `*fetch` is auto-triggered once after initial render.
       - A “once key” is derived from the spec to prevent repeated automatic fetches.

       - If this once key has not been seen before, Sercrod:

         - Records it in an internal set for this host.
         - Schedules `_do_load(spec)` with `requestAnimationFrame`.

   Children:

   - In both cases, after cloning and setting up `*fetch`, Sercrod renders the element’s children normally.
   - Child directives (`*print`, `*if`, `*each`, etc.) can immediately read from existing data.
   - After the fetch completes, the host rerender updates those children with the new data.


#### Once-key and the `ts` parameter

For non-clickable elements, `*fetch` auto-runs “at most once per URL spec” by using an internal once key.

The once key is derived as follows:

- Sercrod tries to parse the spec as a URL relative to `location.href`.
- If that succeeds:

  - It removes the `ts` query parameter from the URL.
  - It uses `pathname` plus the remaining query string to form the once key.

- If parsing fails:

  - It removes any `ts` parameter with a regular expression.
  - It also strips trailing `?` or `&` characters.

Implications:

- Adding a `ts` query parameter is treated as a cache-busting trick that does not affect the once key.
- Re-rendering with the same `*fetch` spec will not auto-run the fetch again for non-clickable elements.
- To re-run fetch automatically, you must either:

  - Change the spec in a way that changes the once key, or
  - Use a clickable element and let the user trigger fetch explicitly.


#### Events

`*fetch` communicates its progress via DOM events on the host:

- Before fetch starts:

  - `sercrod-load-start`

    - `detail`:

      - `stage`: `"fetch"`
      - `host`: the Sercrod host instance
      - `spec`: the full spec string
      - `file`: the URL part (`file`)
      - `prop`: the property spec (if any)

- After a successful fetch, before `update()`:

  - `sercrod-loaded`

    - `detail`:

      - `stage`: `"fetch"`
      - `host`: the Sercrod host instance
      - `spec`: the full spec string
      - `file`: the URL part
      - `prop`: the property spec (if any)
      - `json`: the parsed JSON value
      - `paths`: an array of logical data paths that were touched

        - Either `["$root"]` when the root was replaced, or
        - A list such as `["items"]` or `["users[current]"]` when merging into a property.

- On error:

  - `sercrod-load-error`

    - `detail`:

      - `stage`: `"fetch"`
      - `host`: the Sercrod host instance
      - `spec`: the full spec string
      - `file`: the URL part
      - `prop`: the property spec (if any)
      - `error`: the error message string

Notes:

- These events bubble and are composed.
- They allow external code to observe loading, success, and failure, and to implement custom UI such as progress indicators or retry buttons.

`*fetch` does not set or use `$pending`, `$error`, `$download`, or `$upload` in data. Those state helpers are used by `*api` and `*post`, not by `*fetch`.


#### Interaction with *api, *post, and *into

`*fetch`, `*post`, and `*api` are all “request” directives that write into host data, but they differ in capabilities:

- `*fetch`:

  - Simple GET-only helper.
  - Takes a static `URL[:prop]` string.
  - Writes JSON into data or a property path.
  - Does not use `*into` or `$pending` / `$error` / `$download` / `$upload`.

- `*post`:

  - Sends JSON built from host data via POST.
  - Uses a similar `URL[:prop]` spec to map the JSON response back into data.
  - Integrates with `$pending`, `$error`, `$upload`, `$download`.

- `*api`:

  - General-purpose API helper.
  - Supports method, headers, file uploads, `*into`, and once rules at the API level.

Ordering and combinations:

- Inside the element rendering pipeline:

  - `*post` is processed before `*fetch`.
  - `*fetch` is processed before `*api`.

- Each of these directives claims the element and returns early after setting up behavior, so only the first matching directive on a given element executes.

Recommendations:

- Do not combine `*fetch` with `*post` or `*api` on the same element.
  Only the first one in the internal order will take effect, and the rest will be ignored.
- Use separate elements if you need multiple request types (for example, a `*fetch` for initial data and a `*post` button for submitting changes).

`*into` is reserved for `*api` and is not used by `*fetch`.


#### Use with conditionals and loops

`*fetch` is not a structural directive by itself, so it composes with structural directives as long as they are applied at different levels.

Typical patterns:

- Conditional host fetch:

  - For a host, `*fetch` runs from `connectedCallback`.
    You normally do not wrap the host itself with `*if`.

- Conditional child fetch:

  ```html
  <serc-rod id="app" data='{"ready": false, "items": []}'>
    <button
      *if="ready"
      *fetch="/api/items.json:items"
    >
      Load items
    </button>
  </serc-rod>
  ```

  - `*if` is processed before `*fetch`.
  - If `ready` is false, the button (and its `*fetch`) is not rendered.

- Fetch inside loops:

  - You can place `*fetch` on elements inside `*for` or `*each` bodies, but you should be cautious:

    - Each rendered element with `*fetch` may set up its own auto fetch or click handler.
    - Non-clickable `*fetch` inside a loop can trigger many automatic requests, once per iteration.

  ```html
  <ul *each="user of users">
    <li>
      <span *print="user.name"></span>
      <button *fetch="'/api/user/' + user.id + '.json:details'">
        Load details
      </button>
    </li>
  </ul>
  ```

  - Note that the spec for `*fetch` is still a literal string in the current implementation; the example above illustrates intent, but the runtime does not evaluate expressions in the spec. For dynamic URLs, prefer `*api` which expands text with `%expr%` placeholders.


#### Server-side contract and recommended API shape

Because `*post`, `*fetch`, and `*api` all treat HTTP communication as “JSON in, JSON out” and share the same state flags, it is natural to standardize server-side handlers around this contract.

Recommended approach on the server:

- Treat Sercrod-driven endpoints as JSON endpoints:

  - Always accept a JSON request body for write operations.
  - Always return a JSON response for both success and application-level errors.
  - Use a stable envelope shape so that `URL[:prop]` and `*into` can be wired consistently.

- Reuse the same processing pipeline:

  - Parse JSON.
  - Run validation, authentication, business logic, and logging in a shared middleware.
  - Produce a JSON object that Sercrod can store as-is into `data[prop]`, `data[base][key]`, or a target selected by `*into`.

Benefits for server-side code:

- You can implement a “Sercrod API style” once and reuse it across multiple endpoints.
- Monitoring and logging become easier because every Sercrod request and response has the same structure.
- Frontend and backend teams can agree on a single JSON contract instead of negotiating many small variations.

Position in Sercrod’s design:

- Sercrod does not force this server-side style, but the runtime is optimized around it:
  - `*post` and `*fetch` share the `URL[:prop]` rule and write values back without further transformation.
  - `*api` writes the raw response into the variable named by `*into`.
  - All of them update `$pending`, `$error`, `$download`, and `$upload` in a consistent way.
- For new projects that adopt Sercrod end to end, designing server APIs to follow this unified JSON contract is strongly recommended.
- For existing APIs, you can:
  - Use `*api` to integrate with legacy endpoints as they are.
  - Gradually introduce Sercrod-style JSON endpoints for new features and move existing endpoints toward the same contract when possible.


#### Best practices

- Use `*fetch` for simple JSON GETs:

  - When you only need to GET JSON and place it in a single property or replace the root, `*fetch` is the smallest tool.

- Keep the spec simple and relative:

  - Prefer relative URLs such as `"/api/items.json"` and use `:prop` for data placement.
  - Avoid unencoded `:` in the URL part, since `*fetch` uses `spec.split(":")`.

- Use props for partial updates:

  - Use `:prop` when you want to update a subset of data without replacing the root.
  - Use `base[key]` syntaxes such as `:users[current]` when you need keyed slots.

- Reserve `*fetch` on the host for initial data load:

  - Host-level `*fetch` is ideal for “page load → fetch → render once” behavior.
  - It keeps the initial render in sync with fetched data.

- Use clickable `*fetch` for explicit reloads:

  - Putting `*fetch` on a button or link gives users control over when to refresh data.
  - This avoids the implicit “auto-run once” behavior of non-clickable `*fetch`.

- Handle errors through events:

  - Attach listeners for `sercrod-load-error` when you need explicit error handling.
  - For more advanced error-state tracking inside data, consider using `*api` or `*post` instead.


#### Additional examples

Host-level full replacement:

```html
<serc-rod id="profile" *fetch="/api/profile.json">
  <h1 *print="name"></h1>
  <p *print="email"></p>
</serc-rod>
```

- The entire root data is replaced by the JSON from `/api/profile.json`.
- The template then uses `name` and `email` from the new root.

Host-level partial update:

```html
<serc-rod id="dashboard" data='{"stats": {}, "user": {}}' *fetch="/api/stats.json:stats">
  <h2>Dashboard</h2>
  <section>
    <p>Total users: <span *print="stats.totalUsers"></span></p>
    <p>Active users: <span *print="stats.activeUsers"></span></p>
  </section>
</serc-rod>
```

- Only `data.stats` is overwritten by the JSON response.
- Other properties such as `data.user` remain untouched.

Non-clickable auto fetch:

```html
<serc-rod id="news" data='{"articles": []}'>
  <section *fetch="/api/news.json:articles">
    <h2>Latest news</h2>
    <ul *each="article of articles">
      <li>
        <strong *print="article.title"></strong>
        <p *print="article.summary"></p>
      </li>
    </ul>
  </section>
</serc-rod>
```

- The `<section>` is not clickable, so `*fetch` auto-runs once per spec.
- After the fetch, `articles` is updated and the list is rendered.

Clickable reload button:

```html
<serc-rod id="log-viewer" data='{"log": []}'>
  <button *fetch="/api/log.json:log">
    Reload log
  </button>

  <ul *each="entry of log">
    <li *print="entry.message"></li>
  </ul>
</serc-rod>
```

- Each click triggers a fresh GET request for `/api/log.json`.
- The JSON response replaces `data.log`, and the list is updated.


#### Notes

- `*fetch` and `n-fetch` are aliases with identical behavior.
- The spec is treated as a raw string; `*fetch` does not evaluate expressions or expand `%expr%` placeholders.
- The directive expects JSON responses. Non-JSON responses cause `r.json()` to reject and result in `sercrod-load-error`.
- Root replacement via `*fetch` always re-wraps the new root data to maintain Sercrod’s internal observation and proxy invariants.
- When used on normal elements, `*fetch` sets up behavior on a cloned element and then returns early; no additional directives on the same element are evaluated after `*fetch` in the rendering pipeline.
- On hosts, only one `*fetch` per host is meaningful; additional fetches should be implemented via nested elements or separate buttons.
- For complex API use cases (headers, methods, payloads, file uploads, and rich state tracking), consider using `*api` and `*post` instead of `*fetch`.
