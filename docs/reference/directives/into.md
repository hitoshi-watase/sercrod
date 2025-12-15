### *into

#### Summary

`*into` selects a data slot that receives the result of certain Sercrod directives that talk to the outside world.
It is most often used together with `*api`, `*upload`, or `*websocket` to capture responses in a named field on the root data object.

`*into` has an alias `n-into`. Both forms behave the same.

Key points:

- `*into` does not do anything by itself.
- It is only consulted by directives that explicitly read it (for example `*api`, `*upload`, `*websocket`).
- Responses are also mirrored into built-in fields such as `$download`, `$upload`, or `$ws_last`, so `*into` is an opt-in extra sink, not the only place where data goes.


#### Basic example

Capture an API response into `user`:

```html
<serc-rod id="app" data='{"user": null}'>
  <button
    *api="'/api/user.json'"
    method="GET"
    *into="user"
  >
    Load user
  </button>

  <pre *if="user" *print="JSON.stringify(user, null, 2)"></pre>
</serc-rod>
```

Behavior:

- Clicking the button performs an HTTP GET request to `/api/user.json`.
- When the request succeeds, the parsed response body is stored in:
  - `$download` (because it is a GET request)
  - `user` (because of `*into="user"`)
- On the next finalize step, `$download` and `user` are reset to `null`. If you want to keep the data, copy it to a long-lived field in your data.


#### Behavior

`*into` is a routing hint for Sercrod’s I/O helpers. It tells those helpers which top-level key on the root data object should receive their latest result.

Implemented behavior in this version:

- `*api` / `n-api`:

  - Use `*into` on the same element to select a data field where the parsed response is stored.
  - Also maintain `$download` and `$upload` metrics.

- `*upload`:

  - Uses `*into` on the element that defines the upload behavior (see below) to decide where to place the server response.

- `*websocket` / `n-websocket`:

  - Treat `*into` as the destination for the last received message.

No other directives read `*into` in the current implementation.
Putting `*into` on an element that does not participate in these features has no effect.


#### Evaluation timing

`*into` is always read on the element that owns the directive which uses it.

- For `*api`:

  - During rendering, `*api` reads `*into` or `n-into` from the same element.
  - The network request is run when Sercrod decides to activate that `*api` (for example on click or on initial render, depending on how `*api` is used).
  - When the request resolves, the response body is passed to a small helper `place(value)` which:
    - Updates `$download` or `$upload`.
    - Writes to the `*into` target if one was provided.

- For `*upload`:

  - When an upload button is bound, Sercrod reads `*into` from the original element that defines the upload behavior.
  - The value is stored on an internal helper and reused when the upload completes.
  - The upload completion handler then writes the response body to the chosen key.

- For `*websocket`:

  - When a WebSocket connection is initialized, Sercrod reads `*into` from the element that has `*websocket` / `n-websocket`.
  - The destination is stored together with the WebSocket instance and reused whenever messages arrive.
  - Each incoming message is run through a lightweight parser and then written to the `*into` target, if present.


#### Execution model

At a high level, the execution model for `*into` looks like this for each supported directive.

- With `*api`:

  1. Sercrod finds an element with `*api` or `n-api`.
  2. It clones the element as a real DOM node and reads:
     - `*api` / `n-api` for the URL expression.
     - `method` for the HTTP method (default `"GET"`).
     - `*into` / `n-into` for the destination key.
  3. It ensures `$download`, `$upload`, and the `*into` target (if any) exist on the root data as keys with `null` values.
  4. It runs the HTTP request, either as JSON style or other depending on the options.
  5. On success:
     - For GET requests, it stores the body into `$download`.
     - For non-GET requests or file uploads, it stores the body into `$upload`.
     - If `*into` is present, it stores the same value into `data[into]` and remembers that key for later clearing.
  6. It dispatches custom events to signal start, success, or error.
  7. Sercrod continues its normal update cycle. At the finalize step, `$download`, `$upload`, and any remembered `*into` keys are reset to `null`.

