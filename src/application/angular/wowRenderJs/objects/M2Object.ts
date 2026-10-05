import config from './../../services/config';
import AnimationManager from './../manager/animationManager'
import type { M2CameraDetails, M2LightDetails } from './../manager/animationManager';
import type InstanceManager from './../manager/instanceManager';
import mathHelper from './../math/mathHelper';
import type { AABB } from './../math/mathHelper';
import QuickSort from './../math/quickSort';
import {vec4, mat4, vec3, quat} from 'gl-matrix';
import type {ReadonlyMat4, ReadonlyVec4} from 'gl-matrix';
import Expansion from '../../Expansion';
import type { Vector3f } from '../../services/fileReadHelper';
import type { M2File } from '../../services/map/mdxLoader';
import type { SkinHeader, SkinTex } from '../../services/map/skinLoader';
import type { M2Geom } from '../geometry/m2GeomCache';
import type { SkinGeom } from '../geometry/skinGeomCache';
import type { Texture } from '../texture/textureCache';
import type { SceneApi } from '../sceneApi';
import type AdtM2Object from './adtM2Object';
import type WmoM2Object from './wmoM2Object';
import type WorldMDXObject from './worldM2Object';
import ParticleEmitter, { ParticleFlags } from '../particles/particleEmitter';
import RibbonEmitter from '../particles/ribbonEmitter';
import type ParticleRenderer from '../particles/particleRenderer';

/* What getShaderNames() returns for a skin batch; a name stays undefined when the table has no entry for it */
export interface M2ShaderNames {
    vertex: string | undefined;
    pixel: string | undefined;
}

/* A texture bound to a material: a loaded Texture, or the composed texture overrideModelTexture() puts in */
export type M2MaterialTexture = Pick<Texture, 'texture'>;

/* One entry of materialArray, built by makeTextureArray() and drawn by M2Geom.drawMesh() */
export interface M2MaterialData {
    isRendered: boolean;
    isTransparent: boolean;
    isEnviromentMapping: boolean;
    meshIndex: number;
    textureTexUnit1: null;
    textureTexUnit2: null;
    textureTexUnit3: null;

    layer: number;
    /* 0 when getShaderNames() finds no shader pair */
    shaderNames: M2ShaderNames | 0;
    renderFlag: number;
    renderBlending: number;

    /* op_count > 0 */
    texUnit1TexIndex: number;
    mdxTextureIndex1: number;
    xWrapTex1: boolean;
    yWrapTex1: boolean;
    textureUnit1TexName: string | undefined;
    /* op_count > 1 */
    mdxTextureIndex2?: number;
    xWrapTex2?: boolean;
    yWrapTex2?: boolean;
    texUnit2TexIndex?: number;
    textureUnit2TexName?: string;
    /* op_count > 2 */
    mdxTextureIndex3?: number;
    xWrapTex3?: boolean;
    yWrapTex3?: boolean;
    texUnit3TexIndex?: number;
    textureUnit3TexName?: string;

    /* set once the texture has loaded (or by overrideModelTexture) */
    texUnit1Texture?: M2MaterialTexture;
    texUnit2Texture?: M2MaterialTexture;
    texUnit3Texture?: M2MaterialTexture;
}

/* Any M2 object in the scene. AdtM2Object and WmoM2Object override load() and checkAgainstDepthBuffer() with
   other signatures, so they are not assignable to MDXObject itself - code that holds "some M2 object" uses this */
export type M2Object = AdtM2Object | WmoM2Object | WorldMDXObject;

/* The depth test checkAgainstDepthBuffer() hands the projected box to */
export type CheckDepthFunc = (min_x: number, max_x: number, min_y: number, max_y: number, depth: number) => boolean;

const pixelShaderTable: { [name: string]: number } = {
    "Combiners_Opaque" : 0,
    "Combiners_Decal" : 1,
    "Combiners_Add" : 2,
    "Combiners_Mod2x" : 3,
    "Combiners_Fade" : 4,
    "Combiners_Mod" : 5,
    "Combiners_Opaque_Opaque" : 6,
    "Combiners_Opaque_Add" : 7,
    "Combiners_Opaque_Mod2x" : 8,
    "Combiners_Opaque_Mod2xNA" : 9,
    "Combiners_Opaque_AddNA" : 10,
    "Combiners_Opaque_Mod" : 11,
    "Combiners_Mod_Opaque" : 12,
    "Combiners_Mod_Add" : 13,
    "Combiners_Mod_Mod2x" : 14,
    "Combiners_Mod_Mod2xNA" : 15,
    "Combiners_Mod_AddNA" : 16,
    "Combiners_Mod_Mod" : 17,
    "Combiners_Add_Mod" : 18,
    "Combiners_Mod2x_Mod2x" : 19
}

abstract class MDXObject {
    sceneApi: SceneApi;
    currentAnimationStart: number;
    currentAnimation: number;
    currentTime: number;
    isAnimated: boolean;
    subMeshColors: vec4[] | null;
    hasBillboarded: boolean;
    rightHandClosed: boolean;
    leftHandClosed: boolean;
    localBB: [Vector3f, Vector3f] | null;
    loaded: boolean;
    loading: boolean;

    /* set by setLoadParams() */
    fileIdent!: string;
    modelName!: string;
    skinNum!: number;
    /* null or left out when the whole model is drawn with its own textures */
    meshIds: number[] | null | undefined;
    replaceTextures: string[] | null | undefined;

    /* set by load() */
    m2Geom!: M2Geom;
    skinGeom!: SkinGeom;
    animationManager!: AnimationManager;
    materialArray!: M2MaterialData[];
    textAnimMatrices!: mat4[];
    cameras!: M2CameraDetails[];
    lights!: M2LightDetails[];
    bonesMatrices!: mat4[];
    transparencies!: number[];
    diameter!: number;
    /* WorldMDXObject starts it as null */
    aabb!: [vec4, vec4] | null;
    /* set by update() */
    combinedBoneMatrix!: Float32Array;

    /* kept until the animation manager exists */
    startAnimationId: number | undefined;
    startLeftHandClosed: boolean | undefined;
    startRightHandClosed: boolean | undefined;

