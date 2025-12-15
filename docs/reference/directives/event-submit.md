### @submit

#### Summary

@submit attaches a handler to the native submit event.
The expression on @submit is evaluated when a form is submitted and the submit event reaches the element that declares @submit.
Typical uses include validating data, toggling flags, or invoking custom submission logic before or instead of the browser’s default form submission.

@submit is part of the event handler family (such as @click, @input, @change, @keydown) and follows the same general evaluation rules as other @ directives.
It does not automatically prevent the browser’s default submission; use modifiers or *prevent-default when you want to block navigation.


#### Basic example

Intercept form submission and mark the form as submitted without leaving the page:

```html
<serc-rod id="contact" data='{
  "form": {
    "name": "",
    "message": ""
  },
  "submitted": false
}'>
  <form @submit.prevent="submitted = true">
    <label>
      Name:
      <input type="text" name="name" :value="form.name">
    </label>

    <label>
      Message:
      <textarea name="message" :value="form.message"></textarea>
    </label>

    <button type="submit">Send</button>

    <p *if="submitted">
      Thank you, we received your message.
    </p>
  </form>
</serc-rod>
```

Behavior:

- When the user clicks the button or presses Enter in a field, the browser fires a submit event on the form.
- Sercrod invokes the expression submitted = true on that host.
- The modifier .prevent on @submit.prevent calls event.preventDefault, so the browser does not perform a full page navigation.
- The paragraph shows after the first successful submit event.


#### Behavior

Core rules:

- Target event  
  @submit wires the native submit event.
  The handler is attached to the element that carries @submit.
  Usually this is a form element, but you can also listen on an ancestor and rely on event bubbling.

- Expression evaluation  
  Sercrod treats the attribute value as a script expression, for example handleSubmit($event) or submitted = true.
  When the event fires, Sercrod evaluates this expression in the current scope.

- Event context  
  Inside the expression, Sercrod provides:

  - $event and $e: the native Event or SubmitEvent instance.
  - el and $el: the element that has @submit (typically the form).

  For example:

  - @submit.prevent="handleSubmit($event, $el)"

- Default action  
  By default, @submit does not alter the browser’s default submit behavior.
  The default action runs unless it is prevented by your handler or by *prevent-default.
  To block navigation, use a modifier such as .prevent or use *prevent-default on the same form.

- Modifiers  
  Modifiers are appended to the event name with dots, for example:

  - @submit.prevent
  - @submit.prevent.stop
  - @submit.once
  - @submit.noupdate
  - @submit.update

  The generic modifier semantics are:

  - prevent: call event.preventDefault() before evaluating the expression.
  - stop: call event.stopPropagation() before evaluating the expression.
  - once: automatically remove the handler after the first successful call.
  - capture: attach the listener in the capture phase.
  - passive: attach the listener as passive.
  - update: force a host update after the handler, even if the event is considered non mutating.
  - noupdate: skip automatic updates after the handler.

- Cleanup  
  If Sercrod configuration sets cleanup.handlers to a truthy value, the original @submit attribute is removed from the output DOM after the listener has been registered.
  The listener itself remains attached; only the attribute string disappears from the markup.


#### Evaluation timing

@submit participates in the normal Sercrod render and event lifecycle:

- Structural phase  
  Structural directives such as *if, *for, *each, *switch, and *include run first, deciding whether the form is present and what its children look like.

- Attribute and directive phase  
  Once Sercrod decides to keep the element, it processes its attributes.
  Event attributes whose names start with the configured events.prefix (by default "@") are handled in this phase.
  For @submit, the handler is registered at this time.

- Event firing  
  When the browser fires submit:

  - If @submit is on the form, the handler runs at the form.
  - If @submit is on an ancestor, the handler runs when the submit event bubbles to that ancestor, unless the event was stopped earlier.

- Re renders  
  On subsequent renders, Sercrod reattaches or updates the handler so it always reflects the latest expression and scope.


#### Execution model

Conceptually, Sercrod handles @submit as follows:

1. During rendering, Sercrod encounters an element with an attribute whose name begins with the events prefix and whose base name is submit, such as @submit or @submit.prevent.stop.
2. Sercrod strips the prefix and splits the remaining part on dots:

   - "submit.prevent.stop" becomes event name submit and modifiers prevent and stop.

