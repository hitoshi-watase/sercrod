### @keyup

#### Summary

`@keyup` attaches a handler to the native `keyup` event on an element.
The expression on `@keyup` is evaluated when the user releases a key while the element has focus.
Typical uses include:

- reacting to keyboard shortcuts,
- running validation as the user types,
- triggering search or filtering when the user releases Enter,
- updating live previews based on current input.

`@keyup` is part of the event handler family (such as `@click`, `@input`, `@keydown`) and follows the same generic event rules in Sercrod.


#### Basic example

Triggering search when the user presses Enter:

```html
<serc-rod id="search-app" data='{
  "query": "",
  "results": [],
  "last_key": ""
}'>
  <input type="search"
         :value="query"
         @keyup="
           last_key = $event.key;
           if($event.key === 'Enter'){
             search(query);
           }
         ">

  <p *if="last_key">
    Last key: {{%last_key%}}
  </p>

  <ul>
    <li *for="item of results">{{%item%}}</li>
  </ul>
</serc-rod>
```

Behavior:

- The input is bound to `query`.
- On every `keyup`, the handler records the last key to `last_key`.
- When the key is `"Enter"`, the expression calls `search(query)` in the current scope.
- Sercrod runs a light child update so that `last_key` and `results` are reflected in the DOM.


#### Behavior

Core rules:

- Target event  
  `@keyup` wires the native `keyup` event on the element where it is declared.
  The element must be focusable for the handler to fire (for example, form controls or elements made focusable via `tabindex`).

- Expression evaluation  
  Sercrod parses the attribute value as an expression (for example `search(query)` or `if($event.key === 'Enter') submit()`).
  When the event fires, Sercrod evaluates this expression using its event evaluator, with access to data and the event object.

- Side effects only  
  The return value of the expression is ignored.
  What matters is the side effect of the expression (for example writing to data or calling functions).

- Keyboard event access  
  The native `KeyboardEvent` instance is exposed as:

  - `$event` and `$e` (both point to the same `KeyboardEvent`),
  - The element is exposed as `el` and `$el`.

  You can use `$event.key`, `$event.code`, `$event.ctrlKey`, and similar properties exactly as you would in plain JavaScript.

- Multiple directives on the same element  
  You can combine `@keyup` with other event directives on the same element (for example `@keydown`, `@input`, `@blur`) as long as each uses a different event name.
  Each handler is evaluated independently when its event fires.


#### Evaluation timing

`@keyup` participates in Sercrod’s normal rendering and event lifecycle:

- Structural phase  
  Structural directives such as `*if`, `*for`, `*each`, `*switch`, and `*include` are applied first.
  If these directives remove or replace the element, `@keyup` is attached only to the final rendered element.

- Attribute phase  
  Once the element is kept, Sercrod processes its attributes.
  Event attributes whose names start with the configured event prefix (by default `"@"`) are detected, and `_renderEvent` is called for each of them, including `@keyup`.

- Listener attachment  
  In this phase, Sercrod creates a handler function and attaches it with `addEventListener("keyup", handler, options)`, where `options` reflects event modifiers such as `.capture`, `.passive`, and `.once`.

- Event firing  
  When the browser fires `keyup` on that element:

  - Sercrod prepares an evaluation scope for this host and element.
  - It injects the `KeyboardEvent` into `$event` and `$e`, and the element into `el` and `$el`.
  - It evaluates the `@keyup` expression in that scope.
  - After evaluation, Sercrod triggers an update pass (described below) so that data changes are reflected in the DOM.

There is no special debounce or delay attached to `@keyup` itself; it executes in the same turn as the native event.


#### Execution model

At a high level, the runtime behaves as follows for `@keyup`:

1. During rendering, Sercrod finds an attribute whose name starts with the event prefix (by default `"@"`) and whose event name portion is `"keyup"`.
2. It extracts:

   - the event name `ev = "keyup"`,
   - the list of modifiers (for example `"prevent"`, `"stop"`, `"once"`, `"capture"`, `"passive"`),
   - the expression string from the attribute value, for example `onKey($event)`.

