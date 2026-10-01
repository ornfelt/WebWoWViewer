// The object Scene.initSceneApi() (wowRenderJs/scene) builds and hands to the caches, managers and
// scene objects. Type-only: this module emits no JavaScript.

export interface SceneApiExtensions {
    getInstancingExt(): ANGLE_instanced_arrays | undefined;
    getAnisotropicExt(): EXT_texture_filter_anisotropic | undefined;
    getComprTextExt(): WEBGL_compressed_texture_s3tc | null;
    getVaoExt(): OES_vertex_array_object | undefined;
}

export interface SceneApiShaders {
    activateBoundingBoxShader(): void;
    deativateBoundingBoxShader(): void;
    activateFrustumBoxShader(): void;
    activateAdtShader(): void;
    activateDrawPortalShader(): void;
    activateTextureCompositionShader(texture: WebGLTexture): void;
    deactivateTextureCompositionShader(): void;
    activateWMOShader(): void;
    deactivateWMOShader(): void;

    /* M2 shader functions */
    activateM2ShaderAttribs(): void;
    deactivateM2ShaderAttribs(): void;
    activateM2Shader(): void;
    deactivateM2Shader(): void;
    activateM2InstancingShader(): void;
    deactivateM2InstancingShader(): void;
    getShaderUniforms(): { [name: string]: WebGLUniformLocation | null };
    getShaderAttributes(): { [name: string]: number };
}

export interface SceneApiDbc {
    getCharacterFacialHairStylesDBC(): any; // TS-PORT: parked until services/dbc/characterFacialHairStylesDBC.ts
    getCharHairGeosetsDBC(): any; // TS-PORT: parked until services/dbc/charHairGeosetsDBC.ts
    getCharSectionsDBC(): any; // TS-PORT: parked until services/dbc/charSectionsDBC.ts
    getCreatureDisplayInfoDBC(): any; // TS-PORT: parked until services/dbc/creatureDisplayInfoDBC.ts
    getCreatureDisplayInfoExtraDBC(): any; // TS-PORT: parked until services/dbc/creatureDisplayInfoExtraDBC.ts
    getCreatureModelDataDBC(): any; // TS-PORT: parked until services/dbc/creatureModelDataDBC.ts
    getGameObjectDisplayInfoDBC(): any; // TS-PORT: parked until services/dbc/gameObjectDisplayInfoDBC.ts
    getHelmetGeosetVisDataDBC(): any; // TS-PORT: parked until services/dbc/helmetGeosetVisDataDBC.ts
    getItemDisplayInfoDBC(): any; // TS-PORT: parked until services/dbc/itemDisplayInfoDBC.ts
    getItemDBC(): any; // TS-PORT: parked until services/dbc/itemDBC.ts

    /* Map and area data */
    getMapDBC(): any; // TS-PORT: parked until services/dbc/mapDBC.ts

    /* Lights information */
    getLightDBC(): any; // TS-PORT: parked until services/dbc/lightDBC.ts
    getLightFloatBandDBC(): any; // TS-PORT: parked until services/dbc/lightFloatBandDBC.ts
    getLightIntBandDBC(): any; // TS-PORT: parked until services/dbc/lightIntBandDBC.ts
    getLightParamsDBC(): any; // TS-PORT: parked until services/dbc/lightParamsDBC.ts
}

export interface SceneApiObjects {
    loadAdtM2Obj(doodad: any): any; // TS-PORT: parked until wowRenderJs/manager/sceneGraphManager.ts (addAdtM2Object)
    loadAdtWmo(wmoDef: any): any; // TS-PORT: parked until wowRenderJs/manager/sceneGraphManager.ts (addWmoObject)
    loadWmoM2Obj(doodadDef: any, placementMatrix: any, useLocalLightning: any): any; // TS-PORT: parked until wowRenderJs/manager/sceneGraphManager.ts (addWmoM2Object)
    loadWorldM2Obj(modelName: any, meshIds: any, replaceTextures: any): any; // TS-PORT: parked until wowRenderJs/manager/sceneGraphManager.ts (addWorldMDXObject)
    loadAdtChunk(fileName: string): any; // TS-PORT: parked until wowRenderJs/manager/sceneGraphManager.ts (addADTObject)
}

export interface SceneApiResources {
    loadTexture(fileName: string): Promise<any>; // TS-PORT: parked until wowRenderJs/texture/textureCache.ts exports Texture
    unLoadTexture(fileName: string): void;
    loadWmoMain(fileName: string): Promise<any>; // TS-PORT: parked until services/map/wmoLoader.ts exports WmoFile
    unloadWmoMain(fileName: string): void;
    loadWmoGeom(fileName: string): Promise<any>; // TS-PORT: parked until wowRenderJs/geometry/wmoGeomCache.ts exports WmoGeom
    unloadWmoGeom(fileName: string): void;
    loadM2Geom(fileName: string): Promise<any>; // TS-PORT: parked until wowRenderJs/geometry/m2GeomCache.ts exports M2Geom
    unloadM2Geom(fileName: string): void;
    loadSkinGeom(fileName: string): Promise<any>; // TS-PORT: parked until wowRenderJs/geometry/skinGeomCache.ts exports SkinGeom
    unloadSkinGeom(fileName: string): void;
    loadAdtGeom(fileName: string): Promise<any>; // TS-PORT: parked until wowRenderJs/geometry/adtGeomCache.ts exports ADTGeom
    unloadAdtGeom(fileName: string): void;
}

export interface SceneApi {
    drawCamera(): void;
    getGlContext(): WebGLRenderingContext;
    getCurrentWdt(): any; // TS-PORT: parked until services/map/wdtLoader.ts exports WdtFile
    getBlackPixelTexture(): WebGLTexture;
    setFogColor(color: number[]): void;
    getFogColor(): number[];
    getIsDebugCamera(): boolean;
    extensions: SceneApiExtensions;
    shaders: SceneApiShaders;
    dbc: SceneApiDbc;
    objects: SceneApiObjects;
    resources: SceneApiResources;
}
