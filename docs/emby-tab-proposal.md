# Proposal: Plugin-registered home tabs for Emby Web

**Goal:** let server plugins register a tab in the Web app's home screen
(next to *Home* / *Favorites*), rendered from content the plugin serves.

This document is written to be handed directly to the Emby team (forums:
*Emby → Feature Requests*) as a concrete, low-risk proposal with a working
reference implementation.

---

## 1. Problem

Emby Server has a solid plugin model (`IHasWebPages` / `PluginPageInfo`) for the
**Dashboard**, but zero extensibility in the **user-facing** web UI. The home
screen tab bar is hardcoded in the shipped web bundle.

Evidence from `4.10.0.25`, file `dashboard-ui/home/home.js`:

```js
HomeView.prototype.getTabs = function () {
    return [
        { name: Globalize.translate("Home"),      id: "home" },
        { name: Globalize.translate("Favorites"), id: "favorites" }
    ];
};
HomeView.prototype.loadTabController = function (id) {
    switch (id) {
        case "home":      return Emby.importModule("./home/hometab.js");
        case "favorites": return Emby.importModule("./home/favorites.js");
        default: throw new Error("tab not found: " + id);
    }
};
```

Consequence: integrations that users clearly want inside the main UI — media
request apps (Seerr/Overseerr), calendars, dashboards — must live at separate
URLs or be installed by hand-editing web files, which every server update wipes.

## 2. Current workaround (and why it's not good enough)

We ship a community patch (`install-webmod.sh` in this repo) that string-patches
`home/home.js` after install and drops in an iframe tab module. It works, but:

- lost on every Emby update (must re-run),
- version-fragile (minified anchors can change),
- unsupported by definition.

A first-class API removes all three problems.

## 3. Proposed API (small surface, additive only)

### Server side

Extend `PluginPageInfo` (or add an optional `IHasHomeTabs` interface) with:

```csharp
public class PluginPageInfo {
    // existing...
    public bool   AsHomeTab   { get; set; }   // register as a home tab
    public string TabIcon     { get; set; }   // material icon name, optional
    public int    SortOrder   { get; set; }   // position after built-in tabs
}
```

Expose them via a new read-only endpoint, e.g.
`GET /emby/web/hometabs` → `[{ id, title, icon, url, sortOrder }]`,
filtered by the requesting user's policy (same rules as plugin pages today).

### Client side (two tiny changes in `home.js`)

1. `getTabs()`: append the server-provided list after the built-in tabs.
2. `loadTabController()`: replace the `default: throw` with a **generic iframe
   tab controller** (~30 lines) that hosts `url` for any non-builtin id.

A proven generic controller already exists in this repo:
[`webmod/home/seerrtab.js`](../webmod/home/seerrtab.js) — creates an iframe,
lazily sets `src` on resume, cleans up on destroy.

## 4. Why this is low-risk for Emby

- **Additive:** with no plugin registering tabs, behavior is byte-for-byte
  identical to today.
- **No new security model:** tabs come from server plugins, which are already
  admin-installed code; iframes point at same-origin plugin endpoints already
  protected by the normal auth pipeline.
- **Tiny client footprint:** one merge point + one fallback controller; no
  changes to routing, state, or existing tabs.
- **Official apps unaffected:** Android/iOS/TV apps simply ignore it, as they do
  other web-only features.

## 5. What we bring

- Working reference implementation against 4.10.0.25 (patched `home.js` +
  iframe tab module) — can be adapted into the official bundle as-is.
- A real-world consumer plugin ([Emby.Plugin.Seerr](https://github.com/ALeXXBody/emby-plugin-seerr))
  whose UX improves immediately once native support lands (the patch gets deleted).
- Happy to test pre-release builds and iterate on the API shape.

## 6. The ask

Accept a small enhancement: plugin pages can opt into being home tabs, and the
web home screen renders unknown tab ids through a generic iframe controller.

Suggested tracking label: `web`, `plugins`, `enhancement`.