3. It constructs listener options from modifiers:

   - `capture: mods.has("capture")`,
   - `passive: mods.has("passive")`,
   - `once: mods.has("once")`.

4. It defines a handler `handler(e)` that:

   - Applies `preventDefault` if `mods` contains `"prevent"`.
   - Applies `stopPropagation` if `mods` contains `"stop"`.
   - Constructs an evaluation scope in which:

     - `$event` and `$e` refer to `e`,
     - `el` and `$el` refer to the element,
     - other names are resolved first against Sercrod data, then against the provided scope, and finally against `window`.

   - Calls `this.eval_event(expr, scope, { el, $event: e })` to execute the expression.
   - Decides the update strategy and runs a suitable update method (see below).
   - If the `"once"` modifier was present, removes the handler from the element after the first call.

5. Before attaching the handler, Sercrod ensures that there is at most one handler per event name on the element:

   - It keeps a private `el._sercrod_handlers[ev]`.
   - If a previous handler exists for `"keyup"`, it is removed before the new handler is attached.

6. It attaches the handler using `el.addEventListener("keyup", handler, options)`.

This mechanism is shared by all `@event` directives; `@keyup` is one instance of this generic path, with the event name `"keyup"`.


#### Key data and $event

Inside a `@keyup` handler expression:

- `$event` and `$e` are instances of `KeyboardEvent`.
- Useful properties include:

  - `key` (logical key, for example `"Enter"`, `"a"`, `"Escape"`),
  - `code` (physical key, for example `"KeyA"`, `"Enter"`),
  - modifier states such as `ctrlKey`, `altKey`, `shiftKey`, `metaKey`,
  - `repeat` (whether the key is being held down and auto repeating).

- `el` and `$el` point to the element where `@keyup` is declared.
- Reads of other identifiers consult:

  1. Sercrod’s data object for the host,
  2. The provided scope for directives around this element (such as loop variables),
  3. `window` as a final fallback.

- Writes to properties in the data object propagate back into Sercrod data and mark them as dirty so that the subsequent update pass can reflect changes in the DOM.


#### Update behavior for @keyup

`@keyup` is treated as an input-like event in Sercrod’s update strategy.

After the handler runs, the runtime computes:

- whether the event is considered input-like (`is_inputish`), and
- whether the event is classified as non mutating according to `config.events.non_mutating`.

For `ev === "keyup"`:

- `keyup` is explicitly listed as input-like.
- As a result, after running the handler, Sercrod calls a lightweight child update on the host:

  - `this._updateChildren(false, this)`.

This has two practical consequences:

- Keyup handlers can safely mutate data without causing the whole host to be re rendered.
- Focus and caret position are preserved more reliably during keyboard input, since only children are refreshed.

The classification as input-like is built into the runtime and is independent of the default `non_mutating` configuration (which lists hover and pointer events, but not `keyup`).


#### Use with loops and conditionals

`@keyup` composes naturally with structural directives controlling the element itself:

- Inside loops:

  ```html
  <ul>
    <li *for="item of items">
      <input type="text"
             :value="item.label"
             @keyup="item.label = $event.target.value">
    </li>
  </ul>
  ```

  Each iteration has its own handler and its own `item` in scope.

- With `*if`:

  ```html
  <input *if="mode === 'search'"
         type="search"
         :value="query"
         @keyup="if($event.key === 'Enter') runSearch(query)">
  ```

  The handler is attached only when `mode === 'search'` is true.
  If the element is removed by `*if`, the listener is removed along with the element during the next render.

Structural directives do not change the semantics of `@keyup`; they only decide whether the element (and its handler) exist in the rendered tree.


#### Use with form inputs and staged updates

`@keyup` is especially useful for form inputs and staged editing:

- Live filtering without committing immediately:

  ```html
  <input type="search"
         :value="filters.query"
         @keyup="filters.query = $event.target.value">
  ```

  The data is kept in sync with the DOM on each key release, and Sercrod performs a child update for efficient re rendering.

