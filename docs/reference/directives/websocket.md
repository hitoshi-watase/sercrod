### *websocket

#### Summary

`*websocket` opens and manages WebSocket connections for a Sercrod host and its descendants.

- It works in two forms:
  - As a host attribute on `<serc-rod>` to automatically connect once per URL.
  - As an element directive on clickable or non-clickable elements to connect from within the template.
- WebSocket messages update dedicated `$ws_*` state fields and, optionally, a property chosen via `*into`.
- Outgoing messages are sent with `*ws-send`, optionally directed to a specific URL with `*ws-to` / `n-ws-to`.


#### Basic examples

Host-level connection with state flags:

```html
<serc-rod id="chat"
         data='{"wsUrl": "wss://example.com/chat"}'
         *websocket="wsUrl"
         *into="wsData">
  <section>
    <p>
      Status:
      <strong *print="$ws_ready ? 'connected' : 'disconnected'"></strong>
    </p>

    <p *if="$ws_error">
      Last error: <span *print="$ws_error"></span>
    </p>

    <pre *if="wsData"
         *textContent="JSON.stringify(wsData, null, 2)"></pre>
  </section>
</serc-rod>
```

Element-level connection and sending:

```html
<serc-rod id="notify"
         data='{
           "notifyUrl": "wss://example.com/notify",
           "payload": { "type": "ping" }
         }'>

  <!-- Connect on button click -->
  <button *websocket="notifyUrl"
          *into="lastNotify">
    Connect notification channel
  </button>

  <!-- Send via the same URL (selected by *ws-to on *ws-send) -->
  <button *ws-send="payload"
          *ws-to="%notifyUrl%">
    Send ping
  </button>

  <pre *if="lastNotify"
       *textContent="JSON.stringify(lastNotify, null, 2)"></pre>
</serc-rod>
```


#### Host vs element usage

`*websocket` can be attached to:

1. The Sercrod host (`<serc-rod>`) as a host attribute:

   - `*websocket="spec"`
   - Optional: `*into="propName"`

   Example:

   - `<serc-rod *websocket="wsUrl" *into="wsData">…</serc-rod>`

   Behavior:

   - The host resolves `spec` into a URL (and optional `into`) from the host scope.
   - It attempts a connection once, asynchronously, after the initial render.
   - The connection is tracked per URL and controlled by the host’s `websocket` controller.

2. Any element inside a Sercrod host:

   - `*websocket="spec"` on a child element (for example `button`, `a`, `div`) creates or reuses a connection for that URL.

   Behavior:

   - The directive is rendered as a “special element”:
     - Sercrod clones the element (without children), wires the WebSocket logic, and appends the clone.
     - Children of the original element are rendered normally into the clone.
   - The connection is still owned by the host (the WebSocket state lives on the host’s data object), but events are dispatched from the element.

Clickable vs non-clickable elements:

- If the element is “clickable” (`<button>`, `<a>` without `download`, or `<input type="button|submit|reset">`):
  - The WebSocket connection is created when the user clicks the element.
- Otherwise:
  - Sercrod automatically attempts the connection once on the next animation frame.


#### Spec expression and URL resolution

The `spec` expression on `*websocket` can be:

- A simple expression that evaluates to a URL string.
- A template-like string with placeholders.
- An object expression that describes additional options.

Resolution steps (for both host and element):

1. Evaluate the `spec` as a Sercrod expression in `mode: "attr"`.

   - Example: `*websocket="wsUrl"` or `*websocket="config.ws"`.

2. If the expression result is `null` or is exactly the same as the raw string, treat it as a template string and run Sercrod’s text expansion:

   - `${expr}` is evaluated like other Sercrod template expansions.
   - `%name%` placeholders can also be used and are expanded from the current scope.

3. Interpret the final value:

   - If it is an object, the runtime accepts:
     - `url`: the WebSocket URL (string, required).
     - `protocols`: reserved for future use (currently ignored).
     - `into`: optional property name that indicates where to store incoming messages.
   - Otherwise, the value is treated as the URL string.

Examples:

```html
<!-- Simple string or data binding -->
<serc-rod *websocket="'wss://example.com/ws'"></serc-rod>
<serc-rod *websocket="wsUrl"></serc-rod>

<!-- Template-style expansion -->
<serc-rod *websocket="'wss://example.com/ws/%roomId%'"></serc-rod>

<!-- Object-style spec -->
<serc-rod *websocket="{ url: wsUrl, into: 'wsData' }"></serc-rod>
```

Placeholder guard:

- Before connecting, Sercrod checks whether the final URL still contains placeholder patterns such as:
  - `${...}`
  - `%name%`
- If placeholders remain, Sercrod does not connect and may emit a warning:

  - Host-level: `"[Sercrod warn] *websocket(host): URL not expanded"`.
  - Element-level: `"[Sercrod warn] *websocket(el): URL not expanded"`.

- This usually means your data is not ready yet. You can retry later (for example via a forced update).


#### Data integration and state fields

`*websocket` ensures that the host’s data object has the following fields:

- `$ws_ready`: `true` when at least one connection is open, `false` otherwise.
- `$ws_error`: last error message string, or `null`.
- `$ws_last`: last received message payload (after JSON decoding if applicable).
- `$ws_messages`: array of all message payloads received during the lifetime of the host.

Connection metadata:

- `$ws_closed_at`: timestamp (`Date.now()`) of the most recent close event, or `null`.
- `$ws_close_code`: close code from the WebSocket `close` event, or `null`.
- `$ws_close_reason`: close reason string, or `null`.

Message storage:

- Internally, each connection is stored in a map keyed by URL:
  - `url` → `{ ws, into, el }`
- On each message:

  - The payload is decoded:

    - If `ev.data` is a string that looks like JSON (starts with `{` / `[` and ends with `}` / `]`), Sercrod attempts `JSON.parse`.
    - Otherwise the raw string or binary value is used as-is.

  - Then the runtime:

    - Sets `$ws_last` to that payload.
    - Pushes the payload into `$ws_messages`.
    - If an `into` key is configured for that connection:
      - Writes the payload into `data[into]`.
      - Records the property name for potential later cleanup.

Notes:

- The `into` path is a simple property name on the host’s data object.
  - If you need nested structures, store payloads into objects and manage nested fields yourself.
- All these fields live on the host’s data object and are visible to all directives under that host.


#### Using *into with *websocket

You can choose where incoming messages are stored with `*into` or by specifying `into` in the spec object:

- Resolution order:

  1. Host- or element-level `*into` / `n-into` attribute wins if present.
  2. Otherwise, `spec.into` (if provided) is used.
  3. If neither is present, only `$ws_last` and `$ws_messages` are updated.

Examples:

```html
<!-- Host-level with *into -->
<serc-rod *websocket="wsUrl" *into="wsData">
  <pre *textContent="JSON.stringify(wsData, null, 2)"></pre>
</serc-rod>

<!-- Element-level with *into -->
<button *websocket="wsUrl" *into="wsMessage">
  Connect and keep last message in wsMessage
</button>

<!-- Object spec provides into -->
<serc-rod *websocket="{ url: wsUrl, into: 'wsData' }"></serc-rod>
```


#### Events and lifecycle hooks

`*websocket` dispatches custom DOM events that you can listen to on the host or on the element that owns the directive.

Lifecycle events:

- `sercrod-ws-before-connect` (cancelable):

  - Fired just before a connection attempt.
  - `detail` includes:
    - `url`: initially resolved URL string.
    - `into`: currently chosen into property name.
    - `controller`: the host-level `websocket` controller object.
  - You can:
    - Modify `detail.url` and `detail.into` to override connection parameters.
    - Call `event.preventDefault()` to cancel the connection.

- `sercrod-ws-open`:

  - Fired when the connection is successfully opened.
  - `detail` includes `{ url }`.

- `sercrod-ws-message`:

  - Fired on each incoming message.
  - `detail` includes:
    - `url`: URL of the connection.
    - `payload`: already-decoded payload (possibly parsed from JSON).

- `sercrod-ws-error`:

  - Fired on errors from the WebSocket.
  - `detail` includes:
    - `url`
    - `error`: message string.

- `sercrod-ws-close`:

  - Fired when the connection closes.
  - `detail` typically includes:
    - `url`
    - `code`, `reason`
    - `closedAt` (timestamp)

Dispatch target:

- For host-level `*websocket`:
  - Events are dispatched from the `<serc-rod>` host.
- For element-level `*websocket`:
  - Events are dispatched from the element that carries the directive.
  - Events bubble and are composed, so you can listen at the host or further up if needed.


#### WebSocket controller (`el.websocket`)

Each Sercrod host exposes a lightweight controller object on the host element:

- Accessible as `host.websocket` in JavaScript.
- Non-enumerable and safe to overwrite on reinitialization.

Properties and methods (simplified view):

- `last_url`: last URL used to open a connection, or empty string.
- `last_into`: last `into` value used for a connection, or empty string.
- `urls()`: array of URLs currently known in the connection map.
- `status(url?)`:

  - Returns an object like:
    - `ready`: boolean (whether the chosen connection is open).
    - `state`: the WebSocket `readyState` value, or `-1` if no connection.
    - `error`: `$ws_error` or `null`.
    - `count`: `$ws_messages.length` or `0`.

- `connect(url?, into?)`:

  - Uses the given `url` and optional `into`, or falls back to the last arguments.
  - Returns `true` if a connection was created or reused, `false` otherwise.

- `reconnect()`:

  - Attempts to reconnect using the last known `url` and `into`.
  - Returns `true` on success, `false` otherwise.

- `close(url?)`:

  - If `url` is given, closes the connection for that URL.
  - If omitted, closes all known connections.
  - Returns `true` if at least one connection was closed, `false` otherwise.

- `send(payload, toUrl?)`:

  - Uses the same logic as `*ws-send`:
    - If `toUrl` is provided, sends to that specific URL (if open).
    - Otherwise, sends to the first open connection.
  - Returns `true` if the message was sent, `false` otherwise.

