# Dependencies

What this project depends on, what each package is used for, and which further upgrades are
possible, with their benefits and downsides. Versions are as of 2026-10-01, after the
"update npm packages within existing ranges" and "upgrade webpack-cli to 7 and webpack-dev-server
to 6" commits. `npm audit` reports 0 vulnerabilities on both `new-clean` and `new-clean-ts`.

Keep any upgrade in a commit of its own. Do not mix it into a TypeScript port run: the port checks
that its output matches the code it started from, so that starting point must not move mid-port.

## Overview

| Package | Kind | Installed | Latest | Status |
| --- | --- | --- | --- | --- |
| Node.js | runtime for the tooling | 25.2.1 (local) | 24.21.0 LTS / 26.10.0 | **upgrade recommended** - 25 is end-of-life |
| `axios` | dependency | 1.20.0 | 1.20.0 | up to date |
| `gl-matrix` | dependency | 3.4.4 | 3.4.4 (4.0.0-beta.2) | up to date - do not take the beta |
| `webpack` | devDependency | 5.111.1 | 5.111.1 | up to date |
| `webpack-cli` | devDependency | 7.2.3 | 7.2.3 | up to date |
| `webpack-dev-server` | devDependency | 6.0.0 | 6.0.0 | up to date |
| `typescript` | devDependency, `new-clean-ts` only | 5.9.3 | 7.0.2 (6.0.3) | optional - see below, stay on 5.x for now |
| `ts-loader` | devDependency, `new-clean-ts` only | 9.6.2 | 9.6.2 | up to date |

## Packages and what they are used for

### Runtime dependencies (shipped to the browser)

- **`gl-matrix`** - vector and matrix math for WebGL: `vec3`, `vec4`, `mat4`, `quat` and
  `glMatrix`, imported by 15 files (camera, scene, scene graph, M2/WMO/ADT objects, animation,
  portal culling, world objects). `scene.js` calls `glMatrix.setMatrixArrayType(Array)`, so every
  vector and matrix is a plain JavaScript array rather than a `Float32Array`. It ships its own
  TypeScript types.
- **`axios`** - HTTP client, used in exactly one place: `services/fileSystem/fileLoaderStub.js`,
  inside the file-loading Web Worker, to `GET` each WoW file as an `arraybuffer` from the local
  file server at `http://127.0.0.1:3002/files/`. It is bundled into a separate vendor chunk
  that only the worker loads (~50 KiB minified, next to ~220 KiB for `main.js`). It ships its own
  TypeScript types.

### Build tooling (devDependencies, never shipped)

- **`webpack`** - the bundler. Builds `build/main.js` from the entry
  (`js/application/angular/app_wowjs.js` on `new-clean`, `app_wow.ts` on `new-clean-ts`),
  splits off the Web Worker (`new Worker(new URL(...))`) and its axios chunk, inlines the imported
  mock-packet JSON (`rag_no_mount.json`), and writes source maps (`devtool: 'source-map'`).
  `index.html` loads the result with `<script src="build/main.js">`.
- **`webpack-cli`** - provides the `webpack` command the npm scripts run: `npm run build`
  (development), `npm run build:prod` (minified), and `webpack serve` for the dev server.
- **`webpack-dev-server`** - `npm run start` / `npm run server` (the two scripts are identical):
  serves the repository root on port 8888 with the bundle built in memory and rebuilt on change.
  Version 6 requires Node.js 22.15 or newer.
- **`typescript`** (`new-clean-ts` only) - the TypeScript compiler. `ts-loader` uses it to
  compile `.ts` files during the build, `npx tsc --noEmit` type-checks the project, and the
  `js-ts-webwowviewer` skill's `compare-emit.mjs` uses its JavaScript API (`transpileModule`)
  to prove each ported file emits the same JavaScript as the original.
- **`ts-loader`** (`new-clean-ts` only) - the webpack loader for `.ts` files. It calls the
  TypeScript compiler's JavaScript API, so it type-checks as part of every build.

### Not installed, but still referenced

These appear in the code or config but are not in `package.json`. None of them is needed today:

- **`raw-loader`, `file-loader`, `style-loader`, `css-loader`** - `webpack.config.js` has rules
  for `.glsl`, font and `.css` files that point at these loaders. Nothing imports such files any
  more: the `.glsl` imports in `scene.js` are commented out (the live shaders are inline
  `<script>` blocks in `index.html`), and no CSS or fonts are imported. webpack only looks for a
  loader when a matching file is imported, so the build works without them. If a rule is ever
  needed again, `raw-loader` and `file-loader` are deprecated in webpack 5; use the built-in asset
  modules (`type: 'asset/source'` for `.glsl`, `type: 'asset/resource'` for fonts) instead.
