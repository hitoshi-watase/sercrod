### @keydown

#### Summary

`@keydown` attaches a handler to the native `keydown` event on an element.
The expression on `@keydown` is evaluated every time a key is pressed while the element has focus (and may fire repeatedly if the key is held, depending on the browser and operating system).

Typical uses:

- Handling keyboard shortcuts.
- Reacting to Enter, Escape, or arrow keys.
- Implementing keyboard driven navigation or editing commands.

`@keydown` is part of Sercrod’s event handler family (such as `@click`, `@input`, `@change`, `@focus`, `@blur`) and uses the same evaluation and modifier rules as other `@event` directives.


#### Basic example

A simple handler that reacts to Enter and Escape:

```html
<serc-rod id="app" data='{
  "log": [],
  "value": ""
}'>
  <input type="text"
         :value="value"
         @keydown="
           if($event.key === 'Enter'){
             log.push('submit:' + value);
           } else if($event.key === 'Escape'){
             value = '';
             log.push('clear');
           }
         ">

  <ul>
    <li *for="msg of log" *textContent="msg"></li>
  </ul>
</serc-rod>
```

Behavior:

- While the input has focus, every physical key press triggers a `keydown` event.
- Sercrod evaluates the `@keydown` expression in the current scope, with `$event` bound to the native `KeyboardEvent`.
- Pressing Enter logs a submit entry.
- Pressing Escape clears the value and logs a clear entry.


#### Behavior

Core rules:

- Target event  
  `@keydown` listens for the native `"keydown"` event on the element where it appears.
  The element must be focusable (for example inputs, textareas, buttons, links, or elements with `tabindex`) for the event to fire.

- Expression evaluation  
  The attribute value (for example `onKey($event)` or the inline logic above) is parsed and stored as a Sercrod expression.
  When the event fires, the expression is evaluated in the context of the current host and element.

- Event object and element access  
  Inside the expression:

  - `$event` and `$e` refer to the native `KeyboardEvent` instance.
  - `el` and `$el` refer to the element that owns `@keydown`.

  For example:

  - `$event.key` and `$event.code` give the key that was pressed.
  - `$event.ctrlKey`, `$event.shiftKey`, `$event.altKey`, `$event.metaKey` expose modifier keys.

- One way effect  
  Sercrod ignores the return value of the expression.
  Only side effects such as updating data, calling methods, or triggering other APIs matter.

- Repeated firing  
  Because `keydown` may fire repeatedly while a key is held, your handler may run multiple times in quick succession.
  If you need to ignore repeats, check `$event.repeat` in the expression.


#### Event modifiers

`@keydown` supports the same modifier suffixes as other `@event` directives.
Modifiers are appended to the attribute name, separated by dots:

- `prevent`  
  Calls `event.preventDefault()` before evaluating the expression.

- `stop`  
  Calls `event.stopPropagation()` before evaluating the expression.

- `once`  
  Uses the browser’s `once` option so the handler runs at most once per element and event type, then removes itself.

- `capture`  
  Registers the listener in the capture phase.

- `passive`  
  Registers the listener as passive, signaling that the handler will not call `preventDefault()`.

- `update`  
  Forces a Sercrod update after the handler runs, even for events that would normally be treated as non mutating.

- `noupdate`  
  Suppresses Sercrod’s automatic update after the handler runs.

Examples:

```html
<input @keydown.prevent="handleKey($event)">
<input @keydown.stop="handleKey($event)">
<input @keydown.once="registerShortcut($event)">
<input @keydown.noupdate="handleKeyWithoutRerender($event)">
```

Rules specific to `@keydown`:

- `keydown` is not in Sercrod’s default `non_mutating` event list.
  By default, Sercrod treats `@keydown` as a mutating event, so it will re render after the handler unless you use `.noupdate` or change configuration.
- Using `.noupdate` is often appropriate for pure keyboard navigation where you manually apply visual changes or where a full re render would be too heavy.


#### Evaluation timing

`@keydown` fits into Sercrod’s event and render pipeline as follows:

1. Structural directives (`*if`, `*for`, `*each`, `*switch`, `*include`, etc.) first decide whether the element exists and in what form.
2. Sercrod processes attributes on the kept element:

   - Colon bindings like `:value`, `:class`, `:style`, etc.
   - Event bindings such as `@keydown`, `@input`, `@click`.

3. For `@keydown`, Sercrod extracts:

   - The event name `"keydown"` from the attribute name (after removing the configured prefix).
   - Any modifiers from the rest of the attribute name.
   - The expression string from the attribute value.

4. Sercrod registers a real DOM event listener `keydown` on the element, using `capture`, `passive`, and `once` as requested.
5. When the browser fires `keydown`:

   - Sercrod builds an evaluation scope that proxies the current data scope and injects `$event` / `$e` and `el` / `$el`.
   - Sercrod runs the expression through its event evaluator.
   - Sercrod then decides whether and how to re render based on the event name, modifiers, and configuration.

`@keydown` executes synchronously as part of the native event dispatch, so any side effects (such as updating data) happen immediately before any subsequent re renders.


#### Execution model and updates

Internally, after evaluating the handler expression, Sercrod chooses the update strategy:

- It reads the configured set of non mutating event names: `this.constructor._config.events.non_mutating`.
- It decides whether this event wants an update by default:

  - `wantsUpdate` is `true` if the event name is not in `non_mutating`.
  - For `keydown`, this is `true` by default, because `keydown` is not in the built in `non_mutating` list.

- It checks modifiers:

  - `.update` forces `wantsUpdate = true`.
  - `.noupdate` forces `wantsUpdate = false`.
  - `.once` combined with a non mutating event disables updates for that handler.

