### *let

#### Summary

`*let` runs a small piece of JavaScript in Sercrod’s sandbox to define local helper variables.
These variables are available to expressions on the same element and all of its descendants.
Newly created variable names are also promoted into the host data so that later elements inside the same `<serc-rod>` can read them.

Alias:

- `*let` and `n-let` are aliases and behave the same.


#### Basic example

Compute a derived value once and reuse it in the element’s subtree:

```html
<serc-rod id="invoice" data='{"price": 1200, "qty": 3}'>
  <p *let="total = price * qty">
    Subtotal: <span *print="total"></span> JPY
  </p>
</serc-rod>
```

In this example:

- `*let` runs before any other directive on the `<p>`.
- The code `total = price * qty` creates a new variable `total` in the local scope.
- The child `<span *print="total">` can read `total` directly.
- Because `total` did not exist in the host data before, it is also promoted into the Sercrod data scope for this `<serc-rod>`.


#### Behavior

At a high level, `*let` behaves like “execute this code in the current data scope and keep any new variables”:

- It reads the current data for the host `<serc-rod>` and any in-scope iteration variables.
- It executes the `*let` string as JavaScript (expressions or simple statements) in a sandboxed scope.
- It updates the effective scope for the current element and its descendants.
- It promotes newly created variable names into the host data, but does not overwrite existing ones.

Key points:

- `*let` is a non-structural directive: it does not clone or repeat elements; it just prepares values for other directives.
- The attribute remains on the element; internally Sercrod re-evaluates it on each re-render.
- `*let` runs before `*if`, `*switch`, `*each`, and `*for` on the same element, so later directives can rely on variables created by `*let`.


#### Expression model

The value of `*let` is treated as JavaScript code:

- The code runs inside Sercrod’s expression sandbox using a dedicated scope object.
- You can write one or more simple statements.

Typical patterns:

- Single assignment:

  ```html
  <div *let="fullName = user.first + ' ' + user.last">
    <p *print="fullName"></p>
  </div>
  ```

- Multiple assignments or function calls:

  ```html
  <div *let="
    subtotal = price * qty;
    tax = subtotal * taxRate;
    total = subtotal + tax;
  ">
    <p *print="total"></p>
  </div>
  ```

- Calling helper functions:

  ```html
  <div *let="displayName = formatUserName(user)">
    <span *print="displayName"></span>
  </div>
  ```

  Here `formatUserName` must be available in the scope (for example, exported via `*methods` on the host).

What the sandbox does:

- Reads variables from the current per-element scope (data fields, loop variables, earlier `*let` values).
- Reads built-in globals (such as `Math`, `Date`) from the real global environment.
- Writes always go into the local scope used for `*let`, never directly into `globalThis`.


#### Evaluation timing

`*let` is evaluated early in the per-element pipeline:

- It is processed before structural directives on the same element:

  - Before `*if` / `n-if`.
  - Before `*switch` / `n-switch`.
  - Before `*each` / `n-each`.
  - Before `*for` / `n-for`.

- It is also evaluated before `*global` on the same element.

As a result:

- You can compute helper values in `*let` and use them immediately in:

  - `*if` conditions on the same element.
  - `*switch` expressions.
  - `*each` and `*for` expressions.
  - Any `*print`, bindings, or event handlers on this element and its children.

Example:

```html
<li *let="is_expensive = price > 1000"
    *if="is_expensive">
  <span *print="name"></span>
  <span>(premium)</span>
</li>
```

Here `*if` can safely use `is_expensive` because `*let` runs first.


#### Execution model

Conceptually, Sercrod handles `*let` on an element like this:

1. Compute the current effective scope `effScope` for this element:
   - Based on the host data for the `<serc-rod>`.
   - Including any variables from surrounding loops or parent `*let` directives.

2. If the element has `*let` or `n-let`:

   - Create a new scope object whose prototype points to `effScope`.
   - Copy the current values from `effScope` into this new scope.
   - Inject `$parent` so that branch-local code has access to the nearest ancestor Sercrod’s data.
   - Inject any methods that were registered via `*methods` and Sercrod’s internal helper methods.

3. Run the `*let` code inside Sercrod’s sandbox:

   - Reads go through the scope or, as a fallback, the real global environment for standard objects (such as `Math`).
   - Writes update only the local scope object created for `*let`.
   - Unknown identifiers become new variables on this local scope when you assign to them.

4. After the code runs:

   - Sercrod copies any variables that did not exist in the host data into the host data object.
   - Existing host data keys are not overwritten by `*let`.
   - The new scope becomes the effective scope for this element and its descendants.

5. Sercrod schedules a re-render if necessary so that bindings see the updated values.

This model keeps `*let` local by default, but still lets you share newly defined helper variables with other elements in the same `<serc-rod>`.


#### Variable creation and promotion

`*let` distinguishes between:

- New variable names created by `*let`.
- Existing data properties already present in the host’s data.

Rules:

- When `*let` creates a new name (for example `total`):

  - The new name lives in the local `*let` scope and is visible to:

    - The current element and its descendants.
    - Later elements in the same `<serc-rod>`, because Sercrod promotes this name into the host data.