This controller is useful for advanced orchestration and custom reconnection strategies, but most templates can rely on `*websocket` plus `*ws-send` and `*ws-to` without calling it directly.


#### Interaction with *ws-send and *ws-to

`*websocket` establishes and tracks connections; `*ws-send` and `*ws-to` send messages over them.

Connection map:

- Every `*websocket` (host or element) uses the host’s internal map:

  - Key: URL string.
  - Value: `{ ws, into, el }`.

Sending:

- `*ws-send` evaluates its expression to a payload.
- The runtime calls `_ws_send` with:

  - An optional URL chosen via `*ws-to` / `n-ws-to`.
  - The payload object or value.

- `_ws_send` behaves as follows:

  - If `url` is specified (via `*ws-to`), it looks up that URL in the connection map and sends to that connection if it is open.
  - Otherwise, it sends to the first open connection found in the map.
  - If no suitable open connection exists, it returns `false` and does nothing.

`*ws-to` / `n-ws-to`:

- Used on the same element as `*ws-send`.
- Resolved via Sercrod’s text expansion (not as a full expression):

  - `*ws-to="%notifyUrl%"` will expand `%notifyUrl%` from the current scope.
  - The result should match the WebSocket URL string.

Restrictions:

- `*ws-to` / `n-ws-to` only makes sense on `*ws-send` / `n-ws-send` elements.
- It does not affect how `*websocket` connects; it only selects which existing connection `*ws-send` should use.


#### Evaluation timing and reconnection

Host-level auto connect:

- On first connection:

  - After the host is initialized, Sercrod schedules a `*websocket` host connect on the next animation frame.
  - It resolves the spec and attempts the connection once per URL.
  - A one-shot guard ensures the same host and URL are not auto-connected repeatedly.

- On failure or close:

  - If the connection fails (for example, invalid URL) or errors/ closes:
    - Sercrod clears the one-shot guard for that URL.
    - It also clears internal retry flags so that the connection can be retried later.
    - It invalidates the AST cache related to the WebSocket spec so that the expression will be re-evaluated on the next forced update.

- Retrying:

  - Sercrod does not automatically loop or schedule reconnect attempts.
  - To try again with the same host-level `*websocket`:
    - You can call `host.update(true)` (or equivalent) to trigger a forced update.
    - Or invoke `host.websocket.reconnect()` from custom code.
  - Both rely on the internal flags having been cleared by a prior error or close.

Element-level connect:

- For clickable elements:

  - Each click runs a fresh `connect` attempt:
    - If the URL is new, a new connection is created.
    - If a connection for the URL already exists and is open or connecting, it is reused.

- For non-clickable elements:

  - Sercrod attempts one connection on the next animation frame.
  - After an error or close, you can:
    - Re-render the element.
    - Or use the host’s `websocket` controller to reconnect.

Placeholder behavior:

- If the URL still contains placeholders when evaluated:
  - Sercrod aborts the connection attempt and logs a warning.
  - Once the data is ready and the URL expands cleanly, a new connection attempt can be triggered via forced update or user action.


#### Best practices

- Prefer JSON payloads:

  - Sending objects from `*ws-send` is natural because Sercrod automatically `JSON.stringify` values that are plain objects.
  - Incoming messages that look like JSON are automatically parsed.

- Use `*into` for the main “current message”, `$ws_messages` for history:

  - Use a dedicated property via `*into` or `spec.into` to hold the latest message relevant for the UI.
  - Use `$ws_messages` when you need a full message log.

- Be explicit about URLs when you have multiple connections:

  - Use `*ws-to` / `n-ws-to` on `*ws-send` when more than one `*websocket` is active.
  - Keep connection URLs in your data model (for example `notifyUrl`, `chatUrl`) so that you can reference them consistently in both `*websocket` and `*ws-to`.

- Handle errors and closure:

  - Watch `$ws_error` and `$ws_ready` to show user-friendly status.
  - Listen to `sercrod-ws-error` and `sercrod-ws-close` if you need more precise handling or logging.

- Design your own reconnection strategy:

  - Sercrod intentionally avoids automatic reconnect loops.
  - If you need reconnects, implement them explicitly using:
    - `host.websocket.reconnect()`.
    - Or by calling `host.websocket.connect(url, into)` from your own timers or event handlers.

- Keep specs simple and stable:

  - Avoid writing very complex expressions inside `*websocket`.
  - Prefer to compute configuration in data and refer to it by a simple expression like `wsConfig.chat` or `wsUrl`.


#### Notes

- `*websocket` has an alias `n-websocket`. They are interchangeable; pick one style and use it consistently.
- `*websocket` can be used on the host and on child elements; all connections end up in the same host-level map and share the same `$ws_*` state.
- Messages that are not valid JSON strings remain as raw values (strings or binary).
- `*websocket` does not conflict with most other directives, but it does share `*into` semantics with HTTP directives. Only one `*websocket` / `n-websocket` should be attached to a given element.
- Use `*ws-send` and `*ws-to` for sending messages; do not attempt to send directly from `*websocket`. The directive’s responsibility is connection management and state integration.
