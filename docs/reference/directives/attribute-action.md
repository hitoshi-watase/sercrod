### :action

#### Summary

:action is an attribute binding directive that controls the action attribute of a form element.
It evaluates a Sercrod expression and writes the result into the form action attribute, optionally passing the value through a configurable url filter.
The binding is one way: data updates change the DOM attribute, but changes to the DOM attribute do not update data.

:action is part of the generic colon attribute family and shares the same evaluation rules as other colon bindings such as :href and :src.


#### Basic example

A simple dynamic form endpoint:

```html
<serc-rod id="app" data='{
  "endpoint": "/api/contact"
}'>
  <form method="post" :action="endpoint">
    <label>
      Name:
      <input type="text" name="name">
    </label>
    <button type="submit">Send</button>
  </form>
</serc-rod>
```

Behavior:

- The Sercrod host receives data with endpoint set to "/api/contact".
- When the form is rendered, Sercrod evaluates the expression endpoint in the current scope.
- The result is converted to a string and written into the form action attribute.
- If the data changes and the form is re rendered, the action attribute is updated to match the latest value.


#### Behavior

Core rules:

- Target attribute  
  :action targets the standard HTML action attribute. In practice it is meant for form elements, but Sercrod does not enforce the tag name. If used on a non form element, it simply writes an action attribute on that element.

- Expression evaluation  
  Sercrod reads the attribute value (for example :action="endpoint" or :action="isEdit ? editUrl : createUrl").
  It evaluates the expression in the current scope using the attribute binding mode attr:action.

- Value interpretation  
  After evaluation:

  - If the value is strictly false or is null or undefined, Sercrod removes the action attribute from the element.
  - Otherwise the value is converted to a string and passed through the url filter.
  - If the url filter returns a truthy value, Sercrod sets action to that filtered value.

- Error handling  
  If evaluating the :action expression throws an error, Sercrod falls back to a safe state by setting an empty action attribute on the element.

- Url filter  
  For :action (as for :href, :src, :formaction, and xlink:href), Sercrod calls the url filter:

  - The filter signature is url(raw, attr, ctx).
  - For :action, raw is the stringified expression result, attr is "action", and ctx contains el and scope.
  - By default, the built in url filter simply returns raw unchanged.
  - Projects can override url at startup via window.__Sercrod_filter to perform validation, rewriting, or blocking of unsafe URLs.

- Cleanup  
  If Sercrod configuration sets cleanup.handlers to a truthy value, the original :action attribute is removed from the output DOM after it has been processed.
  In that case, only the final action attribute remains visible in the rendered HTML.


#### Evaluation timing

:action is evaluated during the element rendering phase, together with other colon style attribute bindings.

More precisely:

- Structural directives such as *if, *for, *each, *switch, *include, and others decide first whether the element is present and what its children look like.
- Once Sercrod has decided to keep the element and has a working element instance for rendering, it walks through its attributes.
- For every attribute whose name starts with a colon, Sercrod dispatches to the colon binding path.
- For :action, this happens in the same pass as :href and :src.
- If the Sercrod host updates due to data changes, the form is re rendered and :action is re evaluated with the latest scope.

There is no separate scheduling or delay specific to :action. It participates in the normal render update cycle of the host.


#### Execution model

Conceptually, when Sercrod renders an element with :action, the steps are:

1. Sercrod encounters a node that has an attribute named :action.
2. It reads the expression string from that attribute, for example endpoint or isEdit ? editUrl : createUrl.
3. It evaluates the expression with eval_expr, using the current scope and a context that sets mode to attr:action and el to the current element.
4. It inspects the result:

   - If the result is strictly false, or is null or undefined, Sercrod removes the action attribute from the element and stops.
   - Otherwise, it converts the result to a string and passes it to the url filter, along with the attribute name "action" and a context with the element and scope.

5. If the url filter returns a truthy string, Sercrod sets the element attribute action to that string.
6. If evaluation throws an exception at any point, Sercrod falls back to setting action to an empty string.
7. If cleanup.handlers is enabled in the configuration, Sercrod removes the original :action attribute from the element, leaving only the concrete action attribute in the output DOM.


#### Use with structural directives and loops

Because :action is only an attribute binding, it composes freely with structural directives around it.

Typical combinations:

- Conditional forms:

  ```html
  <form *if="mode === 'edit'" method="post" :action="editEndpoint">
    <!-- fields -->
  </form>

  <form *if="mode === 'create'" method="post" :action="createEndpoint">
    <!-- fields -->
  </form>
  ```

  Each form has its own :action and the relevant one is evaluated only when its *if condition is true.

- Forms inside loops:

  ```html
  <div *each="user of users">
    <form method="post" :action="user.endpoint">
      <input type="hidden" name="id" :value="user.id">
      <button type="submit">Save {{%user.name%}}</button>
    </form>
  </div>
  ```

  For each iteration, :action is evaluated using that iteration scope, so each form can post to a user specific endpoint.

There are no special restrictions on combining :action with structural directives such as *if, *for, or *each, because those operate at the element or container level, while :action only binds an attribute.


#### Best practices

- Use on form elements  
  Use :action primarily on form elements, because the action attribute has standard meaning there.
  Sercrod does not prevent using it on other elements, but it is rarely useful outside forms.

- Keep expressions simple  
  Prefer expressions like endpoint, user.formAction, or config.apiBase + "/users" over large, complex inline logic.
  If you need elaborate branching or construction, compute the endpoint in data or in a helper function and bind that result.

- Use null or false to remove the attribute  
  When you want to explicitly remove action and fall back to the browser default (current URL), return null, undefined, or false from the expression.
  Sercrod will remove the attribute in these cases.

- Leverage the url filter for safety  
  If your project accepts dynamic or user influenced endpoints, consider overriding the url filter to reject or normalise unsafe URLs, for example by blocking unsupported protocols or rewriting relative paths.

- Combine with other bindings deliberately  
  You can freely use :action alongside other colon bindings on the same element, such as :method or :target, as long as the attribute names are distinct.
  Each binding is evaluated independently in the same attribute pass.


#### Additional examples

Dynamic endpoint based on mode:

```html
<serc-rod id="app" data='{
  "mode": "create",
  "createEndpoint": "/api/users/create",
  "editEndpoint": "/api/users/edit"
}'>
  <form method="post"
        :action="mode === 'edit' ? editEndpoint : createEndpoint">
    <!-- fields -->
  </form>
</serc-rod>
```

When mode is "create", the form posts to /api/users/create. When mode switches to "edit" and the host updates, :action changes the action attribute to /api/users/edit.

Switching between environments:

```html
<serc-rod id="app" data='{
  "env": "staging",
  "endpoints": {
    "staging": "https://staging.example.com/api/submit",
    "production": "https://example.com/api/submit"
  }
}'>
  <form method="post" :action="endpoints[env]">
    <!-- fields -->
  </form>
</serc-rod>
```

The same template can be reused across staging and production by changing env in data, without touching the markup.


#### Notes

- :action is a colon style attribute binding that targets the action attribute and shares the same mechanics as :href, :src, :formaction, and xlink:href.
- The expression result is treated as read only from the perspective of Sercrod. It is never written back into data.
- Falsy values of false, null, or undefined remove the attribute, while other values are stringified and written.
- The final URL passes through the url filter before being assigned, which allows applications to plug in custom validation or rewriting logic at startup.
- If cleanup.handlers is enabled, the original :action attribute will not appear in the rendered HTML, only the concrete action attribute remains.
