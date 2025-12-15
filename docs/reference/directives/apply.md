### *apply / n-apply

#### Summary

*apply is the commit counterpart to *stage. On a staged host it copies the current staged data back into the host data object and triggers a redraw, so that edited values become the new committed state. The alias n-apply behaves identically. :contentReference[oaicite:0]{index=0}


#### Description

When a Sercrod host uses *stage, the runtime keeps a separate buffer object called the stage for rendering and user edits, while the original data object remains the committed source of truth. During update, the visible scope for the host is taken from the stage buffer when it exists, and falls back to the data object when it does not. 

*apply is a simple event-style directive that finalises a staged edit session. When the element is clicked, the contents of the stage buffer are merged into the host data and the host is updated. Immediately after applying, Sercrod takes a deep snapshot of the committed data so that *restore can later rebuild the stage from that snapshot. :contentReference[oaicite:2]{index=2}

The attribute value of *apply or n-apply is not used. Presence of the attribute is all that matters; any value is ignored.


#### Basic example

A minimal save or cancel form with staging:

```html
<serc-rod data="{ profile: { name: 'Alice' } }" *stage>
  <label>
    Name:
    <input type="text" *input="profile.name">
  </label>

  <p>Preview (staged): %profile.name%</p>

  <button type="button" *apply>Save</button>
  <button type="button" *restore>Cancel</button>
</serc-rod>
```

In this pattern:

- The host has *stage, so user edits go into the staged buffer.
- Clicking the Save button commits the staged values into the host data.
- Clicking the Cancel button discards staged edits and reconstructs the stage from the last committed snapshot. 


#### Behavior

- Presence only  
  - *apply and n-apply are presence based. The attribute value, if any, is ignored by the runtime.

- Host selection  
  - The directive always talks to the nearest Sercrod host that owns the template being rendered. The click handler is bound with that host as the internal target, and it uses that host data and stage.

- Click handling  
  - On click, if the host has a non null stage buffer, the runtime performs a shallow merge from the stage to the host data at the top level using an assignment equivalent to Object.assign(data, stage). :contentReference[oaicite:4]{index=4}  
  - Nested objects are copied by reference at the top level, so changes to nested properties in the stage are reflected when the containing object is assigned back to the data.

- Redraw and snapshot  
  - After merging, the host update method is called to re render based on the new committed data or staged view.  
  - The committed data is then deep cloned into a private snapshot field used by *restore, using structured cloning where available and falling back to a JSON round trip. :contentReference[oaicite:5]{index=5}

- No stage, no effect  
  - If the host does not have a stage buffer, clicking a *apply or n-apply element does nothing. There is no error and no update is triggered.

- Children and other directives inside the element  
  - The renderer handles *apply as a control directive: it clones the original element, wires the click handler on the clone, appends that clone to the output, and returns without sending the element through the normal attribute and text processing pipeline. :contentReference[oaicite:6]{index=6}  
  - As a consequence, Sercrod specific features inside the same element are not processed:
    - No text expansion of percent expressions inside the button label.
    - No *print, *textContent, *compose, or other directives on the same element.
    - No @event attributes handled by Sercrod on that element; only the internal click handler is attached.
  - Plain HTML attributes, tag name, and static text in the element are preserved as in the template but stay static.

- Aliases  
  - n-apply is a direct alias of *apply. Both names go through the same runtime path and have identical behavior.


#### Evaluation timing

- Template render  
  - During rendering, Sercrod scans each node for control directives after structural directives such as *if, *switch, and *each have been processed. *apply is one of these control directives.   
  - If *apply or n-apply is found on the working node, the engine:
    - Clones the node.
    - Attaches the click listener to the clone.
    - Appends the clone to the output parent.
    - Returns without further processing for that node.

- User interaction  
  - The runtime does not evaluate any expression for *apply itself; the only evaluation occurs when the user clicks the element, and the operation is a direct object merge from stage into data followed by an update.

- Re rendering  
  - On each host update, the template is re rendered and new clones of the *apply elements are created with fresh handlers. Old DOM is discarded as part of the normal update flow.


#### Execution model

- Synchronous behavior  
  - The commit operation is fully synchronous: merging the staged object into the data, taking a snapshot, and calling update all happen in the same call stack of the click handler, before the event finishes bubbling.

- Interaction with other lifecycle features  
  - After update, normal lifecycle hooks run as usual, including logging hooks, *updated, and any data observation and change detection that operate on the host data.
  - If the host is running with observation enabled, the assignments produced by *apply go through the same proxy layer used for other writes and therefore produce the same change events.

- Error handling  
  - The *apply implementation does not wrap its assignments in explicit error handling. If the data object is writable, the operation should succeed under normal circumstances.


#### Variable creation

- *apply does not define any new variables or bindings in the template scope.
- It does not introduce special variables like a loop index or branch state.
- The only internal data it maintains is the host private snapshot used by *restore, which is not injected into expression scopes.


#### Scope layering

- Host data versus stage buffer  
  - Hosts with *stage or n-stage maintain:
    - A committed data object used as a durable source of truth and as the base for observation.
    - A stage buffer used for rendering and user edits.   
  - The visible scope during update is taken from the stage buffer when it exists, falling back to the data object otherwise.

