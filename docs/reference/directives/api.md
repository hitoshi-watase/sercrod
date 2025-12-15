### *api / n-api

#### Summary

`*api` / `n-api` is the low-level HTTP gateway directive in Sercrod.

It is responsible for:

- Building an HTTP request from the current scope (URL, method, optional JSON body).
- Sending the request via `fetch` (or `FormData` upload for file inputs).
- Updating shared status flags on the host:
  - `$pending` - whether a request is in flight.
  - `$error` - last error object for this host.
  - `$download` - last value from GET-like requests.
  - `$upload` - last value from non-GET or file uploads.
- Optionally writing the response into a named data slot via `*into` / `n-into`.
- Dispatching events (`sercrod-api`, `sercrod-error`) for external observers.
- Automatically firing once for non-clickable elements, with deduplication.

Higher level helpers such as `*download` or `*upload` share the same `$pending` / `$error` / `$download` / `$upload` convention, but `*api` is the single general-purpose primitive for ad-hoc HTTP calls on normal elements.


#### Basic example

A simple GET that populates `user` and exposes status to children:

```html
<serc-rod id="app" data='{"user": null}'>
  <section
    *api="/api/user.json"
    *into="user">

    <p *if="$pending">Loading user...</p>

    <p *if="$error" class="error">
      <span *print="$error.message"></span>
    </p>

    <pre *if="user" *print="JSON.stringify(user, null, 2)"></pre>
  </section>
</serc-rod>
```

Key points in this example:

- The `section` element owns the HTTP call through `*api`.
- The response is written as-is to `user` (because of `*into="user"`).
- `$pending` and `$error` are shared on the host and can be read from any child.
- `user` starts as `null` but is explicitly initialized by `*api` if missing.


#### Behavior

##### Core behavior

When Sercrod finds `*api` or `n-api` on an element during rendering:

1. It clones the element (shallow clone, without children).
2. It reads the relevant attributes:
   - `*api` / `n-api` - URL template string.
   - `method` - HTTP method, default `"GET"`.
   - `body` or `payload` - expression for request body (non-GET only).
   - `*into` / `n-into` - optional destination key in the host data.
3. It detects file uploads:

   - `isFile` is `true` when the cloned element is `<input type="file">`.

4. It initializes status fields on `this._data` if they are missing:
   - `$pending` - `false`
   - `$error` - `null`
   - `$download` - `null`
   - `$upload` - `null`
   - `into` key - when provided and not present, it is created and set to `null`.
5. It appends the clone to the parent.
6. It wires up request logic depending on the element type:
   - `<input type="file">` - prepare upload on `change`.
   - Button-like elements - trigger JSON-like request on `click`.
   - Other elements - schedule a one-shot automatic request.
7. It renders the original children into the clone with the current scope, so that children can read `$pending`, `$error`, `$download`, `$upload`, and the `*into` variable.


#### Request URL and placeholders

##### URL source

The URL template is taken exactly from:

- `*api` attribute, or
- `n-api` attribute, when `*api` is not present.

The raw string is passed to an internal helper `_expand_text(urlRaw, scope, work)`, which performs placeholder expansion based on the global delimiters.

By default, the delimiters are:

- `start: "%"`
- `end: "%"`

So a URL such as:

```html
<section
  *api="/api/users/%userId%?ts=%Date.now()%"
  *into="user">
</section>
```

is turned into a concrete URL by evaluating each expression between the delimiters in the current scope, then substituting the result.

Notes:

- If the expression throws, the placeholder is replaced with an empty string by the placeholder filter.
- Placeholder expansion is performed at each request, not just once, so dynamic values (for example timestamps or tokens) are evaluated at call time.


#### HTTP method and body

##### Method

The HTTP method is read from the `method` attribute on the same element, then uppercased:

- `method="GET"` (default when omitted).
- `method="POST"`, `method="PUT"`, `method="PATCH"`, and so on - passed through unchanged.

