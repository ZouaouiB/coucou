# T24 Integration & Custom Fork of Coucou

This repository is a customized fork of **Coucou** ([Louis-CFM/coucou](https://github.com/Louis-CFM/coucou)), created to extend Coucou with dedicated **T24 (Temenos Transact / Core Banking Toolkits)** capabilities while maintaining full compatibility with upstream updates.

---

## 1. Fork Architecture & Repository Setup

### Remotes Configuration

- **`origin`**: `https://github.com/ZouaouiB/coucou.git` (Personal fork on GitHub — all custom development and pushes go here).
- **`upstream`**: `https://github.com/Louis-CFM/coucou.git` (Official upstream Coucou repository — used exclusively for fetching new releases).
- **Push Protection**: The `upstream` push URL is locked to `no_push` (`git remote set-url --push upstream no_push`) to prevent any accidental push to Louis's repository.

### Active Working Branch

- **`t24-main`**: Dedicated branch for T24 features, UI polish, and custom enhancements.
- Keep the local `main` branch clean and aligned with `upstream/main` so that rebasing or merging upstream updates is seamless.

---

## 2. Upstream Synchronization Workflow

Whenever upstream Coucou publishes updates, new features, or bug fixes:

```bash
# 1. Fetch latest changes from the official Coucou repository
git fetch upstream

# 2. Ensure you are on your working branch
git checkout t24-main

# 3. Merge or rebase upstream updates into your branch
git merge upstream/main
# (or: git rebase upstream/main)

# 4. Push the synchronized updates to your fork
git push origin t24-main
```

### The Golden Rule of Fork Maintenance

To avoid merge conflicts when syncing with upstream:

- **Decouple custom code**: Keep all T24-specific features, modules, scripts, and connectors inside dedicated directories (like `t24/`).
- **Minimize core file modifications**: Whenever touching existing files (e.g. `windows/src/hub/shell.ts` or `NotchBuddy/Sources/CoucouKit/PillCatalog.swift`), make isolated, clean hook insertions rather than large structural rewrites.
- New files merge with zero conflicts!

---

## 3. Fork features and their hook points

Each feature lives in its own files; upstream files only carry the one-line hooks listed here. After `git merge upstream/main`, a conflict in one of these files means re-applying the listed line(s), nothing more.

### OmniRoute support (Windows / Linux)

OmniRoute (https://omniroute.online, `npm install -g omniroute`) as a chat provider in the island, and optionally the route for Coucou's own AI features (dictation clean-up, Notetaker summaries, « OK Coucou »). Settings → Notch → Chat → **OmniRoute**: turn it on, Coucou starts it, paste an API key made in its dashboard (API Manager), pick a model.

| New files | Role |
|---|---|
| `windows/src-tauri/src/omniroute.rs` | Config, bound API key, status, auto-start (`node omniroute.mjs serve --daemon`, no cmd/PowerShell), `/v1/messages` routing, commands, tests |
| `windows/src/core/omniroute.ts` | Types, commands, pure helpers (stage, model choice) |
| `windows/src/settings/omniroute.ts` | The Settings card |
| `windows/tests/omniroute.test.mjs` | Frontend tests |

| Upstream file | Hook |
|---|---|
| `src-tauri/src/lib.rs` | `mod omniroute;` · `omniroute::setup(&handle);` in `.setup` · the four `omniroute::omniroute_*` commands in `generate_handler!` |
| `src-tauri/src/settings.rs` | `pub omniroute: crate::omniroute::Config` + its default; `"omniroute"` in the test fixture and key list |
| `src-tauri/src/secrets.rs` | `"omniroute-api-key"` in `KNOWN_KEYS` |
| `src-tauri/src/local_chat.rs` | `crate::omniroute::PROVIDER => return Some(crate::omniroute::server(settings)),` in `server()` |
| `src-tauri/src/claude.rs` | first line of `complete()` and of `voice_turn()`: `if let Some(routed) = crate::omniroute::….await { return routed; }` |
| `src-tauri/src/flow/cleanup.rs`, `voice/mod.rs` | `\|\| crate::omniroute::serves_features()` next to the Anthropic key check |
| `src/core/state.ts` | `omniroute: OmniRouteConfig` + its default + type import |
| `src/core/providers.ts` | `"omniroute"` in `ProviderId`, its `PROVIDERS` entry, one `.filter(...)` in `visibleProviders` |
| `src/settings/main.ts` | import + `if (notchPage === "chat") root.append(omnirouteSection(...))` after the sections |
| `tests/providers.test.mjs` | `"omniroute"` in the expected provider ids |
| `src/i18n/extra.json` | 19 OmniRoute strings, inserted in sorted order (all 12 languages) |

Live test against the OmniRoute on this computer (uses the key saved in Coucou, never printed):
`cd windows/src-tauri && OMNIROUTE_TEST_MODEL=auto/best-coding cargo test --no-default-features --lib omniroute::tests::live -- --ignored --nocapture`

### Coucou window polish (scrollbars, page slide, opening motion)

`windows/src/t24/` (`hub-polish.css`, `pageTransition.ts`, `windowOpen.ts`) and `windows/src-tauri/src/t24_hub_motion.rs`. Hooks: `hub/shell.ts` (import + `swapPage(...)` at the end of `show()`), `lib.rs` (`mod t24_hub_motion;`, `t24_hub_motion::close/open` in the close handler and `show_hub`).

### Screen hop of the island

`windows/src/t24/screenHop.ts`. Hook: `main.ts` (import + the `screen-changed` handler wrapped in `hopScreens(...)`).

### Upstream candidates (bug fixes, not fork features)

Mochi cut off after a monitor change (canvas bitmaps not following the pixel ratio): `island/island.ts`, `desktop/main.ts`, `mochi/minibots.ts`, `views/wardrobe.ts`, and the self-re-arming ratio watcher in `main.ts`. Worth a PR to Louis-CFM/coucou so the fork stops carrying them.
