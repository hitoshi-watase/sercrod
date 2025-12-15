### Event bindings (fallback for @name)

This page describes the general behavior of Sercrod’s **event bindings** for `@name` when there is **no dedicated manual** for that event.

Typical examples that rely on this fallback:

- `@pointerdown`, `@pointerup`, `@pointermove`
- `@mousedown`, `@mouseup`, `@mousemove`
- `@dragstart`, `@dragover`, `@drop`
- `@wheel`
- custom events dispatched via `element.dispatchEvent(new CustomEvent("..."))`

Events such as:

- `@click`
- `@submit`
- `@input`
- `@change`
- `@keydown`
- `@keyup`
- `@focus`
- `@blur`

have (or may have) their own manuals (`event-click.md`, `event-submit.md`, and so on) and are not fully described here.

This page explains the **common rules** for all `@name` event bindings that do not have a dedicated entry.

> Note: This document uses `@` as the event prefix.
> If you configure `config.events.prefix` to something else (for example `ne-`), mentally replace `@click` with the actual prefix you use (`ne-click`, and so on).


#### Overview

- `@name` attaches a DOM event listener for the event `name` on that element.
- When the event fires, Sercrod evaluates the attribute value as **JavaScript** in the current Sercrod scope.
- The scope contains:
  - the `data` object from the `<serc-rod>` host,
  - stage data if you use staging (`*stage`),
  - local variables from `*let`, loops, and other structural directives.
- The **DOM `Event` object** is available as:
  - `$event` (primary name),
  - `$e` (short alias).
- The **current element** is available as:
  - `el`,
  - `$el`.
- The return value of the code is ignored:
  - what matters is the side effect (for example updating data, calling functions),
  - re-rendering after the handler depends on the event type and on modifiers such as `.update` or `.noupdate`.

You can read `@name` as “run this code when this DOM event occurs on this element”.


#### Syntax

General form:

- Without modifiers:

  - `@eventName="code"`

- With modifiers:

  - `@eventName.mod1.mod2="code"`

##### Recognized modifiers and categories

Sercrod understands the following modifier names.  
They fall into three categories:

1. **DOM listener option modifiers**  
   These map directly to standard `addEventListener` options and are **not** Sercrod specific:

   - `.capture`  
     - Sets the listener option `capture: true`.  
     - The handler runs in the capture phase.

   - `.once`  
     - Sets the listener option `once: true`.  
     - The browser calls the handler at most once and then automatically removes it.

   - `.passive`  
     - Sets the listener option `passive: true`.  
     - Signals that the handler will not call `preventDefault()` in normal browser semantics.

2. **DOM method helpers (Sercrod specific syntax, standard DOM behavior)**  
   These modifiers are **Sercrod syntax** that call standard methods on the event object.
   They are not native event options and are not passed to `addEventListener`:

   - `.prevent`  
     - Calls `event.preventDefault()` for that event before evaluating the handler code.

   - `.stop`  
     - Calls `event.stopPropagation()` for that event before evaluating the handler code.

3. **Sercrod specific re-rendering modifiers**  
   These modifiers control Sercrod’s update logic only.
   They are **not** standard JS event options and are **not** passed to `addEventListener`:

   - `.update`  
     - Forces a re-render after the handler, even if the event is normally treated as non mutating.

   - `.noupdate`  
     - Suppresses host re-rendering after the handler, even if the event type would normally trigger an update.

   These flags affect only Sercrod’s internal “should we update the host?” decision.
   They do not change event propagation, default behavior, or listener options.

Examples:

```html
<div @pointerdown="startDrag($event)"></div>

<div @dragover="handleDragOver($event)"
     @drop="handleDrop($event)"></div>

<section @wheel.prevent="zoomWithWheel($event)">
  ...
</section>

<button @pointerdown.stop.update="handlePress($event)">
  Press
</button>
```

The `code` part is arbitrary JavaScript that runs inside a Sercrod evaluation context similar to:

```js
with (scope) {
  // your expression or statements here
}
```

You can write either:

- a simple expression:

  - `@pointerdown="drag.active = true"`

- or multiple statements separated by semicolons:

  - `@pointerdown="drag.active = true; drag.startX = $event.clientX"`


#### Event object and element access

For all event bindings:

- The DOM event object is injected as:

  - `$event` (primary name),
  - `$e` (short alias).

- The current element is injected as:

  - `el`,
  - `$el`.

Typical patterns:

```html
<div
  @pointerdown="
    drag = {
      active: true,
      x: $event.clientX,
      y: $event.clientY
    }
  "
  @pointermove="drag && drag.active && updateDrag($event)"
  @pointerup="endDrag($event)"
></div>
```

Inside a helper function you can use the full event API:

```js
function updateDrag($event){
  const t = $event.target;
  // Use $event.clientX, $event.clientY, t.dataset.id, and so on.
}
```

Notes:

- There is no special variable named `event` injected by Sercrod.
  - Use `$event` or `$e` instead.
- `el` and `$el` always refer to the element that owns the `@name` attribute.
- Assigning to `$event`, `$e`, `el`, or `$el` has no effect on Sercrod and should be treated as read only in handlers.


#### Data updates and re-render timing

Event handlers often mutate data. Sercrod’s event pipeline is tuned so that:

- High frequency events (such as pointer moves) do **not** force heavy re-renders by default.
- Input related events perform **lightweight** updates that keep focus stable.

The basic rules are:

1. **During the handler**:

   - Writes like `count++` or `state.value = ...` go into the current evaluation scope.
   - If a written key also exists in the host `data` object, Sercrod updates `data[key]` as well and marks it as dirty.

2. **After the handler**, Sercrod decides how to update based on:

   - the event type (`ev`),
   - the `events.non_mutating` configuration list,
   - whether the event is treated as input like,
   - and modifiers `.update`, `.noupdate`, and `.once`.

   Concretely:

   - Sercrod maintains a set `NON_MUTATING` derived from `config.events.non_mutating`.  
     By default it contains events like:

     - `mouseover`, `mouseenter`, `mousemove`, `mouseout`, `mouseleave`, `mousedown`
     - `pointerover`, `pointerenter`, `pointermove`, `pointerout`, `pointerleave`, `pointerrawupdate`, `pointerdown`
     - `wheel`, `scroll`, `touchmove`, `touchstart`
     - `dragstart`, `drag`, `dragenter`, `dragover`, `dragleave`, `dragend`
     - `resize`, `timeupdate`, `selectionchange`

   - It detects **input like events**:

     - `input`, `change`, `beforeinput`,
     - `keydown`, `keyup`,
     - `compositionstart`, `compositionupdate`, `compositionend` (any event name starting with `composition`),
     - `click` on form controls (inputs, textareas, selects, or contentEditable elements).

   - It then computes `wantsUpdate`:

     - Start with `wantsUpdate = !NON_MUTATING.has(ev)`.
     - If `.update` is present, set `wantsUpdate = true`.
     - If `.noupdate` is present, set `wantsUpdate = false`.
     - If `.once` is present and `ev` is in `NON_MUTATING`, Sercrod forces `wantsUpdate = false` to avoid re-creating a one time listener on a non mutating event.

   - Finally, it applies the update:

     - If the event is input like (as defined above), or a `click` on a form control, Sercrod performs a **lightweight children update**:
       - it calls an internal `_updateChildren(...)` so only the host’s children are reconciled, preserving focus.
     - Otherwise, if `wantsUpdate` is true, Sercrod triggers a normal host update.
     - If `wantsUpdate` is false, no re-render is triggered by this handler.

3. **Modifiers override defaults**:

   - `.update` forces an update even for events listed in `events.non_mutating`.
   - `.noupdate` suppresses updates even for events that would normally re-render.

Examples:

```html
<!-- No automatic update: wheel is non mutating by default -->
<div @wheel="pan.x += $event.deltaX; pan.y += $event.deltaY"></div>

<!-- Force update after a move event -->
<div @pointermove.update="cursor = { x: $event.clientX, y: $event.clientY }"></div>

<!-- Explicitly suppress update (even if you touch data) -->
<div @mousedown.noupdate="debug.lastDown = $event.clientX"></div>
```

Practical guidelines:

- For high frequency events (`pointermove`, drag over, scroll, wheel):
  - Start without `.update`.
  - Add `.update` only when you really need DOM changes on each event.
- For most other events:
  - The default behavior already re-renders when it is meaningful.
  - Use `.noupdate` only when you are sure the handler does not affect the visible DOM.