    isCandidateForDrawing!: boolean;
    /* set by the subclass constructors and setIsRendered() */
    isRendered!: boolean;
    currentDistance!: number;
    /* set by the subclasses' createPlacementMatrix() */
    placementMatrix!: mat4;

    /* set by the scene graph manager (sceneGraphManager) */
    sceneNumber!: number;
    instanceManager: InstanceManager | undefined;

    /* the model's particle systems and ribbons (tbc's Model.particleSystems / ribbons), one set per instance
     * as they follow this instance's bones; null until loaded */
    particleEmitters: ParticleEmitter[] | null;
    ribbonEmitters: RibbonEmitter[] | null;
    /* the ParticleRenderer frame this object last submitted its emitters in */
    particleSubmitFrame: number;

    /* implemented by every subclass */
    abstract getInvertModelMatrix(): mat4;
    abstract getDiffuseColor(): Float32Array;
    abstract setIsRendered(value: boolean): void;
    abstract getCurrentDistance(): number;
    abstract getDiameter(): number;
    abstract drawTransparentMeshes(): void;
    abstract drawNonTransparentMeshes(): void;
    abstract drawInstancedNonTransparentMeshes(instanceCount: number, placementVBO: WebGLBuffer): void;
    abstract drawInstancedTransparentMeshes(instanceCount: number, placementVBO: WebGLBuffer): void;

    constructor(sceneApi: SceneApi){
        this.sceneApi = sceneApi;
        this.currentAnimationStart = 0;
        this.currentAnimation = 0;
        this.currentTime = 0;
        this.isAnimated = false;
        this.subMeshColors = null;
        this.hasBillboarded = false;
        this.rightHandClosed = false;
        this.leftHandClosed = false;
        this.localBB = null;

        this.loaded = false;
        this.loading = false;

        this.particleEmitters = null;
        this.ribbonEmitters = null;
        this.particleSubmitFrame = -1;
    }

    getFileNameIdent(){
        return this.fileIdent;
    }
    getHasBillboarded() {
        return this.hasBillboarded;
    }
    getIsInstancable() {
        if (!this.animationManager) return false;

        return !(this.animationManager.firstCalc || this.animationManager.isAnimated);
    }
    setLeftHandClosed(value: boolean) {
        if (!this.animationManager) {
            this.startLeftHandClosed = value;
            return;
        }

        this.animationManager.setLeftHandClosed(value);
    }
    setRightHandClosed(value: boolean) {
        if (!this.animationManager) {
            this.startRightHandClosed = value;
            return;
        }

        this.animationManager.setRightHandClosed(value);
    }
    resetCandidateForDrawing(){
        this.isCandidateForDrawing = false;
        this.isRendered = false
    }

    createAABB(){
        var bb = this.getBoundingBox();
        if (bb) {
            var a_ab = vec4.fromValues(bb.ab.x,bb.ab.y,bb.ab.z,1);
            var a_cd = vec4.fromValues(bb.cd.x,bb.cd.y,bb.cd.z,1);

            var worldAABB = mathHelper.transformAABBWithMat4(this.placementMatrix, [a_ab, a_cd]);

            this.diameter = vec3.distance(worldAABB[0],worldAABB[1]);
            this.aabb = worldAABB;
        }
    }
    calcDistance (position: ReadonlyVec4) {
        if (this.loaded && this.getIsRendered()) {
            this.currentDistance = mathHelper.distanceFromAABBToPoint(this.aabb!, position);
        }
    }
    getIsRendered () {
        return this.isRendered;
    }

    setLoadParams (modelName: string, skinNum: number, meshIds?: number[] | null, replaceTextures?: string[] | null) {
        this.modelName = modelName;

        // HEHE
        //this.modelName = "spells\\fireball_missile_low.m2";
        //this.modelName = "spells\\blizzard_impact_base.m2";
        //const randomNumber = Math.random();

        //if (randomNumber <= 0.5) {
        //    this.modelName = "spells\\blizzard_spawn.m2";
        //    this.modelName = "chainlightning_impact_chest.m2";
        //}

        //this.modelName = "spells\\pyroblast_missile.m2";
        
        // Test models
        //this.modelName = "creature\\ragnaros\\ragnaros.m2";
        //this.modelName = "creature\\druidbear\\druidbear.m2";
        //this.modelName = "creature\\dragon\\dragononyxia.m2";
        //this.modelName = "creature\\drake\\drake.mdx";
        //this.modelName = "creature\\SkeletonNaked\\SkeletonNaked.mdx";
        //this.modelName = "creature\\Cow\\cow.mdx";
        //this.modelName = "creature\\panda\\pandacub.mdx";
        //this.modelName = "creature\\raptor\\raptor.m2";

        // Static
        //this.modelName = "World\\Dungeon\\Cave\\Passivedoodads\\Icicles\\Caveicicle1.Mdl";
        //this.modelName = "World\\Khazmodan\\Ironforge\\Passivedoodads\\Trees\\Wintertree02.Mdx";

        //console.log("LOADING M2: " + this.modelName);
        this.skinNum = skinNum;
        this.meshIds = meshIds;
        this.replaceTextures = replaceTextures;

        var nameTemplate = modelName.split('.')[0];
        var modelFileName = nameTemplate + '.m2';
        var skinFileName = nameTemplate + '00.skin';
        modelFileName = modelFileName.toLowerCase();
        skinFileName = skinFileName.toLowerCase();

        this.fileIdent = modelFileName + " " + skinFileName;
        this.fileIdent = this.fileIdent.replace(/\0/g, '');
    }

