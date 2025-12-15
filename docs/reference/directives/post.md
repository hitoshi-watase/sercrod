### *post

#### Summary

`*post` sends the current Sercrod host data as JSON via HTTP POST to a given URL and writes the JSON response back into host data.
It is typically attached to a button or similar control inside a Sercrod host.
`*post` and `n-post` are aliases.

Key points:

- Serializes either the staged data or the live host data into JSON.
- Sends that JSON as the request body for a POST request.
- Parses the response, preferring JSON when the server advertises it.
- Writes the parsed value back into host data using a simple `URL[:prop]` convention.
- Updates common state flags such as `$pending`, `$error`, `$upload`, and `$download`.
- Emits lifecycle events you can listen to from the outside.


#### Basic example

A minimal contact form that posts all data and stores the response in `result`:

```html
<serc-rod id="contact" data='{
  "form": { "name": "", "message": "" },
  "result": null
}'>
  <form>
    <label>
      Name:
      <input type="text" *input="form.name">
    </label>

    <label>
      Message:
      <textarea *input="form.message"></textarea>
    </label>

    <button type="button" *post="/api/contact.php:result">
      Send
    </button>
  </form>

  <p *if="result">
    <strong>Server response:</strong>
    <span *print="result.status"></span>
  </p>
</serc-rod>
```

Behavior in this example:

- When the button is clicked, `*post` takes the host data as JSON and sends it to `/api/contact.php`.
- When the response returns and can be parsed, the value is written to `result`.
- While the request is in flight, `$pending` is `true`.
- If an error occurs at the transport or JSON level, `$error` is set and an error event is emitted.


#### Behavior

Attachment and rendering:

- `*post` is evaluated when Sercrod renders a normal element inside a Sercrod host.
- The runtime clones the element deep, including all attributes and children:

  - Internally this is equivalent to `work.cloneNode(true)`.

- A click listener is attached to the cloned element.
- The cloned element is appended to the parent, and the original template node is not rendered.

Important consequence:

- Sercrod does not recursively process directives on the children of the `*post` element itself.
- The children of a `*post` button or link are treated as static markup.
  - Do not put `*print`, `*if`, or other Sercrod directives on the same element or its direct children if you expect them to run.
  - Place dynamic content in sibling elements or in the surrounding layout instead.

Trigger timing:

- `*post` always fires on a click on the rendered element, regardless of tag name.
- There is no automatic initial POST and no special detection of clickable tag types.


#### Request specification

The attribute value for `*post` uses a compact `URL[:prop]` format:

- `URL` is the request target for the HTTP POST.
- `prop` is an optional data path that controls where the response is written.

Format:

- `*post="URL"`  
  Send data to `URL` and replace the entire host data with the response.

- `*post="URL:prop"`  
  Send data to `URL` and write the response into `data[prop]`.

Processing rules:

- The raw attribute is read from `*post` or `n-post` and trimmed.
- If the result is empty, the runtime logs a warning (when warnings are enabled) and does nothing.
- The value is split at the first `:`:
  - The part before `:` is the URL.
  - The part after `:` is the optional `prop` string, trimmed again.

Restrictions and details:

- URL is used as-is:
  - There is no expression evaluation or placeholder expansion in the `*post` attribute.
  - The string is not combined with any base URL from `*api`.
- `prop` is a simple textual key, with one special case for bracket syntax described below.
- If URL is missing after trimming, the runtime logs the same warning and aborts the operation.
- When the attribute is malformed, no request is issued and no state flags are changed.


#### Data source and JSON encoding

Source of data:

- `*post` uses the following source when building the request body:

  - If the host has a staged buffer, `src = this._stage`.
  - Otherwise, `src = this._data`.

- In other words, when `*stage` is active for the host, `*post` sends the staged snapshot; otherwise it sends the live data.

Encoding:

- The source object is serialized using `JSON.stringify(src, null, 2)`.
  - This yields a human readable JSON representation but the indentation has no functional effect.
- If `JSON.stringify` throws (for example due to circular references or non-serializable values):
  - The runtime logs a warning when warnings are enabled.
  - No request is issued.
  - No events are fired.
  - `$pending` and `$error` are not changed.

The exact JSON string that will be sent is also exposed to the lifecycle events for debugging and logging.


#### Response handling and writeback

Once the POST request completes, the response is handled in two stages:

1. Derive a `value` and `text` from the HTTP response.
2. Write `value` back into host data according to `prop`.

Content negotiation:

- The response `Content-Type` header is inspected:

  - If it includes `application/json` (case insensitive):

    - The runtime calls `await res.json()` to obtain `value`.
    - It then computes `text` for event payloads:
      - If `value` is already a string, use it as `text`.
      - Otherwise, try to `JSON.stringify(value)`, falling back to `String(value)` if needed.

  - Otherwise:

    - The runtime reads `text = await res.text()`.
    - It then tries `value = JSON.parse(text)`:
      - If parsing succeeds, `value` is the resulting object or array.
      - If parsing fails, `value` is the original text.

- If `res.json()` throws when the content type promises JSON, the error path is taken (see below).

Data writeback:

- Before writing, the runtime always stores the last write result into `$upload`:

  - `this._data.$upload = value`.

- Then the response is applied to host data using `prop`:

  - When `prop` is non-empty:

    - If `prop` matches the pattern `base[key]`:

      - `base` and `key` are extracted textually.
      - If `data[base]` is missing or not an object, it is initialized to `{}`.
      - The runtime assigns:

        - `data[base][key] = value`.

    - Otherwise:

      - The runtime assigns:

        - `data[prop] = value`.

  - When `prop` is empty or omitted:

    - The entire host data is replaced by the response:

      - `this._data = this._wrap_data(value)`.

    - This re-wraps the root in Sercrod's proxy layer similarly to other data entry points.

Tracking:

- Internally the runtime keeps a list of updated paths (such as `result` or `items[id]`) for event payloads.
- These paths reflect the textual interpretation of `prop` and do not perform nested path parsing beyond the single `base[key]` pattern.


#### State flags and error reporting

`*post` shares the same state slots as `*api` and `*fetch`:

- On first use, it ensures that the following properties exist on host data:

  - `$pending`  - whether an HTTP operation is currently in flight.
  - `$error`    - last error object or `null`.
  - `$download` - reserved for fetch results and set to `null` here.
  - `$upload`   - last write result, initially `null`.

Request lifecycle:

- Before the request is issued:

  - `$pending` is set to `true`.
  - `$error` is reset to `null`.
  - The host re-renders.

- On success (including non 2xx status codes as long as the response can be read):

  - `$pending` is set back to `false`.
  - `$upload` holds the parsed result until it is later cleared by the host's finalize phase.
  - `$error` remains `null`.

- On error:

  - `$pending` is set back to `false`.
  - `$error` is set to an object of the form:

    - `{ code: "POST", message: String(err) }`.

  - The error path covers:
    - Network failures or rejected fetch promises.
    - Exceptions thrown by `res.json()` when the response claims to be JSON.

Log output:

- When `this.error.warn` is `true`, `*post` writes warnings and errors to the console:
  - Missing or empty URL specification.
  - JSON encode failures on the request side.
  - POST failures on the response side.

Ephemeral nature of `$upload` and `$download`:

- After each update cycle, Sercrod's finalize phase resets `$upload` and `$download` back to `null`.
- Treat these properties as one-shot state indicators rather than long term storage.


#### Events

`*post` emits three dedicated events during its lifecycle:

- `sercrod-post-start`

  - Fired just before the request is issued.
  - Only fired when the URL and spec are valid and JSON encoding succeeded.
  - Event detail:

    - `stage` - `"post"`.
    - `host` - the Sercrod host instance.
    - `url` - the request URL.
    - `spec` - the original attribute string.
    - `prop` - the parsed property key, possibly an empty string.
    - `json` - the JSON string that will be sent as the request body.

- `sercrod-post-done`

  - Fired after a successful fetch and writeback.
  - This includes non 2xx HTTP statuses as long as the response could be read and interpreted.
  - Event detail:

    - `stage`    - `"post"`.
    - `host`     - the Sercrod host instance.
    - `url`      - the request URL.
    - `spec`     - the original attribute string.
    - `prop`     - the parsed property key.
    - `status`   - numeric HTTP status code.
    - `response` - raw response text used for logging.
    - `value`    - parsed value as written into data.
    - `json`     - the JSON request body that was sent.
    - `paths`    - array of touched paths such as `["result"]` or `["items[id]"]`.

- `sercrod-post-error`

  - Fired when the POST operation fails at the transport or JSON decoding level.
  - Event detail:

    - `stage` - `"post"`.
    - `host`  - the Sercrod host instance.
    - `url`   - the request URL.
    - `spec`  - the original attribute string.
    - `prop`  - the parsed property key.
    - `error` - stringified error message.

