### @change

#### Summary

@change attaches a handler to the native change event on an element.
The expression on @change is evaluated when the browser fires a change event, typically after the user has committed a new value for a form control.
Typical uses include synchronising derived state, running validation at commit time, and triggering side effects when a select, checkbox, or other control is changed.

@change is part of the general event handler family (such as @click, @input, @blur) and follows the same evaluation model as other at sign directives.


#### Basic example

A select that updates a selected value when the user chooses an option:

```html
<serc-rod id="app" data='{
  "selected": "apple",
  "options": ["apple", "banana", "orange"]
}'>
  <label>
    Favorite fruit:
    <select :value="selected"
            @change="selected = $event.target.value">
      <option *for="opt of options"
              :value="opt"
              *textContent="opt"></option>
    </select>
  </label>

  <p>
    You chose:
    <span *textContent="selected"></span>
  </p>
</serc-rod>
```

Behaviour:

- When the user selects a different option, the browser fires change on the select element.
- Sercrod evaluates the @change expression in the current scope, using the native event as $event.
- The expression writes back into data, updating selected.
- After the handler runs, Sercrod performs a lightweight child update of the host so that the rendered content stays in sync.


#### Behavior

Core rules for @change:

- Target event  
  @change wires the native change event on the element where it appears.
  On typical form controls, this event fires when the value is committed, not on every keystroke.

- Expression evaluation  
  The attribute value is parsed as an expression, for example selected = $event.target.value or onChange($event, el).
  When the event fires, Sercrod evaluates this expression against the current host data and local scope.

- Access to the event and element  
  Inside the expression:
  - $event and $e refer to the native Event object.
  - el and $el refer to the current DOM element.

- Data updates  
  When the expression assigns to properties that live on the host data object, Sercrod updates both the scoped view and the underlying host data.
  The result value of the expression is ignored; only its side effects matter.

- Modifiers  
  @change supports the standard event modifiers:
  - .prevent calls event.preventDefault before evaluating the expression.
  - .stop calls event.stopPropagation before evaluating the expression.
  - .once registers a listener that automatically removes itself after the first event.
  - .capture and .passive are passed through to addEventListener options.
  These modifiers are parsed from the attribute name, for example @change.prevent.stop or @change.once.

- Cleanup  
  If cleanup.handlers is enabled in Sercrod configuration, the original @change attribute is removed from the output DOM after it has been processed, leaving only the attached listener and normal attributes visible.


#### Evaluation timing

@change follows the normal rendering and event wiring phases:

1. Structural directives such as *if, *for, *each, *switch, *include and *import decide whether an element exists and what its children look like.
2. Once an element is kept, Sercrod walks its attributes.
   Attributes whose names start with the configured events prefix (by default @) are treated as event handlers.
3. For an attribute named @change or equivalent with modifiers, Sercrod calls the dedicated event renderer to register a change listener.
4. On later renders, Sercrod reattaches handlers as needed, replacing previous listeners for the same event name on the same element.

When the browser fires change on the element, the expression is executed immediately in the same turn as the native event.


#### Execution model

At a high level, Sercrod processes @change as follows:

1. During rendering, Sercrod finds an attribute whose name starts with the events prefix and whose event name part is change.
2. It extracts:
   - The event name change.
   - The set of modifiers such as prevent, stop, once, capture or passive.
   - The expression string from the attribute value.
3. It builds an evaluation scope that:
   - Exposes host data and local scope variables.
   - Provides $event and $e for the native event and el and $el for the element.
   - Propagates writes back into host data when assigning to known keys.
4. Sercrod defines a handler function that:
   - Applies .prevent and .stop modifiers to the native event if requested.
   - Evaluates the expression through Sercrod’s event evaluator with the prepared scope and context.
   - Decides how to update the host after the handler runs.
5. For each element, Sercrod stores a per event handler map so that re rendering removes the previous handler for that event before adding the new one.
   For the change event there is at most one active handler per element; the last declaration wins.

Error handling:

- If evaluation of the @change expression throws, Sercrod logs a warning through its error.warn channel but keeps the application running.
- Errors in one handler do not prevent other elements from updating.


#### Update behaviour after @change

After a @change handler finishes, Sercrod decides how to refresh the view:

- The runtime classifies input, change, beforeinput, keydown, keyup, composition events and clicks on form controls as input like events.
- For these input like events, Sercrod always performs a lightweight child update on the host:
  - It calls the internal update children method for that host, which propagates updates into child Sercrod instances without forcing a full re render of the host itself.
  - This strategy is chosen to keep focus stable while reflecting changes.

For @change specifically:

- change is treated as an input like event, so it always triggers the child update path.
- Configuration of events.non_mutating does not prevent this lightweight update for @change, because change is not considered non mutating.
- There is no automatic full host update triggered solely by @change; the child update is usually sufficient to keep form state and related content in sync.


