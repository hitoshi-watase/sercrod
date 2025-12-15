### *ws-to

#### Summary

`*ws-to` is an optional targeting helper used together with `*ws-send`.
It selects which WebSocket connection a `*ws-send` action will use by specifying a WebSocket URL.
The directive has an alias `n-ws-to`; in this document, “*ws-to” refers to both `*ws-to` and `n-ws-to`.

If a Sercrod host only ever opens one WebSocket connection, `*ws-to` is not required and can be omitted.
When a host has multiple WebSocket connections open (for example primary, notifications, or other channels), `*ws-to` lets you explicitly choose which URL to send to from markup.


#### Relationship to *ws-send and *websocket

`*ws-to` does not open WebSocket connections and does not decide where received messages are stored.
Instead:

- `*websocket` is responsible for:
  - Opening connections for specific URLs.
  - Maintaining the internal map of active connections per host.
  - Updating data fields such as `$ws_ready`, `$ws_last`, `$ws_messages`, and any property configured via `*into`.

- `*ws-send` is responsible for:
  - Evaluating a payload expression when the user clicks a button or similar element.
  - Sending that payload through one of the existing WebSocket connections.

- `*ws-to` is responsible for:
  - Deciding which connection `*ws-send` will use, by providing a WebSocket URL string that matches one of the connections opened by `*websocket`.


#### Basic example: single host with two WebSockets

The following example shows a host that connects to two different WebSocket URLs and uses `*ws-to` to direct messages to each one.

```html
<serc-rod id="multi"
         data='{
           "apiUrl":   "wss://example.com/api",
           "notifyUrl":"wss://example.com/notify"
         }'
         *websocket="apiUrl">

  <!-- Connect a second WebSocket for notifications -->
  <span *websocket="notifyUrl"></span>

  <!-- Sends to the default connection (apiUrl) -->
  <button *ws-send="{ type: 'ping-api' }">
    Ping API
  </button>

  <!-- Sends specifically to notifyUrl -->
  <button *ws-send="{ type: 'ping-notify' }"
          *ws-to="%notifyUrl%">
    Ping notify
  </button>
</serc-rod>
```

Behavior:

- The host-level `*websocket` opens a connection to `apiUrl`.
- The `<span>` with `*websocket="notifyUrl"` opens a second connection to `notifyUrl`.
- The first button has no `*ws-to`, so `*ws-send` sends through the host’s default open connection (here, the first open connection, which is `apiUrl`).
- The second button has `*ws-to="%notifyUrl%"`, so `*ws-send` sends through the connection associated with `notifyUrl`.


#### Behavior

At render time, the `*ws-send` directive reads the raw `*ws-to` or `n-ws-to` attribute value:

- It looks for a `*ws-to` attribute on the original template element.
- If not found, it then looks for an `n-ws-to` attribute.
- If either is present, the raw text is stored as `toRaw`.
- If neither is present, `toRaw` is an empty string.

On each click, when the handler runs, `*ws-send` resolves the target URL like this:

- It calls an internal resolver:

  - `resolveTo()` returns:
    - An empty string if `toRaw` is empty.
    - Otherwise, the text produced by passing `toRaw` through Sercrod’s text expansion helper.

- Sercrod uses its central text expansion function (the same one used for other attribute expansions) to interpret constructs such as `%notifyUrl%` according to the current scope.

Once the target URL string has been calculated, the runtime calls the internal send helper:

- `_ws_send(urlOrEmpty, payload)` is invoked with:
  - `urlOrEmpty` set to the resolved `*ws-to` value, which may be an empty string.
  - `payload` set to the evaluated result of the `*ws-send` expression.

The runtime then selects a WebSocket connection based on `urlOrEmpty`:

- If `urlOrEmpty` is a non-empty string:
  - It looks up that URL in the host’s internal WebSocket map.
  - If a connection for that URL exists and is open, it becomes the target.
  - If no open connection for that URL is found, nothing is sent.

- If `urlOrEmpty` is an empty string:
  - It scans the map of connections for the first instance whose `readyState` is `OPEN`.
  - If such a connection is found, it becomes the target.
  - If no open connection exists, nothing is sent.

In all cases:

- If a target WebSocket is found, the payload is serialized and sent.
- If no target is found, the send operation is skipped and the internal helper returns `false`.


#### Evaluation timing

`*ws-to` participates in the evaluation lifecycle of `*ws-send` in a controlled way:

- At render time:
  - The raw attribute string from `*ws-to` or `n-ws-to` is captured once.
  - No WebSocket lookup or send occurs during rendering.

- At click time:
  - The payload expression of `*ws-send` is evaluated with the current scope and event.
  - The target URL is resolved by expanding the raw `*ws-to` template with the current scope.
  - A connection is selected and the message is sent, or skipped if no suitable connection is open.

This design lets `*ws-to` depend on dynamic state (such as a URL stored in data) without forcing re-renders every time the target changes.


#### Interaction with text expansion

The value of `*ws-to` or `n-ws-to` is processed with Sercrod’s generic text expansion helper, so it follows the same rules as other text templates in the system.

Typical patterns:

- Using a property from data:

  - `*ws-to="%notifyUrl%"`

- Using nested data:

  - `*ws-to="%config.websocket.notifyUrl%"`

The exact placeholder syntax and expansion rules are defined by Sercrod’s global configuration and text expansion logic.
The important point is that `*ws-to` is not a full expression binding; it is a text template that is expanded into a plain string URL for `_ws_send`.


#### Multiple connections per host

A Sercrod host can maintain multiple WebSocket connections, one per URL, as long as the browser and server allow it.

Internally, each host keeps a map from URL to a holder object that contains:

- `ws`: the actual WebSocket instance.
- `into`: optional data path used by `*websocket` for storing received messages.
- `el`: the element that initiated the connection.

When `*websocket` is used with different URLs on the same host, this map grows to include each distinct URL.
If `*websocket` is used multiple times with the same URL:

- The existing open connection for that URL is reused.
- Additional calls do not create duplicate WebSocket instances; they reuse the same one.

In this environment:

- `*ws-to` (or `n-ws-to`) lets you choose a specific URL entry from this map when sending.
- It does not change how the map is populated; that is controlled by `*websocket` and the helper API.


#### Relationship to *into and received messages

`*ws-to` only affects where outgoing messages are sent.
It does not influence how incoming messages are stored.

For incoming data:

- `*websocket` controls:
  - Whether received messages are parsed as JSON.
  - Which data fields receive messages.
  - Whether messages are pushed into arrays such as `$ws_messages`, or stored in `$ws_last`, or written into a custom property via `*into`.

- `*into` is used by `*websocket` as an optional override to say:
  - “Store data for this connection under `data[intoKey]`.”

`*ws-to` does not touch `*into` or any of those storage rules:

- Changing `*ws-to` or `n-ws-to` on a button will not change where messages are written when responses arrive.
- Received messages for each connection still follow the configuration of the corresponding `*websocket`.

In other words:

- `*into` describes where information comes in.
- `*ws-to` describes where outbound messages go.


#### Use with the websocket helper API

Sercrod’s host exposes a `websocket` helper object that includes a `send` method.
Internally:

- Both the `websocket.send(payload, toUrl)` helper and `*ws-send` with `*ws-to` call the same low-level function for selecting connections and sending payloads.

From a conceptual point of view:

- The helper function:

  - `websocket.send(payload, toUrl)`

  lets scripts choose a target by URL.

- The `*ws-to` attribute:

  - `*ws-to="someUrlTemplate"` or `n-ws-to="someUrlTemplate"`

  lets templates choose a target by URL.

This symmetry ensures that template-driven and script-driven code share the same rules for selecting WebSocket connections.


#### Best practices

- Single-connection hosts:

  - When a host only has one WebSocket connection, omit `*ws-to` and `n-ws-to` on all `*ws-send` elements.
  - In that case, `*ws-send` automatically sends to the single open connection, and no additional configuration is needed.

- Multiple-connection hosts:

  - When a host opens more than one WebSocket URL, prefer to give each send action an explicit `*ws-to` (or `n-ws-to`).
  - Keep all URLs in the data object (for example `apiUrl`, `notifyUrl`, `metricsUrl`) instead of hardcoding them in attributes.
  - Use `*ws-to` only to select among those known URLs via simple templates such as `%notifyUrl%`.

- Keep `*ws-to` templates simple:

  - Use `*ws-to` mainly to choose among already computed URLs.
  - Avoid embedding complex logic or large configuration strings in `*ws-to` itself.
  - If you need more complex routing, prefer to compute the final URL in data or methods and reference it from `*ws-to`.

- Avoid depending on map ordering:

  - Without `*ws-to`, `*ws-send` will pick the first open connection it finds.
  - When multiple connections are open and the target matters, always use `*ws-to` to avoid relying on internal map iteration order.

- Configuration and documentation:

  - Treat `*ws-to` as an advanced feature.
  - In introductory examples for `*ws-send` and `*websocket`, focus on the single-connection pattern and introduce `*ws-to` only when you show multiple connections.


#### Additional examples

Dynamic target based on environment:

```html
<serc-rod id="env-ws"
         data='{
           "env": "prod",
           "wsUrls": {
             "dev":  "wss://dev.example.com/ws",
             "prod": "wss://api.example.com/ws"
           }
         }'
         *websocket="wsUrls[env]">

  <button *ws-send="{ type: 'ping', env }">
    Ping current env
  </button>
</serc-rod>
```

In this scenario:

- `*websocket="wsUrls[env]"` decides which URL to connect to based on `env`.
- There is still only one WebSocket connection, so `*ws-to` is not needed.
- If you later add a second connection (for notifications), you can add a new `*websocket` and a `*ws-to` on the notification buttons to target it explicitly.

Explicit URL selection for three channels:

```html
<serc-rod id="multi3"
         data='{
           "chatUrl":   "wss://example.com/chat",
           "notifyUrl": "wss://example.com/notify",
           "metricsUrl":"wss://example.com/metrics"
         }'>
  <span *websocket="chatUrl"></span>
  <span *websocket="notifyUrl"></span>
  <span *websocket="metricsUrl"></span>

  <button *ws-send="{ type: 'chat-ping' }"
          *ws-to="%chatUrl%">
    Ping chat
  </button>

  <button *ws-send="{ type: 'notify-ping' }"
          n-ws-to="%notifyUrl%">
    Ping notify
  </button>

  <button *ws-send="{ type: 'metrics-ping' }"
          *ws-to="%metricsUrl%">
    Ping metrics
  </button>
</serc-rod>
```

Here, `*ws-to` and `n-ws-to` both associate buttons with specific connections, and the behavior is independent of the internal ordering of WebSocket connections on the host.


#### Notes

- `*ws-to` and `n-ws-to` are aliases; choose one style per project for consistency.
- `*ws-to` only has effect on `*ws-send`. Other directives ignore it.
- Omitting `*ws-to` or `n-ws-to` is safe and recommended for hosts with a single WebSocket connection.
- Adding `*ws-to` introduces an explicit dependency on URL strings; keeping those URLs in data rather than hardcoding them in attributes improves maintainability.
- `*ws-to` does not affect reconnection policies or error handling; those are defined by `*websocket` and the surrounding application logic.
