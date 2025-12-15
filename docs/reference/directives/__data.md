### Data and *let

#### Summary

This reference explains in detail how `*let` interacts with Sercrod’s data:

- How `*let` creates new variables.
- When existing data is left unchanged.
- How nested assignments behave.
- What happens inside loops.
- How `*let` differs from `*global` in terms of side effects.

It focuses on the actual behavior of the runtime, pattern by pattern, so that you can predict when Sercrod’s host data (`data` on `<serc-rod>`) is modified and when it is not.


### 1. Data model recap

Before looking at patterns, it helps to separate three layers:

1. **Host data (`_data`)**

   - Each `<serc-rod>` keeps a data object (from its `data="..."` or `data='{...}'` attribute).
   - This is the base object used to build scopes.
   - When we say “host data changes”, we mean this object is mutated or receives new properties.

2. **Effective scope (`effScope`)**

   - A plain object that represents “what expressions see” at a given element.
   - It starts from the host data.
   - Sercrod adds extra entries (loop variables like `item`, `index` and so on).
   - For each element, `effScope` may be replaced or extended (for example by `*let`).

3. **Local *let scope (`letScope`)**

   - When an element has `*let`, Sercrod builds

     - `letScope = Object.assign(Object.create(effScope), effScope)`

   - The `*let` code runs against this `letScope` via a sandbox.
   - After execution:

     - `effScope` for this element and its children becomes `letScope`.
     - New names from `letScope` may be copied (“promoted”) into the host data.

Promotion rule (current implementation):

- After `*let` finishes, Sercrod checks each property name in `letScope`.
- For every key `k`:

  - If `k` is already in the host data, it is not overwritten.
  - If `k` is not in the host data, `this._data[k] = letScope[k]` is assigned.

This rule is the core of how `*let` affects data.


### 2. Pattern reference

This section lists concrete patterns: initial data, `*let` code, and what happens to both the local scope and the host data.


#### 2.1 Pattern A: New top-level variables

Case A1: Create a new helper from existing data.

```html
<serc-rod id="invoice" data='{"price": 1200, "qty": 3}'>
  <p *let="total = price * qty">
    <span *print="total"></span>
  </p>
</serc-rod>
```

- Initial host data:

  ```json
  { "price": 1200, "qty": 3 }
  ```

- `*let` execution:

  - `total` does not exist yet in `effScope` or host data.
  - The sandbox writes `total` into `letScope`.

- Promotion:

  - After `*let`, the runtime sees `total` in `letScope`.
  - `total` is not in the host data, so host data becomes:

    ```json
    { "price": 1200, "qty": 3, "total": 3600 }
    ```

- Visibility:

  - Inside the `<p>` and its children, `total` is available via `effScope` (which is `letScope`).
  - Sibling elements of `<p>` can use `total` as a normal data field as well.


Case A2: Create multiple new names at once.

```html
<serc-rod data='{"a": 2, "b": 3}'>
  <p *let="
    sum = a + b;
    diff = a - b;
  ">
    <span *print="sum"></span>
    <span *print="diff"></span>
  </p>
</serc-rod>
```

- New names: `sum`, `diff`.
- Data after first render:

  ```json
  { "a": 2, "b": 3, "sum": 5, "diff": -1 }
  ```

- On subsequent renders, `sum` and `diff` are already in host data, so only their local values in `letScope` are updated. The host data entries stay at the first values unless something else updates them.


#### 2.2 Pattern B: Overwriting existing top-level properties

Case B1: Reassign a field that already exists in data.

```html
<serc-rod id="priceBox" data='{"price": 100}'>
  <p *let="price = price * 1.1">
    <span *print="price"></span>
  </p>
  <p>
    Original price: <span *print="$data.price"></span>
  </p>
</serc-rod>
```

- Initial host data:

  ```json
  { "price": 100 }
  ```

- `*let` execution on `<p>`:

  - Before `*let`, `effScope.price` comes from host data (100).
  - `letScope` is created as a shallow copy of `effScope`.
  - The sandbox runs `price = price * 1.1`:

    - Reads `price` from `letScope` (100).
    - Writes `price` (110) back into `letScope`.

- Promotion:

  - When promoting, the runtime sees `price` in `letScope`.
  - Since `price` already exists in the host data, it is not overwritten.

- Results:

  - Inside the first `<p>` (which uses `letScope` as `effScope`), `price` is 110.
  - In the host data and for other elements (such as the second `<p>`), `price` remains 100.
  - So `*let` can shadow existing values for the current element and its subtree without changing the original data.


