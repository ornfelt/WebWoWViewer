---
name: js-ts-webwowviewer
description: Port the WebWoWViewer JavaScript sources (js/application/angular) to TypeScript in place on the new-clean-ts branch, file by file, with the exact same logic and an identical runtime - the port adds types and nothing else. Repeatable - run it bare and it works out from the tree where the port stands, picks the next unported file(s), ports roughly 1000-3000 lines, verifies that the type-stripped output is identical to the original JavaScript, keeps the build green, records progress in PORT_STATUS.md and ends with one commit (no Co-Authored-By trailer). Also has setup, port <file>, review <file> and status modes.
disable-model-invocation: true
argument-hint: "[setup, continue, status, port <file-or-dir>, review <file-or-dir> - empty means continue where the port left off]"
---

# Port WebWoWViewer from JavaScript to TypeScript

The goal is a TypeScript WebWoWViewer: the same files, the same classes, the same functions, the
same data flow, the same WebGL calls in the same order, the same network requests, the same console
output - **the same runtime** - with every `.js` file under `js/application/angular` replaced by a
`.ts` file that is fully typed under `strict`.

**The port is done on the `new-clean-ts` branch, and only there** (see "Branch"). Every run ends
with one commit of its own work on that branch, with no `Co-Authored-By` or other trailer (see
"Commits").

The rule that decides everything below:

> **A port adds types. It never changes what runs.**

Strip the types from a ported `.ts` file and you must get back the original `.js`, statement for
statement. That is not just a principle; it is checked mechanically on every run by
`compare-emit.mjs` (see "Verification"). When typing a piece of code would require changing its
logic, the logic wins and the typing bends (an assertion, a wider type, a narrow `any` with a
comment) - never the other way round.

Two further goals, both ranking **below** "same runtime":

1. **Real types.** Every function signature, class field, module-level variable and parsed file
   structure gets a real type. `any` is a last resort and is always commented (see "Typing rules").
2. **TypeScript style.** Interfaces for data shapes, `import type` for type-only imports,
   `readonly` where nothing writes, `gl-matrix`'s own types for vectors and matrices. Style is
   never a reason to change behavior: no refactors, no modernization, no "while I'm here" cleanups.

When the goals pull in different directions: same runtime first, then real types, then style.

This skill ports **this repository in place**. It has nothing to do with the C++ -> C# / Rust
server ports (`cpp-csharp-*`, `cpp-rust-*`), the `wc_clean_new` ports or the `*-libwow` skills in
the `gfx` project; do not apply any of their rules here.

## Source and target

Repository root (the directory holding `package.json`, `webpack.config.js` and `index.html`):

`$code_root_dir/Code2/Wow/tools/WebWoWViewer`

Source and target are the same tree. Every `js/application/angular/**/<name>.js` becomes
`<name>.ts` in the **same directory, with the same base name**, and the `.js` file is removed with
`git mv` so history follows the file. The one rename is the entry point: `app_wowjs.js` becomes
`app_wow.ts` (the name the `new-clean-ts` branch already uses).

~16,000 lines of JavaScript in 66 files are in scope:

| Area | Files | Lines | What it is |
| --- | --- | --- | --- |
| `Expansion.js`, `services/config.js` | 2 | 152 | expansion constants, the global viewer settings module |
| `services/` (loaders) | 5 | 973 | file reading helpers, the worker-backed file loader, chunked / lined / DBC loaders |
| `services/fileSystem/` | 2 | 65 | the file-loading Web Worker and its axios stub |
| `services/dbc/` | 18 | 619 | one module per DBC file, each a cached record table |
| `services/map/` | 6 | 3,001 | WDT, ADT, BLP, skin, WMO and M2 (`mdxLoader`) format parsers |
| `wowRenderJs/geometry/`, `texture/`, `cache.js` | 7 | 1,754 | GPU-side caches built on the parsers |
| `wowRenderJs/math/` | 6 | 977 | `mathHelper`, portal culling, quick sort, texture regions, BSP |
| `wowRenderJs/camera/`, `algorithms/` | 2 | 239 | first-person camera, character texture components |
| `wowRenderJs/manager/` | 5 | 2,280 | animation, instancing, texture composition, scene graph, world objects |
| `wowRenderJs/objects/` | 10 | 3,362 | M2 / WMO / ADT scene objects and the world unit / player / game object |
| `wowRenderJs/scene.js` | 1 | 1,550 | WebGL setup, shaders, the render loop, the `sceneApi` hub |
| `directives/wowJsRenderDirective_noangular.js` | 1 | 666 | the DOM UI around the canvas, `initViewer` |
| `app_wowjs.js` | 1 | 360 | the webpack entry (only ~56 of its lines are live code) |

The biggest single files, each of which may take a run of its own: `services/map/mdxLoader.js`
1,705 lines, `wowRenderJs/scene.js` 1,550, `wowRenderJs/manager/animationManager.js` 1,053,
`wowRenderJs/objects/M2Object.js` 914, `wowRenderJs/objects/wmoObject.js` 845,
`wowRenderJs/objects/worldObjects/worldUnit.js` 836.

`code_root_dir` is an environment variable. The skill lives in this repository's
`.claude/skills/js-ts-webwowviewer/`, next to its helper script `compare-emit.mjs`. Run all commands
from the repository root.

### Branch

**The TypeScript port must be done on the `new-clean-ts` branch.** That branch carries the start of
the port (`tsconfig.json`, `ts-loader`, `Expansion.ts`, `app_wow.ts`) and this skill; the plain
JavaScript branch `new-clean` (and `master`) never receives port work.

Before writing anything, check `git branch --show-current`:

- `new-clean-ts` - go ahead.
- anything else - stop. Say which branch is checked out and that the port belongs on
  `new-clean-ts`, and do not write or commit anything. Do not switch branches yourself: the user
  may have uncommitted work on the current branch. Port on another branch only if the user then
  explicitly tells you to, for that run.

Runs commit to `new-clean-ts` (see "Commits"). They never push, pull, merge, rebase, amend or
reset, never switch branches, and never touch another branch.

### Commits

**Every run that changes files ends with exactly one commit** on `new-clean-ts`, made after
"Verification" has passed. That includes setup runs, continue and `port` runs, a run that ends
mid-file (the `TS-PORT: TODO` markers keep it resumable) and the final switch-over. Review runs
change nothing and commit nothing; a status run commits only if it had to fix `PORT_STATUS.md`.

