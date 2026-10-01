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

## Runtime notes

- `mathHelper.ts` `sortVec3ArrayAgainstPlane`: `vec3.scale(center, 1 / n)` passes two arguments to a
  three-argument function (centre becomes NaN). `@ts-expect-error`, ported as-is.
- `mathHelper.ts` `createPlaneFromVertexes`: uses an undeclared `edgeDir` (the local is `edgeDir1`) - would throw
  a ReferenceError if called; nothing calls it. Three `@ts-expect-error` lines, ported as-is.
- `linedfileLoader.ts` `readType` case `ablock_tbc`: the `else if` reads `this.interpolation_type` /
  `this.global_sequence` (the LinedFile, so always undefined) instead of `result`'s. `@ts-expect-error`; the
  following `result.ranges!.push` is unreachable in practice.
- `linedfileLoader.ts` case `layout`: `if (!layout instanceof Array)` is always false. `@ts-expect-error`.
- `linedfileLoader.ts`: `LinedFileObj` is a constructor function; `new` goes through
  `LinedFileObj as unknown as new () => LinedFile`. Parsed values are `SectionValue` / `ParsedObject`
  (`{ [field: string]: any }`, schema-driven); parsers assert their file interfaces on the result.
- `chunkedLoader.ts`: `processFile` calls `processChunk` with a third argument it ignores - the `ChunkedFile`
  interface declares it optional. Chunk handlers take `resultObj: ChunkResultObj` (= `any`, the object differs
  per parser and chunk). The load-by-path promise resolves with the error value on failure (rejection handler
  returns `e`), so `Promise<ChunkedFile>` is the success type only.
- `cache.ts` `remove()`: calls `destroy()` on the cached object unconditionally, via an assertion to
  `T & Destroyable` - ADTGeom, M2Geom and SkinGeom have no `destroy()`.
- `fileLoader-worker.ts`: `messageId` is `!`-asserted (only `loadFile` requests carry one); the init params and
  file path are asserted out of the request union because the JS reads `message` before checking `opcode`.
- Entry point (group 10): `compare-emit.mjs app_wow.ts=app_wowjs.js` DIFFERS - `app_wow.ts` adds
  `if (!container) { console.error("Viewer container not found!"); return; }` in `window.onload`. Needs the
  user's decision before `app_wowjs.js` is removed. Its `declare global` moved to `global.d.ts` this run.

## Run log

| Run | Files | ~Lines | tsc | build | emit check |
| --- | --- | --- | --- | --- | --- |
| setup | toolchain | - | clean | green | - |
| 1 | groups 1-2: config, fileReadHelper, cache, quickSort, wowTextureRegions, mathHelper, global.d.ts, sceneApi.ts, fileLoaderStub, fileLoader-worker, fileLoader, dbcLoader, chunkedLoader, linedfileLoader | 2,430 | clean | green (dev + prod) | all SAME |
