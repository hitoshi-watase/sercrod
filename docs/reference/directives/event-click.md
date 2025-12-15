### @click

#### Summary

`@click` attaches a handler to the native `click` event on an element.
The expression on `@click` is evaluated every time the element is clicked.

Typical uses:

- Toggle UI state (open or close menus, expand sections).
- Increment counters or update data.
- Invoke application methods, optionally using the native event as `$event`.

`@click` belongs to the general event handler family (such as `@input`, `@change`, `@blur`, `@focus`) and follows the same evaluation rules as other `@event` directives.


#### Basic example

A simple counter:

```html
<serc-rod id="app" data='{
  "count": 0
}'>
  <button @click="count++">
    Clicked {{%count%}} times
  </button>
</serc-rod>
```

Behavior:

- The Sercrod host has initial data with `count: 0`.
- Each click on the button evaluates `count++` in the current scope.
- Sercrod then re-renders the host according to the event update rules, so the button label reflects the new `count` value.


#### Accessing the event and element

When a `click` event fires, Sercrod evaluates the `@click` expression with a special event scope:

- `$event` and `$e`  
  Refer to the native `MouseEvent` (or `PointerEvent`) instance for this click.
  Use this when you need event details such as `clientX`, `shiftKey`, or the original `target`.

- `$el` and `el`  
  Refer to the DOM element on which `@click` is declared.

Example:

```html
<serc-rod id="app" data='{
  "log": []
}'>
  <button @click="log.push({ x: $event.clientX, y: $event.clientY })">
    Log click position
  </button>
</serc-rod>
```

Assignments to `$event`, `$e`, `$el`, or `el` are not used by Sercrod internally; treat them as read only in event expressions.


#### Behavior

Core rules:

- Target event  
  `@click` wires the native `click` event to the expression.
  Sercrod does not alter the native `click` semantics; it just adds expression evaluation.

- Expression execution  
  The attribute value is treated as a JavaScript snippet (for example `count++`, `toggleOpen()`, or `doSomething($event, item)`).
  When the click occurs, Sercrod evaluates the snippet in the current scope.

- Data writes  
  Assignments to properties that exist in the host data are reflected back into the host’s data store.
  This drives subsequent re-renders.

- Result value  
  The return value of the expression is ignored.
  Side effects (writing to data, calling methods) are what matter.

- Cleanup (optional)  
  If `cleanup.handlers` is enabled in the Sercrod configuration, the original `@click` attribute is removed from the DOM after the listener is attached.
  The compiled HTML then shows only structural and standard attributes, not the `@click` source code.


#### Evaluation timing and re-rendering

`@click` participates in the normal render and update cycle for a Sercrod host:

1. Structural directives such as `*if`, `*for`, `*each`, `*switch`, and `*include` decide whether the element is present.
   If the element is removed by a structural directive, no handler is attached.

2. During attribute processing, Sercrod recognises attributes starting with the configured event prefix (by default `"@"`).
   Each event attribute (such as `@click`) is converted into a listener with its expression and modifiers.

3. When the native `click` fires:
   - Sercrod builds the merged event scope (data plus `$event`, `$el`, and global fallback).
   - Sercrod evaluates the expression.
   - If evaluation throws, Sercrod logs the error (when `error.warn` is enabled) but does not halt the framework.

4. After the expression runs, Sercrod decides how to re-render:

   - It reads the `events.non_mutating` list from configuration.
   - It treats `click` as a mutating event by default (so it usually causes an update).
   - For clicks on form controls (inputs, textareas, selects, or contentEditable elements) Sercrod prefers a lightweight child update to preserve focus.
   - For other clicks, Sercrod triggers a full host update unless the modifiers override this (see `.update` and `.noupdate`).

You usually do not need to call any manual update function.
Changing data in `@click` handlers is sufficient to trigger re-renders according to these rules.


#### Use with buttons, links, and other controls

`@click` is most natural on interactive elements:

- Buttons:

  ```html
  <button type="button" @click="open = !open">
    Toggle panel
  </button>
  ```

- Links:

  ```html
  <a href="/profile"
     @click.prevent="goToProfile()">
    Profile
  </a>
  ```

  In this pattern:

  - `@click.prevent` calls `event.preventDefault()` before evaluating `goToProfile()`.
  - The native navigation is blocked; your handler can perform SPA style navigation or other logic.

- Custom clickable containers:

  ```html
  <div class="card" @click="select(item)">
    <!-- card contents -->
  </div>
  ```

  Any element can be made clickable by combining `@click` with styling and accessibility attributes (for example `role="button"` and `tabindex="0"`).


#### Use with forms and submission

`@click` often appears on form buttons:

```html
<serc-rod id="app" data='{
  "profile": { "name": "" },
  "saving": false
}'>
  <form method="post" :action="saveUrl">
    <input type="text" name="name" :value="profile.name">

    <button type="submit"
            @click.prevent="saving = true; submitProfile(profile)">
      Save
    </button>
  </form>
</serc-rod>
```

Typical patterns:

- `@click.prevent` on a submit button to stop the native form submission and handle the post yourself (via `*post`, `fetch`, or any other mechanism).
- Using `@click` on `type="button"` buttons for actions that should not submit forms at all.

For clicks on form controls (inputs, textareas, selects) or on buttons that are treated as input controls, Sercrod performs a lightweight child update to keep focus stable while still reflecting data changes.