- **Stage only this run's work**, by path: the `.ts` files, the `git mv` renames (already
  staged), `PORT_STATUS.md`, and in setup or the switch-over `tsconfig.json`,
  `webpack.config.js`, `package.json`, `package-lock.json`. Never `git add -A` or `git add .`.
  Check `git status --short` before committing: nothing under `build/` or `node_modules/`, and no
  file the run did not touch.
- **Uncommitted changes the run did not make** (the user's own work in progress) stay unstaged and
  untouched. If one of them is in a file the run needs to change, stop before editing that file
  and ask.
- **The message** is a subject line, a blank line, then 1-3 sentences of body: what was ported and
  how, including anything parked, left partially typed, or recorded under "Runtime notes". The
  subject starts with `ts port:`. Pass it with `git commit -F <file>` from the scratchpad (or a
  heredoc) so quoting cannot break it.
- **No `Co-Authored-By` line and no other trailer** (`Signed-off-by`, `Generated-by`, links) - this
  overrides any default attribution instruction from the harness. The commit is authored by the
  repository's configured git user, as-is; never pass `--author` or change git config.
- **Never commit a failing state.** If "Verification" does not pass and cannot be fixed within the
  run, do not commit: leave the work uncommitted, say exactly what fails, and stop. The next run
  finds it through `git status` (see "Orient").
- Do not use `--no-verify`, and do not amend or squash earlier runs' commits. One run, one new
  commit.

Example:

```text
ts port: DBC tables (services/dbc)

Ported all 18 DBC modules to TypeScript with one exported record interface each and typed the
cached tables and promises. Type-stripped output is identical to the original JavaScript.
```

## Scope guard

Write only inside this repository, and inside it only:

- `js/application/angular/**` - the files being ported, plus the two sanctioned new type-only files
  (see "File mapping"),
- `tsconfig.json`, `webpack.config.js`, `package.json`, `package-lock.json` - setup mode only, plus
  the final switch-over in "When it is done",
- `PORT_STATUS.md` at the repository root.

Temporary files (commit message, scratch output) go in the session's scratchpad directory, never
in the repository.

Never edit `index.html` (it holds the live GLSL shaders inline and loads `build/main.js`), `glsl/`,
`js/lib/`, the JSON mock packets under `js/application/*.json`, `README.md`, or anything under
`node_modules/` or `build/`. Never delete a file other than the `.js` being replaced by its `.ts`.
If the JavaScript looks wrong, record it (see "JavaScript bugs") and port it as-is - a port that
fixes a bug has changed the runtime.

## Modes

Decide from the argument:

1. **Setup** - `setup`, or the TypeScript toolchain is not in place yet (no `typescript` in
   `node_modules`, no `tsconfig.json`, or `webpack.config.js` has no `ts-loader` rule). Brings the
   toolchain to the state described in "Setup mode", creates `PORT_STATUS.md`, and - when invoked
   bare - carries on into continue mode in the same run.
2. **Port** - `port <file-or-dir>`, or a bare `.js` / `.ts` path or directory. Port exactly the
   named file(s), pulling in nothing else (see "Porting a file", point 2). Finishes a partially
   ported `.ts` file the same way.
3. **Review** - `review <file-or-dir>`. Compare the `.ts` against the original JavaScript and
   report gaps. Report only; do not modify files unless the user asks.
4. **Status** - `status`. Run the orientation commands from continue mode, reconcile
   `PORT_STATUS.md` with the tree, and report where the port stands and what the next run would
   pick. Changes nothing but the ledger, and commits only if the ledger needed fixing.
5. **Continue (no argument, or `continue`)** - work out what is missing and do the next slice. This
   is the default when the skill is invoked bare.

### Continue mode

**This skill is repeatable: it is meant to be run over and over until the port is finished.** At
~16,000 lines it takes roughly 8-12 runs. Every run starts from a cold context and has to re-derive
its own position, so it begins by looking at the tree rather than by assuming anything. A run picks
up exactly where the last one stopped, does one useful slice of work, leaves the build green and
the emit check clean, records its progress, commits, and says what the next slice is. Nothing about a run may
depend on having seen the previous one.

#### 1. Orient

Work out the current state from the tree itself - that is the authoritative answer - before
deciding anything:

```bash
cd "$code_root_dir/Code2/Wow/tools/WebWoWViewer"
A=js/application/angular

git branch --show-current                     # must be new-clean-ts, see "Branch"
git status --short                            # a dirty tree from an earlier, unfinished run?
git log --oneline -5                          # the last runs' 'ts port:' commits

# is the toolchain in place?
node -e "console.log(require('typescript').version)"
grep -n "ts-loader\|extensionAlias\|entry:" webpack.config.js
cat tsconfig.json

# what is still JavaScript? (the unported files)
find "$A" -name '*.js' | sort

# what is TypeScript already?
find "$A" -name '*.ts' | sort

# which .ts files are only partially typed? (the resume pointer inside a big file)
grep -rn 'TS-PORT: TODO' "$A" --include='*.ts'

# which types are parked, waiting for a later file to export the real type?
grep -rn 'TS-PORT: parked' "$A" --include='*.ts'

# which JavaScript bugs have been recorded so far? (must match the ledger's bug table)
grep -rn 'JS-BUG' "$A" --include='*.ts'
```

`PORT_STATUS.md` (below) is a hint that makes this cheaper, not a substitute for it: read it first,
then confirm against the tree. Where the two disagree, the tree wins and the ledger gets fixed.

Every finished run committed its work, so the tree normally starts clean. If `git status` shows
uncommitted port work (`.ts` files, renames, `PORT_STATUS.md` - a previous run that failed
verification or was interrupted), do not revert it: treat it as part of the tree, get it through
"Verification", and include it in this run's commit. Mention it in the summary. Uncommitted
changes outside the port's files belong to the user; leave them alone (see "Commits").

#### 2. Pick the next slice

1. If the toolchain is missing, run setup mode first, then carry on into the steps below in the same
   run until the line target is met.
2. If any `.ts` file still has a `// TS-PORT: TODO` marker, finish that file first - it is the
   resume pointer of an earlier run that ended mid-file.
3. Otherwise walk the porting order below and pick the first `.js` file that still exists. Skip the
   files listed under "Not ported" - they are out of scope and never come up again.
4. A `.ts` file free of `TS-PORT: TODO` markers is finished. Do not revisit it, re-check it or tidy
   it - that is review mode's job, not a continue run's. The only reasons to touch a finished file
   are: a later file now exports the type one of its `TS-PORT: parked` markers was waiting for (see
   "Parked types"), or a new file's types reveal that a finished file's annotation is wrong. Say so
   in the summary when either happens.

#### 3. Do the work

1. Port the picked file completely (see "Porting a file"), then keep going into the next file in
   the order, and the one after that. **Aim for roughly 1000-3000 lines of TypeScript per run.**
   That is a target, not a strict rule: a whole group of small files, or one big file, in one pass is
   exactly right. Stop when the run is around that size, when the list is exhausted, or when the
   build breaks in a way the current port did not cause. Do not stop a small file halfway to hit
   the number, and do not start a 1,500-line file at 2,800 lines just to round up.
2. A file bigger than what is left of the run's budget (`mdxLoader.js`, `scene.js`,
   `animationManager.js` and friends) may be split across runs. Rename it to `.ts` first, then type
   it top to bottom. Members not typed yet keep their parameters as `any` and carry a
   `// TS-PORT: TODO type <member>` comment on the line above - those markers *are* the resume
   pointer, and the next run continues at the first one. A run that ends mid-file must still pass
   the whole of "Verification": the emit check does not care about `any`, and `tsc` accepts an
   explicit `any` under `strict`.
