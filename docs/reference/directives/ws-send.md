### *ws-send

#### Summary

`*ws-send` sends a message through the active WebSocket connection managed by the same Sercrod host.
It is an action directive for regular elements (for example `<button>`, `<a>`, or `<input>`).
The directive has an alias `n-ws-send` and supports an optional `*ws-to` attribute that selects a specific WebSocket URL using Sercrod’s text expansion.

Use `*ws-send` when you already have one or more WebSocket connections open (via `*websocket` or the `websocket` helper) and want a declarative way to send messages in response to clicks.


#### Basic example

A basic setup with a host-level WebSocket and a button that sends a simple message:

```html
<serc-rod id="app"
         data='{"wsUrl":"wss://example.com/ws","message":"hello"}'
         *websocket="wsUrl">
  <button *ws-send="message">
    Send
  </button>
</serc-rod>
```

Behavior:

- `<serc-rod>` connects to `wss://example.com/ws` because of `*websocket="wsUrl"`.
- When the button is clicked, Sercrod evaluates `message` in the current scope.
- The resulting value `"hello"` is sent through the active WebSocket connection.
- The button’s content ("Send") is rendered as usual; `*ws-send` only adds behavior.


#### Behavior

- `*ws-send` is an action directive that:

  - Clones the element (without its children) and appends the clone to the DOM.
  - Attaches a click handler when the element is considered clickable (button-like).
  - On click, evaluates the expression in the directive.
  - Sends the evaluated value as a WebSocket message.

- The directive does not create or manage WebSocket connections by itself.
  It reuses connections opened by:

  - The host-level `*websocket` on `<serc-rod>` or another Sercrod host.
  - The element-level `*websocket` on specific elements.
  - The imperative `this.websocket.connect(...)` helper from scripts.

- Alias:

  - `*ws-send` and `n-ws-send` are aliases and behave identically.


#### Clickability and event wiring

The directive decides whether to attach its own click handler based on the cloned element’s tag and type:

- `BUTTON` always counts as clickable.
- `A` counts as clickable when it does not have a `download` attribute.
- `INPUT` is clickable when `type` is one of `"button"`, `"submit"`, or `"reset"`.

For those clickable elements:

- `*ws-send` adds its own click handler that sends the message.
- Event attributes using the configured prefix (by default `@`) such as `@click`, `@mousedown`, and so on are still respected.
  Sercrod scans all attributes, and for each one whose name starts with the event prefix, it calls the internal event binder.

This means:

- You can combine `*ws-send` with `@click` on the same element.
- Both handlers run: `*ws-send` performs its send, and your `@click` expression is evaluated as usual.


#### Expression and payload evaluation

The attribute value of `*ws-send` is an expression that is evaluated at click time, not at render time:

- On each click, Sercrod calls:

  - `this.eval_expr(expr, scope, { el: work, mode: "ws-send", $event: e })`

- Inside the expression you can access:

  - All data in the current scope (for example properties from `data`, `stage`, or `*methods`).
  - `$data` (this host’s data object).
  - `$root` (root host’s data, if any).
  - `$parent` (nearest ancestor Sercrod host’s data).
  - `el` (the original template element that declared `*ws-send`).
  - `$event` (the click event object).

Payload conversion:

- After evaluating the expression, `_ws_send` converts the value before sending:

  - If the value is an object:

    - It attempts `JSON.stringify(payload)`.
    - If that fails, it falls back to `String(payload)`.

  - For non-object values:

    - It uses `String(payload)`.

- The final message sent over the WebSocket is always a string.
- On the receiving side, `*websocket` will attempt to parse incoming string messages as JSON when they look like arrays or objects (`"{}"` or `"[]"` style). This makes sending objects via `*ws-send` a natural choice.


#### Target selection with the `*ws-to` attribute

`*ws-send` can send messages either to a specific WebSocket URL or to the first open connection it finds.

- Optional `*ws-to` attribute:

  - If present, its value is treated as a text template and resolved via Sercrod’s text expansion logic.
  - Internally, the directive uses:

    - `this._expand_text(toRaw, scope, work)`

  - This supports the standard placeholder mechanisms (such as `%path.to.url%` or other configured `%...%` forms), as defined by Sercrod’s `_expand_text`.

