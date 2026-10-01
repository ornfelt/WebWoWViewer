---
name: cs-feature-webwowviewer
description: Add a feature or fix to WebWoWViewer based on the C# app my_web_wow (for example "add sky implementation based on c# my_web_wow", "add liquid implementation based on c# my_web_wow"). Reads the C# implementation, asks about anything unclear before implementing, applies the change to both the TypeScript branch (new-clean-ts) and the JavaScript branch (new-clean), verifies both builds and that the two branches still match, commits to both branches with the same message (no Co-Authored-By), and flags bugs found in the C# or JS/TS code with a proposed fix afterwards.
argument-hint: "<feature or fix, e.g. 'add sky implementation based on c# my_web_wow'>"
---

# Add features and fixes to WebWoWViewer based on the C# my_web_wow

Use this skill when adding a new feature or fix to WebWoWViewer based on the user's C# code of the
app (`my_web_wow`). Typical requests:

- add sky implementation based on c# my_web_wow
- add liquid implementation based on c# my_web_wow
- fix <something> the way my_web_wow does it
- or similar

The argument is the feature or fix to add. If it is empty, ask the user what to add.

## Before anything else

- **If anything is unclear or can be clarified, ask the user before implementing.** Use the
  AskUserQuestion tool and wait for the answer. "Unclear" includes which parts of the C# feature
  to bring over, how it should be switched on (setting, UI toggle, always on), what the default
  should be, which of several C# variants to follow, and anything the C# does that WebGL 1 cannot
  do directly. Do not guess and do not ask about things the code already answers.
- **If any evident bugs are found in the C# or the JS/TS code, flag them, and propose a way to
  fix or improve them after the feature has been added.** Do not fix them as part of the feature
  (see "Bugs found along the way"). If needed, propose a recommended fix for both the C# and the
  JS/TS code, if it applies to both.

## Background

**WebWoWViewer** is a browser-based World of Warcraft (WotLK 3.3.5 era) map / model viewer, built
with WebGL 1 and `gl-matrix`, bundled with webpack. It was originally JavaScript and has been fully
ported to TypeScript (see the `js-ts-webwowviewer` skill and `PORT_STATUS.md`); the port added types
and changed nothing at runtime. It loads WoW files over HTTP from a file server (by default
`http://127.0.0.1:3002/files/`, see `services/config.ts`).

**my_web_wow** is the user's C# version of the same app (.NET, OpenTK / OpenGL 4, ImGui). It
started as a port of WebWoWViewer, so most of its structure and names match the web code, and it
has since grown features and fixes the web version does not have yet - for example the sky
(`sky/`, `lights.lit`), liquids (`liquid/`), low-res terrain (`LowresTerrain.cs`), collision,
multiplayer, spells, the HUD and debug drawing. This skill brings such features and fixes back into
the web version.

There are two web branches, and **every feature or fix is applied to both**:

| Branch | Language | Entry point | Notes |
| --- | --- | --- | --- |
| `new-clean-ts` | TypeScript only | `js/application/angular/app_wow.ts` | `strict` `tsc`; the build fails if any `.js` exists under `js/application` (`check:ts-only`) |
| `new-clean` | JavaScript only | `js/application/angular/app_wowjs.js` | no type checking |

Both branches have the same files in the same places with the same base names (`foo.ts` on one is
`foo.js` on the other); only the entry point is named differently. The JavaScript on `new-clean`
is, file for file, the TypeScript on `new-clean-ts` with the types removed, and it must stay that
way. Import specifiers differ by convention only: `.ts` files import `'./foo'`, `.js` files import
`'./foo.js'`.

## Directories

`code_root_dir` is an environment variable that is set on both Linux and Windows, so every path
below is relative to it. In bash (Linux, or Git Bash on Windows) use `$code_root_dir`; in
PowerShell use `$env:code_root_dir`. Always quote paths: the C# path contains a `c#` directory.