For `<input type="file" *api>`, GET is automatically converted to POST during the upload, but the original `method` string is still used in the non-file path and in event payloads for JSON-like requests.

##### JSON body (non-file elements)

For non-file elements, `*api` can optionally send a JSON body when the method is not GET.

The body expression is taken from:

- `body` attribute, or, if missing,
- `payload` attribute.

When `bodyExp` is non-empty and `method !== "GET"`:

1. Sercrod evaluates the expression with `eval_expr(bodyExp, scope, { el: work, mode: "body" })`.
2. If evaluation succeeds and the result is not `null` or `undefined`, it builds:
   - `headers: { "Content-Type": "application/json" }`
   - `body: JSON.stringify(value)`
3. If evaluation of the body expression throws, the error is ignored, and the request is sent without a body.

For `method === "GET"`:

- The body expression is ignored.
- No request body is sent.

##### Parsing the response

After the request completes:

- Sercrod inspects the response `Content-Type` header (lowercased).
- If it contains `application/json`:
  - It calls `res.json()` and uses the resulting value.
- Otherwise:
  - It calls `res.text()`.
  - It then attempts `JSON.parse(text)`.
    - On success, the parsed value is used.
    - On failure, the original text string is kept.

Arrays, objects, and primitive values are all stored as-is.


#### File uploads with `<input type="file" *api>`

When `*api` is placed on an `<input type="file">`:

```html
<serc-rod id="uploader">
  <input
    type="file"
    name="files[]"
    *api="/upload">
</serc-rod>
```

the behavior is:

- `isFile` is detected from the element type.
- The element gets a `change` listener.
- On `change`:
  - Sercrod collects all chosen files into a `FormData` instance.
  - The form field name is:
    - `name` attribute value if present, otherwise
    - `"files[]"`.
  - The HTTP method is either:
    - `method` attribute value if provided and not `"GET"`, or
    - `"POST"` when `method` is `"GET"` or omitted.
  - The request is sent using `fetch(url, { method, body: formData })`.

The response parsing and placement are the same as for JSON-like requests, with these differences:

- `$upload` is always updated with the response value.
- `sercrod-api` is dispatched with `method: "POST(FORMDATA)"`.
- On error:
  - `$error` is set to `{ code: "UPLOAD", message: String(err) }`.
  - `sercrod-error` is dispatched with `detail: { url, method: "POST(FORMDATA)", into, error: String(err) }`.

There is no automatic request on page load for file inputs. Uploads only happen when the user selects files.


#### Shared state flags and *into

##### Status flags

`*api` ensures that the following properties exist on the host data object:

- `$pending` - `boolean`
  - `true` while a request is in flight.
  - `false` once the request finishes (success or error).
- `$error` - `null` or `{ code, message }`
  - `null` before the first request and after each successful request.
  - An error object when a request throws (network error, fetch error, JSON failure, and so on).
- `$download` - `any`
  - Last value from GET-like JSON requests.
  - Shared across all `*api` and related network helpers on the same host.
- `$upload` - `any`
  - Last value from non-GET JSON requests or file uploads.
  - Shared across the host.

These flags are created even when `*into` is not set, so you can always:

- show a spinner while `$pending` is true.
- show an error area when `$error` is non-null.
- inspect `$download` or `$upload` directly for diagnostics.

##### `*into` / `n-into`

`*into` and `n-into` allow you to additionally store the response into a named data property:

- The attribute value is treated as a plain string key.
- It is not evaluated as an expression.
- When the key is non-empty and not yet present, Sercrod initializes it with `null`.
- On success, `this._data[into]` is set to the final response value.

Example:

```html
<serc-rod id="app" data='{"profile": null, "logs": []}'>
  <section
    *api="/api/profile"
    *into="profile">

    <p *if="$pending">Loading profile...</p>
    <p *if="$error" *print="$error.message"></p>

    <h2 *if="profile" *print="profile.name"></h2>
  </section>
</serc-rod>
```