- It detects input like interactions:

  - Sercrod distinguishes between input like events (such as `input`, `change`, composition events, and form control clicks) and other events.
  - For input like events, Sercrod prefers a lightweight child update rather than a full re render to preserve focus.

- For `@keydown`:

  - `keydown` is not treated as a special input like event by default.
  - If `wantsUpdate` is `true` and no modifiers override it, Sercrod updates the entire host via `update()` after the handler.
  - If you combine `@keydown` with `.noupdate`, Sercrod will skip that update entirely.

This means `@keydown` is powerful but potentially expensive if many key events fire in quick succession and each triggers a full update.
Use `.noupdate` or `events.non_mutating` if you need tight keyboard handling without frequent re renders.


#### Use with focusable controls and forms

`@keydown` is often paired with inputs and textareas:

- Updating data on every key press:

  ```html
  <input type="text"
         :value="draft"
         @keydown="draft = $event.target.value">
  ```

  This pattern is usually better handled by `n-input` or `*input`, but shows how `@keydown` can directly read `event.target.value`.

- Handling shortcuts while editing:

  ```html
  <textarea
    :value="note"
    @keydown="
      if($event.key === 'Tab'){
        $event.preventDefault();
        note += '    ';
      }
    ">
  </textarea>
  ```

With forms:

- Use `@keydown` to intercept Enter in specific fields:

  ```html
  <form @submit.prevent="submitForm()">
    <input type="text"
           :value="query"
           @keydown="
             if($event.key === 'Enter'){
               submitForm();
             }
           ">
  </form>
  ```

If you want to globally prevent Enter from submitting a form, consider using `*prevent-default` with the `"enter"` mode instead of repeating `@keydown.prevent` handlers on every control.


#### Use with conditionals and loops

`@keydown` composes cleanly with structural directives:

- Conditional fields:

  ```html
  <input type="text"
         *if="mode === 'search'"
         :value="query"
         @keydown="
           if($event.key === 'Enter'){
             runSearch(query);
           }
         ">
  ```

  The handler exists only when the condition is true.

- Inside loops:

  ```html
  <ul>
    <li *for="item of items">
      <input type="text"
             :value="item.label"
             @keydown="
               if($event.key === 'Enter'){
                 item.editing = false;
               }
             ">
    </li>
  </ul>
  ```

Each iteration gets its own `@keydown` handler, bound to that iteration’s `item` in scope.


#### Sercrod-specific restrictions

For `@keydown` itself, Sercrod does not impose special structural restrictions beyond the general event rules:

- You may put `@keydown` on any element that can receive focus.
- You may combine `@keydown` with other event directives on the same element (such as `@keyup`, `@input`, `@blur`) as long as each uses a different event name.
- You may combine `@keydown` with colon bindings like `:value`, `:class`, or `:style`, and with structural directives like `*if`, `*for`, and `*each` that target the same element.

The main Sercrod specific consideration is update behavior:

- `keydown` is treated as a mutating event by default.
- If you do not want re renders on every key, attach `.noupdate` or add `"keydown"` to `config.events.non_mutating` for your application.


#### Best practices

- Use `$event.key` and `$event.code`  
  Use `$event.key` for user facing logic (for example `"Enter"`, `"Escape"`, arrow keys) and `$event.code` if you need physical key positions independent of keyboard layout.

- Avoid heavy work in handlers  
  Because `keydown` can fire many times while keys are held, avoid heavy logic directly in the `@keydown` expression.
  Delegate to lightweight helpers or throttle logic on the data side if needed.

- Control updates explicitly  
  For navigation or text editing shortcuts where you manage DOM directly (for example scrolling, `focus()` calls), use `.noupdate` so that Sercrod does not re render on every key.

- Use `.once` for setup shortcuts  
  If a certain keyboard shortcut needs to be wired only once per element, and the handler does not mutate data in a way that requires re render, use `.once` and possibly `.noupdate`.

- Prefer `n-input` for value tracking  
  Use `n-input` or `*input` for tracking changes to input values.
  Use `@keydown` when you need to react to specific keys or combinations, not as a general value sync mechanism.


#### Additional examples

Arrow key navigation in a list:

```html
<serc-rod id="app" data='{
  "items": ["Alpha", "Beta", "Gamma"],
  "index": 0
}'>
  <ul tabindex="0"
      @keydown="
        if($event.key === 'ArrowUp'){
          if(index > 0) index -= 1;
        } else if($event.key === 'ArrowDown'){
          if(index < items.length - 1) index += 1;
        }
      ">
    <li *for="(i, item) of items"
        :class="i === index ? 'is-active' : ''">
      {{%item%}}
    </li>
  </ul>
</serc-rod>
```

Closing a dialog with Escape:

```html
<serc-rod id="dialogHost" data='{
  "open": true
}'>
  <div *if="open"
       class="dialog"
       tabindex="0"
       @keydown="
         if($event.key === 'Escape'){
           open = false;
         }
       ">
    <p>Press Escape to close.</p>
  </div>
</serc-rod>
```


#### Notes

- `@keydown` wires the native `keydown` event to a Sercrod expression.
- Inside the handler, `$event` / `$e` and `el` / `$el` are always available.
- Modifiers such as `.prevent`, `.stop`, `.once`, `.capture`, `.passive`, `.update`, and `.noupdate` are supported and follow the same semantics as for other `@event` directives.
- By default, `keydown` is not in the built in `non_mutating` list, so Sercrod will re render after the handler unless you suppress updates with `.noupdate` or change `config.events.non_mutating`.
- If `cleanup.handlers` is enabled in the Sercrod configuration, the original `@keydown` attribute is removed from the output DOM after the handler is wired, keeping the rendered HTML clean.