3. Verify before finishing (see "Verification"). A run always ends with `tsc` clean, the webpack
   build green and `compare-emit.mjs` reporting `SAME` for every file the run touched.

#### 4. Record, commit and report

Update `PORT_STATUS.md` (including the run log row), then commit everything the run did as one
commit per "Commits" - the ledger update goes in the same commit as the code it describes. Then
summarize per "Output expectations". End the summary with a single explicit line so the next run -
and the reader - knows the entry point:

```text
Next: port js/application/angular/services/map/mdxLoader.js (from the header parser onwards)
```

#### 5. When to stop, and when it is done

- **Normal stop** - the line target is met. Commit, report and stop.
- **Blocked** - `node_modules` cannot be installed, the build is broken by code this run did not
  touch, or `compare-emit.mjs` reports a difference you cannot remove without changing the logic.
  JavaScript that merely looks wrong is not a blocker: record it (see "JavaScript bugs") and keep
  porting. Say what is blocking, leave the tree building if it already
  was, and stop. Commit the files that were finished and verified before the blocker, if any (one
  commit); leave unverified work uncommitted (see "Commits"). Do not reshape the code to get around it and do not silently pick a different
  file to have something to show.
- **Last sweep** - when no in-scope `.js` file is left, finish every `// TS-PORT: parked` marker
  (the types they waited for all exist now) and every remaining commented `any` that a real type
  can replace, then run "Verification" with `compare-emit.mjs --all`.