Important notes:

- Because the key is literal, `*into="user"` always writes to `data.user`, not to a dynamic path.
- If you reuse the same `*into` key in several `*api` blocks on the same host, the last successful request overwrites the previous value.
- Internally, Sercrod also tracks `*into` names in an internal `_intos` list, used by other features (for example update hooks). This is an implementation detail, but explains why `*into` is cheap to use even when you do not immediately read the value.


#### Events

`*api` dispatches two CustomEvents on the element that owns the directive.

##### `sercrod-api`

Dispatched after a successful request, with `detail` containing:

- For JSON-like (non-file) requests:
  - `url` - resolved URL at call time.
  - `method` - the HTTP method (for example `"GET"`, `"POST"`).
  - `status` - numeric HTTP status code.
  - `into` - resolved `*into` key or empty string.
  - `value` - parsed response value (JSON, parsed text, or raw text).

- For file uploads:
  - `url` - resolved URL at call time.
  - `method` - the fixed string `"POST(FORMDATA)"`.
  - `status` - numeric HTTP status code.
  - `into` - resolved `*into` key or empty string.
  - `value` - parsed response value.

The event is configured with:

- `bubbles: true`
- `composed: true`

so ancestor elements and outer frameworks can listen for it.

##### `sercrod-error`

Dispatched when the request, parsing, or internal processing throws. Details differ slightly:

- For JSON-like (non-file) requests:
  - `$error` is set to `{ code: "API", message: String(err) }`.
  - The event detail is `{ url, method, into, error: String(err) }`.

- For file uploads:
  - `$error` is set to `{ code: "UPLOAD", message: String(err) }`.
  - The event detail is `{ url, method: "POST(FORMDATA)", into, error: String(err) }`.


#### Evaluation timing and scope

##### Scope used for URL and body

Inside `_renderElement(node, scope, parent)`, Sercrod maintains:

- `scope` - the scope object passed into this element from its parent (already includes ancestor `*let` effects and loop variables).
- `effScope` - the effective scope that may be further modified by `*let` on this element before children are rendered.

For `*api`:

- URL placeholders and body expressions are evaluated with `scope`, not `effScope`.

This means:

- Ancestor `*let` expressions are visible inside `*api`, because parents call `renderNode(child, effScope, parent)` with their updated effective scope.
- Loop variables (`*for`, `*each`) are visible, because they are part of the incoming `scope`.
- Additional variables introduced by `*let` on the same element are not visible to `*api` in the current implementation. They are only visible to children that are rendered after `*api`.

If you need to prepare derived values for `*api`, prefer one of these patterns:

- Define them in the host `data` up front.
- Use `*let` on an ancestor wrapper element.
- Compute them inside the body expression by referring directly to the base data.

##### Child rendering order

The order around `*api` is:

1. Status fields (`$pending`, `$error`, `$download`, `$upload`, and `into` key) are created if missing.
2. The host clone is appended to the DOM.
3. Event handlers and auto-run logic are registered.
4. Children are rendered into the clone, using the current effective scope.

This guarantees that:

- Children can safely read `$pending`, `$error`, `$download`, `$upload`, and the `*into` variable even before the first request has completed.
- `$pending` begins as `false` and is only toggled to `true` once the actual request starts.


#### Execution model and triggers

##### Non-file elements

For non-file elements, `*api` chooses the trigger based on the element type:

- Clickable elements:
  - `<button>`
  - `<a>` without a `download` attribute
  - `<input type="button">`, `<input type="submit">`, `<input type="reset">`

  These get a `click` listener that calls the JSON-like request function.

  - Each click sends a new request.
  - There is no deduplication for manual clicks.

- Non-clickable elements:
  - Any element that is not considered clickable and not a file input (for example `section`, `div`, `span`, and so on).

  These get an automatic one-time request after the next animation frame.

##### Deduplication key for auto-run

For non-clickable, non-file elements, `*api` builds an automatic deduplication key and uses an internal `__apiOnce` set:

- Sercrod computes a body hash once at render time:
  - It evaluates the body expression in the same way as `runJsonLike`.
  - It then `JSON.stringify`s the result.
  - On any error, the hash is an empty string.
- It defines `resolveUrl()` that expands placeholders using `_expand_text`.
- It then builds a URL-only string for deduplication:
  - It tries `new URL(resolveUrl(), location.href)`.
  - If that succeeds:
    - It removes the `ts` query parameter, if present.
    - It uses `pathname` plus the remaining query string.
  - If creating a `URL` fails:
    - It falls back to a simple string replace that strips `ts` and trailing `?` or `&`.

The final once-key is:

- `method + " " + dedupPathAndQueryWithoutTs + " :: " + into + " :: " + bodyHash`

At render time:

- If `__apiOnce` does not contain the key:
  - The key is added to `__apiOnce`.
  - `requestAnimationFrame(runJsonLike)` is scheduled to execute once.
- If `__apiOnce` already contains the key:
  - No automatic request is scheduled.

As a result:

- Changing the URL (except for the `ts` parameter) causes a new automatic request.
- Changing the HTTP method causes a new automatic request.
- Changing the literal `*into` key causes a new automatic request.
- Changing the body expression result causes a new automatic request.
- Re-rendering the same element with the same URL (ignoring `ts`), method, `into`, and body result produces no additional automatic requests.

##### File inputs

For `<input type="file" *api>`, there is:

- No auto-run.
- No deduplication based on `__apiOnce`.
- Each `change` event sends an upload request with the current selection.


#### Use with conditionals and loops

##### Showing loading and errors

A typical pattern is:

```html
<serc-rod id="users" data='{"items": [], "selectedId": null}'>
  <section *api="/api/users" *into="items">
    <p *if="$pending">Loading users...</p>

    <p *if="$error" class="error">
      <span *print="$error.message"></span>
    </p>

    <ul *if="!$pending && !$error && items">
      <li *for="user of items">
        <button
          @click="selectedId = user.id"
          *print="user.name">
        </button>
      </li>
    </ul>
  </section>
</serc-rod>
```

Because `*api` fires automatically on the non-clickable `section`, this:

- Shows "Loading users..." while the request is in flight.
- Shows an error message if `$error` is non-null.
- Renders the list when `items` has been populated.

##### Inside loops

You can place `*api` inside `*for` or `*each` loops, but keep in mind:

- Loop variables are visible to `*api` expressions, because they are part of the incoming `scope`.
- The `*into` key is literal, so reusing the same `*into` inside a loop will cause each iteration to overwrite the same data property on the host.

For independent state per iteration, consider:

- Having a dedicated `*api` host per entity (for example one `<section>` per user ID, each with a different literal `*into` key).
- Structuring your API to return all needed data at once and iterating purely on the client side.


#### Use with other directives

##### `*into`

`*into` is designed to be used with `*api` (and some related directives such as `*websocket` and upload helpers). When combined with `*api`:

- `*into` controls where the response is stored.
- `$download` and `$upload` are always updated irrespective of `*into`.

##### Other network helpers

Although `*api`, `*download`, and `*upload` are related conceptually, they consume the element in different ways:

- Each expects to own the element and its children.
- In the rendering pipeline, only one of these directives is applied per element.

In the current implementation:

- If `*api` or `n-api` is present on an element, it takes precedence for that element.
- Other network helpers on the same element are effectively ignored because `_renderElement` returns after handling `*api`.

For clarity and future-proofing, it is recommended to:

- Use at most one of `*api`, `*download`, `*upload`, or similar network primitives on a single element.
- Split different responsibilities across separate wrapper elements when needed.

##### Event handlers (`@click` and others)

`*api` coexists with event directives such as `@click`, `@change`, and others:

- Sercrod simply adds another listener for `click` or `change` on the same element.
- You can safely add your own handlers alongside `*api` to update state or log events.