- Combining with `*stage` for drafts:

  ```html
  <form *stage="'editor'">
    <textarea
      :value="editor.body"
      @keyup="editor.body = $event.target.value">
    </textarea>

    <button type="button" *apply="'editor'">Save</button>
    <button type="button" *restore="'editor'">Cancel</button>
  </form>
  ```

  Here, `@keyup` only touches the staged `editor` snapshot.
  The user can type freely, and only when they press “Save” does `*apply` commit the staged data back into the main data object.


#### Sercrod-specific restrictions

For `@keyup`, the main Sercrod-specific points are:

- Single handler per event name per element  
  Sercrod maintains at most one handler per event name on each element.

  - This is a runtime detail: when the host re renders and encounters `@keyup` again, it removes the previous handler for `"keyup"` before attaching a new one.
  - From a template perspective, you normally declare `@keyup` once per element.

- Event prefix  
  The event prefix (by default `"@"`) is taken from `config.events.prefix`.
  If you change this prefix globally, you must also update your templates accordingly (for example from `@keyup` to `ne-keyup` if the prefix was changed to `"ne-"`).
  The event name `keyup` itself does not change.

There are no special combination restrictions unique to `@keyup`:

- You can combine `@keyup` with other event directives (`@keydown`, `@input`, `@blur`, and so on) as long as each uses a different event name.
- You can combine `@keyup` with attribute bindings like `:value`, `:class`, `:style`, or with structural directives like `*if` and `*for` on the same element.


#### Best practices

- Use `@keyup` for user facing feedback  
  `@keyup` is well suited for behaviors where you want to respond to user input without blocking typing, such as live search hints or inline validation.

- Use `$event.key` for shortcut logic  
  Prefer `if($event.key === 'Enter')` and similar checks over raw key codes for readability and compatibility.

- Combine with `@keydown` when necessary  
  For some interactions (such as continuous movement or game controls), you may want to use `@keydown` to start an action and `@keyup` to stop it.

- Keep handler expressions focused  
  As with other event directives, keep inline expressions small.
  Move complex logic to functions defined in your data or helpers, and call those from `@keyup`.

- Avoid heavy work in the handler  
  Do not perform long running computations or blocking operations directly inside the `@keyup` expression.
  Use asynchronous APIs or queue work into other parts of your application if needed.


#### Additional examples

Simple shortcut: submit on Enter, ignore other keys:

```html
<form *post="'/api/search:result'">
  <input type="search"
         :value="query"
         @keyup="
           if($event.key === 'Enter'){
             $el.form.requestSubmit();
           }
         ">

  <button type="submit">Search</button>
</form>
```

Toggle a help overlay with a keyboard shortcut:

```html
<serc-rod id="help-app" data='{
  "show_help": false
}'>
  <input type="text"
         :value="input"
         @keyup="
           if($event.key === 'F1'){
             show_help = !show_help;
           }
         ">

  <aside *if="show_help">
    Press F1 again to hide this help.
  </aside>
</serc-rod>
```

Implement a simple key logger for debugging:

```html
<serc-rod id="logger" data='{
  "keys": []
}'>
  <input type="text"
         @keyup="
           keys.push($event.key);
           if(keys.length > 20) keys.shift();
         ">

  <p>Recent keys: {{%keys.join(' ')%}}</p>
</serc-rod>
```


#### Notes

- `@keyup` is a generic event handler for the native `keyup` event.
- The event object is available as `$event` and `$e`, while the element is available as `el` and `$el`.
- After each `@keyup` handler call, Sercrod performs a lightweight child update on the host, treating keyup as an input-like event so that focus and caret remain stable.
- Event modifiers such as `.prevent`, `.stop`, `.once`, `.capture`, and `.passive` are supported and handled before the expression is evaluated.
- The event prefix is configurable, but the event name `keyup` is not; when the prefix changes, you must update the markup accordingly.
