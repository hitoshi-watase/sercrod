### @focus

#### Summary

@focus attaches a handler to the native focus event on an element.
The expression on @focus is evaluated when that element receives focus.
Typical uses include highlighting a field while it is active, resetting error messages when the user returns to a control, or tracking which part of a form is currently focused.

@focus is part of the general event handler family (for example @click, @input, @blur) and follows the same evaluation rules as other event directives that use the Sercrod event prefix.


#### Basic example

Tracking whether an input is currently focused:

```html
<serc-rod id="app" data='{
  "profile": { "name": "" },
  "focus":   { "name": false }
}'>
  <label>
    Name:
    <input type="text"
           :value="profile.name"
           @focus="focus.name = true"
           @blur="focus.name = false">
  </label>

  <p *if="focus.name">
    This field is currently focused.
  </p>
</serc-rod>
```

Behavior:

- The input is bound to profile.name via :value.
- When the user clicks into or tabs into the input, the browser fires a focus event.
- Sercrod evaluates the @focus expression in the current scope, setting focus.name to true.
- When the user leaves the input, @blur sets focus.name back to false.
- The paragraph is shown only while the field is focused.


#### Behavior

Core rules:

- Target event  
  @focus wires the native focus event on the element where it is declared.
  The element must be able to receive focus (for example input, textarea, select, button, link, or any element with a suitable tabindex).

- Scope and data  
  When focus fires, Sercrod evaluates the @focus expression in the same Sercrod scope used for other directives on that element.
  Reads and writes in that expression see the current Sercrod data, including local variables from surrounding directives and the host data object.

- Access to event and element  
  Inside @focus expressions, Sercrod injects:

  - $event and $e for the native event object.
  - el and $el for the element that received focus.

  Data remains the primary source; event and element are additional helpers inside the evaluation context.

- One way effect  
  The result value of the expression is ignored by Sercrod.
  What matters is the side effect (for example updating flags such as focus.name, calling helper functions, and so on).

- Coexistence with other bindings  
  @focus can be combined with colon bindings (such as :value, :class, :style) and with structural directives targeting the same element (such as *if or *for), as long as the markup remains valid.
  It can also be combined with other event handlers such as @blur, @input, or @change on the same element, because they use different event names.


#### Evaluation timing

@focus participates in Sercrod’s normal event lifecycle:

- Structural phase  
  Sercrod first processes structural directives such as *if, *for, *each, *switch, and *include.
  If those directives remove the element from the output, no @focus handler is attached.

- Attribute and event phase  
  For elements that are kept, Sercrod walks through the attributes:

  - Attributes whose name starts with the event prefix (by default "@") are treated as event handlers.
  - For @focus, Sercrod extracts the event name focus and any modifiers from the attribute name.
  - The attribute value is stored as the expression string to run later.
  - Sercrod then registers a native focus listener on the element with options derived from the modifiers.

- Re-renders  
  When the host re-renders, Sercrod ensures that the listener continues to point to the current expression and scope, replacing any old listener as needed so it does not accumulate duplicates.

The actual focus event still fires according to browser rules; Sercrod only attaches its handler to that event and evaluates your expression when it occurs.


#### Execution model

Conceptually, the runtime behaves as follows for @focus:

1. During rendering, Sercrod encounters an attribute whose name starts with the configured events.prefix and whose event name portion is focus.
2. It splits the attribute name into:

   - The event name focus.
   - A set of modifiers (for example prevent, stop, once, capture, passive, update, noupdate).

3. Sercrod reads the attribute value as an expression string.
4. Sercrod constructs listener options:

   - capture is true if the name includes the capture modifier.
   - passive is true if the name includes the passive modifier.
   - once is true if the name includes the once modifier.

5. Sercrod creates a handler function that:

   - Applies generic modifiers:

     - If the name includes prevent, it calls event.preventDefault() before anything else.
     - If the name includes stop, it calls event.stopPropagation().

   - Constructs a proxy scope in which:

     - $event and $e refer to the native focus event.
     - el and $el refer to the focused element.
     - Other reads first consult the Sercrod scope; if a name is not found there, the proxy falls back to the global window.

   - Evaluates the expression with this proxy scope using the event evaluator.
   - Catches and logs any errors so that one failing handler does not break other updates.

6. After the expression runs, Sercrod decides how to update the host:

   - It consults the configured set events.non_mutating to see whether the event should cause a re-render by default.
   - The update modifier forces a re-render even if the event is configured as non mutating.
   - The noupdate modifier suppresses updates even if the event is normally treated as mutating.
   - For focus, this means you can opt into or out of re-rendering per handler by using these modifiers.

7. Sercrod either triggers a lightweight children update or a host level update according to its update strategy and then returns control to the browser.

Finally, Sercrod records the handler in an internal map so that subsequent re-renders can remove or replace it cleanly.


#### Use with form fields and UI state

@focus is most commonly used with form controls and interactive UI components:

- Highlighting the active field:

  @@html
  <serc-rod id="app" data='{
    "active": { "field": null }
  }'>
    <input type="text"
           name="email"
           @focus="active.field = 'email'">

    <textarea name="message"
              @focus="active.field = 'message'"></textarea>

    <p *if="active.field === 'email'">
      You are editing the email.
    </p>

    <p *if="active.field === 'message'">
      You are editing the message.
    </p>
  </serc-rod>
  @@

- Clearing errors when returning to a field:

  @@html
  <input type="text"
         :value="profile.email"
         @focus="errors.email = ''">
  @@

  When the user focuses the input again, outdated error messages are cleared, which can be more user friendly than showing an old error while they are trying to fix it.

- Pairing with :class for visual focus:

  @@html
  <input type="text"
         :class="focus.name ? 'is-focused' : ''"
         @focus="focus.name = true"
         @blur="focus.name = false">
  @@

  The CSS class is-focused is present only while the input has focus.


#### Use with conditionals and loops

Because @focus is an event directive on the element itself, it composes naturally with structural directives:

- Conditional inputs:

  @@html
  <input type="text"
         *if="mode === 'advanced'"
         :value="settings.detail"
         @focus="focus.detail = true"
         @blur="focus.detail = false">
  @@

  The focus handlers exist only in advanced mode, and every time the element is created a fresh listener is attached.

- Inputs inside loops:

  @@html
  <ul>
    <li *for="item of items">
      <input type="text"
             :value="item.label"
             @focus="item.is_focused = true"
             @blur="item.is_focused = false">
    </li>
  </ul>
  @@

  Each iterated input receives its own @focus and @blur handlers.
  The expression is evaluated in the per item scope so it can safely write to item.is_focused.


#### Sercrod-specific notes and restrictions

- No bubbling shortcut  
  The native focus event does not bubble in the same way as click events.
  Sercrod does not change this.
  If you attach @focus to a parent container, it will not see focus events from descendants unless the browser fires those events on the container as well.
  To react when a specific element gains focus, put @focus directly on that element.

- Event prefix  
  The actual attribute name for focus uses whatever prefix is configured in events.prefix.
  By default this is "@", so the attribute is @focus.
  If you change the prefix to something like "ne-", the same handler would be written as ne-focus.

- Cleanup of handler attributes  
  If cleanup.handlers is enabled in Sercrod configuration, Sercrod removes the original @focus attribute from the output DOM after the listener has been attached.
  The listener remains active; the cleanup only affects the visible markup.


#### Best practices

- Track simple flags  
  Use @focus to maintain simple flags, such as focus.name or active.field, rather than recalculating focus state indirectly.
  This keeps templates easy to read and styles easy to apply.

- Combine with @blur  
  For most flows, treat @focus and @blur as a pair:
  set a flag true on focus and false on blur.
  This pattern fits well with conditions like *if="focus.name" and with :class or :style bindings.

- Keep handlers small  
  Focus events can occur often when users tab through a form or when scripts programmatically move focus.
  Keep @focus expressions short and inexpensive, and delegate complex logic to helper functions when necessary.

- Use update and noupdate modifiers deliberately  
  Whether @focus causes a re-render by default depends on the events.non_mutating configuration.
  If you need UI to change as soon as focus moves (for example to show helper text or highlight a row), use @focus.update to force an update.
  If you use @focus only for internal bookkeeping that does not affect the page, you can use @focus.noupdate to keep rendering cost low.

- Consider keyboard users  
  Remember that many users navigate by keyboard.
  @focus is a natural place to add or remove keyboard friendly affordances such as outline highlights or helper text.


#### Additional examples

Highlighting the currently focused row in a table:

```html
<serc-rod id="app" data='{
  "rows": [
    { "id": 1, "name": "Alpha" },
    { "id": 2, "name": "Beta" }
  ],
  "focused_id": null
}'>
  <table>
    <tbody>
      <tr *for="row of rows"
          :class="row.id === focused_id ? 'is-focused-row' : ''">
        <td>
          <input type="text"
                 :value="row.name"
                 @focus="focused_id = row.id"
                 @blur="focused_id = null">
        </td>
      </tr>
    </tbody>
  </table>
</serc-rod>
```

Showing contextual helper text only while a field has focus:

```html
<serc-rod id="app" data='{
  "focus": { "password": false }
}'>
  <label>
    Password:
    <input type="password"
           @focus="focus.password = true"
           @blur="focus.password = false">
  </label>

  <p *if="focus.password">
    Use at least 12 characters, mixing letters, numbers, and symbols.
  </p>
</serc-rod>
```


#### Notes

- @focus is an event directive that wires the native focus event to a Sercrod expression.
- The expression runs in the usual Sercrod scope, with access to $event, $e, el, and $el in addition to normal data.
- @focus composes cleanly with colon bindings, structural directives, and other event handlers on the same element.
- Update behavior is governed by the global events.non_mutating configuration and can be overridden per handler using the update and noupdate modifiers.
- If cleanup.handlers is enabled, the original @focus attribute is removed from the rendered DOM after the listener is attached, leaving the final HTML clean while keeping the handler active.