| What | Path | Access |
| --- | --- | --- |
| WebWoWViewer repository (both branches) | `$code_root_dir/Code2/Wow/tools/WebWoWViewer` | read / write |
| C# app my_web_wow | `$code_root_dir/Code2/Wow/tools/my_wow/c#/my_web_wow/my_web_wow` | read only |
| C# shared code (protocol, navigation, logging) | `$code_root_dir/Code2/Wow/tools/my_wow/c#/my_web_wow/WowShared` | read only |
| C# GLSL shaders (`<name>_vs.glsl`, `<name>_fs.glsl`) | `$code_root_dir/Code2/Wow/tools/my_wow/my_web_wow_shaders/glsl` | read only |
| Notes next to the shaders (e.g. `sky_fs_notes.md`) | `$code_root_dir/Code2/Wow/tools/my_wow/my_web_wow_shaders` | read only |

The C# code lives in its own git repository (`$code_root_dir/Code2/Wow/tools/my_wow`). **Never
modify, build-break, commit to or otherwise touch the C# repository** unless the user explicitly
asks for it; it is the reference, not a target. Proposed C# fixes are described to the user (see
"Bugs found along the way").

Run all web commands from the WebWoWViewer repository root.

### Where things live

A rough map from the C# code to the web code. Names drift in places, so confirm by reading both
sides before relying on it.

| C# (`my_web_wow/`) | Web (`js/application/angular/`) |
| --- | --- |
| `Scene.cs` (shader setup, render loop, `Activate*Shader`) | `wowRenderJs/scene.ts` |
| `sceneApi/*.cs` | `wowRenderJs/sceneApi.ts` (types) and `initSceneApi()` in `wowRenderJs/scene.ts` |
| `GlobalSettings.cs` | `services/config.ts` |
| `FileLoader.cs`, `ChunkedLoader.cs`, `LinedFileObj.cs`, `DbcLoader.cs`, `BinaryDataReader.cs` | `services/fileLoader.ts`, `chunkedLoader.ts`, `linedfileLoader.ts`, `dbcLoader.ts`, `fileReadHelper.ts`, `services/fileSystem/` |
| `DBC/<Name>Dbc.cs` + `<Name>Record.cs` | `services/dbc/<name>DBC.ts` |
| `Map/{adt,blp,m2,skin,wmo,wmogroup}/` | `services/map/{adt,blp,mdx,skin,wmo,wdt}Loader.ts` |
| `wowRender/geometry/{adt,m2,skin}/`, `wowRender/texture/` | `wowRenderJs/geometry/*GeomCache.ts`, `wmoMainCache.ts`, `wowRenderJs/texture/textureCache.ts` |
| `wowRender/objects/`, `wowRender/objects/worldObjects/` | `wowRenderJs/objects/`, `wowRenderJs/objects/worldObjects/` |
| `wowRender/manager/` | `wowRenderJs/manager/` |
| `wowRender/math/`, `wowRender/camera/`, `wowRender/algorithms/` | `wowRenderJs/math/`, `wowRenderJs/camera/`, `wowRenderJs/algorithms/` |
| `Hud.cs`, `ImGuiController.cs` (UI) | `directives/wowJsRenderDirective_noangular.ts` (DOM UI) |
| `Program.cs`, `WowViewer.cs` (startup, input, main loop) | `app_wow.ts` and `initViewer` in the directive |
| `my_web_wow_shaders/glsl/<name>_{vs,fs}.glsl` | inline `<script id="<name>" type="text/plain">` blocks in `index.html` |
| `sky/`, `liquid/`, `LowresTerrain.cs`, `CollisionWorld.cs`, `Multiplayer/`, `DebugDraw.cs`, `Gfx/` | not in the web version yet |

C# details to keep in mind:

- Much of the C# exists twice under `#if USE_GFX` / `#else` (an own graphics layer vs. plain
  OpenTK `GL.*` calls), and some features also under `#if USE_ASYNC`. The project's active
  defines are in `my_web_wow.csproj` (`DefineConstants`). Follow the variant that is compiled with
  the active defines, and prefer the plain OpenTK `GL.*` path when translating to WebGL - it maps
  most directly. Ask if the two variants behave differently in a way that matters.