3. Sercrod reads the attribute value as an expression string, for example handleSubmit($event) or submitted = true.
4. Sercrod builds a handler function handler(e) that:

   - Applies the prevent modifier by calling e.preventDefault() if present.
   - Applies the stop modifier by calling e.stopPropagation() if present.
   - Creates a proxy scope that:

     - Exposes $event and $e as the native event.
     - Exposes el and $el as the element with @submit.
     - Falls back to data on the host and then to window for global names.

   - Invokes eval_event(expr, mergedScope, { el, $event: e }).

   - Decides how to update the host after the expression, based on the event name and modifiers (see below).

   - Removes itself if the once modifier is set.

5. Sercrod registers this handler with addEventListener("submit", handler, options) on the element, where options reflect capture, passive, and once.

6. When the handler finishes without throwing, Sercrod applies its default update strategy:

   - It treats submit as a mutating event, so by default it triggers a full host update, unless modifiers override this behavior.

The expression runs in the context of the host; any property writes to data are marked as dirty and become visible in subsequent renders.


#### Interaction with form submission

Because @submit hooks into the native submit event, it integrates with normal form behavior:

- Where to place @submit  

  - Placing @submit on the form element is the most direct pattern.
  - You can also place @submit on a wrapper element if you rely on the submit event bubbling from the form.

- Default navigation  
  Without any prevention:

  - The browser submits the form to its action URL (or to the current URL if action is absent).
  - Sercrod still runs the @submit expression before or alongside the browser’s default action, depending on modifiers and other listeners.

- Preventing navigation  

  You have two main options to prevent native navigation:

  - Use a modifier on @submit:

    - @submit.prevent="handleSubmit($event)"
    - @submit.prevent.stop="handleSubmit($event)"

    The prevent modifier calls event.preventDefault() on the same event that triggers your handler.

  - Or use *prevent-default on the form:

    - <form *prevent-default="submit" @submit="handleSubmit($event)">...</form>

    *prevent-default with mode submit (or all) adds a submit listener on the form that always calls event.preventDefault(), regardless of @submit modifiers.

  When both @submit.prevent and *prevent-default="submit" are present, the event is prevented in both listeners; this is safe but redundant.

- Button clicks and keyboard submit  

  @submit fires when the submit event fires, regardless of whether it was initiated by a button click or pressing Enter in a field.
  The exact triggering rules follow native browser behavior; Sercrod does not change which interactions emit submit.


#### Update strategy and performance

The generic event engine applies an update strategy after each handler:

- Submit is treated as a mutating event  
  By default, submit is not listed among non mutating events in configuration.
  That means wantsUpdate is true unless you explicitly mark submit as non mutating.

- Default behavior  
  For a submit event, Sercrod performs a full host update after the handler, unless:

  - You explicitly add the noupdate modifier, for example @submit.noupdate="handleSubmit()".
  - You add submit to the events.non_mutating configuration set and do not force update with a modifier.

- Overriding the default  

  - To always update, even for events configured as non mutating, use the update modifier.
  - To avoid updates when you only use @submit to trigger external side effects (for example, sending data via a third party library), use noupdate.

This strategy ensures that typical form flows see an updated UI after submit (for example showing confirmation messages or clearing fields), while still allowing you to suppress updates when not needed.


#### Use with attribute bindings and staged forms

@submit combines naturally with attribute bindings and staging mechanisms:

- With :action and :method  

  ```html
  <form method="post"
        :action="endpoint"
        @submit.prevent="handleSubmit($event)">
    <!-- fields -->
  </form>
  ```

  :action and :method control the visible form attributes; @submit controls what happens when the form is submitted.
  Sercrod does not automatically couple @submit to :action; they are separate mechanisms that share the same DOM element.

