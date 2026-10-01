# WebWoWViewer TypeScript port status

Maintained by the `js-ts-webwowviewer` skill. A hint for the next run, not the source of truth -
the tree is. Re-derive with:
`find js/application/angular -name '*.js'` (unported) and
`grep -rn 'TS-PORT' js/application/angular` (partially typed / parked).

**Last run:** run 10 - scene (group 9), wowJsRenderDirective_noangular (group 10), last sweep, switch-over
**Next:** nothing left to port - the port is complete; `review js/application/angular` next, then the bug table below

## Porting order

- [x] 1. Foundation - Expansion, config, fileReadHelper, cache, quickSort, wowTextureRegions, mathHelper (+ global.d.ts, sceneApi.ts)
- [x] 2. File loading - fileLoaderStub, fileLoader-worker, fileLoader, dbcLoader, chunkedLoader, linedfileLoader
- [x] 3. DBC tables - services/dbc/*
- [x] 4. Format parsers - wdt, adt, blp, skin, wmo, mdx
- [x] 5. Caches - adt/skin/m2/wmo geometry caches, wmoMainCache, textureCache
- [x] 6. Math, camera, managers - portalCullingAlgo, bsp, BspTree, firstPersonCamera, characterComponents, textureCompositionManager, instanceManager, animationManager
- [x] 7. Scene objects - M2Object, adtM2Object, wmoM2Object, worldM2Object, adtObject, wmoObject
- [x] 8. World objects - worldObject, worldUnit, worldPlayer, worldGameObject, worldObjectManager
- [x] 9. Scene - sceneGraphManager, scene
- [x] 10. Entry and UI - wowJsRenderDirective_noangular, app_wowjs -> app_wow; last sweep; switch-over

## Parked types

(none open)

- Resolved in run 5: `mathHelper.ts` BSP types (`WmoBspNode`, `WmoGroupFile`), `SceneApi.getCurrentWdt()` (`WdtFile`),
  `SceneApi.resources.loadWmoMain()` (`WmoFile | undefined`), every `SceneApiDbc` getter (its `*Record` table).
- Resolved in run 6: the `SceneApiResources` loaders (`Texture`, `WmoGeom`, `M2Geom`, `SkinGeom`, `ADTGeom`).
- Resolved in run 7: `m2GeomCache.ts` `setupUniforms(lights)` (`M2LightDetails[]` from `animationManager.ts`).
- Resolved in run 8: `config.ts` `cameraM2` / `setCameraM2` and every `instanceManager.ts` list (`M2Object` union),
  `m2GeomCache.ts` `drawMesh(materialData)` (`M2MaterialData`), `portalCullingAlgo.ts` (`WmoObject`, `Set<M2Object>`,
  `Set<WmoM2Object>`), every `SceneApiObjects` member (the group 7 classes; `loadAdtChunk` returns `void` - read off
  `addADTObject` in the still-JavaScript sceneGraphManager).

## JavaScript bugs (ported as-is)

Bugs and suspicious code found in the original JavaScript while porting. The port never fixes them
(that would change the runtime); they are collected here to go through after the port. Each one is
also marked in the source with a `// JS-BUG:` comment on the line above - `grep -rn 'JS-BUG'
js/application/angular` lists them with current line numbers. Columns: where, what, effect.

| # | Where | What | Effect |
| --- | --- | --- | --- |
| 2 | `wowRenderJs/math/mathHelper.ts` `createPlaneFromVertexes` | uses undeclared `edgeDir` (local is `edgeDir1`); never returns the plane | ReferenceError if called; nothing calls it |
| 5 | `wowRenderJs/math/quickSort.ts` `multiQuickSort` | `var newRight = 1` instead of `left + 1` | wrong grouping when `left != 0`; harmless today (M2Object passes 0) |
| 6 | `wowRenderJs/cache.ts` `remove` | calls `destroy()` on every cached object | ADTGeom, M2Geom, SkinGeom and the parsed WMO file have no `destroy()` - TypeError when they are unloaded; no caller unloads them today |
| 9 | `services/linedfileLoader.ts` `readType` | duplicate `case "int32Array"` | second case unreachable; harmless |
| 10 | `services/linedfileLoader.ts` `readType`, `ablock_tbc` | `else if` reads `this.interpolation_type` / `this.global_sequence` (the LinedFile) instead of `result`'s | the whole-track range for TBC blocks without ranges is never added |
| 11 | `services/linedfileLoader.ts` `readType`, `layout` | `if (!layout instanceof Array)` | always false - the "layout is not array" check never fires |
| 12 | `services/dbc/charHairGeosetsDBC.ts` | default export is named `characterFacialHairStylesDBC` (copy-paste) | harmless, importers pick their own name |
| 13 | `services/dbc/creatureModelDataDBC.ts` | default export is named `creatureDisplayInfoExtraDBC` (copy-paste) | harmless, importers pick their own name |
| 15 | `services/dbc/lightFloatBandDBC.ts` | `times` read from column `1 + j` - column 1 is `noOfEntries` | `times[0]` is the entry count, every time shifted by one (probably `2 + j`); nothing reads `times` today |
| 16 | `services/dbc/lightIntBandDBC.ts` | same as 15 | same as 15 |
| 17 | `services/dbc/lightParamsDBC.ts` | `lightSkyboxID` / `cloudTypeID` read with `readFloat32`; the 3.3.5 layout probably has no `cloudTypeID` column | ids are denormal floats and `glow` / the alpha fields are probably shifted by one column; nothing reads them today |
| 18 | `services/dbc/wmoAreaTableDBC.ts` | a copy of `lightDBC`: loads `Light.dbc` and builds light records | not WMOAreaTable data at all; nothing imports it |
| 19 | `services/map/adtLoader.ts` `MVER` handler | throws with undeclared `filename` | ReferenceError instead of the message; unreachable (handler only runs for MVER) |
| 23 | `services/map/wmoLoader.ts` `MOGP` | the uint16 after `numBatchesC` is not read | `Indeces`, `Unk1`, `groupID`, `Unk2`, `Unk3` read 2 bytes early; none is used today |
| 24 | `services/map/wmoLoader.ts` `MOPY` | `chunk.length` - a chunk has no `length` | `n` is NaN; unused, harmless |
| 25 | `services/map/wmoLoader.ts` `MOVT`, `MONR`, `MOTV` | non-plain branch calls `readVector3f` / `readVector2f` with a count; they read one vector | would store a single vector; unreachable (wmoGeomCache always passes `loadPlainVertexes = true`) |
| 28 | `services/map/mdxLoader.ts` `mdx_ver274` | the layout has no cameras, attachments, attachLookups, animationLookup, keyBoneLookup, boneLookupTable or lights sections | `animationManager` reads `animationLookup` / `keyBoneLookup` unconditionally - TypeError for version-274 models |
| 30 | `services/map/mdxLoader.ts` `mdxChunked['12DM']` | `$.extend` - jQuery is neither imported nor loaded | ReferenceError; unreachable today (bug 32) |
| 31 | `services/map/mdxLoader.ts` `parseOldFile` | when `timeStart > timeEnd`, `timeEnd -= timeStartTemp` instead of `timeEnd = timeStartTemp` (the code's own TODO doubts it) | `timeEnd` becomes negative and `length` is `-timeStart` for those TBC / classic animations (probably meant a swap) |
| 32 | `services/map/mdxLoader.ts` `BaseMdxChunkedLoader.getHandler` | returns `handlerTable[...]`, which is not declared (probably meant `mdxChunked`) | ReferenceError on the first chunk; unreachable today (bug 33) |
| 33 | `services/map/mdxLoader.ts` default export (MD21 branch) | `chunkedLoader` is not imported | every MD21 (chunked, Legion+) model rejects with a ReferenceError |
| 35 | `wowRenderJs/geometry/adtGeomCache.ts` `ADTGeom` constructor | initialises `combinedVBO`, while `createVBO()` / `draw()` use `combinedVbo` | harmless, the field is never read |
| 37 | `wowRenderJs/geometry/skinGeomCache.ts` `fixShaderIdBasedOnLayer` | every write goes to `shader_id`, a new property, not `shaderId` | nothing else reads `shader_id`, so the layer-based shader fixes never reach the renderer (probably meant `shaderId`) |
| 38 | `wowRenderJs/geometry/skinGeomCache.ts` `fixShaderIdBasedOnLayer` | `renderFlag != 6` and `renderFlag != 1` compare the render flag object with a number | always true, so those branches ignore the second blend mode (probably meant `blend != 6` / `blend != 1`) |
| 39 | `wowRenderJs/geometry/skinGeomCache.ts` `SkinGeomCache` | `skinLoader(fileName, true)` - skinLoader takes only the path (copied from wmoGroupLoader) | harmless, the argument is ignored |
| 40 | `wowRenderJs/geometry/m2GeomCache.ts` `drawMesh` | `renderFlag.flags & 0x1 > 0` parses as `flags & (0x1 > 0)` | `flags & true` equals `flags & 1`, so it happens to work - harmless |
| 42 | `wowRenderJs/geometry/wmoGeomCache.ts` `draw` | calls `loadTextures()` without the `momt` it needs | TypeError on `momt[textIndex]`; unreachable today (WmoGroupObject calls `loadTextures(momt)` first) |
| 44 | `wowRenderJs/math/portalCullingAlgo.ts` `startTraversingFromInteriorWMO`, `startTraversingFromExterior` | `m2Object.checkFrustumCulling(cameraVec4, frustumPlanes, 6, false)` - the method takes three arguments | harmless, the `false` is ignored |
| 45 | `wowRenderJs/algorithms/characterComponents.ts` `generateGeosetFromItems` | static method reads `this.sceneApi` (undefined on the class) instead of its `sceneApi` parameter | TypeError if called; nothing calls it |
| 46 | `wowRenderJs/algorithms/characterComponents.ts` `generateGeosetFromItems` | chest branch sets `meshIds[8]` from `glovesItemRec` instead of `chestItemRec` | wrong / NaN geoset or TypeError; nothing calls it |
| 47 | `wowRenderJs/algorithms/characterComponents.ts` `generateGeosetFromItems` | boots branch sets `meshIds[5]` from `legsItemRec` instead of `bootsItemRec` | wrong / NaN geoset or TypeError; nothing calls it |
| 48 | `wowRenderJs/manager/instanceManager.ts` `updatePlacementVBO` | `if (this.previousObjectList) { newList }` - an expression statement with no effect | harmless leftover |
| 49 | `wowRenderJs/manager/animationManager.ts` `updateCameraSimplified` | reads `m2File.animations[this.nextSubAnimationIndex]` (still -1 after the pick) instead of the local `nextSubAnimationIndex`; the pick is never stored back | for a model whose main animation has `next_animation > -1`, `animations[-1].blend_time` throws a TypeError on every `M2Object.updateCameras()` (scene, when viewing through an M2 camera) |
| 51 | `wowRenderJs/manager/animationManager.ts` `getTimedValue` | `var maxTime = times[times_len-1]` overwrites the parameter (and the global sequence length) | the `animTime > last key && animTime <= maxTime` branch never runs, so past the last key the track holds the last value instead of the first |
| 52 | `wowRenderJs/manager/animationManager.ts` `calcBones` / `calcChildBones` | `calcBones` passes 5 arguments to the 8-parameter `calcChildBones`, which passes 8 to the 5-parameter `calcBoneMatrix` | the camera position lands in `blendAnimationIndex` and is forwarded into `calcBoneMatrix`'s `cameraPosInLocal` - works by accident |
| 53 | `wowRenderJs/manager/animationManager.ts` `calcSubMeshColors` | the blend branch evaluates the alpha track with `time` / `animationRecord` / `animationIndex` instead of the blend animation's | alpha is not blended between animations; unreachable today (sub-animation picking is disabled by `if (false)` in `update()`) |
| 56 | `wowRenderJs/objects/M2Object.ts` `load` | the `!m2Geom` branch calls `$log.log(... + modelName)` - neither is declared | ReferenceError; unreachable (`skinGeom.fixData(m2Geom.m2File)` above already throws for a missing `m2Geom`, inside the same `try`) |
| 57 | `wowRenderJs/objects/M2Object.ts` `getShaderNames` | the retry calls the three-parameter `getTabledShaderNames` with four arguments | `0x11` becomes `tex_unit_number2` and `textureUnitNum` is dropped; harmless - the `return 0` paths do not depend on that argument, so the retry always returns 0 again |
| 58 | `wowRenderJs/objects/M2Object.ts` `getShaderNames` | cases 1-3 of the `0x8000` branch store the `Combiners_*` name in `vertexShader` and `Diffuse_T1_Env` in `pixelShader` - probably swapped | `pixelShaderTable["Diffuse_T1_Env"]` is undefined, so those batches draw with pixel shader 0 (Combiners_Opaque) |
| 59 | `wowRenderJs/objects/M2Object.ts` `makeTextureArray` | `textureUnitNum <= textUnitLookup.length` instead of `<` | reads one past the end (undefined); harmless |
| 63 | `wowRenderJs/objects/M2Object.ts` `sortMaterials` | `isInsideAABB1 && isInsideAABB1` (and `!(...)`) - probably meant `isInsideAABB2` | harmless: after the returns above both flags are equal there |
| 65 | `wowRenderJs/objects/adtM2Object.ts` constructor | `super(sceneApi, localBB)` - the MDXObject constructor takes one argument, and no caller passes `localBB` | harmless |
| 66 | `wowRenderJs/objects/adtM2Object.ts` `draw` | `super.draw(this.placementMatrix, this.diffuseColor)` - the `drawTransparent` argument is missing | `placementMatrix` lands in `drawTransparent` and `diffuseColor` is used as the placement matrix; nothing calls `AdtM2Object.draw()` today (the scene graph uses `draw*Meshes`) |
| 67 | `wowRenderJs/objects/adtM2Object.ts` `drawInstanced*Meshes` | pass `0xffffffff` as a fourth argument to the three-parameter `drawInstanced` | harmless, ignored |
| 69 | `wowRenderJs/objects/wmoObject.ts` `isInsideInterior` | `this.currentGroupId = i` - `i` indexes `candidateGroups`, not the WMO groups (probably `candidateGroups[i].groupId`) | `drawBspVerticles()` and the BSP branch of `drawPortalBased()` pick the wrong group |
| 70 | `wowRenderJs/objects/wmoObject.ts` `checkFrustumCulling` | `m2Object.checkFrustumCulling(..., num_planes, false)` - four arguments (like 44) | harmless, the `false` is ignored |
| 72 | `wowRenderJs/objects/wmoObject.ts` `drawPortalBased` | BSP branch calls `this.currentNodeId.map(...)` (a number) and reads `wmoGroupArray[i].wmoGroupFile` (it is `wmoGeom.wmoGroupFile`) | TypeError when BSP rendering is on, the camera is outside and `currentGroupId == i`; the list it builds is never used |
| 73 | `wowRenderJs/objects/wmoObject.ts` `drawPortals` | reads `portalInfo.isFalse`, which nothing sets | every portal is drawn blue (debug drawing only) |
| 74 | `wowRenderJs/objects/wmoObject.ts` `drawPortalFrustumsBB` | `portalViewFrustums` is never assigned on the WmoObject (portalCullingAlgo keeps its own), and the loop tests `wmoGroupArray[i].wmoGroupFile`, which does not exist | the function always returns at once - the portal frustum debug drawing never draws |
| 75 | `wowRenderJs/objects/wmoObject.ts` `drawBspVerticles` | reads `wmoGroupFile`, `combinedVBO` and `mobrVBO` from the WmoGroupObject; they are members of its `wmoGeom` | TypeError whenever BSP rendering is on and the camera is inside an interior group (`currentGroupId >= 0`) |
| 76 | `wowRenderJs/objects/wmoObject.ts` `WmoGroupObject.updateWorldGroupBBWithM2` | `mogp.flags` - the field is `Flags` | `dontUseLocalLighting` is always false; nothing calls this method today |
| 80 | `wowRenderJs/objects/worldObjects/worldUnit.ts` `update` | three `setAnimationId(id, false)` calls - `M2Object.setAnimationId` takes one argument | harmless, the `false` is ignored |
| 81 | `wowRenderJs/objects/worldObjects/worldUnit.ts` `update` | the interpolated position `result` starts as `pointsTotalPath[0]` (a path length) instead of a point (probably `pointsArray[0]`) | `setPosition(number)` if no path segment matches; unreachable in practice - the time check before it guarantees a match |
| 83 | `wowRenderJs/objects/worldObjects/worldUnit.ts` `setDisplayId` | `this.modelChanged = value` - stores the display id, the sibling setters store `true` | harmless: any non-zero id is truthy, and `complete()` loads `nativeDisplayId` either way |
| 85 | `wowRenderJs/manager/worldObjectManager.ts` `processPacket` | the "Main hand" block reads `PLAYER_VISIBLE_ITEM_15_0`, the back slot again (probably `16_0`) | `mainHandItemId` gets the back item; nothing reads it today |
| 86 | `wowRenderJs/manager/worldObjectManager.ts` `processPacket` | the "Off hand" block calls `setMainHandItem` (probably `setOffHandItem`, and slot `17_0`) | `offHandItemId` is never set; nothing reads it today |
| 87 | `wowRenderJs/manager/sceneGraphManager.ts` `addAdtM2Object` | `adtM2.load(doodad, false)` - `AdtM2Object.load` takes one argument | harmless, the `false` is ignored |
| 88 | `wowRenderJs/manager/sceneGraphManager.ts` `addM2ObjectToInstanceManager` | passes `newBucket` to the one-parameter `InstanceManager.addMDXObject`; no caller passes `newBucket` | harmless |
| 89 | `wowRenderJs/manager/sceneGraphManager.ts` `checkCulling` | `points = mathHelper.getFrustumPoints(...)` is computed and never used | harmless, wasted work per frame |
| 90 | `wowRenderJs/manager/sceneGraphManager.ts` `checkCulling` | `if (!m2Object) return;` in the world-M2 loop - `return`, not `continue` | would skip the rest of `checkCulling` and keep last frame's rendered lists; unreachable (`worldM2Objects` has no holes) |
| 92 | `wowRenderJs/manager/sceneGraphManager.ts` `update` | `wmoObject.update(deltaTime)` - `WmoObject.update` takes no arguments | harmless, ignored |
| 93 | `wowRenderJs/manager/sceneGraphManager.ts` `update` | reads `.groupId` / `.nodeId` from `isInsideInterior()`, which returns `-1` (a number) when the camera is outside the WMO's box | works by accident (`undefined >= 0` is false), but the returned `interiorGroupNum` is `undefined` rather than -1 when the last WMO's box does not contain the camera; the UI shows `\|\| 0` |
| 94 | `wowRenderJs/manager/sceneGraphManager.ts` `drawM2s` | `drawBB()` without a color - `WorldMDXObject` does not override `MDXObject.drawBB(color)` like the ADT / WMO doodads do | world M2 boxes call `uniform3fv(uColor, new Float32Array(undefined))` - probably a GL INVALID_VALUE, the box keeps the previous color (debug drawing only) |
| 95 | `wowRenderJs/scene.ts` `initGlContext` | `WebGLDebugUtils.makeDebugContext(...)` - `js/lib/webgl-debug.js` is neither loaded by `index.html` nor imported | the ReferenceError is swallowed by the empty `catch`, so `gl` stays the plain context and `throwOnGLError` / `validateNoneOfTheArgsAreUndefined` are dead code - harmless |
| 96 | `wowRenderJs/scene.ts` `initSceneApi` | `shaders.deativateBoundingBoxShader` calls `self.deactivateBoundingBoxShader()`, which Scene does not have | would throw a TypeError; nothing calls it - harmless today |
| 97 | `wowRenderJs/scene.ts` `initSceneApi` | `resources.unloadWmoMain` calls `self.wmoMainCache.unloadWmoMain()` - the method is `unLoadWmoMain` | would throw a TypeError; nothing calls it - harmless today |
| 98 | `wowRenderJs/scene.ts` `draw` | the M2-camera branch runs `vec4.transformMat4` on `currentPosition` / `currentTarget`, which `calcCameras` builds with 3 components for an unanimated track | `w` is `undefined`, so the camera position becomes NaN (probably needs `w = 1`); the branch is unreachable today because nothing sets `config.setCameraM2` (bug 100) |
| 100 | `directives/wowJsRenderDirective_noangular.ts` `initViewer` | `config.setCameraM2(m2Object)` - `m2Object` is not declared (its `loadM2File` block is commented out) | an M2 preset with `cameraIndex` (the commented-out "Vanilla Opening screen") throws a ReferenceError there, before the fog settings and the UI wiring; the active AV preset never reaches it |

## Runtime notes

Places where typing needed an assertion, a widened type, `@ts-expect-error` or a commented `any`
(bugs are in the table above, not repeated here).

- `mathHelper.ts`: `@ts-expect-error` on the three `edgeDir` lines of bug 2.
- `linedfileLoader.ts`: `@ts-expect-error` on bugs 10 and 11; `result.ranges!.push` after bug 10 is
  unreachable in practice. `LinedFileObj` is a constructor function; `new` goes through
  `LinedFileObj as unknown as new () => LinedFile`. Parsed values are `SectionValue` / `ParsedObject`
  (`{ [field: string]: any }`, schema-driven); parsers assert their file interfaces on the result.
- `chunkedLoader.ts`: `processFile` calls `processChunk` with a third argument it ignores - the `ChunkedFile`
  interface declares it optional. Chunk handlers take `resultObj: ChunkResultObj` (= `any`, the object differs
  per parser and chunk).
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
- `mdxLoader.ts`: `@ts-expect-error` on bugs 30, 32 and 33. The parse is definition-driven, so `M2File` lists the
  union of the four layouts with the layout-specific members optional, and `M2Track<V>` is the shared shape of
  the three ablock variants. `anim.timeStart!` / `anim.timeEnd!` in `parseOldFile` - the `hasOwnProperty` checks
  do not narrow. `mdxChunked` is typed but never used (bug 32).
- `adtGeomCache.ts`: `mcnkObj.alphaArray!` - the JS assumes MCAL is present whenever the chunk has layers;
  `textureName!` - added by `addTextureNames()` after the parse.
- `textureCache.ts`: `textureGPUFormat!` - guarded by `canUseCompressed`, which TS does not narrow through.
- `skinGeomCache.ts`: `@ts-expect-error` on both lines of bug 38 and on bug 39. `fixShaderIdBasedOnLayer` asserts
  the header to `SkinHeader & { texs: SkinGeomTex[] }` for `shader_id` (bug 37); `lowerLayerSkin!` - set by the
  layer-0 texture before it is read; `blendOverrides!` - read only in the WotLK blend-override branch.
- `m2GeomCache.ts`: `@ts-expect-error` on bug 40. Matrix parameters are gl-matrix `mat4` and go to
  `uniformMatrix4fv` as `Float32List` (gl-matrix's `mat4` includes a plain iterable). `instExt!` - only used when
  `instanceCount != -1`.
- `wmoGeomCache.ts`: `@ts-expect-error` on bug 42. `appendBuffer` takes a local `VertexBuffer` type
  (float arrays and the MOCV byte arrays).

- `bsp.ts` and `BspTree.ts` stay scripts (no import or export, like the JS). `bsp.ts` names `AABB` through an
  inline `import('./mathHelper').AABB` type - a top-level `import type` would make the emit gain `export {}`.
- `characterComponents.ts`: `@ts-expect-error` on bug 45.
- `textureCompositionManager.ts`: `region.x!` / `.y!` / `.w!` / `.h!` - region slots are `Partial` (Accessory and
  Unused are `{}`), and `update()` only draws slots that have a region.
- `animationManager.ts`: track values are the `M2TrackValue` union; `convertValueTypeToVec4` asserts the value per
  `type` (`as Vector3f` / `as Vector4f` / `as number[]` / `as number`). `!` on `probability`, `timeStart` / `timeEnd`
  (optional in `M2Animation`), `nAnimationLookup` / `animationLookup` / `keyBoneLookup` (bug 28),
  `subAnimRecord!` (a `var` assigned in a branch), `value1!` / `value2!` (convert returns `undefined` only for an
  unknown type), and `interpolateValues(...)!` in `calcSubMeshColors` (interpolation type 1 always returns);
  `unk_ambient` is declared `vec4 | number | null | undefined` and
  stored `as number | undefined`. `calcChildBones` is typed as it is really called (`blendAnimationIndex: ReadonlyVec4`,
  the last three optional `unknown`), with `@ts-expect-error` on the 8-argument `calcBoneMatrix` call (bug 52).
  `isAnimated`, `leftHandClosed`, `rightHandClosed`, `nextSubAnimationActive` are `| undefined` - not set by the
  constructor.

- `M2Object.ts`: `MDXObject` is an `abstract class` (erased) with abstract declarations for the members only the
  subclasses implement (`getInvertModelMatrix`, `getDiffuseColor`, `setIsRendered`, `draw*Meshes`, ...). AdtM2Object
  and WmoM2Object override `load()` and `checkAgainstDepthBuffer()` with other signatures - `@ts-expect-error` on those
  four declarations - so they are not assignable to `MDXObject`; "any M2 in the scene" is the exported union
  `M2Object = AdtM2Object | WmoM2Object | WorldMDXObject` (config, instanceManager, portalCullingAlgo, wmoObject).
  `@ts-expect-error` on bugs 56, 57 and the boolean XOR
  (`isTransparent ^ !drawTransparent`) in `drawMeshes`. Assertions: `{...} as M2MaterialData`, `{} as M2CameraDetails` /
  `M2LightDetails`, `color as Float32List` (subMeshColors are plain arrays), `aabb as unknown as AABB` (`SubMeshBB` is
  `number[][]`), `placementMatrix as Float32List` for `uniformMatrix4fv`. `!` on `localBB`, `aabb`, `subMeshColors`
  (set by load()), the `textureUnitNTexName` passed to `loadTexture` (guarded by the `if`), `mdxTextureDefinition`
  (a `var` from the `op_count > 0` branch), `texUnit2TexIndex! >= 0` (the JS relies on `undefined >= 0` being false),
  `result!` in the sort comparator, and `(shaderNames as M2ShaderNames).pixel!` - `shaderNames` may be `0` and `pixel`
  undefined, which indexes `pixelShaderTable` with undefined (uniform 0).
- `m2GeomCache.ts` `drawMesh`: `meshColor` widened from `Float32Array` to `Float32List` (it receives the plain-array
  sub-mesh colors). `mathHelper.ts` `checkFrustum`: `points` widened to `| null` (the WMO callers pass `null`).
- `instanceManager.ts`: `lastDrawn!` and `placementVBO!` - the JS assumes a rendered object and a prior
  `updatePlacementVBO()`.
- `adtM2Object.ts`: `@ts-expect-error` on bugs 65, 66 and both lines of 67. `worldM2Object.ts`: `attachLookups!` /
  `attachments!` (absent only for the 274 layout, bug 28), `mdxTextureIndex2!` / `3!` (an undefined index reads undefined).
- `adtObject.ts`: `m2Array!` / `wmoArray!` - filled through `self`, which TS does not narrow.
- `wmoObject.ts`: fields assigned through `self` in the constructor are declared with `!` (also in `wmoM2Object.ts`).
  `portalVerticles!` / `portalInfos!` / `portalRelations!` here and in
  `portalCullingAlgo.ts` - only used for WMOs with portals. `modf.bb2!` (set together with `bb1`), `slice(0) as [vec4,
  vec4]`, `wmoDoodads[i]!` and `aabb!` (in `updateWorldGroupBBWithM2`). `@ts-expect-error` on bugs 70, 72, 73, 74, 75
  (three lines) and 76; `portalCullingAlgo.ts` now also needs it on both lines of bug 44.

- `worldObject.ts`: `scale` is `number | undefined` (set only by `setScale()`); the `this.scale! > 0.0001` tests in
  `worldUnit.ts` / `worldGameObject.ts` rely on `undefined > x` being false. `pos` / `f` are declared with `!`.
- `worldUnit.ts`: `createMaterialFromOwnItem` has an overload signature `(replaceTextures?, meshIds?): boolean | void` above the
  empty implementation (erased), so WorldPlayer's two-parameter override and the call in `createModelFromDisplayId` type-check.
  `this.objectModel!` where the JS guards it through the `objectModelIsLoaded` `var` (TS does not narrow through it).
  `result: number | vec3` on both declarations and `setPosition(result as vec3)` (bug 81). `@ts-expect-error` on the
  three calls of bug 80. Fields set after construction (movement, packet data) are declared with `!`.
- `worldObjectManager.ts`: `processPacket(packet: any)` - the mock packet JSON is walked field by field. Local `ItemToWear`
  interface for the virtual item slots. `(newWorldUnit as WorldPlayer)` in the `obj_type == 4` block (TS does not narrow on
  `obj_type`), `(this.objectMap[guid] as WorldUnit)` in `SMSG_MONSTER_MOVE` - the JS assumes the guid is a unit (a game object
  would throw). `vectorArray: number[]` on all three declarations in `update()` (`new Array()` and a literal).
- `sceneGraphManager.ts`: `@ts-expect-error` on bugs 87, 88, 92, 93 (both lines) and 94. `this.currentWMO!` in `checkCulling`
  (set whenever `currentInteriorGroup >= 0`). `skyDom` is `{ draw(): void } | null` (nothing assigns it). `var i: number` for
  the bare `var i;` in `update()`; `new Set<T>()` type arguments (erased). `m2Objects` is `(AdtM2Object | WmoM2Object)[]`,
  `m2RenderedThisFrame` the `M2Object` union.

- `scene.ts`: `WebGLDebugUtils` is a file-local `declare const` (bug 95). `gl` in `initGlContext` is `WebGLRenderingContext | null |
  undefined` (declared inside the `try`), the `experimental-webgl` context is asserted `as WebGLRenderingContext | null`, and
  `this.gl = gl!` - the JS stores `null` when WebGL is unavailable and nothing checks it. `createShader(...)!`, `el.textContent!`,
  `{} as ShaderProgram` in `compileShader`. `@ts-expect-error` on bugs 96 and 97. `getCurrentWdt` returns `self.currentWdt!` - ADTs
  load only after `loadMap()` has set the WDT; `wdtFile.modfChunk!` in `loadMap` (present whenever `isWMOMap`). `cameraVecs` is
  `CameraVecs | M2CameraVecs` and returned as `cameraVecs!` (one of the two branches always assigns it). Fields assigned through
  `self` and the lazily set ones (shaders, caches, GL objects, DBC tables) are declared with `!`. `SceneApi.getIsDebugCamera()`
  now returns `boolean | undefined` to match the literal; every other `SceneApi` member matched `initSceneApi()`.
- `wowJsRenderDirective_noangular.ts`: local `PrefixedMouseEvent` / `PrefixedCanvas` / `PrefixedDocument` interfaces for the
  vendor-prefixed pointer-lock members, `MapParams` with every preset field optional (so `mapParams.x!` etc.), and
  `NumberTextElement` for the two spans the render loop assigns numbers to. `querySelector<T>(...)!` for the UI elements,
  `sceneObj.draw(timeDelta)!` (`draw()` returns nothing only before the shaders are loaded, which the constructor does),
  `(cameraVecs.cameraVec3 as number[])` (plain arrays at runtime). `@ts-expect-error` on bug 100.
- Switch-over (run 10): `allowJs` / `checkJs` removed from `tsconfig.json`; `extensionAlias` removed from `webpack.config.js`
  (no `.js` specifier is left outside comments). The three remaining `any`s are commented and genuinely dynamic:
  `ChunkResultObj` (chunkedLoader), `ParsedObject` (linedfileLoader), `processPacket(packet)` (worldObjectManager).
- After the port (user request): the unused AngularJS directives `wowJsRenderDirective.js` and `fileDownload.js` were deleted, and
  `package.json` gained `check:ts-only` (fails if any `.js` file exists under `js/application`), run with `tsc --noEmit` by the
  `prebuild`, `prebuild:prod`, `prestart` and `preserver` hooks.

## Run log

| Run | Files | ~Lines | tsc | build | emit check |
| --- | --- | --- | --- | --- | --- |
| setup | toolchain | - | clean | green | - |
| 1 | groups 1-2: config, fileReadHelper, cache, quickSort, wowTextureRegions, mathHelper, global.d.ts, sceneApi.ts, fileLoaderStub, fileLoader-worker, fileLoader, dbcLoader, chunkedLoader, linedfileLoader | 2,430 | clean | green (dev + prod) | all SAME |
| 2 | JS bug list + `JS-BUG` markers in groups 1-2 (no code change) | - | clean | green | all SAME |
| 3 | app_wow.ts rebuilt from app_wowjs.js (entry point; app_wowjs.js not yet removed) | 360 | clean | green | SAME |
| 4 | removed app_wowjs.js (entry point now app_wow.ts only) | - | clean | green | SAME |
| 5 | group 3: services/dbc/* (18); group 4: wdtLoader, adtLoader, blpLoader, skinLoader, wmoLoader; parked types resolved in sceneApi.ts, mathHelper.ts | 2,610 | clean | green | all SAME |
| 6 | group 4: mdxLoader; group 5: adtGeomCache, skinGeomCache, m2GeomCache, wmoGeomCache, wmoMainCache, textureCache; parked loaders resolved in sceneApi.ts | 3,790 | clean | green | all SAME |
| 7 | group 6: portalCullingAlgo, bsp, BspTree, firstPersonCamera, characterComponents, textureCompositionManager, instanceManager, animationManager; parked `lights` resolved in m2GeomCache.ts | 1,900 | clean | green | all SAME |
| 8 | group 7: M2Object, adtM2Object, wmoM2Object, worldM2Object, adtObject, wmoObject; every parked type resolved (config, instanceManager, m2GeomCache, portalCullingAlgo, sceneApi) | 2,620 | clean | green | all SAME |
| 9 | group 8: worldObject, worldUnit, worldPlayer, worldGameObject, worldObjectManager; group 9: sceneGraphManager | 2,270 | clean | green | all SAME |
| 10 | group 9: scene; group 10: wowJsRenderDirective_noangular; last sweep; switch-over (tsconfig, webpack) | 2,410 | clean | green (dev + prod) | all SAME (--all) |