    load() {
        var self = this;
        // HEHE: to test without models (for tbc and classic debugging)
        //return true;

      try {
          var nameTemplate = this.modelName.split('.')[0];
          var modelFileName = nameTemplate + '.m2';

          var skinFileName = modelFileName;
          if (window.selectedExpansion === Expansion.WOTLK) {
              skinFileName = nameTemplate + '00.skin';
          }

          var m2Promise = this.sceneApi.resources.loadM2Geom(modelFileName);
          var skinPromise = this.sceneApi.resources.loadSkinGeom(skinFileName);

          return Promise.all([m2Promise, skinPromise]).then((result) => {
              try {
                  var m2Geom = result[0];
                  var skinGeom = result[1];

                  self.m2Geom = m2Geom;
                  self.skinGeom = skinGeom;

                  skinGeom.fixData(m2Geom.m2File);
                  skinGeom.calcBBForSkinSections(m2Geom.m2File);

                  if (!m2Geom) {
                      // JS-BUG: $log and modelName are not declared - ReferenceError; unreachable (skinGeom.fixData(m2Geom.m2File) above already throws for a missing m2Geom)
                      // @ts-expect-error $log and modelName are not declared; ported as-is
                      $log.log("m2 file failed to load : " + modelName);
                  } else {
                      var gl = self.sceneApi.getGlContext();
                      m2Geom.createVAO(skinGeom);
                      self.hasBillboarded = self.checkIfHasBillboarded();

                      self.makeTextureArray(self.meshIds, self.replaceTextures);
                      self.initEmitters(self.replaceTextures);
                      self.updateLocalBB([self.m2Geom.m2File.BoundingCorner1, self.m2Geom.m2File.BoundingCorner2]);

                      self.createAABB();

                      self.initAnimationManager(m2Geom.m2File);
                      self.initBoneAnimMatrices();
                      self.initSubmeshColors();
                      self.initTextureAnimMatrices();
                      self.initTransparencies();
                      self.initCameras();
                      self.initLights();

                      self.postLoad();
                      self.loaded = true;
                  }
              } catch (e) {
                  console.log("exception while loading M2", e)
              }

              return true;
          });
      } catch (e) {
          console.log(e);
      }
    }
    postLoad(){

    }
    getShaderNames(m2Batch: SkinTex): M2ShaderNames | 0 {
        function getTabledShaderNames(shaderId: number, op_count: number, tex_unit_number2: number): M2ShaderNames | 0 {
            var v4 = (shaderId >> 4) & 7;
            var v5 = shaderId & 7;
            var v6 = (shaderId >> 4) & 8;
            var v7 = shaderId & 8;

            var vertexShaderName: string | undefined;
            var pixelShaderName: string | undefined;
            if ( op_count == 1 ) {
                if ( v6 )
                {
                    vertexShaderName = "Diffuse_Env";
                }
                else
                {
                    vertexShaderName = "Diffuse_T2";
                    if ( tex_unit_number2 )
                        vertexShaderName = "Diffuse_T1";
                }
                switch ( v4 )
                {

                    case 0:
                        pixelShaderName = "Combiners_Opaque";
                        break;
                    case 2:
                        pixelShaderName = "Combiners_Decal";
                        break;
                    case 3:
                        pixelShaderName = "Combiners_Add";
                        break;
                    case 4:
                        pixelShaderName = "Combiners_Mod2x";
                        break;
                    case 5:
                        pixelShaderName = "Combiners_Fade";
                        break;
                    default:
                        pixelShaderName = "Combiners_Mod";
                        break;
                }
            } else {
                if ( v6 )
                {
                    vertexShaderName = "Diffuse_Env_T2";
                    if ( v7 )
                        vertexShaderName = "Diffuse_Env_Env";
                }
                else if ( shaderId & 8 )
                {
                    vertexShaderName = "Diffuse_T1_Env";
                }
                else
                {
                    vertexShaderName = "Diffuse_T1_T2";
                }
                if ( !v4 )
                {
                    switch ( v5 )
                    {
                        case 0:
                            pixelShaderName = "Combiners_Opaque_Opaque";
                            break;
                        case 3:
                            pixelShaderName = "Combiners_Opaque_Add";
                            break;
                        case 4:
                            pixelShaderName = "Combiners_Opaque_Mod2x";
                            break;
                        case 6:
                            pixelShaderName = "Combiners_Opaque_Mod2xNA";
                            break;
                        case 7:
                            pixelShaderName = "Combiners_Opaque_AddNA";
                            break;
                        default:
                            pixelShaderName = "Combiners_Opaque_Mod";
                            break;
                    }
                } else if ( v4 == 1 ) {
                    switch ( v5 )
                    {
                        case 0:
                            pixelShaderName = "Combiners_Mod_Opaque";
                            break;
                        case 3:
                            pixelShaderName = "Combiners_Mod_Add";
                            break;
                        case 4:
                            pixelShaderName = "Combiners_Mod_Mod2x";
                            break;
                        case 6:
                            pixelShaderName = "Combiners_Mod_Mod2xNA";
                            break;
                        case 7:
                            pixelShaderName = "Combiners_Mod_AddNA";
                            break;
                        default:
                            pixelShaderName = "Combiners_Mod_Mod";
                            break;

                    }
                } else if ( v4 == 3 ) {
                    if ( v5 == 1 )
                    {
                        pixelShaderName = "Combiners_Add_Mod";
                    }
                    return 0;
                } else if ( v4 != 4 ) {
                    return 0;
                } else if ( v5 == 1 ) {
                    pixelShaderName = "Combiners_Mod_Mod2x";
                } else {
                    if ( v5 != 4 )
                        return 0;
                    pixelShaderName = "Combiners_Mod2x_Mod2x";
                }
            }
            return { vertex: vertexShaderName, pixel : pixelShaderName }
        }

        var shaderId = m2Batch.shaderId;
        var shaderNames;
        var vertexShader: string | undefined;
        var pixelShader: string | undefined;
        if ( !(shaderId & 0x8000) ) {
            shaderNames = getTabledShaderNames(shaderId, m2Batch.op_count, m2Batch.textureUnitNum);
            if ( !shaderNames )
                shaderNames = getTabledShaderNames(shaderId, m2Batch.op_count, 0x11);
            return shaderNames;
        }
        switch ( shaderId & 0x7FFF ) {
            case 0:
                return 0;
            // the merged layers (see fixShaderIdBasedOnLayer): Diffuse_* is the vertex shader, Combiners_* the pixel shader
            case 1:
                vertexShader = "Diffuse_T1_Env";
                pixelShader = "Combiners_Opaque_Mod2xNA_Alpha";
                break;
            case 2:
                vertexShader = "Diffuse_T1_Env";
                pixelShader = "Combiners_Opaque_AddAlpha";
                break;
            case 3:
                vertexShader = "Diffuse_T1_Env";
                pixelShader = "Combiners_Opaque_AddAlpha_Alpha";
                break;
            default:
                break;
        }

        return { vertex: vertexShader, pixel : pixelShader }
    }
    makeTextureArray (meshIds: number[] | null | undefined, replaceTextures: string[] | null | undefined) {
       try {
           var self = this;
           var mdxObject = this.m2Geom;
           var skinObject = this.skinGeom;
           if (!replaceTextures)
               replaceTextures = new Array();

           /* 1. Free previous subMeshArray */

           /* 2. Fill the materialArray */
           var materialArray: M2MaterialData[] = new Array();


           var subMeshes = skinObject.skinFile.header.subMeshes;
           for (var i = 0; i < skinObject.skinFile.header.texs.length; i++) {
               var materialData = {
                   isRendered: false,
                   isTransparent: false,
                   isEnviromentMapping: false,
                   meshIndex: -1,
                   textureTexUnit1: null,
                   textureTexUnit2: null,
                   textureTexUnit3: null
               } as M2MaterialData;

               var skinTextureDefinition = skinObject.skinFile.header.texs[i];
               var subMesh = subMeshes[skinTextureDefinition.submeshIndex];

               if (meshIds && (meshIds.length > 0) && (subMesh.meshID > 0) && (meshIds[(subMesh.meshID / 100) | 0] != (subMesh.meshID % 100))) {
                    continue;
               }

               materialArray.push(materialData);

               var op_count = skinTextureDefinition.op_count;

               var renderFlagIndex = skinTextureDefinition.renderFlagIndex;
               //var isTransparent = (mdxObject.m2File.renderFlags[renderFlagIndex].blend >= 2);
               var isTransparent = (mdxObject.m2File.renderFlags[renderFlagIndex].blend >= 2) ||
                   ((mdxObject.m2File.renderFlags[renderFlagIndex].flags & 0x10) > 0);

               var shaderNames = this.getShaderNames(skinTextureDefinition);

               materialData.layer = skinTextureDefinition.layer;
               materialData.isRendered = true;
               materialData.isTransparent = isTransparent;
               materialData.meshIndex = skinTextureDefinition.submeshIndex;
               materialData.shaderNames = shaderNames;

               materialData.renderFlag =  mdxObject.m2File.renderFlags[renderFlagIndex].flags;
               materialData.renderBlending = mdxObject.m2File.renderFlags[renderFlagIndex].blend;

               var textureUnit;
               // JS-BUG: <= instead of < - for textureUnitNum == length it reads textUnitLookup[length] (undefined); harmless
               if (skinTextureDefinition.textureUnitNum <= mdxObject.m2File.textUnitLookup.length) {
                   textureUnit = mdxObject.m2File.textUnitLookup[skinTextureDefinition.textureUnitNum];
                   if (textureUnit == 0xFFFF) {
                       //Enviroment mapping
                       materialData.isEnviromentMapping = true;
                   }
               }

               if (op_count > 0) {
                   var mdxTextureIndex = mdxObject.m2File.texLookup[skinTextureDefinition.textureIndex];
                   var mdxTextureDefinition = mdxObject.m2File.textureDefinition[mdxTextureIndex];
                   materialData.texUnit1TexIndex = i;
                   materialData.mdxTextureIndex1 = mdxTextureIndex;
                   materialData.xWrapTex1 = (mdxTextureDefinition.flags & 1) > 0;
                   materialData.yWrapTex1 = (mdxTextureDefinition.flags & 2) > 0;

                   if (mdxTextureDefinition.texType == 0) {
                       materialData.textureUnit1TexName = mdxTextureDefinition.textureName;
                   } else {
                       materialData.textureUnit1TexName = replaceTextures[mdxTextureDefinition.texType];
                   }
               }
               if (op_count > 1) {
                   var mdxTextureIndex1 = mdxObject.m2File.texLookup[skinTextureDefinition.textureIndex + 1];
                   var mdxTextureDefinition1 = mdxObject.m2File.textureDefinition[mdxTextureIndex1];
                   materialData.mdxTextureIndex2 = mdxTextureIndex1;
                   materialData.xWrapTex2 = (mdxTextureDefinition1.flags & 1) > 0;
                   materialData.yWrapTex2 = (mdxTextureDefinition1.flags & 2) > 0;
                   materialData.texUnit2TexIndex = i;

                   if (mdxTextureDefinition1.texType == 0) {
                       materialData.textureUnit2TexName = mdxTextureDefinition1.textureName;
                   } else {
                       materialData.textureUnit2TexName = replaceTextures[mdxTextureDefinition1.texType];
                   }
               }
               if (op_count > 2) {
                   var mdxTextureIndex2 = mdxObject.m2File.texLookup[skinTextureDefinition.textureIndex + 2];
                   var mdxTextureDefinition2 = mdxObject.m2File.textureDefinition[mdxTextureIndex2];
                   materialData.mdxTextureIndex3 = mdxTextureIndex2;
                   materialData.xWrapTex3 = (mdxTextureDefinition2.flags & 1) > 0;
                   materialData.yWrapTex3 = (mdxTextureDefinition2.flags & 2) > 0;
                   materialData.texUnit3TexIndex = i;

                   if (mdxTextureDefinition2.texType == 0) {
                       materialData.textureUnit3TexName = mdxTextureDefinition2.textureName;
                   } else {
                       materialData.textureUnit3TexName = replaceTextures[mdxTextureDefinition2.texType];
                   }
               }
           }

           for (var i = 0; i < materialArray.length; i++) {
               var materialData = materialArray[i];
               if (materialData.textureUnit1TexName) {
                   (function (materialData: M2MaterialData) {
                       self.sceneApi.resources.loadTexture(materialData.textureUnit1TexName!)
                           .then(function success(textObject) {
                               materialData.texUnit1Texture = textObject;
                           }, function error() {
                           });
                   })(materialData);
               }
               if (materialData.textureUnit2TexName) {
                   (function (materialData: M2MaterialData) {
                       self.sceneApi.resources.loadTexture(materialData.textureUnit2TexName!)
                           .then(function success(textObject) {
                               materialData.texUnit2Texture = textObject;
                           }, function error() {
                           });
                   })(materialData);
               }
               if (materialData.textureUnit3TexName) {
                   (function (materialData: M2MaterialData) {
                       self.sceneApi.resources.loadTexture(materialData.textureUnit3TexName!)
                           .then(function success(textObject) {
                               materialData.texUnit3Texture = textObject;
                           }, function error() {
                           });
                   })(materialData);
               }
           }

           this.materialArray = materialArray;

       } catch(e) {
           console.log(e);
       }

    }
    checkFrustumCulling (cameraVec4: ReadonlyVec4, frustumPlanes: ReadonlyVec4[], num_planes: number): boolean {
        var aabb = this.aabb!;

        //1. Check if camera position is inside Bounding Box
        if (
            cameraVec4[0] > aabb[0][0] && cameraVec4[0] < aabb[1][0] &&
            cameraVec4[1] > aabb[0][1] && cameraVec4[1] < aabb[1][1] &&
            cameraVec4[2] > aabb[0][2] && cameraVec4[2] < aabb[1][2]
        ) return true;

        //2. Check the bounding sphere is within the draw distance
        if (!mathHelper.checkDrawDistance(cameraVec4, aabb, config.getDrawDistance())) return false;

        //3. Check aabb is inside camera frustum
        var result = mathHelper.checkFrustum(frustumPlanes, aabb, num_planes);
        return result;
    }
    checkAgainstDepthBuffer(frustumMatrix: ReadonlyMat4, lookAtMat4: ReadonlyMat4, placementMatrix: ReadonlyMat4, checkDepth: CheckDepthFunc) {
        var bb = this.getBoundingBox();
        if (!bb) return false;

        var combinedMat4 = mat4.create();

        mat4.multiply(combinedMat4, frustumMatrix, lookAtMat4);
        mat4.multiply(combinedMat4, combinedMat4, placementMatrix);

        var bb1 = bb.ab,
            bb2 = bb.cd;

        var bb1vec = vec4.fromValues(bb1.x, bb1.y, bb1.z, 1);
        var bb2vec = vec4.fromValues(bb2.x, bb2.y, bb2.z, 1);

        vec4.transformMat4(bb1vec, bb1vec, combinedMat4);
        vec4.transformMat4(bb2vec, bb2vec, combinedMat4);

        //Perspective divide
        vec4.scale(bb1vec, bb1vec, 1/bb1vec[3]);
        vec4.scale(bb2vec, bb2vec, 1/bb2vec[3]);

        var depth = Math.max(0, Math.min(bb1vec[2], bb2vec[2]));

        var min_x = Math.min(bb1vec[0], bb2vec[0]); min_x = Math.max(min_x, -1.0);
        var max_x = Math.max(bb1vec[0], bb2vec[0]); max_x = Math.min(max_x, 1.0);

        var min_y = Math.min(bb1vec[1], bb2vec[1]); min_y = Math.max(min_y, -1.0);
        var max_y = Math.max(bb1vec[1], bb2vec[1]); max_y = Math.min(max_y, 1.0);

        return checkDepth(min_x, max_x, min_y, max_y, depth);
    }