Be aware that:

- For clickable elements, every `click` triggers the `*api` call. If your own handler also changes data, it will run in addition to the HTTP request.


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

- Prefer literal URLs in `*api` and use placeholder expansion for dynamic parts:
  - `*api="/api/users/%userId%"` is usually clearer than concatenating strings in the attribute.

- Always choose a descriptive `*into` key when you intend to use the value later:
  - For example `*into="profile"`, `*into="items"`, `*into="result"`.

- Use `$pending` and `$error` for control flow:
  - Render loading states.
  - Hide or disable buttons while `$pending` is true.
  - Show `$error.message` in a dedicated area.

- For one-off initial loads, prefer non-clickable hosts so automatic firing performs the first request for you.

- For actions like "Save", "Retry", or "Load more", prefer clickable hosts (buttons, links) so the user is in control.

- When you need cache busting with timestamps, put them in a `ts` query parameter:
  - `*api="/api/users?ts=%Date.now()%"`

  `*api` ignores `ts` when computing the automatic deduplication key so the first automatic request per configuration is still only sent once.

- Handle file uploads through `<input type="file" *api>`, and show progress or final results by reading `$upload` or the `*into` variable.


#### Examples

##### GET with ignored body

Because `*api` only uses the body expression for non-GET methods, the following does not send a body:

```html
<section
  *api="/api/search"
  method="GET"
  body="{ query: term }"
  *into="results">
</section>
```

- URL is `/api/search` (plus any placeholder expansions).
- The body expression is ignored, and no body is sent.
- The response still populates `results` and `$download`.

To send JSON, change to `method="POST"`:

```html
<section
  *api="/api/search"
  method="POST"
  body="{ query: term }"
  *into="results">
</section>
```

##### Button-triggered POST

```html
<serc-rod id="formHost" data='{"form": {"name": "", "email": ""}, "saved": null}'>
  <input type="text"
         :value="form.name"
         @input="form.name = $event.target.value">

  <input type="email"
         :value="form.email"
         @input="form.email = $event.target.value">

  <button
    *api="/api/submit"
    method="POST"
    body="form"
    *into="saved">
    Save
  </button>

  <p *if="$pending">Saving...</p>
  <p *if="$error" *print="$error.message"></p>
  <p *if="saved" *print="'Saved as id ' + saved.id"></p>
</serc-rod>
```

- The request is only sent when the button is clicked.
- The entire `form` object is serialized and sent as JSON.
- The response is placed into `saved` and `$upload`.

##### Simple file upload with preview

```html
<serc-rod id="avatarHost" data='{"avatarResult": null}'>
  <input
    type="file"
    name="avatar"
    accept="image/*"
    *api="/api/avatar"
    *into="avatarResult">

  <p *if="$pending">Uploading...</p>
  <p *if="$error" *print="$error.message"></p>

  <p *if="avatarResult && avatarResult.url">
    <img :src="avatarResult.url" alt="Avatar">
  </p>
</serc-rod>
```

- Selecting a file sends it via `FormData` to `/api/avatar`.
- The parsed response is written into `avatarResult` and `$upload`.
- Errors are surfaced through `$error` and the `sercrod-error` event.


#### Notes

- `*api` is the single low-level primitive for HTTP calls on normal elements. Other helpers reuse the same status fields but provide different ergonomics.
- Responses are not transformed beyond JSON parsing. If you need special handling, do it in your template or in `@` event handlers listening for `sercrod-api`.
- The `*into` key is literal for now. There is no special syntax for nested paths or dynamic property names on this directive.
- Auto-run deduplication is intentionally conservative. If you need to force a new automatic request without user action, change one of the stable components of the key (URL except for `ts`, method, `*into`, or the body expression).
- Future versions of Sercrod may refine the interaction between `*let` and `*api`. The current behavior is that `*api` sees ancestor `*let` effects and loop variables but not new names introduced by `*let` on the same element.