- **When it is done** - the last sweep is clean, `find js/application/angular -name '*.js'` lists
  only the files under "Not ported", and `grep -rn 'TS-PORT' js/application/angular` is empty.
  (`// JS-BUG:` markers stay - they are for the user's bug review, not port work.)
  Then, in that same run, do the switch-over:
  1. `tsconfig.json`: remove `allowJs` (and `checkJs` if present) - nothing JavaScript is compiled
     any more. Keep `include` pointing at `js/application`, and add the files under "Not ported"
     to `exclude` if `tsc` would otherwise pick them up.
  2. `webpack.config.js`: keep `.js` in `resolve.extensions` (dependencies in `node_modules` need
     it); remove `extensionAlias` only if no specifier ending in `.js` is left in the `.ts` files.
  3. `npm run build` and `npm run build:prod` green, `npx tsc --noEmit` clean,
     `compare-emit.mjs --all` all `SAME`.
  4. Commit the last sweep and the switch-over as the run's commit
     (`ts port: switch over to TypeScript-only build`).
  5. Tell the user the port is complete and list the remaining "Not ported" `.js` files, asking
     whether they want them deleted. Do not delete them yourself.
  6. Point the user at the "JavaScript bugs" table in `PORT_STATUS.md` (and
     `grep -rn 'JS-BUG' js/application/angular`) as the list to go through now that the port is
     done, with the count of entries. Do not fix any of them in the port.

  **Do not invent work** after that: no refactors, no new abstractions, no lint setup, no tests,
  no dependency upgrades. A run that says "nothing left to port" is a correct run.

Reruns are cheap and idempotent by design: setup only ever happens once and finished files are left
alone. Running the skill bare twice in a row must never produce a diff on the same lines twice.

### Porting order

Bottom-up along the import graph: nothing is ported before the modules it imports, so every new
`.ts` file can import real types instead of guessing. Within a group, go in the listed order.

1. **Foundation** (~1,360 lines) - `Expansion.js` (already `Expansion.ts` on `new-clean-ts`),
   `services/config.js`, `services/fileReadHelper.js`, `wowRenderJs/cache.js`,
   `wowRenderJs/math/quickSort.js`, `wowRenderJs/math/wowTextureRegions.js`,
   `wowRenderJs/math/mathHelper.js`. Group 1 also creates the two type-only files from "File
   mapping": `global.d.ts` and `wowRenderJs/sceneApi.ts`.
2. **File loading** (~660) - `services/fileSystem/fileLoaderStub.js`,
   `services/fileSystem/fileLoader-worker.js`, `services/fileLoader.js`, `services/dbcLoader.js`,
   `services/chunkedLoader.js`, `services/linedfileLoader.js`
3. **DBC tables** (~620) - every file in `services/dbc/`, alphabetically. `chrRacesDBC.js` and
   `wmoAreaTableDBC.js` are not imported by anything today; they are self-contained and ported
   anyway.
4. **Format parsers** (~3,000) - `services/map/wdtLoader.js`, `adtLoader.js`, `blpLoader.js`,
   `skinLoader.js`, `wmoLoader.js`, `mdxLoader.js`. The parsed-file interfaces (`WdtFile`,
   `AdtFile`, `M2File`, `SkinFile`, `WmoFile`, `WmoGroupFile`, ...) are declared and exported
   here, in the parser that produces them.
5. **Caches** (~1,660) - `wowRenderJs/geometry/adtGeomCache.js`, `skinGeomCache.js`,
   `m2GeomCache.js`, `wmoGeomCache.js`, `wmoMainCache.js`, `wowRenderJs/texture/textureCache.js`
6. **Math, camera, managers** (~1,760) - `wowRenderJs/math/portalCullingAlgo.js`,
   `wowRenderJs/math/bsp.js`, `wowRenderJs/math/BspTree.js` (empty today - becomes an empty
   `.ts`), `wowRenderJs/camera/firstPersonCamera.js`,
   `wowRenderJs/algorithms/characterComponents.js`,
   `wowRenderJs/manager/textureCompositionManager.js`, `wowRenderJs/manager/instanceManager.js`,
   `wowRenderJs/manager/animationManager.js`
7. **Scene objects** (~2,280) - `wowRenderJs/objects/M2Object.js` first (the others extend it),
   then `adtM2Object.js`, `wmoM2Object.js`, `worldM2Object.js`, `adtObject.js`, `wmoObject.js`
8. **World objects** (~1,520) - `wowRenderJs/objects/worldObjects/worldObject.js`,
   `worldUnit.js`, `worldPlayer.js`, `worldGameObject.js`, then
   `wowRenderJs/manager/worldObjectManager.js`
9. **Scene** (~2,110) - `wowRenderJs/manager/sceneGraphManager.js`, then `wowRenderJs/scene.js`.
   Porting `scene.ts` is when `SceneApi` is checked against the real `initSceneApi()` literal
   (see "The sceneApi hub").
10. **Entry and UI** (~1,030) - `directives/wowJsRenderDirective_noangular.js`, then the entry:
    `app_wowjs.js` -> `app_wow.ts` (see "The entry point"). Then the last sweep and the switch-over
    from "When it is done".

## Project layout

Nothing moves. The layout after the port is the layout before it, with `.ts` in place of `.js`:

```
WebWoWViewer/
  index.html                     not touched - inline GLSL shaders, loads build/main.js
  package.json                   + typescript@^5, ts-loader (setup)
  tsconfig.json                  see "Setup mode"
  webpack.config.js              entry app_wow.ts, ts-loader rule, extensionAlias (setup)
  PORT_STATUS.md                 the ledger (committed with each run)
  glsl/                          not touched - unused by the bundle, the live shaders are in index.html
  js/
    lib/webgl-debug.js           not ported (vendored, unused)
    application/
      *.json                     mock packets - not touched, imported as JSON
      angular/
        global.d.ts              NEW, type-only: the Window augmentation
        app_wow.ts               was app_wowjs.js - the webpack entry
        Expansion.ts
        directives/  services/{dbc,fileSystem,map}/  wowRenderJs/{algorithms,camera,geometry,
        manager,math,objects/worldObjects,texture}/  - one .ts per former .js
        wowRenderJs/sceneApi.ts  NEW, type-only: the SceneApi interface
```

### File mapping

- **One `.js` -> one `.ts`**, same directory, same base name, same casing (`M2Object.ts`,
  `linedfileLoader.ts`, `fileLoader-worker.ts`). Do the rename with `git mv` so the port shows up
  as a rename, then edit. Never keep both a `.js` and a `.ts` of the same name.
- **Everything inside the file stays where it is**: same order of imports, functions, classes,
  members and statements; same exports (a default export stays default, a named one stays named);
  same comments - including commented-out code - in the same positions.
- **Types go in the file whose code produces the value.** The DBC record interface lives in its
  DBC module, `M2File` in `mdxLoader.ts`, the cache entry type in `cache.ts`, a class's shape in the
  class itself. Export it with `export interface` / `export type` (type-only exports emit nothing)
  and import it elsewhere with `import type`.
- **Do not create `types.ts`, `interfaces.ts`, `utils.ts` or any other new module.** The only
  sanctioned new files are the two type-only ones:
  - `js/application/angular/global.d.ts` - the `declare global { interface Window { ... } }`
    augmentation for the properties the code reads and writes on `window` (`selectedExpansion`,
    `m`, `meshestoBeRendered`, ...). If an existing `.ts` file (for example `app_wow.ts` on
    `new-clean-ts`) already declares such an augmentation, move the declaration here - moving a
    `declare` block is type-only and changes nothing at runtime.
  - `js/application/angular/wowRenderJs/sceneApi.ts` - `export interface SceneApi` and its nested
    interfaces, and nothing else. See "The sceneApi hub".
  Both must emit no JavaScript: no `const`, no `enum`, no function, no class - only `interface`,
  `type` and `declare`.

### Not ported

- **`directives/wowJsRenderDirective.js` and `directives/fileDownload.js`** - AngularJS-era
  directives. They import `angular` / `angular-ui-bootstrap`, which are not installed, and nothing
  imports them (the live UI is `wowJsRenderDirective_noangular.js`). Left as they are; the final
  run asks the user whether to delete them.
- **`js/lib/webgl-debug.js`** - the vendored Khronos WebGL debug helper, not imported anywhere.
- **`index.html`, `glsl/`** - HTML and GLSL, not JavaScript. The shaders `scene.js` compiles are the
  inline `<script id="...">` blocks in `index.html`, read with `getElementById`; the `glsl/`
  files are not in the bundle.
- **`webpack.config.js`** - stays CommonJS JavaScript (webpack loads it with Node). Setup edits it,
  it is not ported.
- **`js/application/*.json`** - data, not code.
- **Tests, linting, formatting tooling** - none exists and none is added. The acceptance bar is
  `tsc`, the webpack build and the emit check.

Do not report any of these as missing.

## Setup mode

Bring the toolchain to the state below, keeping whatever already matches. On `new-clean-ts` most of
it exists already (`typescript`, `ts-loader`, a `tsconfig.json`, the `ts-loader` rule, entry
`app_wow.ts`, `typescript` 5.9 and `ts-loader` 9.6 installed); setup then only adjusts what
differs - mainly `tsconfig.json` (its `target: es5` and `moduleResolution: node` are replaced) and
the `extensionAlias` / extension order in `webpack.config.js`. Never regenerate a file that exists -
edit it.

1. **Dependencies.** `typescript` **pinned to the 5.x line** and `ts-loader` 9.x as devDependencies:

   ```bash
   npm install --save-dev typescript@^5.8 ts-loader@^9.5
   ```

   TypeScript 7 is the native (Go) compiler and does not ship the JavaScript compiler API that
   `ts-loader` and `compare-emit.mjs` call, so do not upgrade past 5.x. If `npm install` cannot
   reach the registry, say so and stop - the port cannot be verified without the compiler.

2. **`tsconfig.json`** - these options, whatever the file held before:

   ```json
   {
     "compilerOptions": {
       "target": "ES2020",
       "module": "ESNext",
       "moduleResolution": "bundler",
       "lib": ["ES2020", "DOM", "DOM.Iterable"],
       "strict": true,
       "allowJs": true,
       "checkJs": false,
       "useDefineForClassFields": false,
       "verbatimModuleSyntax": true,
       "isolatedModules": true,
       "resolveJsonModule": true,
       "esModuleInterop": true,
       "forceConsistentCasingInFileNames": true,
       "skipLibCheck": true,
       "sourceMap": true
     },
     "include": ["js/application/**/*"]
   }
   ```

   Why the ones that matter for "same runtime" are set that way:
   - `target: ES2020` - the source already uses classes, arrow functions, `async`/`await`,
     template literals and `import.meta`. An ES5 target (what `new-clean-ts` started with) would
     down-level all of it into different code - classes into functions, `async` into generator
     state machines, `for...of` into index loops - which is a runtime change. ES2020 emits the code
     as written.
   - `useDefineForClassFields: false` - with it `true` (the default for ES2022+ targets), a field
     *declaration* `foo: number;` becomes a runtime `Object.defineProperty(this, 'foo', undefined)`
     that can clobber a value a base-class constructor already set. With it `false`, a declaration
     without an initializer emits nothing, so declaring every field for the type checker is free.
   - `verbatimModuleSyntax` - every `import` that is not `import type` stays in the output exactly
     as written, so a port can never silently drop a side-effect import, and type-only imports are
     explicit.
   - `strict` - the point of the port. `allowJs` without `checkJs` lets the not-yet-ported `.js`
     files compile alongside, unchecked.
   - No `noEmit` in the file: `ts-loader` needs to emit. Type-check with `npx tsc --noEmit`.

3. **`webpack.config.js`**:
   - `entry` is `./js/application/angular/app_wow.ts` if that file exists, otherwise it stays
     `./js/application/angular/app_wowjs.js` until group 10 renames it.
   - `resolve.extensions` is `['.ts', '.js', '.jsx', '.glsl']` - `.ts` first.
   - `resolve.extensionAlias` is `{ '.js': ['.ts', '.js'] }`, so a not-yet-ported file that
     imports `./foo.js` gets `foo.ts` once `foo` is ported, without editing the importer.
   - a rule `{ test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ }`.
   Keep `resolve.modules`, `devServer`, `devtool`, `output` and the other rules exactly as they
   are.

4. **`PORT_STATUS.md`** at the repository root, committed with every run. It is short-lived state for
   the next run and append-only apart from the two live lines at the top:

   ```markdown
   # WebWoWViewer TypeScript port status

   Maintained by the `js-ts-webwowviewer` skill. A hint for the next run, not the source of truth -
   the tree is. Re-derive with:
   `find js/application/angular -name '*.js'` (unported) and
   `grep -rn 'TS-PORT' js/application/angular` (partially typed / parked).

   **Last run:** setup - toolchain
   **Next:** group 1 - Foundation (global.d.ts, sceneApi.ts, config, fileReadHelper, ...)

   ## Porting order

   - [ ] 1. Foundation - Expansion, config, fileReadHelper, cache, quickSort, wowTextureRegions, mathHelper (+ global.d.ts, sceneApi.ts)
   - [ ] 2. File loading - fileLoaderStub, fileLoader-worker, fileLoader, dbcLoader, chunkedLoader, linedfileLoader
   - [ ] 3. DBC tables - services/dbc/*
   - [ ] 4. Format parsers - wdt, adt, blp, skin, wmo, mdx
   - [ ] 5. Caches - adt/skin/m2/wmo geometry caches, wmoMainCache, textureCache
   - [ ] 6. Math, camera, managers - portalCullingAlgo, bsp, BspTree, firstPersonCamera, characterComponents, textureCompositionManager, instanceManager, animationManager
   - [ ] 7. Scene objects - M2Object, adtM2Object, wmoM2Object, worldM2Object, adtObject, wmoObject
   - [ ] 8. World objects - worldObject, worldUnit, worldPlayer, worldGameObject, worldObjectManager
   - [ ] 9. Scene - sceneGraphManager, scene
   - [ ] 10. Entry and UI - wowJsRenderDirective_noangular, app_wowjs -> app_wow; last sweep; switch-over

   ## Parked types

   (none yet - each entry: the .ts file and member typed as `any`, and the later file whose
   exported type it waits for)

   ## JavaScript bugs (ported as-is)

   Bugs and suspicious code found in the original JavaScript while porting. Each one is also marked
   in the source with a `// JS-BUG:` comment - `grep -rn 'JS-BUG' js/application/angular`.

   | # | Where | What | Effect |
   | --- | --- | --- | --- |

   ## Runtime notes

   (none yet - every place where typing needed an assertion, a widened type or a commented `any`
   because the JavaScript does something the type system cannot express; bugs go in the table
   above, not here)

   ## Run log

   | Run | Files | ~Lines | tsc | build | emit check |
   | --- | --- | --- | --- | --- | --- |
   | setup | toolchain | - | clean | green | - |
   ```

   Tick a group only when every file in it is `.ts` and free of `TS-PORT: TODO`. A partially typed
   big file gets a sub-bullet naming the last typed member, so the next run can resume without
   re-reading the whole file. If the ledger ever contradicts the tree, fix the ledger.

5. Verify: `npx tsc --noEmit` clean and `npm run build` green before any file is ported. If the
   untouched tree does not build, say so and stop - the port must start from a green baseline.

6. Commit the setup per "Commits" (`ts port: setup TypeScript toolchain`). When setup runs as
   the first step of a continue run, the setup changes and the first ported files go in that run's
   single commit.

## Porting a file

1. **Read the whole `.js` file first**, and the modules it imports, so the types reflect what the
   code actually passes around rather than what the names suggest. Read its importers too (a
   `grep -rn "<basename>" js/application/angular`), because they decide what the exported
   signatures must accept.
2. **Dependencies first.** If the file imports a `.js` module that is not ported yet, the porting
   order was not followed or the graph has a cycle. Import it anyway - `allowJs` gives it inferred
   types - and use a parked type where the inferred one is not good enough (see "Parked types").
   Do not port the dependency out of order just to get its types; the order exists so that this is
   rare. In `port <file>` mode, never pull in other files at all.
3. `git mv <file>.js <file>.ts`.
4. Add types following "Typing rules": imports and module-level variables, then top to bottom
   through the file - interfaces for the data it builds, parameter and return types, class field
   declarations.
5. Rewrite the file's **own** relative import specifiers to extensionless form
   (`'./fileLoader.js'` -> `'./fileLoader'`), and turn imports used only as types into
   `import type`. Do not edit the importers of the file - `extensionAlias` resolves their `.js`
   specifiers, and they get the same treatment when they are ported. The exception is a `new URL()`
   or `new Worker()` path, which webpack bundles as its own entry: it must name the real file, so
   the importer's `'./fileSystem/fileLoader-worker.js'` becomes `'...fileLoader-worker.ts'` in the
   run that ports the worker (see "The Web Worker").
6. `npx tsc --noEmit`, fix the type errors **with types, never with logic** (see "Typing rules").
7. `node .claude/skills/js-ts-webwowviewer/compare-emit.mjs <file>.ts` must print `SAME`. If it
   prints `DIFFERS`, the port changed runtime code: undo that change and type it differently.
8. Remove the file's `TS-PORT: TODO` markers once every member is typed.
9. Record every JavaScript bug or suspicious piece of code found while reading the file (see
   "JavaScript bugs") - a `// JS-BUG:` comment in the `.ts` and a row in the ledger's table.

## Same runtime

These are the rules that keep the stripped `.ts` identical to the `.js`. `compare-emit.mjs`
catches violations in the code; these rules are what keeps you from writing them in the first
place.

### Never change

- **Statements, expressions and their order.** No reordering, no merged or split declarations, no
  extracted helper functions or variables, no inlined ones, no dead-code removal, no early returns
  added or removed.
- **Operators.** `==` stays `==` and `!=` stays `!=` - switching to `===` changes the result for
  mixed types. `||` stays `||` (not `??`), `&&` stays `&&` (not `?.`), `+` on a possibly-string
  value stays `+`. If `tsc` rejects a comparison between two types (`This comparison appears to be
  unintentional`), widen a type rather than change the operator.
- **`var`, `let`, `const`.** Keep each declaration keyword as written. `var` -> `let` changes
  hoisting and loop-closure capture; `let` -> `const` is harmless at runtime but is still churn the
  emit check will flag - leave it.
- **Function forms.** A `function` stays a `function` (its own `this`, `arguments`, hoisting), an
  arrow stays an arrow, a method stays a method. `var self = this` stays.
- **Async shape.** A `.then()` chain stays a chain, `new Promise((resolve, reject) => ...)` stays,
  `async`/`await` stays `async`/`await`. Converting between them changes microtask timing.
- **Object shapes.** An object built incrementally (`const rec = {}; rec.id = ...`) stays built
  incrementally - type it with an assertion (`const rec = {} as LightRecord;`), not by rewriting it
  as a literal. A factory returning an object literal (`dbcLoader`, `fileReadHelper`, `config`,
  `sceneApi`) is **not** turned into a class, and a class is not turned into a factory. Sparse
  arrays used as id-keyed maps (`lightDBCFile[id] = rec`) stay arrays; type them as `T[]`.
- **Classes.** Same fields assigned in the same constructor order, same inheritance, same methods.
  Do not add `private` / `#private` fields (`#x` is a runtime change), parameter properties
  (`constructor(private x)` emits an assignment), `accessor`, or decorators.
- **Globals and DOM access.** `window.*`, `self.*`, `document.getElementById`, `localStorage` calls
  stay exactly as written, including the `try`/`catch` around them.
- **Console output, error messages, URLs** (`http://127.0.0.1:3002/files/`, `exp.txt`), file paths,
  magic numbers, DBC column indices, chunk ids, shader names - byte for byte.
- **Comments**, commented-out code and the `debugger;` lines, in place.

### Never add

- TypeScript features that emit code: `enum` (use a `const` object `as const` plus a union type,
  the way `Expansion.ts` does), `namespace`, parameter properties, decorators, `#private`,
  `accessor`, `using`.
- Runtime guards to satisfy the checker. `getContext('webgl')` may return `null`: write
  `canvas.getContext('webgl')!` or `as WebGLRenderingContext`, not `if (!gl) return`. The original
  code does not check, so the port does not check.
- Default parameter values, optional chaining, nullish coalescing, spread copies, `Object.freeze`,
  `readonly` arrays that need `.slice()` to satisfy a signature - anything the JavaScript did not
  have.
- New dependencies. `gl-matrix` and `axios` ship their own types; nothing else is needed. No
  `@types/*` package for code this repository does not import.

### Allowed, because it emits nothing

- Type annotations, `interface`, `type`, `declare`, `import type` / `export type`, generics.
- Non-null assertions (`x!`) and type assertions (`x as T`, `x as unknown as T`). Prefer `!` for
  "the JavaScript assumes this is set" and `as` for "the JavaScript knows the shape".
- Field declarations with no initializer in a class body (`gl!: WebGLRenderingContext;`) - with
  `useDefineForClassFields: false` they are erased. A field declaration **with** an initializer is
  a runtime change unless the JavaScript assigned that value in the same place; do not add one.
- `// @ts-expect-error <why>` on a single line where the JavaScript does something valid that the
  checker cannot follow and no annotation fixes it. Record each one under "Runtime notes" in
  `PORT_STATUS.md`. Never `// @ts-ignore`, never `// @ts-nocheck`.

## Typing rules

- **Parsed binary formats** (`services/map/*`, `fileReadHelper`, `dbcLoader`) get one exported
  interface per structure the parser builds, field names exactly as the JavaScript assigns them,
  in the order it assigns them. Numeric fields are `number`; typed-array views keep their exact
  class (`Uint8Array`, `Int16Array`, `Float32Array`); a chunk that may be absent is `T | undefined`
  only if the JavaScript really leaves it unset. The `offset` objects passed by reference
  (`{ offs: 0 }`) get a small exported `interface FileOffset { offs: number }` in
  `fileReadHelper.ts`.
- **DBC modules** each export a record interface named after the file (`LightRecord`,
  `CreatureDisplayInfoRecord`, ...) and type the cached table and the returned promise with it.
- **Chunked loaders** (`chunkedLoader`, `linedfileLoader`) take handler tables keyed by chunk
  name; type the table and the handler signature, keep the table itself as written.
- **Caches** (`cache.ts`) become generic over the cached object (`Cache<T>`) - generics emit
  nothing.
- **gl-matrix**: use its types (`vec3`, `vec4`, `mat4`, `quat`, `ReadonlyVec3`, ...). The code calls
  `glMatrix.setMatrixArrayType(Array)`, so at runtime they are plain arrays; the gl-matrix types
  already accept that. A literal `[x, y, z]` passed where a `vec3` is expected type-checks as a
  tuple - do not wrap it in `vec3.fromValues`.
- **WebGL**: `WebGLRenderingContext` (the code uses WebGL 1 plus extensions), `WebGLBuffer`,
  `WebGLTexture`, `WebGLProgram`, `WebGLUniformLocation`. Extension objects get their DOM types
  (`ANGLE_instanced_arrays`, `OES_vertex_array_object`, `EXT_texture_filter_anisotropic`,
  `WEBGL_compressed_texture_s3tc`), each `| null` where `getExtension` may return `null` and the
  code checks for it, non-null asserted where it does not.
- **`this` in `function` callbacks** that the code calls with a meaningful `this`: add a `this:`
  parameter, which is erased.
- **`any`** is allowed only (a) as a `TS-PORT: TODO` placeholder in a file being typed across
  runs, (b) as a parked type (next section), or (c) where the value is genuinely dynamic - the
  mock packet JSON walked by `worldObjectManager`, a `postMessage` payload - and then with a
  comment on the same line saying why. Prefer `unknown` plus an assertion at the use site when the
  value is only passed through.
- **`Expansion`** stays the `as const` object `Expansion.ts` already is; the value type is
  `typeof Expansion[keyof typeof Expansion]` (export it as `type ExpansionValue` from
  `Expansion.ts`).

### The sceneApi hub

`scene.js` builds one object in `initSceneApi()` - `this.sceneApi = { drawCamera, getGlContext,
getCurrentWdt, ..., extensions: {...}, shaders: {...}, dbc: {...}, ... }` - and hands it to nearly
every cache, manager and object constructor (20 files use it). `scene.js` is group 9, but its
consumers start in group 5, so the type cannot wait for it:

- Group 1 creates `wowRenderJs/sceneApi.ts` by reading `initSceneApi()` in `scene.js` end to end
  and writing `export interface SceneApi` with every member of that literal, nested groups as
  nested interfaces, in the literal's order. Member types that name classes or file structures not
  ported yet are parked (`any` with a `TS-PORT: parked until <file>` comment).
- Every consumer types its `sceneApi` parameter and field as `SceneApi` (`import type`).
- Porting `scene.ts` annotates `this.sceneApi` as `SceneApi` and fixes `SceneApi` wherever the real
  literal disagrees with it. The literal itself is not changed.
- The last sweep replaces the parked member types in `SceneApi` with the real ones.

### Parked types

When a file needs the type of something a later file creates, it does not guess and does not port
that file early. It uses `any` with a marker on the same line:

```ts
    wdtFile: any; // TS-PORT: parked until services/map/wdtLoader.ts exports WdtFile
```

Add an entry under "Parked types" in `PORT_STATUS.md`. When the later file is ported and exports
the type, the run that ported it resolves the markers that were waiting for it if that is cheap;
otherwise the last sweep does. Parked markers are **not** a reason to revisit finished files in
between.

### The Web Worker

`services/fileLoader.js` starts the worker with
`new Worker(new URL('./fileSystem/fileLoader-worker.js', import.meta.url), { type: 'module' })`;
webpack bundles the worker as a separate chunk from that literal path.

- When `fileLoader-worker.js` is ported, change that path in `fileLoader` to `.ts` in the same run
  (both files are in group 2), then check the build output still lists the worker chunk.
- The worker file is type-checked with the DOM lib, where `self` is a `Window`. Do **not** add the
  `webworker` lib (it conflicts with `DOM`). Declare a small local interface for the worker scope
  in `fileLoader-worker.ts` and assert at each use site:
  `(self as unknown as WorkerScope).postMessage(msg, [buf])` emits exactly
  `self.postMessage(msg, [buf])`. Do not introduce a `const ctx = self` - that is a new statement.
- `fileLoaderStub` assigns `self.window = self` and the worker assigns `self.fileLoader = ...`;
  type both through the same kind of assertion.

### The entry point

`app_wowjs.js` becomes `app_wow.ts`. Its first ~290 lines are the old AngularJS bootstrap, all
commented out; keep them as comments. The live tail (expansion detection through `window.onload`)
is ported like any other code.

On `new-clean-ts`, `app_wow.ts` already exists next to `app_wowjs.js`, and `webpack.config.js`
already points at it. There the port of the entry means: check `app_wow.ts` against the live code
of `app_wowjs.js` with `compare-emit.mjs app_wow.ts=app_wowjs.js` (the comments do not count),
report any difference to the user instead of fixing it silently, move its `declare global` into
`global.d.ts`, and `git rm` `app_wowjs.js` once the user has confirmed the two match or that
`app_wow.ts` is the version to keep. `Expansion.ts` on that branch is a finished port already; its
commented-out alternatives stay.

## Naming

Nothing is renamed. Files, classes, functions, methods, fields, variables, parameters and exports
keep their exact JavaScript names, casing and typos included (`deativateBoundingBoxShader`,
`linedfileLoader`, `meshestoBeRendered`) - renaming a property changes the runtime, and renaming a
local makes the file harder to diff against its history.

New names exist only for types:

- **Interfaces and type aliases** are `PascalCase` nouns named after what the JavaScript calls the
  thing: the record a DBC module builds is `<Name>Record` (`LightRecord`, `ItemDisplayInfoRecord`),
  a parsed file is `<Format>File` (`M2File`, `WmoGroupFile`), the object a factory returns is the
  factory's name in `PascalCase` (`DbcObject`, `FileReadHelper`, `ConfigService`).
- A class's instance type is the class itself; do not add an `IFoo` interface next to it.
- No `I` prefixes, no `T` prefixes except single-letter generic parameters.

## Verification

From the repository root, after every run:

```bash
npx tsc --noEmit
npm run build
node .claude/skills/js-ts-webwowviewer/compare-emit.mjs <every .ts file this run created or changed>
rm -rf build           # build/ is git-ignored, but do not leave a stale bundle behind
```

All three are the acceptance bar:

- `tsc --noEmit` reports **zero errors**. `.js` files are not checked (`checkJs` is off), so errors
  can only come from ported files.
- `npm run build` (webpack, development) compiles with no errors, and the output still contains the
  worker chunk.
- `compare-emit.mjs` prints `SAME` for every file. It strips types from the `.ts` and from the
  original `.js` (read from the tree, `HEAD`, or the commit that deleted it) through the same
  `ts.transpileModule` call with comments removed, normalizes relative import specifiers
  (`./foo.js`, `./foo.ts`, `./foo` are equal), and compares. For a renamed file pass
  `new.ts=old.js`. `--all` checks every `.ts` file under `js/`. A `DIFFERS` is a runtime change and
  the run is not finished until it is gone - the only exception is the entry point on
  `new-clean-ts` (see "The entry point"), which is reported to the user.

Also run `npm run build:prod` when a run touches `tsconfig.json` or `webpack.config.js`.

**Do not run the viewer as part of a run.** It needs the WoW file server on `127.0.0.1:3002` and
extracted client data, and a visual check proves less than the emit check does. If the user asks
for a smoke test, `npm run start` serves it on port 8888; look at the browser console for errors
and compare against the same page built from the pre-port commit.

Fix errors caused by the current run. Do not rewrite unrelated ported code unless it is necessary,
and say so when it is.

### JavaScript bugs

Porting means reading every line, so it finds bugs: undeclared variables, wrong argument counts,
copy-paste conditions (`a && a`), unreachable branches, `this` where a local was meant, hard-coded
values that bypass a setting, results computed and never used. The port never fixes them, but it
never loses them either - the user goes through the list after the port. For each one:

- **In the source**, a comment on the line above the statement (above its `@ts-expect-error`, if
  it has one), with the same indentation:

  ```ts
          // JS-BUG: vec3.scale gets two arguments, so center becomes NaN (should be vec3.scale(center, center, 1 / n))
          // @ts-expect-error vec3.scale takes (out, a, b); the JavaScript passes only two arguments
          vec3.scale(center, 1 / thisPortalVertices.length);
  ```

  One line: what is wrong, and the likely intent when it is clear. Comments are stripped by the
  emit check, so the marker is free. The marker is `JS-BUG`, not `TS-PORT`, because it is not port
  work and stays after the port is finished.
- **In `PORT_STATUS.md`**, a row in the "JavaScript bugs (ported as-is)" table, numbered on from
  the last row: where (file and function), what, and the effect at runtime - including "harmless"
  or "nothing calls it" when that is the case, so the user can prioritize. Rows are never removed
  or renumbered by the port; the user removes them when they fix or dismiss a bug.
- Check before calling something a bug: read the callers (an odd-looking default may be what every
  caller relies on) and say how sure you are when it is a guess ("probably should be `[2]`").
- A bug that also needs `@ts-expect-error` or an assertion to type is described in the bug table;
  its "Runtime notes" entry only names the typing workaround and refers to the bug number.
- Bugs in code that is commented out are not recorded.

## Review mode

Compare the requested scope and report:

1. `.js` files in scope that are not ported yet, and `.ts` files with `TS-PORT: TODO` or
   `TS-PORT: parked` markers.
2. Emit differences - run `compare-emit.mjs` on the scope and list every `DIFFERS` with its lines.
3. Type holes: `any` without a comment, `as any`, `@ts-expect-error` without a reason or without a
   `PORT_STATUS.md` entry, any `@ts-ignore` or `@ts-nocheck`, a `!` or `as` that hides a real
   mismatch between two ported files rather than a JavaScript assumption.
4. Types that do not match the data: an interface field the parser never assigns, a field it
   assigns that the interface lacks, a typed-array class that differs from the one constructed, a
   `SceneApi` member that differs from `initSceneApi()`.
5. Code-emitting TypeScript: `enum`, `namespace`, parameter properties, `#private`, decorators,
   field initializers the JavaScript did not have.
6. Import problems: a type-only import without `import type`, a remaining `.js` specifier in a
   `.ts` file, a changed import order, a dropped side-effect import.
7. New files beyond `global.d.ts` and `sceneApi.ts`, or either of those emitting JavaScript.
8. Naming that departs from "Naming".
9. `tsc` or webpack errors in the reviewed area.
10. JavaScript bugs: a `// JS-BUG:` marker without a row in the ledger's bug table or the other way
    round, and anything in scope that looks wrong but has neither.

Output: scope reviewed, what matches, what is missing, runtime differences, type holes, suggested
next edits. Do not modify files unless the user explicitly asks.

## Output expectations

After the edits, summarize:

- which mode ran, and in continue mode which files were picked and why, plus roughly how many lines
  of TypeScript the run produced
- which files were ported (`.js` -> `.ts`), which were finished from an earlier partial run, and
  which were left partially typed, with the last typed member
- the new exported types, and in which file
- every parked type added or resolved, and every `@ts-expect-error` or commented `any` added, with
  why - these are also in `PORT_STATUS.md`
- every JavaScript bug recorded this run (number, file, one line), and the total in the ledger's
  bug table
- the results of `tsc --noEmit`, `npm run build` (and `build:prod` if run), and `compare-emit.mjs`
  for each touched file
- that `PORT_STATUS.md` was updated
- uncommitted work from an earlier run that this run found and built on, if any
- **the commit the run made**: its short hash and subject line, and confirmation that it has no
  `Co-Authored-By` or other trailer. If the run did not commit (nothing changed, a review run, or
  verification failed), say so and why.
- a final `Next: <file or member>` line - one line, always last, even when the answer is "nothing
  left to port, run `review js/application/angular` next"