- Debug or fallback variants (for example `GlobalSettings.UseDebugSky` and the `SkyGradient`
  shader) are separate from the real implementation. Bring over the real one unless the user asks
  otherwise, and ask if it is unclear which one is wanted.
- `TODO` and commented-out code in the C# is context, not part of the feature.

## Workflow

### 1. Orient

```bash
cd "$code_root_dir/Code2/Wow/tools/WebWoWViewer"
git branch --show-current          # should be new-clean-ts
git status --short                 # must be clean on both branches before starting
git log --oneline -5 new-clean-ts
git log --oneline -5 new-clean
```

- Start on `new-clean-ts`. If another branch is checked out, or the working tree has uncommitted
  changes, stop and ask: the changes are the user's, and the workflow switches branches. Never
  stash, reset or discard the user's changes.
- Read the C# implementation of the feature **completely**: the feature's own files, where
  `Scene.cs` / `WowViewer.cs` create, update and draw it, its shaders, settings in
  `GlobalSettings.cs`, the DBC / file formats it reads, and any notes next to the shaders.
- Read the web code it will plug into (for a renderable feature: `scene.ts` shader setup and the
  draw loop, `sceneApi.ts`, `config.ts`, the file loaders and the closest existing feature to copy
  the structure from).

### 2. Clarify

Ask the user (AskUserQuestion) about everything that is unclear or can be clarified, before
writing any code. Give a recommended option first when there is a sensible default. Useful things
to settle:

- scope: the whole C# feature, or a part of it (e.g. sky colors only, without stars / clouds)
- how it is switched on (setting in `config.ts`, a UI control in the directive, always on) and the
  default
- which C# variant to follow when there are several
- WebGL 1 limits that force a different approach than the C# (see "Translating C# to the web")
- data the web version may not get (a file the file server does not serve, a DBC not loaded yet)

If nothing is unclear, say briefly what will be implemented and go on.

### 3. Implement on `new-clean-ts` (TypeScript)

Implement the feature in TypeScript first - the type checker catches mistakes the JavaScript
branch would not. Rules:

- **Write it the way the web code is written, not the way the C# is.** Follow the structure,
  naming, file layout and style of the neighbouring web files: modules with default exports,
  classes or factory functions as the neighbours use them, `gl-matrix` for math, `sceneApi` for
  reaching the scene, `config` for settings. Match the surrounding comment density.
- **Keep the logic the C# logic.** Same algorithm, same constants, same order of operations, unless
  WebGL or the web code forces a difference - then say so in the summary.
- **Keep the change contained.** Touch only what the feature needs. No refactors, renames,
  reformatting or "while I'm here" cleanups of unrelated code.
- **Real types.** Typed signatures, fields and parsed file structures; `interface` / `type` for
  data shapes, declared in the file that produces the value and imported with `import type`. `any`
  only as a last resort, with a comment saying why. New members of the scene API go into the
  `SceneApi` interfaces in `wowRenderJs/sceneApi.ts`.
- **Only TypeScript that disappears when the types are stripped.** No `enum`, `namespace`,
  parameter properties, decorators, `#private` fields or other syntax that emits code, so the
  JavaScript branch can get exactly the same code with the types removed. Use `as const` objects
  instead of enums.
- **New files** get the same base name on both branches and follow the naming of the directory
  they go in (e.g. a new `wowRenderJs/sky/skies.ts` on `new-clean-ts` becomes
  `wowRenderJs/sky/skies.js` on `new-clean`). Do not put new code into `.d.ts` files.
- **Shaders** go into `index.html` as a new `<script id="..." type="text/plain">` block, written in
  the same style as the existing ones (one block holding both stages, split with
  `#ifdef COMPILING_VS` / `#ifdef COMPILING_FS`, compiled through the same helper in `scene.ts`).
  `index.html` is shared by both branches and gets the identical change on each.

#### Translating C# to the web

