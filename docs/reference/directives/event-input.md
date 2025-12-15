### @input

#### Summary

@input attaches a handler to the native input event on an element.
The expression on @input is evaluated every time the browser fires an input event for that control.
Typical uses include live validation, updating derived state as the user types, or reacting to slider or range changes.

@input is part of the event handler family (such as @click, @change, @blur) and follows the same general evaluation rules as other @ directives, with input-specific update behavior inside the Sercrod runtime.


#### Basic example

Tracking a live character count while the user types:

```html
<serc-rod id="app" data='{
  "text": "",
  "length": 0
}'>
  <textarea :value="text"
            @input="length = ($event.target.value || '').length">
  </textarea>

  <p>
    Length: {{%length%}} characters
  </p>
</serc-rod>
```

Behavior:

- The textarea is initially empty, with `text` and `length` both zero-like.
- Every time the user edits the textarea, the browser fires an input event.
- Sercrod evaluates the @input expression with `$event` set to the native event.
- `length` is updated to match the length of the current textarea value.
- The paragraph is re-rendered with the latest length.


#### Behavior

Core rules:

- Target event  
  @input wires the native input event on the element where it appears.
  Which user actions cause input to fire is determined by the browser and the element type (for example, typing in text inputs, dragging sliders, or changing some controls).

- Expression evaluation  
  Sercrod parses the attribute value as a JavaScript expression or statement block.
  When input fires, Sercrod evaluates that expression in the element’s current Sercrod scope.

- Access to event and element  
  Inside the expression you can access:

  - `$event` or `$e` for the native event object.
  - `el` or `$el` for the element that received the event.

- One way effect  
  The return value of the expression is ignored.
  @input is for side effects such as writing to data, calling helper functions, or both.

- Coexistence with bindings  
  @input does not replace Sercrod’s form bindings (for example *input).
  You can use @input alongside *input, :value, or :checked on the same element. Sercrod will attach both the data-binding listener and the @input listener, and both handlers will run when the browser fires input.

Sercrod does not change the native timing or semantics of the input event; it only evaluates the expression when the event occurs and then applies its usual re-render rules for input-like events.


#### Evaluation timing

For @input, evaluation follows the general event pipeline:

- Structural phase  
  Structural directives such as *if, *for, *each, *switch, and *include first decide whether the element exists and what its children are.
  If an element is removed by a structural directive, no @input handler is attached.

- Attribute phase  
  Once Sercrod has decided to keep the element, it processes its attributes.
  Event attributes whose name begins with the configured event prefix (by default "@") are recognized as event handlers.
  For @input, this means an input listener is registered in the same pass where colon bindings like :value or :class are processed.

- Re-render phase  
  After the handler expression has run, Sercrod classifies the event as input-like.
  For input-like events (including input itself), Sercrod performs a lightweight update of the host’s children rather than a full host re-render.
  This is done to keep focus stable while still updating dependent content (for example, live counters or validation messages).

On subsequent renders (due to data changes or other events), Sercrod ensures that @input still points to the current expression and scope.


#### Execution model

Conceptually, the runtime behaves as follows for @input:

1. During rendering, Sercrod finds an attribute whose name matches the event prefix plus input (by default @input).
2. It extracts:

   - The event name `input`.
   - Any modifiers (for example, `@input.prevent.update`).
   - The raw expression string from the attribute value.

3. Sercrod registers a native listener on the element using `addEventListener("input", handler, options)` with:

   - `capture` set if `.capture` modifier is present.
   - `passive` set if `.passive` modifier is present.
   - `once` set if `.once` modifier is present.

4. When the browser fires input:

   - The handler applies modifiers:

     - `.prevent` calls `event.preventDefault()`.
     - `.stop` calls `event.stopPropagation()`.

   - Sercrod creates a proxy scope in which:

     - `$event` and `$e` refer to the native event.
     - `el` and `$el` refer to the target element.
     - Reads fall back from the local scope to `window` if a name is not found.
     - Writes update the local scope and, when relevant, the host data.

   - Sercrod calls `eval_event` with the expression and this proxy scope.
   - If evaluation throws, Sercrod catches the error and routes it through the configured logging mechanisms.

5. After the expression runs, Sercrod decides how to refresh:

   - For @input, the event is classified as “input-like”, so Sercrod performs a lightweight children-only update of the host.
   - Non-input events may instead perform a full host update, depending on configuration and modifiers.

6. If `cleanup.handlers` is enabled in the configuration, Sercrod removes the original @input attribute from the DOM after the listener is attached, leaving only the wired listener and any non-directive attributes.

The @input handler does not attempt to modify the value of the control by itself; it just runs your expression and then triggers the appropriate re-render path.


#### Use with form fields and data bindings

@input is often paired with form bindings and colon attributes:

- With `*input` (two-way binding):

  ```html
  <serc-rod id="app" data='{
    "form": { "name": "" },
    "touched": { "name": false }
  }'>
    <input type="text"
           *input="form.name"
           @input="touched.name = true">

    <p *if="touched.name && !form.name">
      Please enter your name.
    </p>
  </serc-rod>
  ```

  - *input keeps `form.name` synchronized with the element’s value.
  - @input marks the field as touched whenever the user edits it, regardless of validation result.

- With `*eager` and `*lazy`:

  ```html
  <input type="text"
         *input="form.query"
         *eager
         @input="results = search(form.query)">
  ```

  Here:

  - *input with *eager updates `form.query` on every input event.
  - @input immediately runs a search using the latest query string.
  - Because @input is treated as input-like, Sercrod applies a children-only update after the handler, keeping focus stable.

- With simple colon bindings:

  ```html
  <input type="range" min="0" max="100"
         :value="level"
         @input="level = Number($event.target.value)">
  ```

  In this pattern, @input itself manages the data update, while :value reflects the current value back into the control on re-render.


#### Use with conditionals and loops

@input works well inside conditionals and loops:

- Conditional inputs:

  ```html
  <input type="text"
         *if="mode === 'advanced'"
         *input="filters.keyword"
         @input="filters.dirty = true">
  ```

  The handler is attached only when the element exists (for example, in advanced mode).

- Inputs in loops:

  ```html
  <ul>
    <li *for="item of items">
      <input type="text"
             *input="item.label"
             @input="item.dirty = true">
    </li>
  </ul>
  ```

  Each iterated input gets its own @input handler, and the expression is evaluated with that iteration’s `item` in scope.

If a structural directive replaces an input element on re-render, Sercrod re-attaches the @input handler on the new node as part of normal rendering.


#### Sercrod-specific restrictions

For @input there are no special “cannot combine on the same element” rules beyond the shared event rules:

- You can combine @input with:

  - Other event handlers on the same element, as long as they use different event names (for example `@focus`, `@blur`, `@change`).
  - Colon bindings like :value, :class, :style.
  - Structural directives that own the element itself (for example `*if`, `*for`, `*each`) as long as they are compatible with the markup.

- @input does not conflict with *input or n-input.
  Sercrod attaches both the form binding listeners and the @input listener when they are present together.

Internally, Sercrod treats input as an “input-like” event and always performs a lightweight children-only update after your handler runs.
In the current implementation, the generic `.update` and `.noupdate` modifiers do not suppress this behavior for @input.


#### Best practices

- Keep handlers light  
  @input can fire very frequently (on every keystroke or small change).
  Keep the expression small and inexpensive: avoid heavy loops, long-running computations, or large network calls directly inside @input.

- Delegate heavy work  
  For expensive operations (such as full-text search or remote validation), delegate to a debounced or throttled helper function rather than doing everything inline in the @input expression.

- Use @input for UI reactions, *input for data sync  
  Prefer *input (and n-input) to keep data synchronized with control values.
  Use @input for supplementary side effects such as tracking “dirty” or “touched” flags, updating previews, or showing helper messages.

- Be mindful of IME composition  
  Sercrod’s @input handler receives input events as the browser fires them.
  On some platforms and input methods, this can happen many times while the user is composing text.
  Design @input logic so it remains robust and fast under frequent updates.

- Combine with @change when appropriate  
  If you only care about the final value (for example, after a select or radio change), consider using @change instead of @input, or combine both for separate behaviors.


#### Additional examples

Live preview of formatted text:

```html
<serc-rod id="app" data='{
  "source": "",
  "preview": ""
}'>
  <textarea *input="source"
            *eager
            @input="preview = source.toUpperCase()">
  </textarea>

  <h3>Preview</h3>
  <pre *print="preview"></pre>
</serc-rod>
```

Numeric input with live clamping:

```html
<serc-rod id="app" data='{
  "volume": 50
}'>
  <input type="number" min="0" max="100"
         *input="volume"
         *eager
         @input="
           if (volume < 0)   volume = 0;
           if (volume > 100) volume = 100;
         ">

  <p>Volume: {{%volume%}}</p>
</serc-rod>
```

Logging raw input events for debugging:

```html
<serc-rod id="app" data='{
  "log": []
}'>
  <input type="text"
         @input="log.push($event.target.value)">

  <ul>
    <li *for="v of log">
      {{%v%}}
    </li>
  </ul>
</serc-rod>
```


#### Notes

- @input is an event handler directive that wires the native input event to a Sercrod expression.
- The expression runs in the same scope as other directives on the element, with `$event` / `$e` for the native event and `el` / `$el` for the element.
- @input composes cleanly with *input, :value, *stage, and other form-related directives.
- After @input runs, Sercrod treats the event as input-like and performs a lightweight children-only update to keep the UI in sync without breaking focus.
- If `cleanup.handlers` is enabled, the original @input attribute is removed from the output DOM once the handler has been installed.
