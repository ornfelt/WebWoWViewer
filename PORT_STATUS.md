# WebWoWViewer TypeScript port status

Maintained by the `js-ts-webwowviewer` skill. A hint for the next run, not the source of truth -
the tree is. Re-derive with:
`find js/application/angular -name '*.js'` (unported) and
`grep -rn 'TS-PORT' js/application/angular` (partially typed / parked).

**Last run:** setup + groups 1-2 (Foundation, File loading)
**Next:** group 3 - DBC tables (services/dbc/*, alphabetically, starting with animationDataDBC)

## Porting order

- [x] 1. Foundation - Expansion, config, fileReadHelper, cache, quickSort, wowTextureRegions, mathHelper (+ global.d.ts, sceneApi.ts)
- [x] 2. File loading - fileLoaderStub, fileLoader-worker, fileLoader, dbcLoader, chunkedLoader, linedfileLoader
- [ ] 3. DBC tables - services/dbc/*
- [ ] 4. Format parsers - wdt, adt, blp, skin, wmo, mdx
- [ ] 5. Caches - adt/skin/m2/wmo geometry caches, wmoMainCache, textureCache
- [ ] 6. Math, camera, managers - portalCullingAlgo, bsp, BspTree, firstPersonCamera, characterComponents, textureCompositionManager, instanceManager, animationManager
- [ ] 7. Scene objects - M2Object, adtM2Object, wmoM2Object, worldM2Object, adtObject, wmoObject
- [ ] 8. World objects - worldObject, worldUnit, worldPlayer, worldGameObject, worldObjectManager
- [ ] 9. Scene - sceneGraphManager, scene
- [ ] 10. Entry and UI - wowJsRenderDirective_noangular, app_wowjs -> app_wow; last sweep; switch-over

## Parked types

- `services/config.ts` - `cameraM2` and `setCameraM2(value)`: waits for `wowRenderJs/objects/M2Object.ts` (M2Object).
- `wowRenderJs/math/mathHelper.ts` - `queryBspTree(nodes)`: waits for `services/map/wmoLoader.ts` (BSP node type);
  `getTopAndBottomTriangleFromBsp(groupFile)`: waits for `services/map/wmoLoader.ts` (WmoGroupFile).
- `wowRenderJs/sceneApi.ts` - `getCurrentWdt()`: `services/map/wdtLoader.ts` (WdtFile); every `SceneApiDbc`
  getter: its `services/dbc/*DBC.ts`; every `SceneApiObjects` member: `wowRenderJs/manager/sceneGraphManager.ts`;
  the `SceneApiResources` loaders: `textureCache.ts` (Texture), `wmoLoader.ts` (WmoFile), `wmoGeomCache.ts`,
  `m2GeomCache.ts`, `skinGeomCache.ts`, `adtGeomCache.ts`.

## JavaScript bugs (ported as-is)

Bugs and suspicious code found in the original JavaScript while porting. The port never fixes them
(that would change the runtime); they are collected here to go through after the port. Each one is
also marked in the source with a `// JS-BUG:` comment on the line above - `grep -rn 'JS-BUG'
js/application/angular` lists them with current line numbers. Columns: where, what, effect.

| # | Where | What | Effect |
| --- | --- | --- | --- |
| 1 | `wowRenderJs/math/mathHelper.ts` `sortVec3ArrayAgainstPlane` | `vec3.scale(center, 1 / n)` - two arguments to a three-argument function | `center` becomes NaN, so the portal-vertex sort compares NaN and the order is arbitrary |
| 2 | `wowRenderJs/math/mathHelper.ts` `createPlaneFromVertexes` | uses undeclared `edgeDir` (local is `edgeDir1`); never returns the plane | ReferenceError if called; nothing calls it |
| 3 | `wowRenderJs/math/mathHelper.ts` `calcZ` | degenerate-triangle fallback returns `Math.min` of the x coordinates (`[0]`) | wrong height for near-degenerate triangles (should probably be `[2]`) |
| 4 | `wowRenderJs/math/mathHelper.ts` `getTopAndBottomTriangleFromBsp` | `minPositiveDistanceToCamera` is never updated | `bottomZ` is the last triangle below the camera, not the closest |
| 5 | `wowRenderJs/math/quickSort.ts` `multiQuickSort` | `var newRight = 1` instead of `left + 1` | wrong grouping when `left != 0`; harmless today (M2Object passes 0) |
| 6 | `wowRenderJs/cache.ts` `remove` | calls `destroy()` on every cached object | ADTGeom, M2Geom, SkinGeom and the parsed WMO file have no `destroy()` - TypeError when they are unloaded; no caller unloads them today |
| 7 | `services/chunkedLoader.ts` (load by path) | rejection handler returns `e` | a failed load resolves with the error object as if it were the ChunkedFile; callers then fail on it |
| 8 | `services/fileSystem/fileLoaderStub.ts` | file server URL hard-coded to `http://127.0.0.1:3002/files/` | `config.getUrlToLoadWoWFile()` and the `urlForLoading` saved in localStorage have no effect |
| 9 | `services/linedfileLoader.ts` `readType` | duplicate `case "int32Array"` | second case unreachable; harmless |
| 10 | `services/linedfileLoader.ts` `readType`, `ablock_tbc` | `else if` reads `this.interpolation_type` / `this.global_sequence` (the LinedFile) instead of `result`'s | the whole-track range for TBC blocks without ranges is never added |
| 11 | `services/linedfileLoader.ts` `readType`, `layout` | `if (!layout instanceof Array)` | always false - the "layout is not array" check never fires |

## Runtime notes

Places where typing needed an assertion, a widened type, `@ts-expect-error` or a commented `any`
(bugs are in the table above, not repeated here).

- `mathHelper.ts`: `@ts-expect-error` on bug 1 and the three `edgeDir` lines of bug 2.
- `linedfileLoader.ts`: `@ts-expect-error` on bugs 10 and 11; `result.ranges!.push` after bug 10 is
  unreachable in practice. `LinedFileObj` is a constructor function; `new` goes through
  `LinedFileObj as unknown as new () => LinedFile`. Parsed values are `SectionValue` / `ParsedObject`
  (`{ [field: string]: any }`, schema-driven); parsers assert their file interfaces on the result.
- `chunkedLoader.ts`: `processFile` calls `processChunk` with a third argument it ignores - the `ChunkedFile`
  interface declares it optional. Chunk handlers take `resultObj: ChunkResultObj` (= `any`, the object differs
  per parser and chunk). `Promise<ChunkedFile>` is the success type only (bug 7).
- `cache.ts` `remove()`: `destroy()` is reached through an assertion to `T & Destroyable` (bug 6).
- `fileLoader-worker.ts`: `messageId` is `!`-asserted (only `loadFile` requests carry one); the init params and
  file path are asserted out of the request union because the JS reads `message` before checking `opcode`.
- Entry point (group 10): `app_wow.ts` was rebuilt from `app_wowjs.js` at the user's request (run 3) -
  all comments kept, the extra `if (!container)` guard removed; `compare-emit.mjs app_wow.ts=app_wowjs.js`
  is SAME. `document.getElementById('viewer-container')!` - the JS assumes the container exists.
  `app_wowjs.js` is still in the tree (not bundled); remove it with `git rm` once the user confirms.

## Run log

| Run | Files | ~Lines | tsc | build | emit check |
| --- | --- | --- | --- | --- | --- |
| setup | toolchain | - | clean | green | - |
| 1 | groups 1-2: config, fileReadHelper, cache, quickSort, wowTextureRegions, mathHelper, global.d.ts, sceneApi.ts, fileLoaderStub, fileLoader-worker, fileLoader, dbcLoader, chunkedLoader, linedfileLoader | 2,430 | clean | green (dev + prod) | all SAME |
| 2 | JS bug list + `JS-BUG` markers in groups 1-2 (no code change) | - | clean | green | all SAME |
| 3 | app_wow.ts rebuilt from app_wowjs.js (entry point; app_wowjs.js not yet removed) | 360 | clean | green | SAME |