- With staged data via *stage  

  ```html
  <serc-rod id="profile" data='{
    "profile": { "name": "", "email": "" },
    "saved": false
  }'>
    <form *stage="'profile'"
          @submit.prevent="
            saved = true;
            // apply staged profile back to main data
            *apply is still driven by its own directive
          ">
      <input type="text" :value="profile.name">
      <input type="email" :value="profile.email">
      <button type="submit">Save</button>
    </form>
  </serc-rod>
  ```

  Here, @submit.prevent is used to mark the form as saved and to coordinate with other directives that commit staged data.
  The actual commit is still controlled by the staging directives; @submit only runs expressions.


#### Use with conditionals and loops

Like other event directives, @submit can be used with structural directives that control the element itself:

- Conditional forms:

  ```html
  <form *if="mode === 'login'"
        @submit.prevent="onLogin($event)">
    <!-- login fields -->
  </form>

  <form *if="mode === 'register'"
        @submit.prevent="onRegister($event)">
    <!-- registration fields -->
  </form>
  ```

  Each form gets its own @submit handler, and only the active form’s handler is attached.

- Forms inside loops:

  ```html
  <div *for="item of items">
    <form @submit.prevent="submitItem(item, $event)">
      <!-- fields bound to item -->
      <button type="submit">Save {{%item.name%}}</button>
    </form>
  </div>
  ```

  Each iteration receives a dedicated handler whose expression is evaluated with that iteration’s item in scope.


#### Sercrod-specific restrictions

For @submit itself, there are no special Sercrod only restrictions beyond the general event rules:

- You may add @submit to any element; in practice it is most useful on form elements or ancestors that receive the bubbling submit event.
- You may combine @submit with other event directives on the same element, as long as they use distinct event names (for example @click, @keydown).
- You may combine @submit with attribute directives such as :action, :method, :class, :style, and with structural directives such as *if and *for targeting the same element.

Unlike structural directives such as *each, *include, or *import, @submit does not participate in element ownership rules for children, so there is no restriction like “only one per element” for @submit.


#### Best practices

- Prefer form level @submit  
  Attach @submit to the form element rather than to individual buttons when you want to handle the logical submission of the form as a whole.

- Use .prevent when staying on the same page  
  For single page flows where you do not want a full page reload, always use @submit.prevent or *prevent-default="submit".
  This lets you run custom logic and update the UI without leaving the host page.

- Keep handlers focused  
  Keep the logic in @submit handlers relatively small and delegate heavy work to helper functions or services.
  This keeps expressions readable and easier to maintain.

- Combine with feedback flags  
  Use flags such as pending, submitted, or error on the host data to drive visual feedback (for example disabling the button or showing status messages) after submit.

- Tune updates when needed  
  If a submit handler only triggers an external side effect and does not need to update the Sercrod host, consider using @submit.prevent.noupdate to avoid unnecessary re renders.


#### Additional examples

Minimal custom submit with validation:

```html
<serc-rod id="signup" data='{
  "email": "",
  "error": "",
  "ok": false
}'>
  <form @submit.prevent="
           error = (!email || email.indexOf('@') === -1)
             ? 'Please enter a valid email.'
             : '';
           ok = !error;
         ">
    <input type="email" name="email" :value="email">
    <button type="submit">Sign up</button>

    <p *if="error" *print="error"></p>
    <p *if="ok">
      Check your inbox to confirm your email.
    </p>
  </form>
</serc-rod>
```

Listening on a wrapper element instead of the form:

```html
<serc-rod id="host" data='{
  "count": 0
}'>
  <div @submit.prevent="count = count + 1">
    <form>
      <input type="text" name="q">
      <button type="submit">Search</button>
    </form>
  </div>

  <p>Submits in this area: {{%count%}}</p>
</serc-rod>
```

In this pattern, the form still fires submit, and the event bubbles to the wrapper div where @submit is attached.


#### Notes

- @submit is an event handler directive for the native submit event.
- The expression runs with $event and $e set to the native event, and el and $el set to the element that declared @submit.
- By default, submit is treated as a mutating event, so Sercrod performs a host update after the handler unless you explicitly suppress it with noupdate.
- Use .prevent on @submit or *prevent-default="submit" on a form when you need to intercept submission without letting the browser navigate away.
- If cleanup.handlers is enabled, the @submit attribute is removed from the rendered DOM after listener registration; this does not affect behavior, only the visible markup.
