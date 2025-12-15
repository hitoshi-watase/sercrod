### :class

#### Summary

:class is an attribute binding directive that computes the class attribute from a Sercrod expression.
It writes directly to the element’s className property and supports three main value shapes:

- string: used as the class list as is,
- array: filtered and joined as space separated class tokens,
- object: keys included when their corresponding values are truthy.

The binding is one way: Sercrod updates the element’s classes from data, but changes to className in the DOM are not written back to data.


#### Basic example

A simple conditional class:

```html
<serc-rod id="app" data='{
  "isActive": true,
  "isDisabled": false
}'>
  <button :class="[
    'btn',
    isActive && 'btn-active',
    isDisabled && 'btn-disabled'
  ]">
    Click me
  </button>
</serc-rod>
```

Behavior:

- The expression is evaluated in the current scope.
- The array is filtered for truthy entries, then joined by spaces.
- With isActive true and isDisabled false, the resulting className is "btn btn-active".
- If the data changes and the host re renders, the className is recomputed.


#### Behavior

Core rules for :class:

- The expression is evaluated with mode attr:class and has access to the current scope and element.
- The result is inspected by type:

  - string:
    - The string is assigned directly to el.className.
  - array:
    - Falsy values are removed using filter(Boolean).
    - The remaining items are joined with a single space.
    - JavaScript toString is used for coercion, so non string items are converted to strings.
  - object:
    - Object.keys(val) is taken.
    - Keys whose values are truthy (Boolean coercion) are kept.
    - The remaining keys are joined with a single space.
  - anything else:
    - el.className is set to an empty string.

- On evaluation error:
  - If evaluating the :class expression throws, Sercrod sets el.className to an empty string as a safe fallback.

- Cleanup:
  - If Sercrod configuration sets cleanup.handlers to a truthy value, the original :class attribute is removed from the output DOM after it has been processed.
  - In that case, only the effective class attribute remains externally visible.


#### Value forms in detail

String form:

```html
<button :class="'btn btn-primary'">Save</button>
```

- The expression returns a string.
- Sercrod sets el.className to that exact string.
- Any existing classes on the element are replaced.

Array form:

```html
<button :class="[
  'btn',
  size === 'large' && 'btn-lg',
  variant === 'danger' && 'btn-danger'
]">
  Delete
</button>
```

- The expression returns an array.
- Falsy entries (false, null, undefined, 0, "", NaN) are removed.
- The remaining entries are joined with a space.
- Typical usage is to write conditions like isActive && "is-active" so that a class is included only when the condition is truthy.

Object form:

```html
<button :class="{
  'btn': true,
  'btn-active': active,
  'btn-disabled': disabled
}">
  Submit
</button>
```

- The expression returns an object mapping class names to flags.
- Sercrod includes a key in the class list when its value is truthy under Boolean coercion.
- This form is well suited for declarative toggling of many classes at once.


#### Evaluation timing

:class is evaluated in the attribute binding phase of element rendering.

Rough order:

- Structural directives such as *if, *for, *each, *switch, *include, and others decide whether the element stays in the DOM and how its children look.
- Once the element is confirmed for rendering, Sercrod iterates over its attributes.
- For every attribute whose name starts with a colon, Sercrod runs the colon binding logic.
- :text and :html are handled by their dedicated text and HTML binding path; other colon attributes, including :class, are handled by the generic :attr binding group.
- When the host re renders because its data or stage changes, :class is re evaluated using the updated scope.

There is no separate scheduling for :class. It participates in the normal render update process like other colon bindings.


#### Execution model

Conceptually, when Sercrod processes an element with :class, the steps are:

1. It encounters an attribute with name :class and reads its value as an expression string.
2. It evaluates that expression using eval_expr with the current scope, and a context where:
   - el is the source template node for this element,
   - mode is "attr:class".
3. It inspects the type of the returned value:
   - string, array, or object are handled as described above.
   - Any other type yields an empty className.
