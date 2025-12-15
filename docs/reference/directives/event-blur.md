### @blur

#### Summary

`@blur` attaches a handler to the native `blur` event on an element.
The expression on `@blur` is evaluated when the element loses focus.
Typical uses include marking a field as “touched”, running lightweight validation, or committing staged values when the user leaves a control.

`@blur` is part of the event handler family (such as `@click`, `@input`, `@change`, `@focus`) and follows the same general evaluation rules as other `@` directives.


#### Basic example

Marking an input as “touched” when it loses focus:

```html
<serc-rod id="app" data='{
  "profile": { "name": "" },
  "touched": { "name": false }
}'>
  <label>
    Name:
    <input type="text"
           :value="profile.name"
           @blur="touched.name = true">
  </label>

  <p *if="touched.name && !profile.name">
    Please enter your name.
  </p>
</serc-rod>
```

Behavior:

- The input is bound to `profile.name` via `:value`.
- When the user focuses the input and then moves focus elsewhere, the browser fires a `blur` event.
- Sercrod invokes the `@blur` expression in the current scope, setting `touched.name = true`.
- The paragraph becomes visible if the field is now empty and has been blurred at least once.


#### Behavior

Core rules:

- Target event  
  `@blur` wires the native `blur` event on the element where it is declared.
  The element must be focusable for the handler to fire (for example, inputs, textareas, buttons, links, or elements made focusable via `tabindex`).

- Expression evaluation  
  Sercrod parses the attribute value as an expression (for example `touched.name = true` or `save(profile)`).
  When the event fires, Sercrod evaluates this expression using the same scope model as other directives on that element.

- One way effect  
  The result of the expression is ignored by Sercrod.
  What matters is the side effect of the expression (writing to data, calling functions, or both).

- Multiple handlers  
  You can combine `@blur` with other event directives on the same element (such as `@focus` or `@input`), as long as each one uses a distinct event name.
  Each handler is evaluated independently when its event fires.

Sercrod does not change the native timing or semantics of the `blur` event; it only injects expression evaluation when the event occurs.


#### Evaluation timing

`@blur` participates in Sercrod’s normal event lifecycle:

- Structural directives first  
  Directives such as `*if`, `*for`, `*each`, `*switch`, and `*include` decide the presence and shape of the element.
  If an element is removed by a structural directive, no event handler is attached.

- Attribute phase  
  Once an element is kept, Sercrod processes its attributes.
  Event attributes starting with `@` are recognized in the same pass as colon attributes like `:value` and directive attributes like `*if`.

- Listener attachment  
  During this pass, Sercrod registers a `blur` listener for each element with `@blur`.
  On re-renders, Sercrod ensures that the handler reflects the current expression and scope.

- Event firing  
  When the browser fires `blur` on that element, Sercrod evaluates the stored expression in the current Sercrod scope associated with the host.

There is no special debounce or scheduling around `@blur`; it runs synchronously when the event fires, in the same turn as the native `blur` event.


#### Execution model

Conceptually, the runtime behaves as follows for `@blur`:

1. During rendering, Sercrod finds an element with an attribute named `@blur`.
2. It reads the attribute value as a source string, for example `touched.name = true` or `validateField('name')`.
3. Sercrod compiles or stores this expression so it can be evaluated later in the current host’s scope.
4. Sercrod attaches a native event listener for `"blur"` on that element.
5. When the browser fires `blur`:
   - Sercrod prepares the evaluation context for this host and element.
   - Sercrod evaluates the stored expression with its expression evaluator.
   - If evaluation throws, Sercrod catches the error and logs it through the configured logging mechanism; the error does not stop other handlers or other elements from updating.
6. If `cleanup.handlers` is enabled in the configuration, Sercrod may remove the original `@blur` attribute from the DOM, leaving only the wired listener and any other visible attributes.

The listener itself is lean: it does not try to change the propagation of the event (such as stopping it) unless your expression does so through normal browser APIs.


#### Use with form fields and data bindings

`@blur` is often paired with data bindings to form controls:

- With `:value` or `:checked`:

  ```html
  <input type="text"
         :value="profile.email"
         @blur="profile.email = profile.email.trim()">
  ```

  - `:value` keeps the DOM value in sync with `profile.email`.
  - `@blur` ensures that the value is trimmed when the user leaves the field.