    setAnimationId(animationId: number) {
        if (!this.loaded) {
            this.startAnimationId = animationId;
            return;
        }
        this.animationManager.setAnimationId(animationId);
    }

    getCombinedColor(skinData: SkinHeader, materialData: M2MaterialData, subMeshColors: vec4[] | null): Float32List {
        var colorIndex = skinData.texs[materialData.texUnit1TexIndex].colorIndex;
        var submeshColor: Float32List = new Float32Array([1,1,1,1]);
        if ((colorIndex >= 0) && (subMeshColors)) {
            var color = subMeshColors[colorIndex];
            submeshColor = color as Float32List;
        }

        return submeshColor;
    }
    getTransparency(skinData: SkinHeader, materialData: M2MaterialData,transparencies: number[]) {
        var transparency = 1.0;
        var transpIndex = skinData.texs[materialData.texUnit1TexIndex].transpIndex;
        if ((transpIndex >= 0) && (transparencies)) {
            transparency = transparencies[transpIndex];
        }

        return transparency;
    }

    updateLocalBB(localBB: [Vector3f, Vector3f]) {
        this.localBB = localBB
    }
    getBoundingBox () {
        return {
            ab: this.localBB![0],
            cd: this.localBB![1]
        }
    }

    updateCameras(deltaTime: number) {
        this.animationManager.updateCameraSimplified(deltaTime, this.cameras);

    }
    update (deltaTime: number, cameraPos: ReadonlyVec4, viewMat: ReadonlyMat4) {
        if (!this.loaded) return;
        if (!this.getIsRendered()) return;
        var invPlacementMat = this.getInvertModelMatrix();

        //if (!this.materialArray) return;

        /* 1. Calc local camera */
        var cameraInlocalPos = vec4.create();
        vec4.copy(cameraInlocalPos, cameraPos);
        vec4.transformMat4(cameraInlocalPos, cameraInlocalPos, invPlacementMat);

        /* 2. Update animation values */
        this.animationManager.update(deltaTime, cameraInlocalPos, this.bonesMatrices, this.textAnimMatrices,
            this.subMeshColors!, this.transparencies, this.cameras, this.lights);

        for (var i = 0; i < this.lights.length; i++) {
            var light = this.lights[i];
            vec4.transformMat4(light.position, light.position, this.placementMatrix);
            vec4.transformMat4(light.position, light.position, viewMat);
        }

        this.combinedBoneMatrix = this.combineBoneMatrixes();

        // particles and ribbons follow the bones just calculated
        this.updateEmitters(deltaTime, cameraPos);

        this.currentTime += deltaTime;
    }