4. It writes the computed class list into el.className, replacing any previous className on that element.
5. If evaluation throws, Sercrod sets el.className to an empty string as a defensive default.
6. If cleanup.handlers is enabled, Sercrod removes the original :class attribute from the rendered element.

Important detail:

- :class always overwrites the element’s entire className, including any classes defined in the original markup or set by scripts, for that render pass.
- If you need to keep certain classes permanently, include them in the expression itself rather than relying on a static class attribute.


#### Scope and data access

The :class expression is evaluated in the same scope as other Sercrod expressions:

- It can access data from the root or the current host.
- It can see any iteration variables from *for or *each that surround the element.
- It can access helper methods and special values such as $root or $parent where applicable.

There is no special scope for :class beyond what the element would normally see in its context.


#### Use with static class attributes and other directives

Static class attributes:

```html
<button class="btn" :class="isPrimary ? 'btn btn-primary' : 'btn btn-secondary'">
  Save
</button>
```

- Even if the template has class="btn", the :class binding will overwrite className entirely.
- After Sercrod’s first render, the static class attribute is no longer authoritative for that element.

Best practice:

- Treat :class as the single source of truth for the element’s classes whenever you use it.
- If you need persistent static classes, include them in the :class expression, for example:
  - :class="['btn', isPrimary ? 'btn-primary' : 'btn-secondary']".

Interaction with other directives:

- :class can be freely combined with:

  - structural directives on the same element such as *if, *for, *each, *switch,
  - other colon bindings on the same element (for example :title, :aria-label),
  - event bindings such as @click,
  - data bindings like n-input on form controls.

- There is no special restriction specific to :class. The main behavior to remember is that :class controls the entire className for that render.


#### Best practices

- Prefer object or array syntax for conditional classes  
  Object syntax is often clearer for toggling many classes:

  ```html
  :class="{
    'is-open': open,
    'is-disabled': disabled,
    'has-error': hasError
  }"
  ```

  or, using array syntax:

  ```html
  :class="[
    'panel',
    open && 'is-open',
    disabled && 'is-disabled',
    hasError && 'has-error'
  ]"
  ```

- Keep string literals for static base classes  
  Use strings as the base and layers of variability:

  ```html
  :class="size === 'large' ? 'btn btn-lg' : 'btn'"
  ```

- Avoid relying on the static class attribute once :class is present  
  Any static class defined directly in markup is overwritten by :class.
  For predictable behavior, consider treating :class as the only definition of classes for that element.

- Use simple, readable expressions  
  If your :class expression becomes long or complex, consider moving the computation into data or a helper method, then binding the single result:

  ```html
  :class="buttonClass"
  ```

  where buttonClass is computed in data or methods.


#### Additional examples

Classes driven by item state in a loop:

```html
<serc-rod id="list" data='{
  "items": [
    { "label": "Alpha", "active": true,  "disabled": false },
    { "label": "Beta",  "active": false, "disabled": false },
    { "label": "Gamma", "active": false, "disabled": true  }
  ]
}'>
  <ul>
    <li *each="item of items"
        :class="{
          'item': true,
          'item-active': item.active,
          'item-disabled': item.disabled
        }">
      <span :text="item.label"></span>
    </li>
  </ul>
</serc-rod>
```

Responsive classes:

```html
<serc-rod id="layout" data='{
  "compact": true
}'>
  <div :class="compact ? 'layout layout-compact' : 'layout layout-wide'">
    <!-- content -->
  </div>
</serc-rod>
```


#### Notes

- :class is a specialized colon binding for the class attribute. It does not go through the generic attr filter; instead, it writes directly to el.className.
- The expression result is never written back into data; the binding is data to DOM only.
- If evaluation fails, Sercrod falls back to an empty className for safety.
- When cleanup.handlers is enabled, the original :class attribute is stripped from the final HTML, leaving only the effective class list on the element.