#### Interaction with *input and other helpers

Input helpers such as `n-input` / `*input`, `*lazy`, and `*eager` control:

- how form control values are synchronized into data,
- when that synchronization happens (immediately, on blur, and so on).

`@name` is orthogonal to those helpers:

- You can attach `@keydown`, `@input`, or `@change` on the same element that uses `n-input`.
- Use the event handlers for extra behavior (validation, logging, analytics).
- Let the input helpers manage the primary data binding.

Example:

```html
<input
  n-input="form.name"
  @keydown="lastKey = $event.key"
  @change="validate(form)"
>
```


#### Interaction with *prevent-default and *prevent

Sercrod also provides **structural directives** for some common default behaviors:

- `*prevent-default`
- `*prevent` (alias)

These directives are evaluated when the element is rendered.
In the current implementation:

- They read an optional mode from the attribute value:

  - `"enter"` (default) ? affects `keydown` for the Enter key on that element.
  - `"submit"` ? affects `submit` events on `<form>` elements.
  - `"all"` ? applies both rules.

- They then attach helper listeners that call `event.preventDefault()` for:

  - `keydown` Enter on the element itself (for `"enter"` or `"all"`),
  - `submit` events on `<form>` elements (for `"submit"` or `"all"`).

The directives do **not** stop propagation, and they do not automatically cover all event types.

For fine grained control on a specific `@name` binding, use **modifiers on the event attribute**:

- `.prevent` on `@name`:
  - Sercrod specific syntax that calls `event.preventDefault()` for that particular handler.
- `.stop` on `@name`:
  - Sercrod specific syntax that calls `event.stopPropagation()` for that particular handler.

Typical patterns:

```html
<!-- Prevent Enter key from submitting or triggering default behavior -->
<input *prevent-default="enter"
       @keydown="handleKey($event)">

<!-- Prevent form submission via browser default, use JavaScript instead -->
<form *prevent-default="submit"
      @submit="saveForm()">
  ...
</form>

<!-- Per event control with modifiers -->
<a href="/danger"
   @click.prevent="confirmLeave && !confirmLeave()">
  Leave page
</a>

<button @click.stop="handleClick($event)">
  Click
</button>
```

For complete details, see the separate manuals for `*prevent-default` and `*prevent`.


#### Custom events

You can also bind handlers to **custom events** dispatched from JavaScript.

In the template:

```html
<div @card-activated="setActive($event.detail.id)">
  ...
</div>
```

In JavaScript:

```js
element.dispatchEvent(new CustomEvent("card-activated", {
  detail: { id: 123 }
}));
```

Inside the handler code, `$event.detail` contains the payload passed by the dispatcher.


#### Error handling and edge cases

- **If handler code throws**:

  - Sercrod catches the error.
  - If `config.error.warn` (or the equivalent runtime flag) is enabled, Sercrod logs a warning such as:
    - `[Sercrod warn] @event handler: ...`
  - The event listener remains attached.
  - Later events still trigger the handler.

- **Bubbling and nesting**:

  - Standard DOM bubbling rules apply.
  - If you have nested elements with the same `@event`:
    - parent handlers see the event only if it is not stopped,
    - use `.stop` on the inner handler when you want to keep the event local.

- **Manual listeners**:

  - Sercrod’s listeners coexist with listeners added via `addEventListener`.
  - The firing order follows normal browser rules (capture vs bubble, registration order, passive listeners).

- **Multiple re-renders**:

  - Sercrod tracks listeners by event name and element.
  - On re-render, it removes old listeners for that event on that element and reattaches them.
  - You should not manually remove Sercrod’s event handlers.


#### Relation to specific event manuals

Some events are common enough to have their own detailed manuals, for example:

- `event-click.md` ? click interactions, buttons, and modifiers.
- `event-submit.md` ? form submissions and interaction with `*prevent-default`.
- `event-input.md` and `event-change.md` ? text fields and update timing.
- `event-keydown.md` and `event-keyup.md` ? keyboard handling patterns.
- `event-focus.md` and `event-blur.md` ? focus management and “touched” state.

Those pages:

- inherit all the rules described here,
- add **event specific** patterns, edge cases, and recommendations.

If you bind an event with `@something` and there is **no** `event-something.md`, the behavior of that binding is determined by the rules on this page.