All three events bubble and are composed, so you can listen for them at the host level or higher in the DOM tree.


#### Integration with staged data (*stage, *apply, *restore)

`*post` is designed to cooperate with Sercrod's staging directives:

- When the host uses `*stage` or `n-stage`, the host maintains a staging buffer `_stage` that holds an editable snapshot of data.
- `*post` looks at this buffer first:

  - If `_stage` is not `null`, it is used as the POST body.
  - If `_stage` is `null` or missing, `*post` falls back to `_data`.

Implications:

- Together with `*stage`, `*apply`, and `*restore` you can:

  - Let users edit a staged copy of data.
  - Submit that staged copy with `*post` without immediately changing `_data`.
  - Decide later when to apply staged values into the live state.

- This means `*post` can be used both for optimistic flows (post and then apply) and for flows where a server response is needed before committing.


#### Relation to *fetch and *api

`*post` shares several concepts with `*fetch` and `*api`, but with distinct responsibilities:

- `*post`:

  - Always uses HTTP POST.
  - Always sends JSON built from the whole staged or live data object.
  - Uses `URL[:prop]` and the same writeback rules as `*fetch`.
  - Maintains state flags (`$pending`, `$error`, `$download`, `$upload`).
  - Emits dedicated `sercrod-post-*` events.

- `*fetch`:

  - Typically uses HTTP GET to load data into the host.
  - Uses `path/to.json[:prop]` and a similar writeback mechanism.
  - Can be attached to hosts or normal elements.
  - Provides automatic initial fetch for certain elements.

- `*api`:

  - General purpose HTTP client directive.
  - Supports configurable methods, bodies, and file uploads.
  - Uses `*into` or `n-into` to select a data target instead of `URL[:prop]`.
  - Reuses `$pending`, `$error`, `$download`, and `$upload`.

When to use which:

- Use `*post` when:

  - You want a simple “send current state as JSON” button.
  - You do not need per-request body expressions or dynamic URLs.
  - You want a symmetric counterpart to `*fetch` with similar writeback rules.

- Use `*api` when:

  - You need more control over HTTP method, body, URL composition, or file uploads.
  - You want to send only a subset of data or a custom payload.


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

- Keep the `*post` element simple:

  - Treat it as a button or link with static content.
  - Avoid placing other Sercrod directives on the same element or inside it.

- Choose `prop` carefully:

  - Use `:result` or similar when you want to preserve the rest of the host data.
  - Omit `:prop` only when you intentionally want to replace the entire root data with the response.

- Use the bracket notation for keyed maps:

  - `*post="/api/save.php:items[id]"` writes the response into `data.items[id]`.
  - Sercrod initializes `data[base]` as an object if needed.

- Watch `$pending` and `$error`:

  - Bind elements to `$pending` to disable buttons or show spinners while the request is running.
  - Bind to `$error` to show a simple error message when something fails at the transport or JSON level.

- Use events for advanced handling:

  - Listen for `sercrod-post-done` when you need status code based handling or logging.
  - Listen for `sercrod-post-error` when you need centralized error reporting.

- Avoid non-serializable values:

  - Ensure that the staged or live data does not contain functions, DOM nodes, or cyclic references that cannot be JSON encoded.
  - If JSON encoding fails, no request is sent and only a warning is produced when warnings are enabled.

- Align server APIs with Sercrod’s JSON contract:

  - Prefer designing endpoints that accept JSON bodies and return JSON values that can be stored directly in Sercrod data.
  - Use a consistent envelope or field naming scheme so that `URL[:prop]` and `*into` can be mapped mechanically.
  - This reduces glue code on both sides and makes error handling and logging easier.


#### Notes

- `*post` and `n-post` are exact aliases. Only one should be used per element.
- `*post` is only handled on regular elements inside a Sercrod host. It does not have special host level behavior.
- The `*post` attribute is treated as a literal string. There is no expression expansion or base URL resolution.
- The response is always treated as successful from a data perspective as long as it can be read:
  - HTTP status codes other than 2xx still result in a `sercrod-post-done` event.
  - If you need application level error handling, use the status code in that event.
- The writeback rule follows the same design as `*fetch`:
  - `:prop` writes into `data[prop]` or `data[base][key]` for bracket syntax.
  - No `:prop` replaces the entire data root.
- There are no additional structural restrictions specific to `*post`, but you should keep the clickable element free of other directives to avoid unexpected behavior due to the way it is cloned and inserted.