- Impact of apply on scopes  
  - *apply copies properties from the stage buffer into the committed data object at the top level. After the merge:
    - New or changed top level properties and their nested contents are committed.
    - Top level keys present only in the data object and removed from the stage buffer are not automatically deleted.
  - Expressions that read from the host data (for example through reserved variables such as the root data of the host) observe the new committed values after the update triggered by *apply.

- External scopes  
  - *apply does not alter parent hosts or global scopes directly. Any effect on parent or root scopes is indirect, through the object graph shared by the data and how it was originally constructed.


#### Parent access

- Because *apply has no expression, it does not directly read or write parent or root variables.
- The only data it modifies is the host data object associated with the Sercrod element that owns the template.
- If the host data was constructed to inherit from a parent object through the prototype chain, parent level reads may see committed values after apply, but this is determined by how the data structure itself is set up rather than by the directive.


#### Use with conditionals and loops

- Inside *if and related branches  
  - *apply can be combined with *if, *elseif, and *else on the same element. Structural directives are processed first, and the chosen branch is cloned with the structural attributes removed. The cloned element still carries *apply and is processed as an apply button. 

- Inside *switch and *each  
  - It is safe to use *apply or n-apply inside elements that are part of a *switch block or that are repeated via *each or *for. Each cloned instance renders its own button, and all of them talk to the same host stage and data.

- Multiple control directives on one element  
  - The renderer handles control directives in a fixed order and returns as soon as it matches one of them. Because of this:
    - If you put *apply together with *restore, *save, *load, *post, *api, *upload, or *download on the same element, only the first directive that the runtime checks will be applied and the rest will be ignored. 
  - In practice, you should treat these as mutually exclusive on a single element and place them on separate elements instead.

- Children with directives  
  - Child elements inside a *apply element are not processed as Sercrod templates for this element, because the renderer returns after wiring the apply handler and does not recurse into children for this particular path.
  - If you need dynamic labels or additional Sercrod logic near a commit button, use separate sibling elements rather than nesting those features inside the same *apply button.


#### Best practices

- Always pair with *stage or n-stage  
  - Use *apply only in hosts that are configured with staging. Without a stage buffer the button is effectively inert.

- Use a dedicated element for committing  
  - Place *apply or n-apply on a dedicated element, typically a button with type set to button to avoid unintended form submission when used inside forms.

- Keep labels static inside the apply element  
  - Because Sercrod does not process directives or text expansions inside a *apply element, keep its contents static and move any dynamic information to nearby elements.

- Coordinate with *restore  
  - For a smooth editing experience:
    - Provide a *restore button to allow users to discard staged edits and rebuild the stage from the last committed snapshot.
    - Ensure that both buttons are clearly labelled and grouped together.

- Avoid stacking control directives  
  - Do not mix *apply with other control directives like *save, *load, *post, or *api on the same element. Use separate elements to keep behavior predictable.

- Drive external side effects from committed data  
  - For external side effects, such as sending a request or syncing with other widgets, read from the committed data after apply has run or trigger those effects from lifecycle hooks that see the committed state.


#### Examples

##### Dialog style form with staged editing and commit

```html
<serc-rod
  data="{
    profile: { name: 'Alice', email: 'alice@example.com' },
    editing: false
  }"
  *stage
>
  <button type="button" @click="editing = true">Edit profile</button>

  <div *if="editing">
    <label>
      Name:
      <input type="text" *input="profile.name">
    </label>

    <label>
      Email:
      <input type="email" *input="profile.email">
    </label>

    <button type="button" *apply>Save changes</button>
    <button type="button" *restore @click="editing = false">Cancel</button>
  </div>

  <h2>Current profile</h2>
  <p>Name: %profile.name%</p>
  <p>Email: %profile.email%</p>
</serc-rod>
```

Key points:

- Edits are made against the stage buffer while the dialog is open.
- Saving applies all staged changes to the committed data and triggers a redraw.
- Cancel uses *restore to rebuild the stage from the last committed snapshot and additionally clears the editing flag via a separate event handler on the cancel button.
- The apply button itself only commits; any additional state changes in the UI are handled by other directives and events on other elements.

##### Multiple apply buttons in different places

You can place several apply buttons in the same staged host to offer alternative commit affordances:

```html
<serc-rod data="{ title: 'Draft', body: '' }" *stage>
  <header>
    <input type="text" *input="title">
    <button type="button" *apply>Save</button>
  </header>

  <main>
    <textarea *input="body"></textarea>
  </main>

  <footer>
    <button type="button" *restore>Discard changes</button>
    <button type="button" *apply>Save and stay</button>
  </footer>
</serc-rod>
```

All apply buttons commit the same staged buffer into the host data when clicked. Users can choose whichever button is more convenient in the layout, but the semantics are identical.


#### Notes

- *apply and n-apply are purely host level commit controls; they do not evaluate expressions or accept configuration.
- The directive relies on the staging mechanism; without *stage or n-stage on the host, it has no effect.
- Because the contents of a *apply element are not processed by Sercrod, you must not rely on nested directives or percent expressions inside the same element. Use separate elements for dynamic information or attach additional behavior via standard DOM event listeners from user code.
- On a single element, only one of the action oriented control directives such as *apply, *restore, *save, *load, *post, *api, *upload, or *download will be honored; additional directives of this kind on the same element are ignored by design.