- Target resolution logic:

  - If `*ws-to` is present and its expanded value is a non-empty string:

    - `_ws_send` looks up a WebSocket in the internal map by that URL.
    - If there is an open connection for that URL (`readyState === WebSocket.OPEN`), the message is sent to that connection.
    - Otherwise, the send is skipped.

  - If `*ws-to` is absent or its expanded value is empty:

    - `_ws_send` iterates over the internal map of WebSocket holders.
    - It picks the first connection whose `readyState` is `WebSocket.OPEN`.
    - If no open connection is found, the send is skipped.

Important notes:

- If no connection is open, `*ws-send` does nothing; there is no built-in error dialog.
- If multiple connections are open and `*ws-to` is not provided, the actual target is whichever open connection is first in the internal map.
  This order is not a stable contract and should not be relied on.
  For multiple connections, always use `*ws-to` to select a URL explicitly.


#### Evaluation timing

`*ws-send` participates in the rendering pipeline as follows:

- During rendering:

  - Sercrod sees the `*ws-send` or `n-ws-send` attribute.
  - It clones the element, appends the clone to the parent, and attaches the click handler if the element is clickable.
  - It also processes event attributes (such as `@click`) on the original element and binds them to the clone.

- During user interaction:

  - The expression in `*ws-send` is evaluated only when the element is clicked.
  - The `*ws-to` attribute (if present) is also evaluated through text expansion at click time, so it can reflect the current state via `%...%` placeholders.

- Updates:

  - Re-renders of the Sercrod host recreate the element and its event handlers.
  - The send behavior is always driven by clicks, not by data changes alone.


#### Execution model

Conceptually, the directive behaves like this:

1. Rendering:

   - Detect `*ws-send` or `n-ws-send` on a node `work`.
   - Clone the element without children: `el = work.cloneNode(false)`.
   - Append the clone to the parent.
   - Read the raw `*ws-to` value once:

     - `const toRaw = work.getAttribute("*ws-to") || "";`

   - Compute clickability based on `el`’s tag and type.
   - If clickable, attach a click listener:

     - On click:

       - Evaluate the expression in the attribute to obtain `payload`.
       - Resolve the `*ws-to` attribute by calling `_expand_text(toRaw, scope, work)` to obtain `targetUrl` (which may be empty).
       - Call `_ws_send(targetUrl, payload)`.

   - For each attribute whose name starts with the event prefix (for example `@`), bind the corresponding event handler to `el`.
   - Render all original child nodes into `el` using the usual rendering rules.

2. Sending:

   - `_ws_send(urlOrEmpty, payload)` selects a target WebSocket:

     - If `urlOrEmpty` is non-empty, look up that URL in the internal map of connections.
     - Otherwise, scan for the first open WebSocket.

   - If no open target is found, return `false` and do not send anything.
   - Convert `payload` to a string as described above.
   - Call `ws.send(out)` on the selected WebSocket.
   - Return `true` if the send operation succeeds, `false` if it throws.

The return value from `_ws_send` is not used by the directive itself but is exposed through the `this.websocket.send(...)` helper for more advanced, imperative control from scripts.


#### Scope layering and variables

`*ws-send` does not create new scope variables of its own, but its expression runs inside the normal Sercrod scope:

- Available in the expression:

  - All properties from the current evaluation scope (data, stage, and so on).
  - `$data`, `$root`, `$parent`.
  - Methods provided via `*methods` or injected internal helpers.
  - `el` (the original template element).
  - `$event` (the click `MouseEvent` or `PointerEvent` or similar).

- The directive does not add new special variables other than passing `el` and `$event` to `eval_expr`.
- Because expressions execute in the standard sandbox, any restrictions that apply to other directives also apply to `*ws-send`.


#### Use with *websocket and WebSocket metrics

`*ws-send` is designed to be used together with `*websocket` and the WebSocket status fields maintained in the data object:

- WebSocket connections:

  - Host-level `*websocket` on `<serc-rod>` can automatically connect once at initialization or when you call `update(true)`.
  - Element-level `*websocket` on, for example, a button, can connect when that element is clicked or immediately if it is not clickable.
  - Both forms ultimately use `_ws_connect` and share a common map of live connections on the host.