    sortMaterials(lookAtMat4: ReadonlyMat4) {
        if (!this.loaded ) return;
        if (!this.getIsRendered()) return;

        /* 3. Resort m2 meshes against distance to screen */
        var skinData = this.skinGeom.skinFile.header;
        var skinGeom = this.skinGeom;

        var modelViewMat = mat4.create();
        mat4.multiply(modelViewMat, lookAtMat4, this.placementMatrix);

        var zeroVect = vec3.create();

        /* 3.1 Transform aabb with current mat */
        if (skinGeom.subMeshBBs) {
            var transformedAABB: [vec4, vec4][] = new Array(skinGeom.subMeshBBs.length);
            for (var i = 0; i < transformedAABB.length; i++) {
                var aabb = skinGeom.subMeshBBs[i];
                transformedAABB[i] = mathHelper.transformAABBWithMat4(modelViewMat, aabb as unknown as AABB);
            }

            QuickSort.multiQuickSort(
                this.materialArray,
                0, this.materialArray.length - 1,
                function sortOnLevel(a: M2MaterialData, b: M2MaterialData) {
                    return a.layer - b.layer;
                },
                function test1(a: M2MaterialData, b: M2MaterialData): number {
                    var aabb1_t = transformedAABB[a.meshIndex];
                    var aabb2_t = transformedAABB[b.meshIndex];

                    var isInsideAABB1 = mathHelper.isPointInsideAABB(aabb1_t, zeroVect);
                    var isInsideAABB2 = mathHelper.isPointInsideAABB(aabb2_t, zeroVect);

                    if (!isInsideAABB1 && isInsideAABB2) {
                        return 1
                    } else if (isInsideAABB1 && !isInsideAABB2) {
                        return -1
                    }

                    var result;
                    // JS-BUG: isInsideAABB1 && isInsideAABB1 (probably meant isInsideAABB2 in both conditions); harmless - after the returns above both flags are equal
                    if (isInsideAABB1 && isInsideAABB1) {
                        result = aabb1_t[0][2] - aabb2_t[0][2];
                    } else if (!(isInsideAABB1 && isInsideAABB1)) {
                        result = aabb2_t[0][2] - aabb1_t[0][2];
                    }

                    return result!;
                }
            );
        }
    }