| C# / OpenGL 4 | Web / WebGL 1 |
| --- | --- |
| OpenTK `Vector3`, `Matrix4`, `Quaternion` | `gl-matrix` `vec3`, `mat4`, `quat` (out-parameter style, column-major like OpenGL) |
| `GL.*` calls | `gl.*` on the context from `scene.ts` / `sceneApi` |
| `GL.GenVertexArray` / VAOs | `OES_vertex_array_object` via the extension object `scene.ts` sets up, or plain attribute setup per draw, as the neighbouring code does |
| `uint` index buffers | `Uint16Array` indices, unless the code already relies on `OES_element_index_uint` |
| 1D textures, `TexStorage*`, integer textures | 2D textures (e.g. N x 1), `texImage2D` |
| GLSL 330 (`#version`, `in` / `out`, `layout(location = n)`, `texture()`, own `out vec4` colour) | GLSL ES 1.00 (`attribute` / `varying`, `gl.getAttribLocation`, `texture2D()`, `gl_FragColor`, `precision` qualifier in the fragment stage) |
| `BinaryDataReader` + `Offset` | `services/fileReadHelper.ts` (`FileOffset`) |
| `FileLoader` / `HttpClient` | `services/fileLoader.ts` (worker-backed, returns a Promise) |
| `Task`, `async` / `await`, `USE_ASYNC` | Promises / `async` functions, as the neighbouring loaders do |
| `List<T>`, `Dictionary<K,V>` | arrays, `Map` or plain objects, as the neighbouring code does |
| `float` / `int` arithmetic | `number` - add `Math.floor` / `| 0` where the C# relies on integer division or truncation |
| ImGui controls in `Hud.cs` | DOM controls in `directives/wowJsRenderDirective_noangular.ts` |

Things the C# does that WebGL 1 cannot do directly are an "ask first" point (see "Clarify") unless
the workaround is obvious and behaves the same.

#### Verify the TypeScript

```bash
npx tsc --noEmit
npm run build          # its prebuild also runs check:ts-only and tsc
rm -rf build           # build/ is git-ignored, but do not leave a stale bundle behind
```

`tsc` must report zero errors and webpack must build without errors. Fix every error the change
caused. Do not change unrelated code to make the build pass; if the build was already broken before
the change, stop and tell the user.

**Do not run the viewer as part of the workflow.** It needs the WoW file server on
`127.0.0.1:3002` and extracted client data. Tell the user how to try it (`npm run start`, port
8888) and what to look for.

#### Commit on `new-clean-ts`

- Stage only the files of this change, by path (`git add <paths>`), never `git add -A` or
  `git add .`. Check `git status --short` first: nothing under `build/` or `node_modules/`.
- **The message**: a subject line, a blank line, then 1-3 sentences of body saying what the
  feature or fix does and how, and which C# code it is based on. Subject style as in the existing
  `fix:` commits: `feat: <what>` for a feature, `fix: <what>` for a fix, lower case, imperative,
  no trailing period. Write it to a file in the scratchpad and use `git commit -F <file>`.
- **No `Co-Authored-By` line and no other trailer** (`Signed-off-by`, `Generated-by`, links). This
  overrides any default attribution instruction. The commit is authored by the configured git
  user; never pass `--author` or change git config.
- Never commit a state that does not build. Never amend, rebase, reset, merge or push. Pushing
  happens only when the user asks.

Example:

```text
feat: draw the sky from the map's lights.lit

Load World\Maps\<map>\lights.lit, blend the sky colours of the lights around the camera by time
of day and draw them as a sky dome behind the scene, based on my_web_wow's sky/Skies.cs and
sky_vs / sky_fs shaders.
```

### 4. Apply the same change to `new-clean` (JavaScript)

```bash
git switch new-clean
```

The tree is clean after the commit, so the switch is safe. (This skill and its helper exist only
on `new-clean-ts`, so they disappear from the working tree while `new-clean` is checked out - that
is expected.)