#### Modifiers

`@click` supports a set of event modifiers that are shared by all `@event` directives.

There are three kinds of modifiers:

- Modifiers that map to DOM listener options (`capture`, `once`, `passive`).
- Modifiers that call standard DOM methods on the event (`prevent`, `stop`).
- Sercrod specific modifiers that control how Sercrod re-renders after the event (`update`, `noupdate`).

Concretely:

- `@click.prevent`  
  Sercrod specific.
  Calls `event.preventDefault()` before evaluating the expression.
  Use this to block default navigation or form submission.

- `@click.stop`  
  Sercrod specific.
  Calls `event.stopPropagation()` before evaluating the expression.
  Use this to prevent the click from bubbling to ancestor elements with their own `@click` handlers.

- `@click.once`  
  Framework syntax that maps directly to the standard DOM listener option `once: true`.
  Sercrod passes this through to `addEventListener`, so the browser detaches the listener after the first successful call.
  Subsequent clicks no longer trigger the handler.

- `@click.capture`  
  Maps directly to the standard DOM listener option `capture: true`.
  Attaches the listener in the capture phase instead of the bubbling phase, following normal DOM capture semantics.

- `@click.passive`  
  Maps directly to the standard DOM listener option `passive: true`.
  This is mainly useful for scroll or touch events; it is rarely needed for `click`, but Sercrod exposes it consistently for all events.

- `@click.update` and `@click.noupdate`  
  Sercrod specific modifiers that control re-rendering only; they are not standard JS event options and are not passed to `addEventListener`.

  - `@click.update` forces a host update even if the event is listed as non mutating in configuration.
  - `@click.noupdate` suppresses host updates even though the handler runs.

  These flags affect only Sercrod’s internal “should we re-render?” decision.
  They do not change the event’s propagation, default behavior, or DOM listener options.

Example:

```html
<button @click.noupdate="log.push('clicked')">
  Log without re-render
</button>
```


#### Use with conditionals and loops

`@click` composes naturally with structural directives:

- Conditionals:

  ```html
  <button *if="canDelete"
          @click="confirmDelete(item)">
    Delete
  </button>
  ```

  The handler exists only if `canDelete` is true at render time.

- Loops:

  ```html
  <ul>
    <li *for="item of items">
      <button @click="selected = item">
        Select {{%item.label%}}
      </button>
    </li>
  </ul>
  ```

  Each iteration has its own `@click` that sees the iteration’s `item` in scope.

When structural directives replace or remove the element, Sercrod tears down and re-attaches `@click` listeners as needed, so you do not need to manage them manually.


#### Best practices

- Keep handlers focused  
  Use `@click` handlers for small, clear pieces of logic: toggling booleans, selecting items, or delegating to well named methods.

- Prefer data updates over direct DOM mutations  
  Let Sercrod re-render based on data changes instead of manually manipulating the DOM in handlers.

- Use modifiers explicitly  
  Use `.prevent` and `.stop` to make intent clear, especially on links and nested clickable areas.
  Use `.once` when you want the browser to call the handler only once.
  Use `.update` and `.noupdate` sparingly to override the default re-rendering policy when you know it is safe.

- Compose with accessibility  
  For non button clickable elements, add appropriate ARIA attributes and keyboard handlers so that `@click` is part of an accessible interaction pattern.

- Avoid heavy work in handlers  
  If a click triggers a heavy operation (such as a large network request), start it asynchronously and keep the handler itself lean.


#### Additional examples

Toggle a menu:

```html
<serc-rod id="menu" data='{
  "open": false
}'>
  <button @click="open = !open">
    {{% open ? 'Close menu' : 'Open menu' %}}
  </button>

  <nav *if="open">
    <!-- menu items -->
  </nav>
</serc-rod>
```

Call a shared method with the event:

```html
<serc-rod id="app" data='{
  "log": []
}'>
  <button @click="logClick($event, 'primary')">
    Primary
  </button>
  <button @click="logClick($event, 'secondary')">
    Secondary
  </button>
</serc-rod>
```

Attach `@click` to a container with nested controls:

```html
<div class="card" @click="select(item)">
  <h2 *print="item.title"></h2>
  <p *print="item.summary"></p>
  <button type="button" @click.stop="openDetails(item)">
    Details
  </button>
</div>
```

In this example:

- The card click selects `item`.
- The Details button uses `.stop` so that clicking it does not also select the card.


#### Notes

- `@click` uses the event prefix defined by `config.events.prefix` (default `"@"`), so projects can replace it with another prefix if needed.
- Event handlers receive `$event` / `$e` and `$el` / `el` in their scope in addition to the host data.
- Among modifiers, `capture`, `once`, and `passive` map directly to standard DOM listener options.
  `prevent`, `stop`, `update`, and `noupdate` are Sercrod level behaviours implemented on top of the DOM event.
- `click` is treated as a mutating event by default and triggers re-rendering after the handler runs, with special handling for form controls to keep focus stable.
- All `@event` directives, including `@click`, share the same modifier semantics; only `update` and `noupdate` are Sercrod specific controls for re-rendering and do not correspond to native JS event options.
- If `cleanup.handlers` is enabled, the original `@click` attribute is removed from the rendered DOM, while the event listener remains active.