- Status fields:

  - When you use `*websocket`, Sercrod keeps several fields on the data object:

    - `$ws_ready`: `true` when at least the last connection is open and ready, `false` otherwise.
    - `$ws_error`: last error message, or `null`.
    - `$ws_last`: last received message (after optional JSON parsing).
    - `$ws_messages`: array of all received messages for this host.
    - `$ws_closed_at`: timestamp of the last close event.
    - `$ws_close_code`: last close code, or `null`.
    - `$ws_close_reason`: last close reason, or `null`.

  - `*ws-send` itself does not change these fields directly.
    They change as a result of connection open, message, error, and close events handled by `*websocket`.

Practical pattern:

- Disable send buttons when no connection is ready:

  ```html
  <serc-rod id="app"
           data='{"wsUrl":"wss://example.com/ws","message":"ping"}'
           *websocket="wsUrl">
    <button *ws-send="message"
            :disabled="!$ws_ready">
      Send ping
    </button>
  </serc-rod>
  ```


#### Best practices

- Prefer object payloads:

  - Sending objects like `{ type: "ping", data: { id: 1 } }` works well because:

    - `*ws-send` serializes objects with `JSON.stringify`.
    - `*websocket` attempts to parse JSON-looking text on receive.

  - This gives a symmetric request/response shape.

- Use `*ws-to` when multiple connections are in play:

  - If your host manages multiple WebSocket URLs, always set `*ws-to` to avoid ambiguity:

    - For example `*ws-to="%primaryUrl%"` or `*ws-to="%notificationsUrl%"`.

  - Do not rely on the internal ordering of the connection map.

- Keep expressions simple:

  - Derive complex payloads via helper functions or precomputed data.

    - For example: `*ws-send="buildPayload($event)"` with a `buildPayload` function defined via `*methods`.

- Handle offline or closed states in the UI:

  - Use `$ws_ready` and `$ws_error` to enable or disable buttons and show status messages instead of relying on the send result.

- Combine with `@click` when you need local side effects:

  - You can use `@click` to update local state and still let `*ws-send` handle the actual send.


#### Additional examples

Sending a structured JSON payload:

```html
<serc-rod id="chat"
         data='{
           "wsUrl": "wss://example.com/chat",
           "draft": ""
         }'
         *websocket="wsUrl">
  <input type="text"
         :value="draft"
         @input="draft = $event.target.value">
  <button *ws-send="{ type: 'chat', text: draft }"
          :disabled="!$ws_ready || !draft">
    Send message
  </button>
</serc-rod>
```

Selecting a specific connection with `*ws-to`:

```html
<serc-rod id="multi"
         data='{
           "primaryUrl": "wss://example.com/primary",
           "secondaryUrl": "wss://example.com/secondary"
         }'
         *websocket="primaryUrl">
  <button *ws-send="{ type: 'ping' }">
    Ping (default connection)
  </button>

  <button *ws-send="{ type: 'ping-secondary' }"
          *ws-to="%secondaryUrl%">
    Ping secondary
  </button>
</serc-rod>
```

In this pattern, you would typically have an element-level `*websocket` somewhere that connects to `secondaryUrl`.
`*ws-send` simply routes messages to the appropriate connection based on `*ws-to`.


#### Notes

- `*ws-send` and `n-ws-send` are aliases; choose one style for consistency.
- The directive sends only when at least one WebSocket is open and ready; otherwise, it silently does nothing (aside from returning `false` internally).
- The message is always sent as a string; objects are serialized with `JSON.stringify`.
- `*ws-send` does not itself attempt reconnection or error handling.
  Connection lifecycle is handled by `*websocket` and internal helpers like `_ws_connect` and `_ws_clear_retry_flags`.
- When combining `*ws-send` with other directives on the same element:

  - It is safe to combine it with attribute bindings (such as `:class`, `:disabled`) and event bindings (such as `@click`).
  - There are no special structural conflicts like those between `*each` and `*include` or `*import`, because `*ws-send` does not take ownership of child structure.
- The `*ws-to` attribute is purely a targeting helper for `*ws-send`; it does not affect where received messages are stored.
  Received messages are still controlled by `*websocket` and its `*into` configuration.