Case B2: Incrementing an existing field with `+=`

```html
<serc-rod id="counter" data='{"count": 0}'>
  <p *let="count += 1">
    <span *print="count"></span>
  </p>
</serc-rod>
```

- First render:

  - `effScope.count` is 0 from host data.
  - `letScope.count` becomes 1.
  - Promotion sees `count` already in data, so it does not overwrite it.
  - Host data remains `{ "count": 0 }`.
  - Inside `<p>`, `count` is 1 (from `letScope`).

- Second render:

  - Host data still has `count: 0`, so the same process repeats.
  - `letScope.count` becomes 1 again.
  - Host data remains 0.

Consequence:

- `*let` is not suitable for permanent accumulation on existing top-level fields using `+=`.
- The local value changes per render, but the host data does not track those changes.
- If you need to truly update host data, prefer `*global` or update data outside templates.


#### 2.3 Pattern C: Creating new nested objects

Case C1: Creating a nested object from scratch.

```html
<serc-rod id="userBox" data='{}'>
  <p *let="user.name = 'Ann'">
    <span *print="user.name"></span>
  </p>
</serc-rod>
```

- Initial host data:

  ```json
  { }
  ```

- `*let` execution:

  - `user` does not exist in the scope.
  - When `user` is first read, the sandbox returns an internal “hole” object.
  - When `user.name = 'Ann'` is executed:

    - The “hole” captures the intended path `["user","name"]`.
    - Sercrod calls an internal helper that ensures `letScope.user` is an object, then sets `user.name` to `"Ann"`.

- Promotion:

  - Host data initially lacks `user`.
  - Promotion copies `user` from `letScope` into host data.

- Resulting data:

  ```json
  { "user": { "name": "Ann" } }
  ```

This is the standard way `*let` creates nested objects for you when you assign to a previously unknown path.


#### 2.4 Pattern D: Updating existing nested structures

Case D1: Updating a nested field on an existing object.

```html
<serc-rod id="profile" data='{"user": { "name": "Ann", "age": 30 }}'>
  <p *let="user.name = 'Bob'">
    <span *print="user.name"></span>
  </p>
  <p>
    Outside: <span *print="$data.user.name"></span>
  </p>
</serc-rod>
```

- Initial host data:

  ```json
  { "user": { "name": "Ann", "age": 30 } }
  ```

- `*let` execution:

  - `effScope.user` refers directly to `data.user` object.
  - `letScope.user` is a shallow copy of the reference, so it points to the same object.
  - When `user.name = 'Bob'` runs, it mutates that shared object in place.

- Promotion:

  - `user` already exists in host data.
  - No new top-level names are added, and promotion does not overwrite `user`.
  - However, the nested object has already been mutated; host data now has `user.name: "Bob"`.

- Result:

  - Both inside the `<p>` and wherever `user` is read later, `user.name` is `"Bob"`.
  - This is an example where `*let` has a global effect through shared references, even though it is “meant” to be local.

Key point:

- Assigning to nested properties of existing data (for example `user.name`, `settings.theme`) mutates the underlying object and therefore affects the host data globally.


#### 2.5 Pattern E: Unknown variables with operators like `+=`

Case E1: Incrementing a variable that does not exist yet.

```html
<serc-rod id="box" data='{}'>
  <p *let="count += 1">
    <span *print="count"></span>
  </p>
</serc-rod>
```

- First render:

  - `count` is not in scope, so reading it returns a special placeholder (hole).
  - `count += 1` uses that placeholder:

    - It behaves as if the previous value was `0`.
    - The result becomes `1`, which is then written into the local scope.

  - After `*let`:

    - `letScope.count` is `1`.
    - Host data does not yet have `count`, so promotion adds it.

- Data after first render:

  ```json
  { "count": 1 }
  ```

- Second render:

  - Now `count` exists in host data (value 1).
  - The situation becomes identical to Pattern B2:

    - `letScope.count` becomes `2` inside `<p>`.
    - Host data remains `1`.

Consequences:

- For the **first** render, an unknown name used with `+=` behaves like a fresh counter.
- From the **second** render onward, `count` is considered an existing data field, so the `+=` happens only in the local `*let` scope without updating host data.
- Do not rely on `*let` for long-lived counters; treat this as an advanced detail and use other mechanisms for stateful counters.


#### 2.6 Pattern F: Inside loops (*for / *each)

`*let` inside loops is evaluated for each iteration. The scope for each iteration is a plain object that includes:

- The host data.
- Loop variables (such as `item`, `index`, `key`, `value`).
- Any earlier `*let` values on ancestors.

Example: `*let` inside `*each`.

```html
<serc-rod id="list" data='{"items":[{"name":"A"},{"name":"B"}]}'>
  <ul *each="item of items">
    <li *let="label = item.name + '!'">
      <span *print="label"></span>
    </li>
  </ul>
</serc-rod>
```

Per iteration:

- `effScope` includes `items` and `item`.
- `letScope` is built from that `effScope`.
- `label` is created and used by this `<li>` and its children.
- Post-`*let`, `label` is also added to host data (if it did not exist yet), because it is a new name.
- `item` is a loop variable:

  - It is part of `effScope`, so `letScope` sees it as well.
  - During promotion, implementation walks through all properties of `letScope`.
  - If `item` is not in host data yet, it may also be added as a new property of the host data.
  - Subsequent renders will not keep this top-level `item` in sync with the loop; it is essentially a snapshot.

Practical guidance:

- It is safe and common to use `*let` to create helper variables from loop variables (for example `label = item.name + '!'`).
- Do not rely on promotion of loop variables like `item`, `index`, `key`, `value` into host data; treat that as an internal detail.
- If you want stable top-level fields derived from loops, compute them outside the template or use a dedicated `*let` on a parent element that runs once.


#### 2.7 Pattern G: Using $parent inside *let

Inside `*let`, Sercrod injects `$parent` as a non-enumerable property:

- `$parent` refers to the data of the nearest ancestor `<serc-rod>`.
- Because it is non-enumerable, it is not copied into host data during promotion.
- However, the object behind `$parent` is shared and can be mutated.

Example:

```html
<serc-rod id="root" data='{"currency":"JPY"}'>
  <serc-rod id="child" data='{"price": 500}'>
    <button *let="$parent.total = ($parent.total || 0) + price">
      Add to total
    </button>
    <p>Total: <span *print="$parent.total"></span> {{currency}}</p>
  </serc-rod>
</serc-rod>
```

- `*let` runs in the child, but `"$parent"` points to the root host’s data.
- The line

  - `$parent.total = ($parent.total || 0) + price`

  mutates the parent data directly.

- Since `$parent` is non-enumerable:

  - Promotion does not create `$parent` as a data key.
  - Only `total` inside the parent’s data changes.

This is an advanced pattern for updating parent data from a nested component via `*let`.


### 3. Comparison with *global

`*let` and `*global` both execute arbitrary JavaScript, but they target different kinds of side effects.

- `*let` (this document):

  - Writes into a local scope first.
  - After execution, new names are copied into host data if they did not exist.
  - Existing host data fields are not overwritten by top-level assignments.
  - Nested assignments can mutate existing objects through shared references.
  - It always schedules a re-render after execution.

- `*global`:

  - Uses a different sandbox.
  - For simple assignments:

    - If a name exists in host data, write into host data.
    - Otherwise, write into `globalThis`.

  - For nested assignments, it uses a scoped resolver that prefers host data when possible.
  - It is intended for explicit, “I know I am changing global or host state” updates.

Rule of thumb:

- Use `*let` for local derived values and light transformations, with occasional controlled promotion of new helper names into data.
- Use `*global` (or external code) when you truly want to update host data fields as part of application logic.


### 4. Cheat sheet

- New simple variable (`x = expr`) where `x` does not exist in data:

  - `*let` creates `x` in the local scope.
  - After promotion, host data gains a new field `x`.

- Reassign existing variable (`x = expr`) where `x` already exists in data:

  - `*let` updates `x` only in the local scope.
  - Host data keeps the original `x`.

- New nested path (`user.name = 'Ann'`) where `user` does not exist:

  - `*let` creates a nested object under `user` in the local scope.
  - Promotion adds `user` into host data.

- Nested update on existing object (`user.name = 'Bob'` where `user` exists):

  - The underlying object is mutated in place.
  - Host data reflects the new nested value everywhere.

- Unknown name with `+=`:

  - First render acts like a fresh counter and adds a new field.
  - Later renders only update the local `*let` scope; host data stays at the first value.

- Inside loops:

  - `*let` per iteration can create helper variables for that iteration.
  - New helper names can be promoted to host data; loop variables may leak into data but are not kept in sync.

- With `$parent`:

  - `*let` can mutate ancestor data through shared references.
  - `$parent` itself is not promoted into host data.

Understanding these patterns makes it much easier to predict when `*let` is local, when it behaves like a helper for derived values, and when it effectively mutates your data structures in a global way.
