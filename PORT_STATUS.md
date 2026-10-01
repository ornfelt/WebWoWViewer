# WebWoWViewer TypeScript port status

Maintained by the `js-ts-webwowviewer` skill. A hint for the next run, not the source of truth -
the tree is. Re-derive with:
`find js/application/angular -name '*.js'` (unported) and
`grep -rn 'TS-PORT' js/application/angular` (partially typed / parked).

**Last run:** run 5 - group 3 (DBC tables) and group 4 up to wmoLoader (wdt, adt, blp, skin, wmo)
**Next:** group 4 - services/map/mdxLoader.js (the last parser), then group 5 - Caches

## Porting order

- [x] 1. Foundation - Expansion, config, fileReadHelper, cache, quickSort, wowTextureRegions, mathHelper (+ global.d.ts, sceneApi.ts)
- [x] 2. File loading - fileLoaderStub, fileLoader-worker, fileLoader, dbcLoader, chunkedLoader, linedfileLoader
- [x] 3. DBC tables - services/dbc/*
- [ ] 4. Format parsers - wdt, adt, blp, skin, wmo, mdx
  - wdt, adt, blp, skin, wmo done; mdxLoader.js not started
- [ ] 5. Caches - adt/skin/m2/wmo geometry caches, wmoMainCache, textureCache
- [ ] 6. Math, camera, managers - portalCullingAlgo, bsp, BspTree, firstPersonCamera, characterComponents, textureCompositionManager, instanceManager, animationManager
- [ ] 7. Scene objects - M2Object, adtM2Object, wmoM2Object, worldM2Object, adtObject, wmoObject
- [ ] 8. World objects - worldObject, worldUnit, worldPlayer, worldGameObject, worldObjectManager
- [ ] 9. Scene - sceneGraphManager, scene
- [ ] 10. Entry and UI - wowJsRenderDirective_noangular, app_wowjs -> app_wow; last sweep; switch-over

## Parked types

- `services/config.ts` - `cameraM2` and `setCameraM2(value)`: waits for `wowRenderJs/objects/M2Object.ts` (M2Object).
- `wowRenderJs/sceneApi.ts` - every `SceneApiObjects` member: `wowRenderJs/manager/sceneGraphManager.ts`;
  the `SceneApiResources` loaders: `textureCache.ts` (Texture), `wmoGeomCache.ts`, `m2GeomCache.ts`,
  `skinGeomCache.ts`, `adtGeomCache.ts`.
- Resolved in run 5: `mathHelper.ts` BSP types (`WmoBspNode`, `WmoGroupFile`), `SceneApi.getCurrentWdt()` (`WdtFile`),
  `SceneApi.resources.loadWmoMain()` (`WmoFile | undefined`), every `SceneApiDbc` getter (its `*Record` table).

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
| 12 | `services/dbc/charHairGeosetsDBC.ts` | default export is named `characterFacialHairStylesDBC` (copy-paste) | harmless, importers pick their own name |
| 13 | `services/dbc/creatureModelDataDBC.ts` | default export is named `creatureDisplayInfoExtraDBC` (copy-paste) | harmless, importers pick their own name |
| 14 | `services/dbc/helmetGeosetVisDataDBC.ts` | loads `DBFilesClient/helmetGeosetVisData.dbc` with a lower-case `h` | load fails on a case-sensitive file server (helmet geoset hiding) |
| 15 | `services/dbc/lightFloatBandDBC.ts` | `times` read from column `1 + j` - column 1 is `noOfEntries` | `times[0]` is the entry count, every time shifted by one (probably `2 + j`); nothing reads `times` today |
| 16 | `services/dbc/lightIntBandDBC.ts` | same as 15 | same as 15 |
| 17 | `services/dbc/lightParamsDBC.ts` | `lightSkyboxID` / `cloudTypeID` read with `readFloat32`; the 3.3.5 layout probably has no `cloudTypeID` column | ids are denormal floats and `glow` / the alpha fields are probably shifted by one column; nothing reads them today |
| 18 | `services/dbc/wmoAreaTableDBC.ts` | a copy of `lightDBC`: loads `Light.dbc` and builds light records | not WMOAreaTable data at all; nothing imports it |
| 19 | `services/map/adtLoader.ts` `MVER` handler | throws with undeclared `filename` | ReferenceError instead of the message; unreachable (handler only runs for MVER) |
| 20 | `services/map/adtLoader.ts` `MDDF` | `scale` read with `readInt32` over the uint16 scale + uint16 flags | a doodad with any MDDF flag set gets a huge scale (`adtM2Object` divides by 1024) |
| 21 | `services/map/blpLoader.ts` palette path | always reads 8-bit alpha after the indices, whatever `alphaChannelBitDepth` is | palettised BLPs without alpha come out fully transparent; 1- and 4-bit alpha misread |
| 22 | `services/map/skinLoader.ts` | rejection handler returns `errorObj` | a failed load resolves with the error as if it were the SkinFile (like 7) |
| 23 | `services/map/wmoLoader.ts` `MOGP` | the uint16 after `numBatchesC` is not read | `Indeces`, `Unk1`, `groupID`, `Unk2`, `Unk3` read 2 bytes early; none is used today |
| 24 | `services/map/wmoLoader.ts` `MOPY` | `chunk.length` - a chunk has no `length` | `n` is NaN; unused, harmless |
| 25 | `services/map/wmoLoader.ts` `MOVT`, `MONR`, `MOTV` | non-plain branch calls `readVector3f` / `readVector2f` with a count; they read one vector | would store a single vector; unreachable (wmoGeomCache always passes `loadPlainVertexes = true`) |
| 26 | `services/map/wmoLoader.ts` `wmoGroupLoader` | rejection handler returns `errorObj` | a failed group load resolves with the error (like 7) |
| 27 | `services/map/wmoLoader.ts` `wmoLoader` | rejection handler returns nothing | a failed root load resolves with `undefined`; `SceneApi.loadWmoMain` is typed `Promise<WmoFile \| undefined>` |

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
- DBC modules: the record is built with `{} as <Name>Record`; the cached table is `!`-asserted inside the
  `.then` (the closure loses the `=== null` narrowing). Tables built as `[]` are `Record[]`, tables built as
  `{}` are `{ [id: number]: Record }`.
- Parsers (`wdt`/`adt`/`wmo`): `.buffer as ArrayBuffer` on the name blocks - `readUint8Array` returns a
  `Uint8Array` over a sliced `ArrayBuffer`, typed `ArrayBufferLike`. `mmdxBuff!` / `mwmoBuff!` in `adtLoader`:
  declared with `var` inside an `if`, used in the loop after it.
- `adtLoader.ts`: `@ts-expect-error` on bug 19. `blpLoader.ts`: `resultBLPObject` is declared twice with `var`;
  both are typed `BlpFile`, the first through `as unknown as BlpFile`. `skinLoader.ts`: `modelHeader` is
  `Partial<SkinModelHeader>` (empty for WotLK), so `ofsViews!`.
- `wmoLoader.ts`: `@ts-expect-error` on bug 24 and the three lines of bug 25. `BaseGroupWMOLoader` /
  `BaseWMOLoader` are constructor functions; `new` goes through `as unknown as new () => SectionReaders`. The
  `MOGP` header-plus-subChunks object is `as unknown as ChunkHandlerWithSubChunks` - its `subChunks` member
  cannot satisfy that type's index signature. `wmoGroupLoader`'s first object is `as unknown as WmoGroupFile`
  (`colorVerticles2` / `textCoords2` start as `[]`).
- Entry point (group 10): `app_wow.ts` was rebuilt from `app_wowjs.js` at the user's request (run 3) -
  all comments kept, the extra `if (!container)` guard removed; `compare-emit.mjs app_wow.ts=app_wowjs.js`
  is SAME. `document.getElementById('viewer-container')!` - the JS assumes the container exists.
  `app_wowjs.js` was removed with `git rm` after the user confirmed (run 4); compare against history with
  `compare-emit.mjs app_wow.ts=app_wowjs.js`.

## Run log

| Run | Files | ~Lines | tsc | build | emit check |
| --- | --- | --- | --- | --- | --- |
| setup | toolchain | - | clean | green | - |
| 1 | groups 1-2: config, fileReadHelper, cache, quickSort, wowTextureRegions, mathHelper, global.d.ts, sceneApi.ts, fileLoaderStub, fileLoader-worker, fileLoader, dbcLoader, chunkedLoader, linedfileLoader | 2,430 | clean | green (dev + prod) | all SAME |
| 2 | JS bug list + `JS-BUG` markers in groups 1-2 (no code change) | - | clean | green | all SAME |
| 3 | app_wow.ts rebuilt from app_wowjs.js (entry point; app_wowjs.js not yet removed) | 360 | clean | green | SAME |
| 4 | removed app_wowjs.js (entry point now app_wow.ts only) | - | clean | green | SAME |
| 5 | group 3: services/dbc/* (18); group 4: wdtLoader, adtLoader, blpLoader, skinLoader, wmoLoader; parked types resolved in sceneApi.ts, mathHelper.ts | 2,610 | clean | green | all SAME |
