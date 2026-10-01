// The object Scene.initSceneApi() (wowRenderJs/scene) builds and hands to the caches, managers and
// scene objects. Type-only: this module emits no JavaScript.

import type { CharacterFacialHairStylesRecord } from '../services/dbc/characterFacialHairStylesDBC';
import type { CharHairGeosetsRecord } from '../services/dbc/charHairGeosetsDBC';
import type { CharSectionsRecord } from '../services/dbc/charSectionsDBC';
import type { CreatureDisplayInfoRecord } from '../services/dbc/creatureDisplayInfoDBC';
import type { CreatureDisplayInfoExtraRecord } from '../services/dbc/creatureDisplayInfoExtraDBC';
import type { CreatureModelDataRecord } from '../services/dbc/creatureModelDataDBC';
import type { GameObjectDisplayInfoRecord } from '../services/dbc/gameObjectDisplayInfoDBC';
import type { HelmetGeosetVisDataRecord } from '../services/dbc/helmetGeosetVisDataDBC';
import type { ItemDisplayInfoRecord } from '../services/dbc/itemDisplayInfoDBC';
import type { ItemRecord } from '../services/dbc/itemDBC';
import type { MapRecord } from '../services/dbc/mapDBC';
import type { LightRecord } from '../services/dbc/lightDBC';
import type { LightFloatBandRecord } from '../services/dbc/lightFloatBandDBC';
import type { LightIntBandRecord } from '../services/dbc/lightIntBandDBC';
import type { LightParamsRecord } from '../services/dbc/lightParamsDBC';
import type { WdtFile } from '../services/map/wdtLoader';
import type { WmoFile } from '../services/map/wmoLoader';
import type { ADTGeom } from './geometry/adtGeomCache';
import type { M2Geom } from './geometry/m2GeomCache';
import type { SkinGeom } from './geometry/skinGeomCache';
import type { WmoGeom } from './geometry/wmoGeomCache';
import type { Texture } from './texture/textureCache';

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
    getCharacterFacialHairStylesDBC(): CharacterFacialHairStylesRecord[];
    getCharHairGeosetsDBC(): CharHairGeosetsRecord[];
    getCharSectionsDBC(): CharSectionsRecord[];
    getCreatureDisplayInfoDBC(): { [id: number]: CreatureDisplayInfoRecord };
    getCreatureDisplayInfoExtraDBC(): { [id: number]: CreatureDisplayInfoExtraRecord };
    getCreatureModelDataDBC(): { [id: number]: CreatureModelDataRecord };
    getGameObjectDisplayInfoDBC(): { [id: number]: GameObjectDisplayInfoRecord };
    getHelmetGeosetVisDataDBC(): { [id: number]: HelmetGeosetVisDataRecord };
    getItemDisplayInfoDBC(): { [id: number]: ItemDisplayInfoRecord };
    getItemDBC(): { [id: number]: ItemRecord };

    /* Map and area data */
    getMapDBC(): { [id: number]: MapRecord };

    /* Lights information */
    getLightDBC(): LightRecord[];
    getLightFloatBandDBC(): LightFloatBandRecord[];
    getLightIntBandDBC(): LightIntBandRecord[];
    getLightParamsDBC(): LightParamsRecord[];
}

export interface SceneApiObjects {
    loadAdtM2Obj(doodad: any): any; // TS-PORT: parked until wowRenderJs/manager/sceneGraphManager.ts (addAdtM2Object)
    loadAdtWmo(wmoDef: any): any; // TS-PORT: parked until wowRenderJs/manager/sceneGraphManager.ts (addWmoObject)
    loadWmoM2Obj(doodadDef: any, placementMatrix: any, useLocalLightning: any): any; // TS-PORT: parked until wowRenderJs/manager/sceneGraphManager.ts (addWmoM2Object)
    loadWorldM2Obj(modelName: any, meshIds: any, replaceTextures: any): any; // TS-PORT: parked until wowRenderJs/manager/sceneGraphManager.ts (addWorldMDXObject)
    loadAdtChunk(fileName: string): any; // TS-PORT: parked until wowRenderJs/manager/sceneGraphManager.ts (addADTObject)
}

export interface SceneApiResources {
    loadTexture(fileName: string): Promise<Texture>;
    unLoadTexture(fileName: string): void;
    /* wmoLoader resolves with undefined when the load fails */
    loadWmoMain(fileName: string): Promise<WmoFile | undefined>;
    unloadWmoMain(fileName: string): void;
    loadWmoGeom(fileName: string): Promise<WmoGeom>;
    unloadWmoGeom(fileName: string): void;
    loadM2Geom(fileName: string): Promise<M2Geom>;
    unloadM2Geom(fileName: string): void;
    loadSkinGeom(fileName: string): Promise<SkinGeom>;
    unloadSkinGeom(fileName: string): void;
    loadAdtGeom(fileName: string): Promise<ADTGeom>;
    unloadAdtGeom(fileName: string): void;
}

export interface SceneApi {
    drawCamera(): void;
    getGlContext(): WebGLRenderingContext;
    getCurrentWdt(): WdtFile;
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
