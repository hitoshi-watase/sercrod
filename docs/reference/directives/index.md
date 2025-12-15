# Sercrod directives

This page is the entry point for the Sercrod directive reference.

## Basic directives

- [`*let`](let.md) - define local variables available to expressions inside this element.
- [`*print`](print.md) - print the result of an expression into the element as plain text.
- [`*input`](input.md) - bind a form control value to a data path.
- [`*if`](if.md) - conditionally render this element when the expression is truthy.
- [`*else`](else.md) - fallback branch for a `*if` / `*elseif` group when no condition matched.
- [`*for`](for.md) - repeat this element for each item in a list.
- [`*save`](save.md) - save host data or a staged view through a configured storage mechanism.
- [`*load`](load.md) - load data from storage into host data.
- [`*rem`](rem.md) - remove this element from the rendered output. Use as a Sercrod-only comment.

See also:
- [Data and `*let`](__data.md) - detailed notes about data and `*let`.

## Extended directives

- [`*compose`](compose.md) - compose this element from another template, partial, or host.
- [`*each`](each.md) - repeat this element for each entry in a map (value, key).
- [`*stage`](stage.md) - work with a staged copy of host data for editing before applying.
- [`*apply`](apply.md) - apply staged changes from the stage back to the host data.
- [`*restore`](restore.md) - discard staged changes and restore host data from the last stable state.
- [`*upload`](upload.md) - upload selected files or data to a server endpoint.
- [`*download`](download.md) - trigger a download of data from a server endpoint.

### Debugging

- [`*log`](log.md) - evaluate an expression and log its value, expression, and host snippet.

## All directives

### Control flow

- [`*if`](if.md) - conditionally render this element when the expression is truthy.
- [`*elseif`](elseif.md) - else-if branch paired with a preceding `*if` or `*elseif`.
- [`*else`](else.md) - fallback branch for a `*if` / `*elseif` group when no condition matched.
- [`*for`](for.md) - repeat this element for each item in a list.
- [`*each`](each.md) - repeat this element for each entry in a map (value, key).
- [`*switch`](switch.md) - select one branch from `*case` / `*default` based on an expression.
- [`*case`](case.md) - render this branch when the `*switch` expression equals the case value.
- [`*case.break`](case-break.md) - like `*case`, and stop evaluating later `*case` branches.
- [`*break`](break.md) - stop processing the current `*for` / `*each` loop when the expression is truthy.
- [`*default`](default.md) - fallback branch for `*switch` when no `*case` matched.

### Scope and literals

- [`*let`](let.md) - define local variables available to expressions inside this element.
- [`*global`](global.md) - write variables into the global Sercrod data scope.
- [`*literal`](literal.md) - treat the inner content as a literal string, without Sercrod expansion.
- [`*rem`](rem.md) - remove this element from the rendered output. Use as a Sercrod-only comment.

### Form input

- [`*input`](input.md) - bind a form control value to a data path.
- [`*lazy`](lazy.md) - update bound data on a later event instead of every input.
- [`*eager`](eager.md) - update bound data eagerly, typically on each input event.

### Staging and persistence

- [`*stage`](stage.md) - work with a staged copy of host data for editing before applying.
- [`*apply`](apply.md) - apply staged changes from the stage back to the host data.
- [`*restore`](restore.md) - discard staged changes and restore host data from the last stable state.
- [`*save`](save.md) - save host data or a staged view through a configured storage mechanism.
- [`*load`](load.md) - load data from storage into host data.

### HTTP and API

- [`*post`](post.md) - send host data as JSON via POST and write the JSON response back into host data.
- [`*fetch`](fetch.md) - fetch JSON from a URL and merge or replace it into host data.
- [`*api`](api.md) - configure an API base URL or options for nested `*fetch` / `*post` directives.
- [`*into`](into.md) - direct the result of the previous directive into a specific data path.

### Rendering output and composition

- [`*print`](print.md) - print the result of an expression into the element as plain text.
- [`*compose`](compose.md) - compose this element from another template, partial, or host.
- [`*textContent`](textContent.md) - set the DOM `textContent` property from an expression.
- [`*innerHTML`](innerHTML.md) - set the DOM `innerHTML` property from an expression.
- [`*unwrap`](unwrap.md) - see the dedicated page.

### WebSocket

- [`*websocket`](websocket.md) - open and manage a WebSocket connection for this host.
- [`*ws-send`](ws-send.md) - send a message through the active WebSocket connection.
- [`*ws-to`](ws-to.md) - set the logical target for outgoing WebSocket messages on this host.

### Upload and download

- [`*upload`](upload.md) - upload selected files or data to a server endpoint.
- [`*download`](download.md) - trigger a download of data from a server endpoint.

### Event helpers

- [`*prevent-default`](prevent-default.md) - call `event.preventDefault()` for the current event.
- [`*prevent`](prevent.md) - short form of `*prevent-default` for the current event.

### Lifecycle

- [`*updated`](updated.md) - call a handler after this host has been updated.
- [`*updated-propagate`](updated-propagate.md) - like `*updated`, and propagate the update event to parents.

### Debugging

- [`*log`](log.md) - evaluate an expression and log its value, expression, and host snippet.

### Methods

- [`*methods`](methods.md) - define methods that can be called from expressions in this host.

### Templates

- [`*template`](template.md) - mark this subtree as a reusable template.
- [`*include`](include.md) - include and render a template or partial into this place.
- [`*import`](import.md) - import a template or partial from another file or module.

## Attribute bindings

- [`:action`](attribute-action.md) - attribute binding for `action`.
- [`:class`](attribute-class.md) - attribute binding for `class`.
- [`:formaction`](attribute-formaction.md) - attribute binding for `formaction`.
- [`:href`](attribute-href.md) - attribute binding for `href`.
- [`:src`](attribute-src.md) - attribute binding for `src`.
- [`:style`](attribute-style.md) - attribute binding for `style`.
- [`:value`](attribute-value.md) - attribute binding for `value`.
- [`:xlink:href`](attribute-xlink-href.md) - attribute binding for `xlink:href`.

Fallback:
- [Attribute bindings (fallback for `:name`)](attributes.md)

## Event bindings

- [`@blur`](event-blur.md) - event binding for `blur`.
- [`@change`](event-change.md) - event binding for `change`.
- [`@click`](event-click.md) - event binding for `click`.
- [`@focus`](event-focus.md) - event binding for `focus`.
- [`@input`](event-input.md) - event binding for `input`.
- [`@keydown`](event-keydown.md) - event binding for `keydown`.
- [`@keyup`](event-keyup.md) - event binding for `keyup`.
- [`@submit`](event-submit.md) - event binding for `submit`.

Fallback:
- [Event bindings (fallback for `@name`)](events.md)