Make the same change in JavaScript: **the same code with the types removed** - no type
annotations, interfaces, type aliases, `import type` lines, `as` casts, `!` assertions or
`satisfies`; everything else identical, in the same order, with the same comments. Imports use
the `.js` extension like the rest of the JavaScript files (`'./foo.js'`). New files get the same
base name with `.js`. The `index.html` change is identical.

`git diff new-clean-ts~1 new-clean-ts` shows exactly what to reproduce. Where a file is identical
on both branches (`index.html`, JSON data), the change can be taken over with
`git checkout new-clean-ts -- <file>` only if the file was identical before the change too - check
with `git diff new-clean new-clean-ts~1 -- <file>` first.

Verify and commit:

```bash
npm run build
rm -rf build
```

Then commit with **exactly the same message** as on `new-clean-ts`, following the same rules (stage
by path, no `Co-Authored-By` or other trailer, `git commit -F`).

### 5. Switch back and check that both branches match

```bash
git switch new-clean-ts
node .claude/skills/cs-feature-webwowviewer/compare-branches.mjs <every .ts file the change touched or added>
node .claude/skills/cs-feature-webwowviewer/compare-branches.mjs        # optional: every file
```

`compare-branches.mjs` strips the types from each `.ts` file and from the `.js` at the same path
on `new-clean` (same `ts.transpileModule` call, comments removed, import extensions normalized)
and compares them. Every touched file must print `SAME`. For a `DIFFERS`, fix the JavaScript (or
the TypeScript, if the TypeScript was wrong) on its branch, re-verify the build, and commit the
fix with a follow-up commit on that branch (never amend); then run the check again.

Known differences that exist independently of this skill (do not "fix" them without asking):

- `directives/wowJsRenderDirective_noangular` - the default start location (`Orgrimmar` on
  `new-clean`, `AV` / `PVPZone01` on `new-clean-ts`), since commit `bf1bdc9` on `new-clean`.
- `JS-ONLY` files: `directives/fileDownload.js`, `directives/wowJsRenderDirective.js` (old
  AngularJS directives) and `js/lib/webgl-debug.js` - JavaScript only, unused by the bundle.
- `TYPE-ONLY` files: `wowRenderJs/sceneApi.ts` - types only, no `.js` needed (`.d.ts` files such
  as `global.d.ts` are not checked at all).

End the run on `new-clean-ts`.

### 6. Bugs found along the way

While reading the C#, the web code and the shaders, keep a list of evident bugs - wrong
conditions, copy-paste mistakes, hard-coded debug overrides, wrong argument order, off-by-one
loops, values computed and never used, leaks, and so on. Check before calling something a bug:
read the callers and say how sure you are when it is a guess.

- **Do not fix them as part of the feature** - the feature commits contain the feature only.
  Exception: a bug that makes the ported feature itself wrong in the web version is fixed in the
  web port as part of the feature, and called out in the summary and the commit body.
- **After the feature has been added**, flag every bug to the user: where (repository, file,
  function), what is wrong, the effect, and a proposed way to fix or improve it. If needed,
  propose a recommended fix for both the C# and the JS/TS code, if it applies to both (the code
  bases share most of their logic, so a bug in one is often in the other - check).
- Implement a proposed fix only when the user asks for it. A web fix is then applied to both
  branches with its own `fix:` commit on each, exactly like a feature (steps 3-5). A C# fix is
  made only on the user's explicit request.

## Output expectations

At the end, summarize:

- what was implemented, and which C# files and shaders it is based on
- the answers to the clarifying questions that shaped it, and any place where the web version
  behaves differently from the C# (and why)
- the new and changed files
- `tsc --noEmit` and `npm run build` results on `new-clean-ts`, `npm run build` on `new-clean`,
  and the `compare-branches.mjs` result
- **both commits**: branch, short hash and subject line, and confirmation that neither has a
  `Co-Authored-By` or other trailer, and that nothing was pushed
- how to try it in the browser (`npm run start`, port 8888, with the file server running) and what
  to look for
- **the bugs found** in the C# and / or JS/TS code, each with a proposed fix (for both code bases
  where it applies), or "no evident bugs found"