- With staging via `*stage`:

  ```html
  <form *stage="'profile'">
    <input type="text"
           :value="profile.name"
           @blur="profile.name = profile.name.trim()">
    <button type="button" *apply="'profile'">Save</button>
    <button type="button" *restore="'profile'">Cancel</button>
  </form>
  ```

  Here, `@blur` cleans up the staged copy of `profile.name`.
  Only when the user presses “Save” does `*apply` commit the staged profile back to main data.

Because `@blur` runs only when focus leaves the element, it is a good fit for:

- Validation that should not interrupt typing.
- Cleaning up formatting.
- Toggling “touched” flags for UI feedback.


#### Use with conditionals and loops

`@blur` can be freely combined with structural directives that control the element itself:

- Conditional display:

  ```html
  <input type="text"
         *if="mode === 'edit'"
         :value="item.title"
         @blur="item.title_touched = true">
  ```

  The handler is attached only when the `*if` condition is true.

- Inside loops:

  ```html
  <ul>
    <li *for="item of items">
      <input type="text"
             :value="item.label"
             @blur="item.touched = true">
    </li>
  </ul>
  ```

  Each iteration gets its own `@blur` handler, and the expression is evaluated with that iteration’s `item` in scope.

If a structural directive replaces the element on re-render (for example via key changes or switching a block), Sercrod re-attaches `@blur` on the new element instance as part of its normal rendering process.


#### Sercrod-specific restrictions

For `@blur`, there are no special Sercrod-only restrictions beyond the general event rules:

- You may put `@blur` on any focusable element.
- You may combine `@blur` with other event directives on the same element, as long as each uses a different event name (for example `@focus`, `@input`, `@change`).
- You may combine `@blur` with attribute bindings like `:value`, `:class`, and `:style`, and with structural directives such as `*if` or `*for` that target the same element.

Unlike structural directives (`*each`, `*include`, `*import`), event directives do not compete for ownership of the element’s children, so there is no “only one of these” constraint specific to `@blur`.


#### Best practices

- Keep handlers small  
  Use `@blur` for small, local side effects: marking fields as touched, trimming strings, or triggering simple validations.
  If the logic is large or used in multiple places, move it into a helper function and call that from `@blur`.

- Avoid heavy work  
  Since `blur` is synchronous, avoid expensive operations (such as large network calls or heavy computation) directly inside the handler expression.
  Instead, delegate to asynchronous functions or queues if needed.

- Combine with “touched” flags  
  Use dedicated flags (for example `touched.name`) to decouple user interactions from validation logic.
  UI components can then react to those flags instead of inferring state from the presence of errors alone.

- Be mindful of non-bubbling behavior  
  The native `blur` event does not bubble in the same way as `click`.
  Place `@blur` on the actual element that should react to losing focus, not on a distant ancestor.

- Use `@focus` and `@blur` together when needed  
  For complex interactions, combine `@focus` and `@blur` on the same element to track active state or to highlight inputs while they are being edited.


#### Additional examples

Mark field as dirty only when value actually changed:

```html
<serc-rod id="app" data='{
  "original": { "name": "Taro" },
  "current":  { "name": "Taro" },
  "dirty":    { "name": false }
}'>
  <input type="text"
         :value="current.name"
         @blur="dirty.name = (current.name !== original.name)">
</serc-rod>
```

Local validation on blur:

```html
<serc-rod id="app" data='{
  "email": "",
  "errors": { "email": "" }
}'>
  <input type="email"
         :value="email"
         @blur="
           errors.email =
             (!email || email.indexOf('@') === -1)
               ? 'Please enter a valid email.'
               : '';
         ">

  <p *if="errors.email" *print="errors.email"></p>
</serc-rod>
```

Toggle helper text visibility:

```html
<serc-rod id="app" data='{
  "show_help": true
}'>
  <input type="text"
         :value="''"
         @blur="show_help = false">

  <p *if="show_help">
    You can leave this field empty.
  </p>
</serc-rod>
```


#### Notes

- `@blur` is an event handler directive that wires the element’s native `blur` event to a Sercrod expression.
- The expression runs in the same scope as other directives on that element and is used for side effects, not for returning values.
- `@blur` composes with other directives, including structural ones, without competing for ownership of the element’s children.
- If `cleanup.handlers` is enabled in the Sercrod configuration, the original `@blur` attribute is removed from the output DOM after the listener has been attached, keeping the rendered markup clean.