    /*
    * Animation functions
    *
    * */
    checkIfHasBillboarded() {
        var m2File = this.m2Geom.m2File;
        for (var i = 0; i < m2File.nBones; i++) {
            var boneDefinition = m2File.bones[i];
            if ((boneDefinition.flags & 0x48) > 0) {
                return true;
            }
        }

        return false;
    }

    initAnimationManager (m2File: M2File) {
        this.animationManager = new AnimationManager(m2File)
        if (typeof this.startAnimationId != 'undefined') {
            this.animationManager.setAnimationId(this.startAnimationId, true);
            this.startAnimationId = undefined;
        }

        if (typeof this.startRightHandClosed != 'undefined') {
            this.animationManager.setRightHandClosed(this.startRightHandClosed);
            this.startRightHandClosed = undefined;
        }
        if (typeof this.startLeftHandClosed != 'undefined') {
            this.animationManager.setLeftHandClosed(this.startLeftHandClosed);
            this.startLeftHandClosed = undefined;
        }
    }
    initTextureAnimMatrices() {
        var m2File = this.m2Geom.m2File;

        var textAnimMatrices: mat4[] = new Array(m2File.nTexAnims);
        for (var i = 0; i < m2File.nTexAnims; i++) {
            textAnimMatrices[i] = mat4.create();;
        }

        this.textAnimMatrices = textAnimMatrices;
    }
    initCameras() {
        var m2File = this.m2Geom.m2File;

        var cameras: M2CameraDetails[] = new Array(m2File.nCameras);
        for (var i = 0; i < m2File.nCameras; i++) {
            cameras[i] = {} as M2CameraDetails;
        }

        this.cameras = cameras;
    }
    initLights() {
        var m2File = this.m2Geom.m2File;

        var lights: M2LightDetails[] = new Array(m2File.nLights);
        for (var i = 0; i < m2File.nLights; i++) {
            lights[i] = {} as M2LightDetails;
        }

        this.lights = lights;
    }

    /* The particle systems and ribbons of the model, with their textures: an index into the model's textures
     * (not the texture lookup), replaceable textures (type != 0) from replaceTextures as for the meshes.
     * A ribbon gets its material's blend mode (tbc always blended it additively). */
    initEmitters(replaceTextures: string[] | null | undefined) {
        var self = this;
        var m2File = this.m2Geom.m2File;

        function loadEmitterTexture(textureIndex: number, emitter: ParticleEmitter | RibbonEmitter) {
            var textureDefinition = m2File.textureDefinition ? m2File.textureDefinition[textureIndex] : undefined;
            if (!textureDefinition) return;
            emitter.wrapX = (textureDefinition.flags & 1) > 0;
            emitter.wrapY = (textureDefinition.flags & 2) > 0;
            var textureName = textureDefinition.texType == 0 ? textureDefinition.textureName
                : (replaceTextures ? replaceTextures[textureDefinition.texType] : undefined);
            if (!textureName) return;
            self.sceneApi.resources.loadTexture(textureName).then(function success(textObject) {
                emitter.texture = textObject;
            }, function error() {
            });
        }

        var particleEmitters = (m2File.particleEmitters || []).map(function (def) {
            var particle = new ParticleEmitter(def);
            loadEmitterTexture(def.texture, particle);
            return particle;
        });
        var ribbonEmitters = (m2File.ribbonEmitters || []).map(function (def) {
            var ribbon = new RibbonEmitter(def);
            if (def.materialIndices.length > 0 && def.materialIndices[0] < m2File.renderFlags.length) {
                var renderFlag = m2File.renderFlags[def.materialIndices[0]];
                ribbon.blend = renderFlag.blend;
                ribbon.renderFlags = renderFlag.flags;
            }
            if (def.textureIndices.length > 0) loadEmitterTexture(def.textureIndices[0], ribbon);
            return ribbon;
        });

        this.particleEmitters = particleEmitters;
        this.ribbonEmitters = ribbonEmitters;
    }

    getBoneWorldMatrix(bone: number, out: mat4) {
        if (bone >= 0 && bone < this.bonesMatrices.length) {
            mat4.multiply(out, this.placementMatrix, this.bonesMatrices[bone]);
        } else {
            mat4.copy(out, this.placementMatrix);
        }
        return out;
    }

