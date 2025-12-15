# Configuration

_What you will find:_ all configuration surfaces recognized by this implementation of Sercrod v1.0.0. This is a normative list of flags, ambient preload points, registries, and limits. No tutorials or design commentary are included.

## 1) Global switches

### `window.SERCROD_NO_AUTO_DEFINE: boolean`
- **Effect**: when truthy, the runtime does not auto-register the default tag. Users must call `customElements.define("serc-rod", Sercrod)` themselves.
- **Default**: `false` (auto-definition enabled).

### Default custom element tag
- **Value**: `"serc-rod"`
- **Registration**: auto-defined unless `SERCROD_NO_AUTO_DEFINE` is truthy.

## 2) Ambient preload points

These objects or arrays are read during class initialization. Presence is optional. Shapes are fixed.

### `window.__Sercrod_filter: { [name: string]: function }`
- **Purpose**: pre-register built-in filter overrides.
- **Lifecycle**: merged once at class load.
- **Mutability**: runtime replacement is not supported. Pre-registration only.
- **Valid keys**: `html`, `url`, `attr`, `input_out`, `input_in`, `style`, `text`, `placeholder`.

### `window.__Sercrod_methods: { [name: string]: function | object }`
- **Purpose**: expose global functions or objects whose function properties can be referenced by `*methods`.
- **Lifecycle**: read at class load to initialize the global methods map.
- **Mutability**: expressions can also resolve functions from `globalThis` directly at evaluation time. Adding functions to the ambient global scope is visible to `*methods`.

### `window.__Sercrod_ast_hooks: function[]`
- **Purpose**: pre-declare AST hooks that run after template parse and before render.
- **Lifecycle**: scanned at class load. See also the runtime API `Sercrod.register_ast_hook(fn)` for post-load registration.

### `window.__Sercrod_pre_hooks: function[]`
- **Purpose**: pre-declare pre-hooks for template input. Pre-hooks run on the parsed DOM before AST extraction.
- **Lifecycle**: scanned at class load. When any pre-hook is active, template caching is bypassed to honor mutations.

### `window.__Sercrod_strict: { [name: string]: function }`
- **Purpose**: registry for `*strict` callbacks.
- **Lifecycle**: referenced as a shared object. Late additions become visible without reloading.

## 3) Registries and lookup order

Lookup orders are fixed and deterministic.

### Methods in expressions (`*methods`, method availability)
1. Host-declared names via `*methods`
2. Global method sets known to the runtime (including entries sourced from `__Sercrod_methods`)
3. Ambient `globalThis` resolution

### `*strict` callback resolution
1. Host-local function registry if present
2. Constructor-level registry (`Sercrod.strictRegistry`)
3. Shared object `window.__Sercrod_strict`
4. Fallback to ambient `globalThis` by identifier
- **Arguments constraint**: `*strict` requires identifier arguments only. Property access is not accepted.

### Filters
- **Source**: built-in defaults merged with `window.__Sercrod_filter` at class load.
- **Runtime override**: not supported by design for safety.
- **Scope**: applies to all hosts created from this constructor.

### AST hooks
- **Preload**: from `window.__Sercrod_ast_hooks` at class load.
- **Runtime registration**: `Sercrod.register_ast_hook(fn)` appends to the hook chain for subsequent renders.

### Pre-hooks
- **Preload**: from `window.__Sercrod_pre_hooks` at class load.
- **Effect**: presence disables template string caching to ensure pre-mutated DOM is always re-extracted into AST.

## 4) Per-host controls

### Observed attributes
- **List**: `data`, `*updated`, `*methods`, `n-updated`, `n-methods`
- **Effect**: changes are specially parsed and schedule an update.

### `el.error: { fatal: boolean, warn: boolean, debug: boolean }`
- **Purpose**: logging and error reporting behavior for this host.
- **Defaults**: `{ fatal: true, warn: true, debug: true }`
- **Scope**: per host.

## 5) Limits and guards

These values are fixed in this version.

- **Update loop limit**: `100` iterations per cycle guard.
- **`*strict` callback body limit**: `2048` characters maximum for inline bodies where applicable.
- **Scheduler**: one render per animation frame per host. Re-entrancy is prevented within a pass.

## 6) Non-configurable behaviors

- **Transient cleanup**: `$upload`, `$download`, and all keys designated by `*into` are cleared on the next frame after the cycle that produced them.
- **Template model**: initial `innerHTML` is captured as the host template. AST caching is enabled unless pre-hooks are present.
- **Data wrapping**: data is Proxy-wrapped. Nested values are wrapped on demand.

## 7) Version scope

This page reflects Sercrod v1.0.0 as designated by the canonical source. Future versions may evolve registry mutability or add configuration keys. Any added keys will be documented here.

---
Back to index: [`README.md`](./README.md)