- When `*let` assigns to a name that already exists in the host data (for example `price`):

  - The host data’s property is not overwritten by `*let`.
  - Only the local `*let` scope sees the updated value.
  - Expressions in the current element and its descendants see the updated value (because they use the `*let` scope), but siblings outside this subtree still see the original host data.

In practice:

- Use `*let` to create new, derived variables (such as `total`, `label`, `filteredItems`).
- Do not rely on `*let` to permanently modify existing host data properties. If you need that behavior, use `*global` instead.


#### Scope layering and parent access

Inside `*let`:

- You can access the same variables that ordinary expressions can see:

  - Fields from the host data (for example `user`, `items`, `config`).
  - Loop variables like `item`, `index`, `row`, `cell` when used inside `*each` or `*for` bodies.
  - Methods referenced via `*methods` for the host.

- Additionally, Sercrod injects `$parent` into the scope:

  - `$parent` refers to the data of the nearest ancestor `<serc-rod>` component (if any).
  - This makes it possible to compute values based on both local data and parent data.

The local `*let` scope then becomes the base scope for:

- All expressions on the same element (such as `*if`, `*print`, `:class`, `@click`).
- All expressions on child elements, including nested loops and conditionals.


#### Use with conditionals and loops

`*let` works closely with conditionals and loops.

On the same element as `*if` / `*elseif` / `*else`:

- `*let` is evaluated before the condition for that branch.
- Each branch can have its own `*let`, and Sercrod uses a branch-specific scope when checking its condition.

Example:

```html
<li *if="kind === 'user'" *let="label = user.name">
  <span *print="label"></span>
</li>
<li *elseif="kind === 'guest'" *let="label = guest.nickname">
  <span *print="label"></span>
</li>
<li *else *let="label = 'Unknown'">
  <span *print="label"></span>
</li>
```

Here:

- Each branch computes its own `label` before the branch condition is evaluated.
- Only the chosen branch is rendered, along with its computed label.

Inside loops:

- When used inside `*each` or `*for` bodies, `*let` runs once per iteration.

Example:

```html
<ul *each="item of items">
  <li *let="label = item.name + ' (#' + item.id + ')'">
    <span *print="label"></span>
  </li>
</ul>
```

Each `<li>` computes its own `label` using the `item` from that iteration.

You can also use `*let` on the loop container:

```html
<ul *each="item of items"
    *let="hasItems = !!items && items.length > 0">
  <li *if="hasItems" *print="item.name"></li>
</ul>
```

`hasItems` is computed before the `*each` and is available to each child `*if` and `*print`.


#### Best practices

- Prefer new helper variables:

  - Use `*let` to create new derived names (`total`, `label`, `normalizedUsers`), not to overwrite existing ones.
  - For permanent data mutations, use `*global` or update your data outside of templates.

- Keep `*let` code simple:

  - Compute values, do light branching, and call small helper functions.
  - Avoid long, complex procedures inside templates; move heavy logic into reusable JavaScript functions and call them from `*let`.

- Use `*let` to prepare values for multiple bindings:

  - If the same expression appears multiple times in one element or subtree, compute it once in `*let` and reuse the variable.

- Avoid unnecessary side effects:

  - `*let` re-runs on re-render, so side-effectful operations (such as network calls) should not be placed directly inside `*let`.
  - Instead, call idempotent helpers or use other mechanisms designed for side effects.


#### Additional examples

Sharing a derived variable with siblings:

```html
<serc-rod id="totals" data='{"items":[{"name":"A","price":100},{"name":"B","price":200}]}'>
  <section *let="
    subtotal = 0;
    for(const item of items){
      subtotal = subtotal + item.price;
    }
  ">
    <p>Subtotal: <span *print="subtotal"></span> JPY</p>
  </section>

  <!-- Later element can also see subtotal, because it was a new name -->
  <p>Summary: total amount is <span *print="subtotal"></span> JPY</p>
</serc-rod>
```

Using `$parent` data in a nested component:

```html
<serc-rod id="root" data='{"currency":"JPY"}'>
  <serc-rod id="child" data='{"price": 500}'>
    <p *let="text = price + ' ' + $parent.currency">
      <span *print="text"></span>
    </p>
  </serc-rod>
</serc-rod>
```

Here:

- The inner Sercrod host defines `price` in its own data.
- `*let` reads `$parent.currency` from the outer host and combines it with `price`.


#### Notes

- `*let` and `n-let` are aliases.
- The code runs inside Sercrod’s sandbox and uses a special scope; it is not the same as writing code directly into global script tags.
- `*let` does not overwrite existing host data properties; it only promotes newly created names into the host data.
- Reads can see global built-in objects like `Math`, but writes go into the local scope instead of the real global environment.
- `*let` is evaluated on each render of the element. Ensure that the code is safe to run multiple times.
- There are no special combination restrictions for `*let` beyond its evaluation order:
  - It may appear together with `*if`, `*switch`, `*each`, `*for`, and other directives on the same element.
  - It simply runs first and prepares values for the rest of the directives on that element.