    /* tbc's Model.Animate (Setup) and UpdateEmitters: moves the emitters with the bones of this frame's
     * animation and steps their particles, then hands the object to the particle renderer. Emitters beyond
     * config.getParticleDrawDistance(), or switched off, are emptied instead, so they start afresh when they
     * come back. deltaTime in milliseconds. */
    updateEmitters(deltaTime: number, cameraPos: ReadonlyVec4) {
        var particleEmitters = this.particleEmitters;
        var ribbonEmitters = this.ribbonEmitters;
        var hasParticles = !!particleEmitters && particleEmitters.length > 0;
        var hasRibbons = !!ribbonEmitters && ribbonEmitters.length > 0;
        if (!hasParticles && !hasRibbons) return;

        var placement = this.placementMatrix;
        var dx = placement[12] - cameraPos[0], dy = placement[13] - cameraPos[1], dz = placement[14] - cameraPos[2];
        var inRange = Math.sqrt(dx * dx + dy * dy + dz * dz) <= config.getParticleDrawDistance();
        var updateParticles = hasParticles && inRange && config.getRenderParticles();
        var updateRibbons = hasRibbons && inRange && config.getRenderRibbons();

        if (hasParticles && !updateParticles)
            for (var i = 0; i < particleEmitters!.length; i++) particleEmitters![i].clear();
        if (hasRibbons && !updateRibbons)
            for (var i = 0; i < ribbonEmitters!.length; i++) ribbonEmitters![i].clear();
        if (!updateParticles && !updateRibbons) return;

        var animationManager = this.animationManager;
        var animations = this.m2Geom.m2File.animations;
        var animationIndex = animationManager.currentAnimationIndex;
        if (!animations || animationIndex < 0 || animationIndex >= animations.length) return;
        var animationTime = animationManager.currentAnimationTime;
        var animationLength = animations[animationIndex].length;
        var dt = deltaTime / 1000;
        var boneWorld = mat4.create();

        if (updateParticles) {
            for (var i = 0; i < particleEmitters!.length; i++) {
                var particle = particleEmitters![i];
                particle.update(dt, this.getBoneWorldMatrix(particle.def.bone, boneWorld), animationManager, animationIndex, animationTime, animationLength);
            }
        }
        if (updateRibbons) {
            for (var i = 0; i < ribbonEmitters!.length; i++) {
                var ribbon = ribbonEmitters![i];
                ribbon.update(dt, this.getBoneWorldMatrix(ribbon.def.bone, boneWorld), animationManager, animationIndex, animationTime, animationLength);
            }
        }

        this.sceneApi.getParticleRenderer().submit(this);
    }

    /* tbc's Model.Draw for the effects: one batch per particle system and per ribbon */
    addParticleQuads(renderer: ParticleRenderer, cameraPos: ReadonlyVec4, right: ArrayLike<number>, up: ArrayLike<number>) {
        var particleEmitters = this.particleEmitters;
        var ribbonEmitters = this.ribbonEmitters;

        if (config.getRenderParticles() && particleEmitters) {
            for (var i = 0; i < particleEmitters.length; i++) {
                var particle = particleEmitters[i];
                if (particle.count == 0 || !particle.texture) continue;
                var blend = particle.def.blendingType;
                var dx = particle.worldX - cameraPos[0], dy = particle.worldY - cameraPos[1], dz = particle.worldZ - cameraPos[2];
                renderer.beginBatch(particle.texture, blend,
                    !particle.hasFlag(ParticleFlags.Fogged), blend <= 1,
                    particle.wrapX, particle.wrapY, Math.sqrt(dx * dx + dy * dy + dz * dz));
                particle.addQuads(renderer, right, up);
                renderer.endBatch();
            }
        }

        if (config.getRenderRibbons() && ribbonEmitters) {
            for (var i = 0; i < ribbonEmitters.length; i++) {
                var ribbon = ribbonEmitters[i];
                if (!ribbon.texture) continue;
                var rdx = ribbon.tposX - cameraPos[0], rdy = ribbon.tposY - cameraPos[1], rdz = ribbon.tposZ - cameraPos[2];
                renderer.beginBatch(ribbon.texture, ribbon.blend,
                    (ribbon.renderFlags & 0x2) > 0, ribbon.blend <= 1 && (ribbon.renderFlags & 0x10) == 0,
                    ribbon.wrapX, ribbon.wrapY, Math.sqrt(rdx * rdx + rdy * rdy + rdz * rdz));
                ribbon.addQuads(renderer);
                renderer.endBatch();
            }
        }
    }
    initBoneAnimMatrices() {
        var m2File = this.m2Geom.m2File;

        var bonesMatrices: mat4[] = new Array(m2File.nBones);
        for (var i = 0; i < m2File.nBones; i++) {
            bonesMatrices[i] = mat4.create();
        }

        this.bonesMatrices = bonesMatrices;
    }
    initSubmeshColors() {
        var m2File = this.m2Geom.m2File;
        this.subMeshColors = new Array(m2File.colors.length);
        for (var i = 0; i < this.subMeshColors.length; i++) {
            this.subMeshColors[i] = [1.0,1.0,1.0,1.0];
        }
    }
    initTransparencies() {
        var m2File = this.m2Geom.m2File;
        this.transparencies = new Array(m2File.transparencies.length);
        for (var i = 0; i < this.transparencies.length; i++) {
            this.transparencies[i] = 1.0;
        }
    }
    combineBoneMatrixes () {
        var combinedMatrix = new Float32Array(this.bonesMatrices.length * 16);
        for (var i = 0; i < this.bonesMatrices.length; i++) {
            combinedMatrix.set(this.bonesMatrices[i], i*16);
        }

        return combinedMatrix;
    }

    /*
    * Draw functions
    *
    * */

