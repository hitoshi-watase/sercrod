### :value

#### Summary

:value is an attribute binding directive that controls the value property and value attribute of a form control.
It evaluates a Sercrod expression and writes the result into both the DOM property el.value and the value attribute for form elements, keeping the control’s visible value in sync with data.

For non form elements, :value behaves like a normal colon attribute binding and only updates the value attribute.


#### Basic example

Prefilling a text input from data:

```html
<serc-rod id="app" data='{
  "form": { "name": "Alice" }
}'>
  <form method="post" action="/submit">
    <label>
      Name:
      <input type="text" name="name" :value="form.name">
    </label>
    <button type="submit">Send</button>
  </form>
</serc-rod>
```

Behavior:

- The Sercrod host provides form.name = "Alice".
- When the template renders, Sercrod evaluates the expression form.name.
- Because the input element is a form control, Sercrod assigns that value to:
  - el.value (the DOM property).
  - The value attribute of the input.
- If data changes and the host re renders, the input’s value is updated accordingly.

:value is one way: the DOM property and attribute are driven by data, but editing the input does not automatically update data unless other directives such as *input or n-input are used.


#### Behavior

Core rules:

- Target attribute and property  
  :value targets the value attribute. For form controls, it also updates the value property.

  - If the element is INPUT, SELECT, TEXTAREA, or OPTION, Sercrod:
    - Sets el.value = String(result).
    - Then runs the generic attribute pipeline to update the value attribute.
  - For other tags, only the value attribute is updated.

- Expression evaluation  
  Sercrod reads the expression from :value (for example form.name, user.email, or condition ? a : b).
  It evaluates this expression in the current scope with mode attr:value and el set to the current element.

- Value interpretation  
  After evaluation:

  - If the result is strictly false, or is null or undefined, Sercrod removes the value attribute from the element.
    - For form controls, the DOM property el.value is not explicitly reset in this branch; the attribute is simply removed.
  - Otherwise, the result is converted to a string and passed to the generic attr filter.

- Attribute filter  
  For :value, Sercrod does not use the url filter. Instead, it calls the attr filter:

  - The filter signature is attr(name, value, ctx).
  - For :value, name is "value", value is the expression result, and ctx contains el and scope.
  - The filter must return an object { name, value } or a compatible pair.
  - If pair.value is not null, Sercrod sets pair.name to either:
    - An empty string if pair.value is true.
    - String(pair.value) for any other value.

  By default, attr returns the name and value unchanged, but applications can override it at startup to rewrite or normalise attribute names and values.

- Error handling  
  If evaluating the :value expression throws an error, Sercrod falls back to a safe state:

  - It sets an empty value attribute on the element.
  - The property el.value is not changed in the error handler.

- Cleanup  
  If configuration sets cleanup.handlers to a truthy value, Sercrod removes the original :value attribute from the DOM after processing it.
  The rendered HTML then only contains the plain value attribute, not the colon binding.


#### Evaluation timing

:value is evaluated during element rendering, as part of the colon attribute binding pass.

High level order:

- Structural directives on the same node (such as *if, *for, *each, *switch, *include, and others) run first and determine whether the element is rendered and what its children are.
- Once the element is kept for output, Sercrod creates a fresh el node from the template node.
- Sercrod then walks all attributes that start with : (except :text and :html, which are handled elsewhere).
- For each such attribute, including :value, the associated expression is evaluated and the element is updated.
- After attribute bindings and event bindings, the element is appended to the parent.

When the host re renders due to data changes, :value is re evaluated with the updated scope, so the control’s value reflects the latest data.


#### Execution model

Conceptually, when Sercrod renders an element that has :value:

1. Sercrod discovers an attribute named :value on the template node.
2. It extracts the expression string, such as form.name or user.profile.displayName.
3. It evaluates the expression using eval_expr with:
   - scope as the current scope.
   - ctx containing el (the working element) and mode "attr:value".