#### Use with form fields and data bindings

@change is especially useful on form controls where the committed value matters more than each keystroke.

With n input or *input:

- n input and *input handle two way binding of values for form controls by attaching their own internal listeners.
- @change can be used alongside n input or *input on the same element to perform additional side effects when the bound value is committed.

Example: normalise and mark dirty when a field changes:

```html
<serc-rod id="app" data='{
  "profile": { "age": 30 },
  "dirty":   { "age": false }
}'>
  <input type="number"
         n-input="profile.age"
         @change="
           profile.age = Number($event.target.value || 0);
           dirty.age = true;
         ">
</serc-rod>
```

With checkbox and radio:

```html
<serc-rod id="app" data='{
  "newsletter": false
}'>
  <label>
    <input type="checkbox"
           :checked="newsletter"
           @change="newsletter = $event.target.checked">
    Receive newsletter
  </label>
</serc-rod>
```

With select multiple:

```html
<serc-rod id="app" data='{
  "selected_tags": []
}'>
  <select multiple
          @change="
            selected_tags = Array.from($event.target.selectedOptions)
                                  .map(o => o.value);
          ">
    <option value="news">News</option>
    <option value="offers">Offers</option>
    <option value="tips">Tips</option>
  </select>
</serc-rod>
```

In each case, @change runs only when the control’s value is committed by the browser, not on every key stroke, making it suitable for validations or side effects that should not run too frequently.


#### Use with conditionals and loops

As with other event directives, @change composes with structural directives that control the element itself.

Inside conditionals:

```html
<input type="text"
       *if="mode === 'edit'"
       :value="item.title"
       @change="item.title_saved = false">
```

Inside loops:

```html
<ul>
  <li *for="item of items">
    <input type="text"
           :value="item.label"
           @change="item.touched = true">
  </li>
</ul>
```

Each instance inside the loop receives its own @change handler bound to that iteration’s item.
If a structural directive removes or replaces the element on update, Sercrod re attaches the @change handler to the new element as part of the normal render process.


#### Sercrod specific restrictions

@change follows the general rules for event directives and has no extra, unique prohibitions:

- You may attach @change to any element, but it is only triggered when the browser actually fires a change event for that element.
  For practical purposes, it is mainly useful on form controls such as input, textarea, select, and content editable elements.
- You may combine @change with other event directives on the same element as long as each uses a different event name (for example @input, @focus, @blur).
- You may combine @change with data bindings such as :value, :checked, :class, :style and structural directives such as *if or *for.

No additional exclusion rules are imposed that are specific to @change.


#### Best practices

- Use @change for commit level logic  
  Prefer @change for operations that should run when the user has finished editing a field, such as validation, formatting, or triggering a save.
  For real time feedback, @input is usually more appropriate.

- Keep handlers focused  
  @change handlers should perform small, focused tasks such as updating a few flags or queuing work.
  If logic becomes large, factor it into named functions and call those from the handler expression.

- Use $event responsibly  
  Prefer to use the data model (for example values managed by n input) as the primary source of truth.
  Use $event.target only when necessary, and keep the DOM access in one place if possible.

- Avoid heavy synchronous work  
  Because the handler runs synchronously in the event loop, avoid expensive computation or long running operations inside the @change expression.
  Delegate heavy work to asynchronous functions if needed.

- Combine with staging when appropriate  
  When using *stage, keep @change handlers operating on the staged copy, and let *apply control when staged values are committed back to the main data.


#### Additional examples

Trigger validation logic on change:

```html
<serc-rod id="app" data='{
  "value": "",
  "error": ""
}'>
  <input type="text"
         :value="value"
         @change="
           const v = $event.target.value.trim();
           value = v;
           error = v ? '' : 'This field is required.';
         ">

  <p *if="error" *textContent="error"></p>
</serc-rod>
```

Integrate with a manual save action:

```html
<serc-rod id="app" data='{
  "draft": "",
  "saved": "",
  "dirty": false
}'>
  <textarea :value="draft"
            @change="dirty = true"></textarea>

  <button type="button"
          @click="
            saved = draft;
            dirty = false;
          ">
    Save
  </button>

  <p *if="dirty">
    You have unsaved changes.
  </p>
</serc-rod>
```


#### Notes

- @change wires a native change event on the element and evaluates a Sercrod expression when that event fires.
- The handler expression has access to $event and $e for the event object, and el and $el for the element, and can write back into host data.
- Sercrod treats change as an input like event and always performs a lightweight child update of the host after the handler runs.
- Cleanup options such as cleanup.handlers can be used to remove the @change attribute from the final DOM while keeping the behaviour intact.