    drawMeshes(drawTransparent: boolean, instanceCount: number) {
        var originalFogColor = this.sceneApi.getFogColor();
        var identMat = mat4.create();
        mat4.identity(identMat);

        var meshIdsTobeRendered = window.meshestoBeRendered;
        for (var i = 0; i < this.materialArray.length; i++) {
            var materialData = this.materialArray[i];
            // @ts-expect-error ^ on two booleans (XOR); valid JavaScript, ported as-is
            if (!(materialData.isTransparent ^ !drawTransparent)) continue;

            if (meshIdsTobeRendered && !meshIdsTobeRendered[materialData.texUnit1TexIndex]) continue;

            /* Get right texture animation matrix */
            var textureMatrix1 = identMat;
            var textureMatrix2 = identMat;
            var skinData = this.skinGeom.skinFile.header;
            if (materialData.texUnit1TexIndex >= 0 && skinData.texs[materialData.texUnit1TexIndex]) {
                var textureAnim = skinData.texs[materialData.texUnit1TexIndex].textureAnim;
                var textureMatIndex = this.m2Geom.m2File.texAnimLookup[textureAnim];
                if (textureMatIndex !== undefined && this.textAnimMatrices && textureMatIndex >= 0 && textureMatIndex <  this.textAnimMatrices.length) {
                    textureMatrix1 = this.textAnimMatrices[textureMatIndex];
                }
                if (materialData.texUnit2TexIndex! >= 0) {
                    var textureMatIndex = this.m2Geom.m2File.texAnimLookup[textureAnim+1];
                    if (textureMatIndex !== undefined && this.textAnimMatrices && textureMatIndex >= 0 && textureMatIndex <  this.textAnimMatrices.length) {
                        textureMatrix2 = this.textAnimMatrices[textureMatIndex];
                    }
                }
            }
            var meshColor = this.getCombinedColor(skinData, materialData, this.subMeshColors);
            var transparency = this.getTransparency(skinData, materialData, this.transparencies)

            //Don't draw meshes with 0 transp
            if ((transparency < 0.0001) || (meshColor[3] < 0.001)) continue;

            var pixelShaderIndex = pixelShaderTable[(materialData.shaderNames as M2ShaderNames).pixel!];
            this.m2Geom.drawMesh(materialData, this.skinGeom, meshColor, transparency, textureMatrix1, textureMatrix2, pixelShaderIndex, originalFogColor, instanceCount)
        }
    }
    drawInstanced(drawTransparent: boolean, instanceCount: number, placementVBO: WebGLBuffer) {
        if (!this.m2Geom || !this.skinGeom) return;

        this.m2Geom.setupAttributes(this.skinGeom);
        var combinedMatrix = this.combinedBoneMatrix;
        this.m2Geom.setupUniforms(null, combinedMatrix, null, drawTransparent, this.lights);
        this.m2Geom.setupPlacementAttribute(placementVBO);
        this.drawMeshes(drawTransparent, instanceCount);
    }

    startLoading() {
        if (!this.loading) {
            this.loading = true;
            MDXObject.prototype.load.apply(this);
        }
    }
    draw(drawTransparent: boolean, placementMatrix: mat4, diffuseColor: Float32Array) {
        if (!this.loaded) {
            this.startLoading();
            return;
        }

        var vaoBinded = this.m2Geom.bindVao();
        if (!vaoBinded) {
            this.m2Geom.setupAttributes(this.skinGeom);
        }

        var combinedMatrix = this.combinedBoneMatrix;
        this.m2Geom.setupUniforms(placementMatrix, combinedMatrix, diffuseColor, drawTransparent, this.lights);

        this.drawMeshes(drawTransparent, -1);

        if (vaoBinded) {
            this.m2Geom.unbindVao()
        }
    }
    drawBB (color: number[]){
        if (!this.loaded) return;

        function drawBBInternal(bb1: Vector3f, bb2: Vector3f, color: number[], placementMatrix: mat4) {
            var center = [
                (bb1.x + bb2.x) / 2,
                (bb1.y + bb2.y) / 2,
                (bb1.z + bb2.z) / 2
            ];

            var scale = [
                bb2.x - center[0],
                bb2.y - center[1],
                bb2.z - center[2]
            ];

            gl.uniform3fv(uniforms.uBBScale, new Float32Array(scale));
            gl.uniform3fv(uniforms.uBBCenter, new Float32Array(center));
            gl.uniform3fv(uniforms.uColor, new Float32Array(color)); //red
            gl.uniformMatrix4fv(uniforms.uPlacementMat, false, placementMatrix as Float32List);

            gl.drawElements(gl.LINES, 48, gl.UNSIGNED_SHORT, 0);
        }
        function drawBBInternal2(center: number[], scale: number[], color: number[], placementMatrix: mat4) {
            gl.uniform3fv(uniforms.uBBScale, new Float32Array(scale));
            gl.uniform3fv(uniforms.uBBCenter, new Float32Array(center));
            gl.uniform3fv(uniforms.uColor, new Float32Array(color)); //red
            gl.uniformMatrix4fv(uniforms.uPlacementMat, false, placementMatrix as Float32List);

            gl.drawElements(gl.LINES, 48, gl.UNSIGNED_SHORT, 0);
        }

        var gl = this.sceneApi.getGlContext();
        var uniforms = this.sceneApi.shaders.getShaderUniforms();

        var bb = this                           .getBoundingBox();

        if (bb) {
            var bb1 = bb.ab,
                bb2 = bb.cd;

            drawBBInternal(bb1, bb2, color, this.placementMatrix);

            //Draw possible BBs
            var skinData = this.skinGeom.skinFile.header;
            for (var i = 0; i < this.materialArray.length; i++) {
                var a = this.materialArray[i];
                //var mesh1Corner1 = skinData.subMeshes[a.meshIndex].pos;
                //var mesh1Corner2 = skinData.subMeshes[a.meshIndex].centerBoundingBox;
                //var radius = skinData.subMeshes[a.meshIndex].radius;
                var aabb = this.skinGeom.subMeshBBs[a.meshIndex];


                //drawBBInternal2([mesh1Corner1.x, mesh1Corner1.y, mesh1Corner1.z], [radius,radius,radius], [0.0, 0.8, 0], this.placementMatrix);
                drawBBInternal(
                    {x : aabb[0][0], y : aabb[0][1], z : aabb[0][2]},
                    {x : aabb[1][0], y : aabb[1][1], z : aabb[1][2]},
                    [0.0, 0.8, 0], this.placementMatrix);
            }
        }
    }

}

export default MDXObject;