4. It inspects the result:

   - If the result is strictly false, null, or undefined:
     - It removes the value attribute from the element.
     - For form controls, el.value is left as is by this branch.
   - Otherwise:
     - If the element is INPUT, SELECT, TEXTAREA, or OPTION, it sets el.value = String(result).
     - It passes result to the attr filter as attr("value", result, {el, scope}).
     - If the filter returns a pair where pair.value is not null, it sets the attribute:
       - pair.name as the attribute name.
       - A stringified value (empty string if pair.value is true, or String(pair.value) otherwise).

5. If an exception occurs during expression evaluation, Sercrod sets an empty value attribute as a fallback.
6. If cleanup.handlers is enabled, Sercrod removes the :value attribute from el, leaving only the concrete value attribute.


#### Use with structural directives and loops

:value is an attribute binding and therefore composes naturally with structural directives that act at the element or container level.

Examples:

- Conditional fields:

  ```html
  <input type="text"
         name="nickname"
         *if="user.allowNickname"
         :value="user.nickname">
  ```

  The input is only rendered when user.allowNickname is truthy.
  When present, :value controls the initial and updated content of the input.

- Lists of form controls:

  ```html
  <div *each="field of fields">
    <label>
      {{%field.label%}}
      <input type="text"
             :value="field.value"
             :name="field.name">
    </label>
  </div>
  ```

  For each iteration, :value is evaluated in that iteration scope, so each input receives the correct value for its field.


#### Best practices

- Use on form controls when you want to set the visible value  
  Use :value on INPUT, SELECT, TEXTAREA, and OPTION when you need the control’s value to follow data.
  Sercrod updates both the DOM property and the attribute, so the control behaves as if you had set value directly in HTML.

- Keep expressions simple  
  Prefer bindings like form.name, user.email, or config.defaults.city over very complex inline expressions.
  If you need elaborate logic, compute a derived field in data or in a helper method and bind :value to that field.

- Use null or false to remove the attribute  
  When you explicitly want to remove the value attribute, return false, null, or undefined from the expression.
  For many browsers, removing the value attribute on a form control leaves the property value unchanged until the next time it is set, so use this pattern when you specifically want the attribute omitted.

- Use attr filter for project wide normalisation  
  If your project needs to normalise or escape values going into attributes, implement a custom attr filter.
  :value automatically participates in this pipeline, so all form values can pass through your normalisation step.

- Combine with other colon attributes on the same element  
  It is safe to use :value alongside other colon bindings on the same form control, such as :name, :placeholder, or :class.
  Each attribute is processed independently in the same colon binding pass.


#### Additional examples

Hidden ID field:

```html
<serc-rod id="app" data='{
  "user": { "id": 42, "name": "Alice" }
}'>
  <form method="post" action="/users/save">
    <input type="hidden" name="id" :value="user.id">
    <input type="text" name="name" :value="user.name">
    <button type="submit">Save</button>
  </form>
</serc-rod>
```

Using :value on OPTION inside SELECT:

```html
<serc-rod id="country-form" data='{
  "countries": [
    { "code": "US", "label": "United States" },
    { "code": "JP", "label": "Japan" }
  ],
  "selected": "JP"
}'>
  <select name="country">
    <option value="">Select a country</option>
    <option *each="c of countries" :value="c.code">
      {{%c.label%}}
    </option>
  </select>
</serc-rod>
```

In this example, :value ensures that each option’s value attribute matches c.code.
The selected option still depends on standard browser behaviour or on other directives for selection state.


#### Notes

- :value is a colon style attribute binding with special handling for form controls: it updates both the value property and the value attribute on INPUT, SELECT, TEXTAREA, and OPTION.
- For other elements, :value behaves as a normal attribute binding, updating only the value attribute.
- The binding is one way from data to DOM. Changing the value in the browser does not update data by itself; two way binding, if desired, is provided by separate form binding directives.
- :value participates in the generic attribute filter pipeline, allowing applications to plug in custom normalisation or escaping at startup.
- If cleanup.handlers is enabled, the original :value attribute is removed from the output DOM after processing, leaving a clean HTML surface with only the concrete value attribute.