- **`angular`, `angular-ui-bootstrap`** - imported only by `directives/wowJsRenderDirective.js`
  and `directives/fileDownload.js`, the old AngularJS UI, which nothing imports any more (the live
  UI is `wowJsRenderDirective_noangular.js`). Leftovers from the AngularJS version of the viewer.

## Upgrades worth considering

### Node.js: 25 -> 24 LTS now, or 26 LTS from 2026-10-28 (recommended)

Node 25 was a short-lived odd-numbered release and reached end-of-life on 2026-06-01, so it no
longer gets security fixes. Node 24 ("Krypton") is the current LTS line, supported until
2028-04-30. Node 26 becomes LTS on 2026-10-28 and is supported until 2029-04-30.

- **Benefits:** security and bug fixes again. Nothing in this project needs to change.
- **Downsides:** none for this project. Do not go below 22.15: `webpack-dev-server` 6 requires
  it, and `npm run start` would stop working.

### TypeScript: 5.9 -> 6.0 (optional, after the port's setup step)

TypeScript 6.0 is the last release of the compiler written in JavaScript, meant as the bridge to
7.0. It deprecates options that 7.0 removes, and treats them as errors unless silenced with
`"ignoreDeprecations": "6.0"`.

- **Benefits:** the newest compiler that still has the JavaScript API, so `ts-loader` and
  `compare-emit.mjs` keep working (`ts-loader`'s peer range is `typescript: *`). It shows early
  what would break under 7.0.
- **Downsides:** tested against TypeScript 6.0.3, the `tsconfig.json` currently on `new-clean-ts`
  fails with two errors: `target=ES5` and `moduleResolution=node10` (what `"node"` means) are
  deprecated. The tsconfig that the `js-ts-webwowviewer` skill's setup step writes (`ES2020`,
  `bundler`) compiles cleanly under 6.0, so the upgrade fits best after that step has run. The
  skill pins `typescript@^5.8`, so its setup section would need to allow 6.x as well.
- **Recommendation:** stay on 5.9 until the port has started; then 6.0 is a small, low-risk
  bump if wanted.

### TypeScript: -> 7.0 (not now)

TypeScript 7.0 is the native rewrite of the compiler in Go. It type-checks many times faster,
but the npm package ships only a `tsc` binary: no `main` entry, so no JavaScript API.

- **Benefits:** much faster `tsc` runs and editor feedback.
- **Downsides:** `ts-loader` cannot use it, so the webpack build would break, and so would
  `compare-emit.mjs`, which calls `transpileModule`. Switching would mean compiling `.ts` some
  other way in webpack (for example `esbuild-loader` or `swc-loader`), running 7.0 only for `tsc --noEmit`, and rewriting the emit check. That is a change to
  the toolchain, not a version bump.
- **Recommendation:** finish the port on 5.x (or 6.0), then reconsider.

### Replace `axios` with `fetch` (optional, after the port)

The worker uses only `axios.get(url, { responseType: 'arraybuffer' })`, which the browser's
built-in `fetch(url).then(r => r.arrayBuffer())` covers.

- **Benefits:** removes the only runtime dependency besides `gl-matrix` and ~50 KiB from the
  worker's chunk. It also ends future axios upgrades and security advisories.
- **Downsides:** it is a code change, not an upgrade, with small behavior differences:
  `fetch` does not reject on HTTP 404/500 (`response.ok` has to be checked), and errors look
  different in the console. It also changes the runtime, so it must not happen during the
  TypeScript port, which promises an identical runtime.

### Clean up the unused loader rules (optional)

Remove the `.glsl`, font and `.css` rules from `webpack.config.js`, or turn them into asset-module
rules (see above). No effect on the bundle; it only stops the config referring to packages that are
not installed.

## Not worth upgrading now

- **`gl-matrix` 4.0** - only `4.0.0-beta.2` exists, the last beta is from April 2024, and 3.4.4
  (August 2025) is the stable line. The 4.x betas reorganize the API, which would touch all 15
  files that import it, for no gain here.
- **`axios`, `webpack`, `webpack-cli`, `webpack-dev-server`, `ts-loader`** - already on their
  latest releases. Keep them current with `npm update` now and then, which stays within the
  `package.json` ranges. Run `npm run build` and `npm run start` afterwards.
- **`@types/*` packages** - none are needed: `gl-matrix` and `axios` ship their own types, and
  `typescript` provides the DOM and WebGL types.