- With `*upload`:

  1. Sercrod normalizes upload options from an expression and element attributes.
  2. It creates or reuses a hidden `<input type="file">` for the clickable element.
  3. It reads `*into` / `n-into` from the upload context element and stores this value on the hidden input.
  4. When the user selects files and the upload completes, the server response body is stored into:
     - A key derived from `*into` if it exists.
     - `$upload` as a generic metric.
  5. That key is also added to the list of `*into` targets that will be cleared at finalize.

- With `*websocket`:

  1. Sercrod resolves the WebSocket specification from:
     - The `*websocket` / `n-websocket` attribute.
     - The current data scope.
  2. It reads `*into` / `n-into` and constructs a holder `{ ws, into, el }`.
  3. When messages arrive:
     - The last payload is stored into `$ws_last`.
     - Sercrod tries to push it into `$ws_messages` if that array exists.
     - If `into` is non-empty, the value is also written to `data[into]` and the key is added to the list for later clearing.


#### Variable creation and scope layering

`*into` does not create new variables for expressions.
Instead, it targets the root data object:

- The value of `*into` is taken as a key on the root data object (`this._data`).
- Sercrod writes directly to `this._data[into]`.
- Nested path semantics (for example `"user.profile"`) are not interpreted.
  Such a string is treated literally as a property name.
- The stored values can later be read by any directive that uses the normal scope, for example:

  - `*print="uploadResult"`
  - `*if="user && user.name"`
  - `*let="latest = wsMessage"`

There is no special `$into` variable or local binding created by `*into` itself.


#### Scope layering and parent access

Because `*into` writes to the root data object, scope behaves as follows:

- The new key is visible as a normal data field.
- Inside the same `serc-rod` host, it is available through:
  - The implicit root scope.
  - `$data`, if you refer to the unwrapped data.
  - `$root`, if you are inside nested hosts.
- If a child host defines its own `data`, it sees the parent field through `$parent` or higher-level references, depending on how you structure your templates.

`*into` does not introduce any extra scope layers by itself.


#### Use with *api

`*into` is most directly tied to the `*api` / `n-api` logic.

Key behaviors:

- For every `*api` request:

  - `$download` is always updated for GET style requests.
  - `$upload` is always updated for non-GET style requests and file uploads.
  - If `*into` is given a non-empty string, that key receives the same value.

- The destination key is initialized to `null` if it did not exist yet.
- At the finalize step, that key is set back to `null` so that stale responses do not remain in data forever.

Typical patterns:

```html
<!-- GET: store response into "user" and also into $download -->
<button *api="'/api/user.json'" method="GET" *into="user">
  Load user
</button>

<!-- POST: store result into "result" and also into $upload -->
<button
  *api="'/api/save'"
  method="POST"
  body="{ name: form.name }"
  *into="result"
>
  Save
</button>
```

If you need to keep the data beyond one update cycle, copy it to a stable field in an event handler or effect, instead of relying on the short-lived `*into` slot.


#### Use with *upload

For uploads, `*into` is read from the element that defines the upload behavior and is then used on the hidden file input.

Behavior:

- If `*into` is present:

  - The response body is written to `data[into]`.
  - The same value is mirrored into `$upload` if `$upload` was previously empty.
  - The `into` key is added to the list of keys to be cleared at finalize.

- If `*into` is not present:

  - The response body is written to `$upload`.
  - `$upload` is also added to the list of keys to be cleared at finalize.

Example pattern:

```html
<serc-rod
  data='{
    "uploadResult": null
  }'
>
  <button
    *upload="{ url: '/api/upload', accept: 'image/*' }"
    *into="uploadResult"
  >
    Upload image
  </button>

  <p *if="uploadResult">
    Uploaded: <span *print="uploadResult.fileName"></span>
  </p>
</serc-rod>
```

In this pattern:

- Clicking the button opens a file picker.
- The upload happens via `fetch` or `XMLHttpRequest`, depending on the upload options.
- The server’s JSON response is stored in `uploadResult` and `$upload`.
- After finalize, `uploadResult` and `$upload` are reset to `null`.


#### Use with *websocket

`*into` is also supported on WebSocket hosts.

Behavior:

- On an element with `*websocket` or `n-websocket`, Sercrod:

  - Resolves a WebSocket specification that includes a URL and optional extra options.
  - Reads `*into` / `n-into` from the same element.
  - Connects to the WebSocket and stores the connection in an internal map together with the `into` key.

- On incoming messages:

  - `$ws_last` receives the last payload.
  - `$ws_messages` (if present and array-like) collects all payloads.
  - If an `into` key is present, `data[into]` is updated with the latest payload and added to the list of keys cleared at finalize.

If the `*websocket` expression resolves to an object with an `into` property, Sercrod also respects that, but a markup `*into` on the same element takes priority.

Example:

```html
<serc-rod id="ws-app" data='{"lastMessage": null}'>
  <section
    *websocket="'wss://example.com/live'"
    *into="lastMessage"
  >
    <p>Connection status: <span *print="$ws_ready ? 'ready' : 'connecting'"></span></p>
    <p *if="lastMessage">Last message: <span *print="JSON.stringify(lastMessage)"></span></p>
  </section>
</serc-rod>
```


#### Best practices

- Choose stable, descriptive keys:

  - Use names like `user`, `profile`, `uploadResult`, or `wsPayload`.
  - Avoid reusing the same key for completely unrelated APIs in the same host, unless you deliberately want to share a single slot.

- Treat `*into` slots as transient:

  - Values in `$download`, `$upload`, and `*into` destinations are cleared at the finalize step.
  - Copy values you want to keep into long-lived fields in your data model.

- Keep the value simple:

  - The full response body is stored as is.
  - If you only need part of it, consider extracting that part into another field inside your own code and leaving the `*into` slot for debugging or inspection.

- Avoid overloading `*into` on the same element:

  - Do not expect `*into` to work with directives that do not reference it.
  - Keep one main I/O directive per element that uses `*into` so it is obvious which operation writes to that field.


#### Examples

Capture download status separately for GET and POST:

```html
<serc-rod
  data='{
    "user": null,
    "saveResult": null
  }'
>
  <button *api="'/api/user'" method="GET" *into="user">
    Load user
  </button>

  <button
    *api="'/api/user'"
    method="POST"
    body="{ user }"
    *into="saveResult"
  >
    Save user
  </button>

  <section *if="user">
    <h2>User</h2>
    <pre *print="JSON.stringify(user, null, 2)"></pre>
  </section>

  <section *if="saveResult">
    <h2>Last save result</h2>
    <pre *print="JSON.stringify(saveResult, null, 2)"></pre>
  </section>
</serc-rod>
```

Use `*into` with WebSocket messages:

```html
<serc-rod data='{"ticker": null}'>
  <div
    *websocket="{ url: 'wss://example.com/ticker', into: 'ticker' }"
  >
    <p *if="ticker">
      Price: <span *print="ticker.price"></span>
    </p>
  </div>
</serc-rod>
```


#### Notes

- `*into` and `n-into` are aliases. Use one style consistently in your project.
- In this version, `*into` is only read by:
  - `*api` / `n-api`
  - `*upload` bindings
  - `*websocket` / `n-websocket`
- `*into` targets operate on the root data object. The value is written as `data[into]` without interpreting dots or bracket notation.
- The same response is also placed into `$download`, `$upload`, or `$ws_last` depending on the directive. You can always inspect those fields even when you do not use `*into`.
- After the finalize step:
  - `$download` and `$upload` are reset to `null`.
  - All keys that were used as `*into` destinations are reset to `null`.
- If you need persistent storage of responses, copy them out of the short-lived `*into` slots into your own fields before they are cleared.
