//import Stats from 'stats.js';

//import drawDepthShader          from 'drawDepthShader.glsl';
//import renderFrameBufferShader  from 'renderFrameBufferShader.glsl';
//import readDepthBuffer          from 'readDepthBuffer.glsl';
//import wmoShader                from 'WmoShader.glsl';
//import m2Shader                 from 'm2Shader.glsl';
//import drawBBShader             from 'drawBBShader.glsl';
//import adtShader                from 'adtShader.glsl';
//import drawPortalShader         from 'drawPortalShader.glsl';
//import drawFrustumShader        from 'drawFrustum.glsl';
//import textureCompositionShader from 'textureCompositionShader.glsl';

import GraphManager from './manager/sceneGraphManager'
import WorldObjectManager, { localPlayerGuid } from './manager/worldObjectManager'
import PlayerAnimationState from './manager/playerAnimationState'
import SpawnManager from './manager/spawnManager'
import SpellManager from './manager/spellManager'
import WanderManager from './manager/wanderManager'
import NodeManager from './manager/nodeManager'
import Hud from './hud/hud'
import { AnimationType } from './manager/playerAnimationState'
import type WorldUnit from './objects/worldObjects/worldUnit';
import type { AnimationTypeValue } from './manager/playerAnimationState';
import { setAnimationSafe } from './manager/animationBridge'
import WorldPlayer from './objects/worldObjects/worldPlayer'
import config from './../services/config'

import wdtLoader from './../services/map/wdtLoader';

import AdtGeomCache    from './geometry/adtGeomCache';
import M2GeomCache     from './geometry/m2GeomCache';
import SkinGeomCache   from './geometry/skinGeomCache';
import WmoGeomCache    from './geometry/wmoGeomCache';
import WmoMainCache    from './geometry/wmoMainCache';
import TextureWoWCache from './texture/textureCache';

import firstPersonCamera from './camera/firstPersonCamera'

import Skies from './sky/skies'
import LowresTerrain from './lowresTerrain/lowresTerrain'

import {mat4, vec4, vec3, glMatrix} from 'gl-matrix'

/* DBC stuff */
import animationDataDBC             from './../services/dbc/animationDataDBC'
import characterFacialHairStylesDBC from './../services/dbc/characterFacialHairStylesDBC'
import charHairGeosetsDBC           from './../services/dbc/charHairGeosetsDBC'
import charSectionsDBC              from './../services/dbc/charSectionsDBC'
import creatureDisplayInfoDBC       from './../services/dbc/creatureDisplayInfoDBC'
import lightDBC                     from './../services/dbc/lightDBC'
import lightParamsDBC               from './../services/dbc/lightParamsDBC'
import lightFloatBandDBC            from './../services/dbc/lightFloatBandDBC'
import lightIntBandDBC              from './../services/dbc/lightIntBandDBC'
import creatureDisplayInfoExtraDBC  from './../services/dbc/creatureDisplayInfoExtraDBC'
import creatureModelDataDBC         from './../services/dbc/creatureModelDataDBC'
import gameObjectDisplayInfoDBC     from './../services/dbc/gameObjectDisplayInfoDBC'
import helmetGeosetVisDataDBC       from './../services/dbc/helmetGeosetVisDataDBC'
import itemDisplayInfoDBC           from './../services/dbc/itemDisplayInfoDBC'
import itemDBC                      from './../services/dbc/itemDBC'
import mapDBC                       from './../services/dbc/mapDBC'
import liquidTypeDBC                from './../services/dbc/liquidTypeDBC'

import Expansion from '../Expansion';

import type { CameraVecs } from './camera/firstPersonCamera';
import type { SceneApi } from './sceneApi';
import type { WmoPlacement } from './objects/wmoObject';
import type { AdtM2Placement } from './../services/map/adtLoader';
import type { WdtFile } from './../services/map/wdtLoader';
import type { AnimationDataRecord } from './../services/dbc/animationDataDBC';
import type { CharacterFacialHairStylesRecord } from './../services/dbc/characterFacialHairStylesDBC';
import type { CharHairGeosetsRecord } from './../services/dbc/charHairGeosetsDBC';
import type { CharSectionsRecord } from './../services/dbc/charSectionsDBC';
import type { CreatureDisplayInfoRecord } from './../services/dbc/creatureDisplayInfoDBC';
import type { LightRecord } from './../services/dbc/lightDBC';
import type { LightParamsRecord } from './../services/dbc/lightParamsDBC';
import type { LightFloatBandRecord } from './../services/dbc/lightFloatBandDBC';
import type { LightIntBandRecord } from './../services/dbc/lightIntBandDBC';
import type { CreatureDisplayInfoExtraRecord } from './../services/dbc/creatureDisplayInfoExtraDBC';
import type { CreatureModelDataRecord } from './../services/dbc/creatureModelDataDBC';
import type { GameObjectDisplayInfoRecord } from './../services/dbc/gameObjectDisplayInfoDBC';
import type { HelmetGeosetVisDataRecord } from './../services/dbc/helmetGeosetVisDataDBC';
import type { ItemDisplayInfoRecord } from './../services/dbc/itemDisplayInfoDBC';
import type { ItemRecord } from './../services/dbc/itemDBC';
import type { MapRecord } from './../services/dbc/mapDBC';
import type { LiquidTypeRecord } from './../services/dbc/liquidTypeDBC';

/* The Khronos helper from js/lib/webgl-debug.js - neither index.html nor any module loads it (see initGlContext) */
declare const WebGLDebugUtils: {
    glEnumToString(value: number): string;
    glFunctionArgsToString(functionName: string, args: ArrayLike<unknown>): string;
    makeDebugContext(ctx: WebGLRenderingContext,
                     opt_onErrorFunc?: (err: number, funcName: string, args: ArrayLike<unknown>) => void,
                     opt_onFunc?: (functionName: string, args: ArrayLike<unknown>) => void): WebGLRenderingContext;
};

/* A linked program with its active attributes and uniforms, built by Scene.compileShader() */
export interface ShaderProgram {
    program: WebGLProgram;
    shaderAttributes: { [name: string]: number };
    shaderUniforms: { [name: string]: WebGLUniformLocation | null };
}

/* Zenith and horizon colour of the gradient debug sky */
export interface SkyPalette {
    zenith: vec3;
    horizon: vec3;
}

/* The camera vectors draw() reports while an M2 camera (config.getCameraM2()) drives the view */
export interface M2CameraVecs {
    lookAtVec3: vec3 | vec4;
    cameraVec3: vec3 | vec4;
    staticCamera: boolean;
}

function getShaderSourceById(id: string): string {
  const el = document.getElementById(id);
  if (!el) {
    console.error(`Shader script with id="${id}" not found`);
    return '';
  }
  // textContent or innerHTML should contain the shader source
  return el.textContent!;
}

const drawDepthShader          = getShaderSourceById('drawDepthShader');
const renderFrameBufferShader  = getShaderSourceById('renderFrameBufferShader');
const readDepthBuffer          = getShaderSourceById('readDepthBuffer');
const wmoShader                = getShaderSourceById('WmoShader');
const m2Shader                 = getShaderSourceById('m2Shader');
const drawBBShader             = getShaderSourceById('drawBBShader');
const adtShader                = getShaderSourceById('adtShader');
const drawPortalShader         = getShaderSourceById('drawPortalShader');
const drawFrustumShader        = getShaderSourceById('drawFrustum');
const textureCompositionShader = getShaderSourceById('textureCompositionShader');
const skyShader                = getShaderSourceById('sky');
const skyGradientShader        = getShaderSourceById('SkyGradient');
const liquidShader             = getShaderSourceById('liquid');
const lowresTerrainShader      = getShaderSourceById('lowresTerrain');
const debug2DShader            = getShaderSourceById('debug2DShader');
const debug3DShader            = getShaderSourceById('debug3DShader');

// etc.

/*************/

glMatrix.setMatrixArrayType(Array);

// TODO: don't cycle for arena maps... Instead just pick one of these:
const skyPalettes: SkyPalette[] = [
    {
        zenith:  [0.15, 0.45, 0.85],
        horizon: [0.40, 0.75, 1.00]
    },
    {
        zenith:  [0.10, 0.30, 0.70],
        horizon: [0.35, 0.60, 0.90]
    },
    {
        zenith:  [0.30, 0.15, 0.05], // sunset orange-red at top
        horizon: [0.60, 0.35, 0.20]  // warm orange at horizon
    }
];

const SecPerSkyHour = 2.0; // 2 s -> next sky hour
const TicksPerHour = 120; // 120 ticks = 1 Look-up hour
/* far plane of the sky's own projection: the sky dome (radius 400) lies on the scene's far plane (400) */
const skyFarPlane = 850;
/* the liquid clock wraps after this many seconds: a whole number of texture frames (30 per second),
 * of UV scroll (0.02 per second) and of wave periods (the liquid shader's WAVE_SPEED), so it wraps seamlessly */
const LiquidClockPeriod = 50;


class Scene {
    /* fields assigned through self in the constructor are declared with ! */
    enableDeferred!: boolean;
    /* assigned in the constructor and never read */
    sceneObjectList!: unknown[];
    sceneAdts!: unknown[];
    secondCamera: vec3;
    secondCameraLookAt: vec3;
    /* the M2 camera branch of draw() stores 4-component positions here */
    mainCamera: vec3 | vec4;
    mainCameraLookAt: vec3 | vec4;
    fogColor: number[];
    uFogStart: number;
    uFogEnd: number;
    isShadersLoaded!: boolean;

    /* set by initGlContext() - null when WebGL is unavailable, which the rest of the code does not check */
    gl!: WebGLRenderingContext;
    canvas!: HTMLCanvasElement;

    /* extensions: the init*Ext() methods leave these unset when getExtension() fails */
    instancing_ext: ANGLE_instanced_arrays | undefined;
    anisotropic_ext: EXT_texture_filter_anisotropic | undefined;
    vao_ext: OES_vertex_array_object | undefined;
    glext_ft: { frameTerminator?(): void } | undefined;
    /* ... and these to null */
    comp_tex_ext!: WEBGL_compressed_texture_s3tc | null;
    depth_texture_ext!: WEBGL_depth_texture | null;
    /* read by initDrawBuffers() only while enableDeferred is still true, i.e. when the extension exists */
    wdb_ext!: WEBGL_draw_buffers;
    texture_floatExt!: OES_texture_float | null;
    texture_floatLinExt!: OES_texture_float_linear | null;

    /* compiled by initShaders() */
    textureCompositionShader!: ShaderProgram;
    renderFrameShader!: ShaderProgram;
    drawDepthBuffer!: ShaderProgram;
    readDepthBuffer!: ShaderProgram;
    wmoShader!: ShaderProgram;
    wmoInstancingShader!: ShaderProgram;
    m2Shader!: ShaderProgram;
    m2InstancingShader!: ShaderProgram;
    bbShader!: ShaderProgram;
    adtShader!: ShaderProgram;
    drawPortalShader!: ShaderProgram;
    drawFrustumShader!: ShaderProgram;
    skyShader!: ShaderProgram;
    liquidShader!: ShaderProgram;
    lowresTerrainShader!: ShaderProgram;
    debug2DShader!: ShaderProgram;
    debug3DShader!: ShaderProgram;
    /* set by the activate*Shader() methods */
    currentShaderProgram!: ShaderProgram;

    sceneApi!: SceneApi;
    graphManager!: GraphManager;
    worldObjectManager!: WorldObjectManager;
    blackPixelTexture!: WebGLTexture;
    bbBoxVars!: { vbo_vertices: WebGLBuffer; ibo_elements: WebGLBuffer };
    textureCompVars!: {
        textureCoords: WebGLBuffer;
        elements: WebGLBuffer;
        framebuffer: WebGLFramebuffer;
        depthTexture: WebGLTexture | null;
    };
    wmoGeomCache!: WmoGeomCache;
    wmoMainCache!: WmoMainCache;
    textureCache!: TextureWoWCache;
    m2GeomCache!: M2GeomCache;
    skinGeomCache!: SkinGeomCache;
    adtGeomCache!: AdtGeomCache;
    camera!: firstPersonCamera;

    /* set by initDrawBuffers() - deferred rendering only */
    depthRGBTexture!: WebGLTexture;
    normalTexture!: WebGLTexture;
    positionTexture!: WebGLTexture;
    colorTexture!: WebGLTexture;
    /* set by initRenderBuffers() */
    frameBuffer!: WebGLFramebuffer;
    frameBufferColorTexture!: WebGLTexture;
    frameBufferDepthTexture!: WebGLTexture | null;
    vertBuffer!: WebGLBuffer;

    /* DBC tables: set when their promise (constructor) resolves, undefined until then */
    animationDataDBC!: AnimationDataRecord[];
    characterFacialHairStylesDBC!: CharacterFacialHairStylesRecord[];
    charHairGeosetsDBC!: CharHairGeosetsRecord[];
    charSectionsDBC!: CharSectionsRecord[];
    creatureDisplayInfoDBC!: { [id: number]: CreatureDisplayInfoRecord };
    creatureDisplayInfoExtraDBC!: { [id: number]: CreatureDisplayInfoExtraRecord };
    creatureModelDataDBC!: { [id: number]: CreatureModelDataRecord };
    gameObjectDisplayInfoDBC!: { [id: number]: GameObjectDisplayInfoRecord };
    itemDisplayInfoDBC!: { [id: number]: ItemDisplayInfoRecord };
    itemDBC!: { [id: number]: ItemRecord };
    helmetGeosetVisDataDBC!: { [id: number]: HelmetGeosetVisDataRecord };
    mapDBC!: { [id: number]: MapRecord };
    lightDBC!: LightRecord[];
    lightFloatBandDBC!: LightFloatBandRecord[];
    lightIntBandDBC!: LightIntBandRecord[];
    lightParamsDBC!: LightParamsRecord[];
    /* WotLK only: undefined on Classic / TBC */
    liquidTypeDBC: { [id: number]: LiquidTypeRecord } | undefined;

    /* set by draw() */
    depthBuffer: Uint8Array | undefined;
    perspectiveMatrix!: mat4;
    viewCameraForRender!: mat4;
    lookAtMat4!: mat4;
    /* true only while draw() renders the debug camera's view */
    isDebugCamera: boolean | undefined;
    /* set by loadMap() */
    currentWdt: WdtFile | undefined;
    currentMapName!: string;

    /* set by initSky(): the quad of the gradient debug sky, or the map's lights.lit sky */
    skyQuadVbo: WebGLBuffer | undefined;
    skies: Skies | undefined;
    /* set by initLowresTerrain(): the map's WDL low-res terrain */
    lowresTerrain: LowresTerrain | undefined;
    /* performance.now() when the debug sky palette cycle / the sky day cycle started */
    skyWatchStart: number | undefined;
    skyClockStart: number | undefined;
    lastHour: number;

    /* performance.now() when the liquid clock (texture frames, scrolling) started */
    liquidClockStart: number | undefined;

    /* set by spawnPlayerCharacter() */
    playerAnimState: PlayerAnimationState | undefined;
    /* set by setPlayerMode() once the player character is to be spawned */
    playerCharacterRequested: boolean | undefined;
    /* set by the constructor */
    unitDbcsLoaded!: Promise<void[]>;
    /* for the CreatureMap / SpellMap modes, set by startSpawnMode() */
    spawnManagerMap: SpawnManager | undefined;
    /* the player's spells, set by spawnPlayerCharacter() */
    spellManager: SpellManager | undefined;
    /* the map's wander nodes, set by loadGameplayNodes() */
    nodeManager: NodeManager | undefined;
    /* the Wander mode's bots, set by startWanderMode() */
    wanderManager: WanderManager | undefined;
    /* the 2D HUD and the 3D debug drawing, set by the constructor */
    hud!: Hud;
    /* frames per second, set by the viewer's render loop (for the HUD) */
    fps: number;

    constructor(canvas: HTMLCanvasElement) {
        //var stats = new Stats();
        //stats.setMode(1); // 0: fps, 1: ms, 2: mb
        //
        //// align top-left
        //stats.domElement.style.position = 'absolute';
        //stats.domElement.style.left = '0px';
        //stats.domElement.style.top = '0px';
        //
        //document.body.appendChild(stats.domElement);
        //this.stats = stats;

        var self = this;
        self.enableDeferred = false;

        self.sceneObjectList = [];
        self.sceneAdts = [];

        this.secondCamera = [0,0,0];
        this.secondCameraLookAt = [0,0,0];

        this.mainCamera = [0,0,0];
        this.mainCameraLookAt = [0,0,0];
        this.fogColor = [0.117647, 0.207843, 0.392157];

        this.uFogStart = -1;
        this.uFogEnd  = -1;
        this.fps = 0;

        this.lastHour = -1;

        self.initGlContext(canvas);
        self.initArrayInstancedExt();
        self.initDepthTextureExt();
        if (self.enableDeferred) {
            self.initDeferredRendering();
        }
        self.initRenderBuffers();
        self.initAnisotropicExt();
        self.initVertexArrayObjectExt();
        self.initCompressedTextureS3tcExt();
        self.initFrameTerminatorExt();

        self.initShaders()
        self.isShadersLoaded = true;
        self.hud = new Hud(self);

        self.initSceneApi();
        self.initSceneGraph();
        self.createBlackPixelTexture();

        self.initBoxVBO();
        self.initTextureCompVBO();
        self.initCaches();
        self.initCamera();

        /* a DBC that fails to load (fileLoader logs the file) is logged and left unset, instead of an uncaught rejection */
        function dbcError(name: string) {
            return function error() {
                console.error("Could not load " + name + ", leaving it unset");
            };
        }

        /* Unit and Player data; unitDbcsLoaded settles once they have all loaded or failed (the player character needs them) */
        var unitDbcs: Promise<void>[] = [];
        unitDbcs.push(animationDataDBC().then(function success(a) {
            self.animationDataDBC = a;
        }, dbcError('AnimationData.dbc')));
        unitDbcs.push(characterFacialHairStylesDBC().then(function success(a) {
            self.characterFacialHairStylesDBC = a;
        }, dbcError('CharacterFacialHairStyles.dbc')));
        unitDbcs.push(charHairGeosetsDBC().then(function success(a) {
            self.charHairGeosetsDBC = a;
        }, dbcError('CharHairGeosets.dbc')));
        unitDbcs.push(charSectionsDBC().then(function success(a) {
            self.charSectionsDBC = a;
        }, dbcError('CharSections.dbc')));
        unitDbcs.push(creatureDisplayInfoDBC().then(function success(a) {
            self.creatureDisplayInfoDBC = a;
        }, dbcError('CreatureDisplayInfo.dbc')));
        if (window.selectedExpansion !== Expansion.CLASSIC) {
          unitDbcs.push(creatureDisplayInfoExtraDBC().then(function success(a) {
              self.creatureDisplayInfoExtraDBC = a;
          }, dbcError('CreatureDisplayInfoExtra.dbc')));
        }
        unitDbcs.push(creatureModelDataDBC().then(function success(a) {
            self.creatureModelDataDBC = a;
        }, dbcError('CreatureModelData.dbc')));
        unitDbcs.push(gameObjectDisplayInfoDBC().then(function success(a) {
            self.gameObjectDisplayInfoDBC = a;
        }, dbcError('GameObjectDisplayInfo.dbc')));

        // TODO: fix
        if (window.selectedExpansion === Expansion.WOTLK) {
          unitDbcs.push(itemDisplayInfoDBC().then(function success(a) {
              self.itemDisplayInfoDBC = a;
          }, dbcError('ItemDisplayInfo.dbc')));
          unitDbcs.push(itemDBC().then(function success(a) {
              self.itemDBC = a;
          }, dbcError('Item.dbc')));
          unitDbcs.push(helmetGeosetVisDataDBC().then(function success(a) {
              self.helmetGeosetVisDataDBC = a;
          }, dbcError('HelmetGeosetVisData.dbc')));
        }
        this.unitDbcsLoaded = Promise.all(unitDbcs);

        /* Map and area data */
        mapDBC().then(function success(a) {
            self.mapDBC = a;
        }, dbcError('Map.dbc'));

        /* Lights information */
        // TODO: fix
        if (window.selectedExpansion === Expansion.WOTLK) {
          lightDBC().then(function success(a) {
              self.lightDBC = a;
          }, dbcError('Light.dbc'));
        }
        lightFloatBandDBC().then(function success(a) {
            self.lightFloatBandDBC = a;
        }, dbcError('LightFloatBand.dbc'));
        lightIntBandDBC().then(function success(a) {
            self.lightIntBandDBC = a;
        }, dbcError('LightIntBand.dbc'));
        lightParamsDBC().then(function success(a) {
            self.lightParamsDBC = a;
        }, dbcError('LightParams.dbc'));

        /* Liquids: the MH2O and WMO liquid type ids of WotLK */
        if (window.selectedExpansion === Expansion.WOTLK) {
          liquidTypeDBC().then(function success(a) {
              self.liquidTypeDBC = a;
          }, dbcError('LiquidType.dbc'));
        }

    }

    compileShader (vertShaderString: string, fragmentShaderString: string): ShaderProgram {
        var gl = this.gl;

        if (this.enableDeferred) {
            vertShaderString = "#define ENABLE_DEFERRED 1\r\n"+vertShaderString;
            fragmentShaderString = "#define ENABLE_DEFERRED 1\r\n"+fragmentShaderString;
        }

        /* 1.1 Compile vertex shader */
        var maxMatrixUniforms = (gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS) / 4) - 6;

        var vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
        gl.shaderSource(vertexShader, "#define MAX_MATRIX_NUM "+maxMatrixUniforms+"\r\n"+"#define COMPILING_VS 1\r\n "+vertShaderString);
        gl.compileShader(vertexShader);

        // Check if it compiled
        var success = gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS);
        if (!success) {
            // Something went wrong during compilation; get the error
            throw "could not compile shader:" + gl.getShaderInfoLog(vertexShader);
        }

        /* 1.2 Compile fragment shader */
        var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
        gl.shaderSource(fragmentShader, "#define COMPILING_FS 1\r\n "+fragmentShaderString);
        gl.compileShader(fragmentShader);

        // Check if it compiled
        var success = gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS);
        if (!success) {
            // Something went wrong during compilation; get the error
            throw "could not compile shader:" + gl.getShaderInfoLog(fragmentShader);
        }

        /* 1.3 Link the program */
        var program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);

        // link the program.
        gl.linkProgram(program);

        // Check if it linked.
        var success = gl.getProgramParameter(program, gl.LINK_STATUS);
        if (!success) {
            // something went wrong with the link

            throw ("program filed to link:" + gl.getProgramInfoLog (program));
        }

        var shader = {} as ShaderProgram;
        shader['program'] = program;

        //From https://github.com/greggman/webgl-fundamentals/blob/master/webgl/resources/webgl-utils.js

        //Get attributes
        var shaderAttribs: { [name: string]: number } = {};
        var attribNum = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
        for (var ii = 0; ii < attribNum; ++ii) {
            var attribInfo = gl.getActiveAttrib(program, ii);
            if (!attribInfo) {
                break;
            }
            var index = gl.getAttribLocation(program, attribInfo.name);
            shaderAttribs[attribInfo.name] = index;
        }
        shader.shaderAttributes = shaderAttribs;


        //Get uniforms
        var shaderUniforms: { [name: string]: WebGLUniformLocation | null } = {};
        var uniformsNumber = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
        for (var ii = 0; ii < uniformsNumber; ++ii) {
            var uniformInfo = gl.getActiveUniform(program, ii);
            if (!uniformInfo) {
                break;
            }

            var name = uniformInfo.name;
            if (name.substr(-3) === "[0]") {
                name = name.substr(0, name.length - 3);
            }

            var uniformLoc = gl.getUniformLocation(program, name);
            shaderUniforms[name] = uniformLoc;
        }
        shader.shaderUniforms = shaderUniforms;

        return shader;
    }
    createBlackPixelTexture() {
        var gl = this.gl;
        var blackPixelTexture = gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, blackPixelTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255,255,255,255]));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

        gl.generateMipmap(gl.TEXTURE_2D);

        gl.bindTexture(gl.TEXTURE_2D, null);

        this.blackPixelTexture = blackPixelTexture;
    }
    initGlContext (canvas: HTMLCanvasElement){
        function throwOnGLError(err: number, funcName: string, args: ArrayLike<unknown>) {
            throw WebGLDebugUtils.glEnumToString(err) + " was caused by call to: " + funcName;
        }
        function validateNoneOfTheArgsAreUndefined(functionName: string, args: ArrayLike<unknown>) {
            for (var ii = 0; ii < args.length; ++ii) {
                if (args[ii] === undefined) {
                    console.error("undefined passed to gl." + functionName + "(" +
                        WebGLDebugUtils.glFunctionArgsToString(functionName, args) + ")");
                }
            }
        }

        try {
            var gl: WebGLRenderingContext | null | undefined = canvas.getContext("webgl", {premultipliedAlpha: false, alpha: false }) || (canvas.getContext("experimental-webgl", {premultipliedAlpha: false}) as WebGLRenderingContext | null);
            // JS-BUG: WebGLDebugUtils (js/lib/webgl-debug.js) is never loaded, so this throws a ReferenceError that the empty catch swallows - the debug context and its two callbacks are never used
            gl = WebGLDebugUtils.makeDebugContext(gl!, throwOnGLError, validateNoneOfTheArgsAreUndefined);
        }
        catch(e) {}

        if (!gl) {
            alert("Unable to initialize WebGL. Your browser may not support it.");
            gl = null;
        }

        this.gl = gl!;
        this.canvas = canvas;
    }
    initArrayInstancedExt(){
        var gl = this.gl;
        var instancing_ext = gl.getExtension('ANGLE_instanced_arrays');
        if (instancing_ext) {
            this.instancing_ext = instancing_ext;
        }
    }
    initAnisotropicExt (){
        var gl = this.gl;
        var anisotropic_ext = gl.getExtension('EXT_texture_filter_anisotropic');
        if (anisotropic_ext) {
            this.anisotropic_ext = anisotropic_ext;
        }
    }
    initVertexArrayObjectExt () {
        var gl = this.gl;
        var vao_ext = gl.getExtension("OES_vertex_array_object")
        if (vao_ext) {
            this.vao_ext = vao_ext;
        }
    }
    initCompressedTextureS3tcExt () {
        var gl = this.gl;
        var ext = (
            gl.getExtension("WEBGL_compressed_texture_s3tc") ||
            gl.getExtension("MOZ_WEBGL_compressed_texture_s3tc") ||
            gl.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc")
        );
        if (ext) {
            this.comp_tex_ext = ext;
        }  else {
            this.comp_tex_ext = null;
        }
    }
    initDepthTextureExt () {
        var gl = this.gl;

        var depth_texture_ext = gl.getExtension('WEBGL_depth_texture');
        if (depth_texture_ext) {
            this.depth_texture_ext = depth_texture_ext;
        } else {
            this.depth_texture_ext = null;
        }
    }
    initDeferredRendering (){
        var gl = this.gl;

        var wdb_ext = gl.getExtension('WEBGL_draw_buffers');
        if (wdb_ext) {
            this.wdb_ext = wdb_ext;
        } else {
            this.enableDeferred = false;
        }
    }
    //For WebInspector
    initFrameTerminatorExt() {
        var gl = this.gl;
        var glext_ft = gl.getExtension("GLI_frame_terminator")
        if (glext_ft) {
            this.glext_ft = glext_ft;
        }
    }
    initShaders (){
        var self = this;

        /* Get and compile shaders */
        self.textureCompositionShader = self.compileShader(textureCompositionShader, textureCompositionShader);

        self.renderFrameShader = self.compileShader(renderFrameBufferShader, renderFrameBufferShader);

        self.drawDepthBuffer = self.compileShader(drawDepthShader, drawDepthShader);

        self.readDepthBuffer = self.compileShader(readDepthBuffer, readDepthBuffer);

        self.wmoShader = self.compileShader(wmoShader, wmoShader);
        self.wmoInstancingShader = self.compileShader("#define INSTANCED 1\r\n " + wmoShader, "#define INSTANCED 1\r\n " + wmoShader);

        self.m2Shader = self.compileShader(m2Shader, m2Shader);
        self.m2InstancingShader = self.compileShader("#define INSTANCED 1\r\n " + m2Shader, "#define INSTANCED 1\r\n " + m2Shader);

        self.bbShader = self.compileShader(drawBBShader, drawBBShader);

        self.adtShader = self.compileShader(adtShader, adtShader);

        self.drawPortalShader = self.compileShader(drawPortalShader, drawPortalShader);
        self.drawFrustumShader = self.compileShader(drawFrustumShader, drawFrustumShader);

        if (config.getUseDebugSky()) {
            self.skyShader = self.compileShader(skyGradientShader, skyGradientShader);
        } else {
            self.skyShader = self.compileShader(skyShader, skyShader);
        }

        self.liquidShader = self.compileShader(liquidShader, liquidShader);

        self.lowresTerrainShader = self.compileShader(lowresTerrainShader, lowresTerrainShader);

        self.debug2DShader = self.compileShader(debug2DShader, debug2DShader);
        self.debug3DShader = self.compileShader(debug3DShader, debug3DShader);
    }
    initCaches (){
        this.wmoGeomCache = new WmoGeomCache(this.sceneApi);
        this.wmoMainCache = new WmoMainCache(this.sceneApi);
        this.textureCache = new TextureWoWCache(this.sceneApi);
        this.m2GeomCache = new M2GeomCache(this.sceneApi);
        this.skinGeomCache = new SkinGeomCache(this.sceneApi);
        this.adtGeomCache = new AdtGeomCache(this.sceneApi);
    }
    initDrawBuffers (frameBuffer: WebGLFramebuffer) {
        var gl = this.gl;
        var wdb_ext = this.wdb_ext;
        // Taken from https://hacks.mozilla.org/2014/01/webgl-deferred-shading/
        // And https://github.com/YuqinShao/Tile_Based_WebGL_DeferredShader/blob/master/deferredshading/deferred.js

        this.texture_floatExt = gl.getExtension("OES_texture_float");
        this.texture_floatLinExt = gl.getExtension("OES_texture_float_linear");

        var normalTexture = gl.createTexture();
        var positionTexture = gl.createTexture();
        var colorTexture = gl.createTexture();
        var depthRGBTexture = gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, normalTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.canvas.width, this.canvas.height, 0, gl.RGBA, gl.FLOAT, null);


        gl.bindTexture(gl.TEXTURE_2D, positionTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.canvas.width, this.canvas.height, 0, gl.RGBA, gl.FLOAT, null);


        gl.bindTexture(gl.TEXTURE_2D, colorTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.canvas.width, this.canvas.height, 0, gl.RGBA, gl.FLOAT, null);


        gl.bindTexture(gl.TEXTURE_2D, depthRGBTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.canvas.width, this.canvas.height, 0, gl.RGBA, gl.FLOAT, null);


        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
        var bufs: number[] = [];
        bufs[0] = wdb_ext.COLOR_ATTACHMENT0_WEBGL;
        bufs[1] = wdb_ext.COLOR_ATTACHMENT1_WEBGL;
        bufs[2] = wdb_ext.COLOR_ATTACHMENT2_WEBGL;
        bufs[3] = wdb_ext.COLOR_ATTACHMENT3_WEBGL;
        wdb_ext.drawBuffersWEBGL(bufs);

        gl.framebufferTexture2D(gl.FRAMEBUFFER, bufs[0], gl.TEXTURE_2D, depthRGBTexture, 0);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, bufs[1], gl.TEXTURE_2D, normalTexture, 0);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, bufs[2], gl.TEXTURE_2D, positionTexture, 0);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, bufs[3], gl.TEXTURE_2D, colorTexture, 0);

        this.depthRGBTexture = depthRGBTexture;
        this.normalTexture = normalTexture;
        this.positionTexture = positionTexture;
        this.colorTexture = colorTexture;
    }
    initRenderBuffers () {
        var gl = this.gl;
        //if(!this.depth_texture_ext) { return; }

        var framebuffer = gl.createFramebuffer();
        if (this.enableDeferred) {
            this.initDrawBuffers(framebuffer)
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

        // Create a color texture
        var colorTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, colorTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.canvas.width, this.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        // Create the depth texture
        var depthTexture: WebGLTexture | null = null;
        if (this.depth_texture_ext) {
            depthTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, depthTexture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, this.canvas.width, this.canvas.height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
        }

        if (!this.enableDeferred) {
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTexture, 0);
        }
        if (this.depth_texture_ext) {
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 0);
        }
        this.frameBuffer = framebuffer;
        this.frameBufferColorTexture = colorTexture;
        this.frameBufferDepthTexture = depthTexture;

        var verts = [
            1,  1,
            -1,  1,
            -1, -1,
            1,  1,
            -1, -1,
            1, -1,
        ];
        var vertBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);

        this.vertBuffer = vertBuffer;
    }
    initSceneGraph () {
        this.graphManager = new GraphManager(this.sceneApi);
        this.worldObjectManager = new WorldObjectManager(this.sceneApi);
    }
    initSceneApi () {
        var self = this;
        this.sceneApi = {
            drawCamera : function () {
                return self.drawCamera();
            },
            getGlContext: function () {
                return self.gl;
            },
            getCurrentWdt : function (){
                return self.currentWdt!;
            },
            getBlackPixelTexture : function () {
                return self.blackPixelTexture;
            },
            setFogColor: function (color) {
                self.fogColor = color;
            },
            getFogColor: function () {
                return self.fogColor;
            },
            getIsDebugCamera() {
                return self.isDebugCamera;
            },
            extensions : {
                getInstancingExt : function (){
                    return self.instancing_ext;
                },
                getAnisotropicExt : function () {
                    return self.anisotropic_ext;
                },
                getComprTextExt : function () {
                    return self.comp_tex_ext;
                },
                getVaoExt : function () {
                    return self.vao_ext;
                }
            },
            shaders : {
                activateBoundingBoxShader : function () {
                    self.activateBoundingBoxShader();
                },
                deativateBoundingBoxShader : function() {
                    // JS-BUG: Scene has no deactivateBoundingBoxShader method, so calling this throws a TypeError
                    // @ts-expect-error Scene has no deactivateBoundingBoxShader; ported as-is
                    self.deactivateBoundingBoxShader();
                },
                activateFrustumBoxShader : function () {
                    self.activateFrustumBoxShader();
                },
                activateAdtShader : function () {
                    self.activateAdtShader();
                },
                activateDrawPortalShader : function () {
                    self.activateDrawPortalShader();
                },
                activateTextureCompositionShader : function (texture) {
                    self.activateTextureCompositionShader(texture);
                },
                deactivateTextureCompositionShader: function () {
                    self.deactivateTextureCompositionShader();
                },
                activateWMOShader : function () {
                    self.activateWMOShader()
                },
                deactivateWMOShader : function () {
                    self.deactivateWMOShader()
                },

                /* M2 shader functions */
                activateM2ShaderAttribs : function () {
                    self.activateM2ShaderAttribs();
                },
                deactivateM2ShaderAttribs : function () {
                    self.deactivateM2ShaderAttribs();
                },
                activateM2Shader : function () {
                    self.activateM2Shader()
                },
                deactivateM2Shader : function () {
                    self.deactivateM2Shader();
                },
                activateM2InstancingShader : function (){
                    self.activateM2InstancingShader();
                },
                deactivateM2InstancingShader : function (){
                    self.deactivateM2InstancingShader();
                },
                getShaderUniforms: function () {
                    return self.currentShaderProgram.shaderUniforms;
                },
                getShaderAttributes: function () {
                    return self.currentShaderProgram.shaderAttributes;
                },
                getSkyShader: function () {
                    return self.skyShader;
                },
                getLiquidShader: function () {
                    return self.liquidShader;
                },
                getLowresTerrainShader: function () {
                    return self.lowresTerrainShader;
                }
            },
            dbc : {
                getCharacterFacialHairStylesDBC : function() {
                    return self.characterFacialHairStylesDBC;
                },
                getCharHairGeosetsDBC : function() {
                    return self.charHairGeosetsDBC;
                },
                getCharSectionsDBC : function () {
                    return self.charSectionsDBC;
                },
                getCreatureDisplayInfoDBC : function () {
                    return self.creatureDisplayInfoDBC;
                },
                getCreatureDisplayInfoExtraDBC : function () {
                    return self.creatureDisplayInfoExtraDBC;
                },
                getCreatureModelDataDBC : function () {
                    return self.creatureModelDataDBC;
                },
                getGameObjectDisplayInfoDBC : function () {
                    return self.gameObjectDisplayInfoDBC;
                },
                getHelmetGeosetVisDataDBC : function() {
                    return self.helmetGeosetVisDataDBC;
                },
                getItemDisplayInfoDBC : function () {
                    return self.itemDisplayInfoDBC;
                },
                getItemDBC : function () {
                    return self.itemDBC;
                },

                /* Map and area data */
                getMapDBC : function () {
                    return self.mapDBC;
                },

                /* Lights information */
                getLightDBC : function () {
                    return self.lightDBC;
                },
                getLightFloatBandDBC : function () {
                    return self.lightFloatBandDBC;
                },
                getLightIntBandDBC : function () {
                    return self.lightIntBandDBC;
                },
                getLightParamsDBC : function () {
                    return self.lightParamsDBC;
                },

                /* Liquids */
                getLiquidTypeDBC : function () {
                    return self.liquidTypeDBC;
                }
            },
            objects : {
                loadAdtM2Obj : function (doodad){
                    return self.graphManager.addAdtM2Object(doodad);
                },
                loadAdtWmo : function (wmoDef){
                    return self.graphManager.addWmoObject(wmoDef);
                },
                loadWmoM2Obj : function (doodadDef, placementMatrix, useLocalLightning){
                    return self.graphManager.addWmoM2Object(doodadDef, placementMatrix, useLocalLightning);
                },
                loadWorldM2Obj : function (modelName, meshIds,replaceTextures){
                    return self.graphManager.addWorldMDXObject(modelName, meshIds,replaceTextures);
                },
                loadAdtChunk: function(fileName) {
                    return self.graphManager.addADTObject(0,0, fileName)
                }
            },
            resources : {
                loadTexture: function (fileName) {
                    return self.textureCache.loadTexture(fileName);
                },
                unLoadTexture: function (fileName) {
                    self.textureCache.unLoadTexture(fileName);
                },
                loadWmoMain: function (fileName) {
                    return self.wmoMainCache.loadWmoMain(fileName);
                },
                unloadWmoMain: function (fileName) {
                    // JS-BUG: the WmoMainCache method is unLoadWmoMain (capital L), so this throws a TypeError
                    // @ts-expect-error WmoMainCache has unLoadWmoMain, not unloadWmoMain; ported as-is
                    self.wmoMainCache.unloadWmoMain(fileName);
                },
                loadWmoGeom: function (fileName) {
                    return self.wmoGeomCache.loadWmoGeom(fileName);
                },
                unloadWmoGeom: function (fileName) {
                    self.wmoGeomCache.unLoadWmoGeom(fileName);
                },
                loadM2Geom: function (fileName) {
                    return self.m2GeomCache.loadM2(fileName);
                },
                unloadM2Geom: function (fileName) {
                    self.m2GeomCache.unLoadM2(fileName);
                },
                loadSkinGeom: function (fileName) {
                    return self.skinGeomCache.loadSkin(fileName);
                },
                unloadSkinGeom: function (fileName) {
                    self.skinGeomCache.unLoadSkin(fileName);
                },
                loadAdtGeom: function (fileName) {
                    return self.adtGeomCache.loadAdt(fileName);
                },
                unloadAdtGeom: function (fileName) {
                    self.adtGeomCache.unLoadAdt(fileName);
                }
            }
        };
    }
    initCamera (){
        this.camera = new firstPersonCamera();
    }
    initSky () {
        if (config.getUseDebugSky()) {
            var gl = this.gl;
            var quad = [
                -1, -1, // two triangles that fill NDC
                 1, -1,
                -1,  1,
                -1,  1,
                 1, -1,
                 1,  1
            ];

            // initSky can run more than once: free the previous quad
            if (this.skyQuadVbo) gl.deleteBuffer(this.skyQuadVbo);

            this.skyQuadVbo = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.skyQuadVbo);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(quad), gl.STATIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
        } else {
            if (this.skies) this.skies.dispose();
            this.skies = new Skies(this.sceneApi, this.currentMapName, false);
        }
    }
    initLowresTerrain () {
        // Free the previous map's low-res terrain
        if (this.lowresTerrain) this.lowresTerrain.dispose();
        this.lowresTerrain = new LowresTerrain(this.sceneApi, this.currentMapName);
    }
    initBoxVBO (){
        var gl = this.gl;

        //From https://en.wikibooks.org/wiki/OpenGL_Programming/Bounding_box
        var vertices = [
            -1, -1, -1, //0
            1, -1, -1,  //1
            1, -1, 1,   //2
            -1, -1, 1,  //3
            -1, 1, 1,   //4
            1, 1, 1,    //5
            1, 1, -1,   //6
            -1, 1, -1,  //7
        ];

        var vbo_vertices = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo_vertices);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        var elements = [
            0, 1, 1, 2, 2, 3, 3, 0,
            4, 5, 5, 6, 6, 7, 7, 4,
            7, 6, 6, 1, 1, 0, 0, 7,
            3, 2, 2, 5, 5, 4, 4, 3,
            6, 5, 5, 2, 2, 1, 1, 6,
            0, 3, 3, 4, 4, 7, 7, 0
        ];
        var ibo_elements = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo_elements);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Int16Array(elements), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        this.bbBoxVars = {
            vbo_vertices : vbo_vertices,
            ibo_elements : ibo_elements
        }
    }
    initTextureCompVBO (){
        var gl = this.gl;

        var framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

        // Create the depth texture
        var depthTexture: WebGLTexture | null = null;
        if (this.depth_texture_ext) {
            var depthTexture: WebGLTexture | null = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, depthTexture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, 1024, 1024, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 0);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        //From https://en.wikibooks.org/wiki/OpenGL_Programming/Bounding_box
        var textureCoords = [
            0,0,
            1,0,
            0,1,
            1,1,
        ];

        var textureCoordsVBO = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordsVBO);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        var elements = [
            0,1,2,
            1,3,2
        ];
        var elementsIBO = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elementsIBO);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Int16Array(elements), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);


        this.textureCompVars = {
            textureCoords : textureCoordsVBO,
            elements : elementsIBO,
            framebuffer: framebuffer,
            depthTexture: depthTexture
        }
    }

    glClearScreen (gl: WebGLRenderingContext, fogColor: number[]){
        gl.clearDepth(1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LESS);

        gl.disable(gl.BLEND);
        //gl.clearColor(0.6, 0.95, 1.0, 1);
        //gl.clearColor(0.117647, 0.207843, 0.392157, 1);
        //gl.clearColor(fogColor[0], fogColor[1], fogColor[2], 1);
        gl.clearColor(0,0,0,1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.disable(gl.CULL_FACE);
    }
    activateRenderFrameShader () {
        this.currentShaderProgram = this.renderFrameShader;
        if (this.currentShaderProgram) {
            var gl = this.gl;
            gl.useProgram(this.currentShaderProgram.program);
            var shaderAttributes = this.sceneApi.shaders.getShaderAttributes();

            gl.activeTexture(gl.TEXTURE0);

            gl.disableVertexAttribArray(1);

            gl.uniform2fv(this.currentShaderProgram.shaderUniforms.uResolution, new Float32Array([this.canvas.width, this.canvas.height]))

            gl.uniform1i(this.currentShaderProgram.shaderUniforms.u_sampler, 0);
            if (this.currentShaderProgram.shaderUniforms.u_depth) {
                gl.uniform1i(this.currentShaderProgram.shaderUniforms.u_depth, 1);
            }
        }
    }
    activateTextureCompositionShader(texture: WebGLTexture) {
        this.currentShaderProgram = this.textureCompositionShader;
        if (this.currentShaderProgram) {
            var gl = this.gl;
            gl.useProgram(this.currentShaderProgram.program);
            var shaderAttributes = this.sceneApi.shaders.getShaderAttributes();

            gl.bindFramebuffer(gl.FRAMEBUFFER, this.textureCompVars.framebuffer);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
            if (this.textureCompVars.depthTexture) {
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.textureCompVars.depthTexture, 0);
            }

            gl.bindBuffer(gl.ARRAY_BUFFER, this.textureCompVars.textureCoords);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.textureCompVars.elements);


            gl.vertexAttribPointer(this.currentShaderProgram.shaderAttributes.aTextCoord, 2, gl.FLOAT, false, 0, 0);  // position

            gl.activeTexture(gl.TEXTURE0);
            gl.uniform1i(this.currentShaderProgram.shaderUniforms.uTexture, 0);

            gl.depthMask(true);
            gl.disable(gl.CULL_FACE);

            gl.clearColor(0,0,1,1);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.disable(gl.DEPTH_TEST);
            gl.depthMask(false);
            gl.viewport(0,0,1024,1024)
        }
    }
    activateRenderDepthShader () {
        this.currentShaderProgram = this.drawDepthBuffer;
        if (this.currentShaderProgram) {
            var gl = this.gl;
            gl.useProgram(this.currentShaderProgram.program);
            var shaderAttributes = this.sceneApi.shaders.getShaderAttributes();



            gl.activeTexture(gl.TEXTURE0);
        }
    }
    activateReadDepthBuffer () {
        this.currentShaderProgram = this.readDepthBuffer;
        if (this.currentShaderProgram) {
            var gl = this.gl;
            gl.useProgram(this.currentShaderProgram.program);
            var shaderAttributes = this.sceneApi.shaders.getShaderAttributes();

            gl.activeTexture(gl.TEXTURE0);

            gl.enableVertexAttribArray(this.currentShaderProgram.shaderAttributes.position);
            gl.enableVertexAttribArray(this.currentShaderProgram.shaderAttributes.texture);

        }
    }
    activateAdtShader (){
        this.currentShaderProgram = this.adtShader;
        if (this.currentShaderProgram) {
            var gl = this.gl;
            var instExt = this.sceneApi.extensions.getInstancingExt();
            var shaderAttributes = this.sceneApi.shaders.getShaderAttributes();

            gl.useProgram(this.currentShaderProgram.program);

            gl.enableVertexAttribArray(shaderAttributes.aHeight);
            gl.enableVertexAttribArray(shaderAttributes.aIndex);

            gl.uniformMatrix4fv(this.currentShaderProgram.shaderUniforms.uLookAtMat, false, this.lookAtMat4);
            gl.uniformMatrix4fv(this.currentShaderProgram.shaderUniforms.uPMatrix, false, this.perspectiveMatrix);

            if (this.currentWdt && ((this.currentWdt.flags & 0x04) > 0)) {
                gl.uniform1i(this.currentShaderProgram.shaderUniforms.uNewFormula, 1);
            } else {
                gl.uniform1i(this.currentShaderProgram.shaderUniforms.uNewFormula, 0);
            }

            gl.uniform1i(this.currentShaderProgram.shaderUniforms.uLayer0, 0);
            gl.uniform1i(this.currentShaderProgram.shaderUniforms.uAlphaTexture, 1);
            gl.uniform1i(this.currentShaderProgram.shaderUniforms.uLayer1, 2);
            gl.uniform1i(this.currentShaderProgram.shaderUniforms.uLayer2, 3);
            gl.uniform1i(this.currentShaderProgram.shaderUniforms.uLayer3, 4);

            gl.uniform1f(this.currentShaderProgram.shaderUniforms.uFogStart, this.uFogStart);
            gl.uniform1f(this.currentShaderProgram.shaderUniforms.uFogEnd, this.uFogEnd);

            gl.uniform3fv(this.currentShaderProgram.shaderUniforms.uFogColor, this.fogColor);
        }
    }
    activateWMOShader () {
        this.currentShaderProgram = this.wmoShader;
        if (this.currentShaderProgram) {
            var gl = this.gl;
            gl.useProgram(this.currentShaderProgram.program);
            var shaderAttributes = this.sceneApi.shaders.getShaderAttributes();

            gl.enableVertexAttribArray(shaderAttributes.aPosition);
            if (shaderAttributes.aNormal) {
                gl.enableVertexAttribArray(shaderAttributes.aNormal);
            }
            gl.enableVertexAttribArray(shaderAttributes.aTexCoord);
            gl.enableVertexAttribArray(shaderAttributes.aTexCoord2);
            gl.enableVertexAttribArray(shaderAttributes.aColor);
            gl.enableVertexAttribArray(shaderAttributes.aColor2);

            gl.uniformMatrix4fv(this.currentShaderProgram.shaderUniforms.uLookAtMat, false, this.lookAtMat4);
            gl.uniformMatrix4fv(this.currentShaderProgram.shaderUniforms.uPMatrix, false, this.perspectiveMatrix);

            gl.uniform1i(this.currentShaderProgram.shaderUniforms.uTexture, 0);
            gl.uniform1i(this.currentShaderProgram.shaderUniforms.uTexture2, 1);

            gl.uniform1f(this.currentShaderProgram.shaderUniforms.uFogStart, this.uFogStart);
            gl.uniform1f(this.currentShaderProgram.shaderUniforms.uFogEnd, this.uFogEnd);

            gl.uniform3fv(this.currentShaderProgram.shaderUniforms.uFogColor, this.fogColor);

            gl.activeTexture(gl.TEXTURE0);
        }
    }
    deactivateWMOShader () {
        var gl = this.gl;
        var instExt = this.sceneApi.extensions.getInstancingExt();
        var shaderAttributes = this.sceneApi.shaders.getShaderAttributes();

        //gl.disableVertexAttribArray(shaderAttributes.aPosition);
        if (shaderAttributes.aNormal) {
            gl.disableVertexAttribArray(shaderAttributes.aNormal);
        }

        gl.disableVertexAttribArray(shaderAttributes.aTexCoord);
        gl.disableVertexAttribArray(shaderAttributes.aTexCoord2);

        gl.disableVertexAttribArray(shaderAttributes.aColor);
        gl.disableVertexAttribArray(shaderAttributes.aColor2);
    }
    deactivateTextureCompositionShader() {
        var gl = this.gl;
        gl.useProgram(this.currentShaderProgram.program);
        var shaderAttributes = this.sceneApi.shaders.getShaderAttributes();

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
    }

    activateM2ShaderAttribs() {
        var gl = this.gl;
        var shaderAttributes = this.sceneApi.shaders.getShaderAttributes();
         gl.enableVertexAttribArray(shaderAttributes.aPosition);
         if (shaderAttributes.aNormal) {
            gl.enableVertexAttribArray(shaderAttributes.aNormal);
         }
         gl.enableVertexAttribArray(shaderAttributes.boneWeights);
         gl.enableVertexAttribArray(shaderAttributes.bones);
         gl.enableVertexAttribArray(shaderAttributes.aTexCoord);
         gl.enableVertexAttribArray(shaderAttributes.aTexCoord2);
    }
    deactivateM2ShaderAttribs() {
        var gl = this.gl;
        var shaderAttributes = this.sceneApi.shaders.getShaderAttributes();

        gl.disableVertexAttribArray(shaderAttributes.aPosition);

        if (shaderAttributes.aNormal) {
            gl.disableVertexAttribArray(shaderAttributes.aNormal);
        }
        gl.disableVertexAttribArray(shaderAttributes.boneWeights);
        gl.disableVertexAttribArray(shaderAttributes.bones);

        gl.disableVertexAttribArray(shaderAttributes.aTexCoord);
        gl.disableVertexAttribArray(shaderAttributes.aTexCoord2);
        gl.enableVertexAttribArray(0);
    }
    activateM2Shader () {
        this.currentShaderProgram = this.m2Shader;
        if (this.currentShaderProgram) {
            var gl = this.gl;
            gl.useProgram(this.currentShaderProgram.program);
            gl.enableVertexAttribArray(0);
            if (!this.vao_ext) {
                this.activateM2ShaderAttribs()
            }

            gl.uniformMatrix4fv(this.currentShaderProgram.shaderUniforms.uLookAtMat, false, this.lookAtMat4);
            gl.uniformMatrix4fv(this.currentShaderProgram.shaderUniforms.uPMatrix, false, this.perspectiveMatrix);
            if (this.currentShaderProgram.shaderUniforms.isBillboard) {
                gl.uniform1i(this.currentShaderProgram.shaderUniforms.isBillboard, 0);
            }

            gl.uniform1i(this.currentShaderProgram.shaderUniforms.uTexture, 0);
            gl.uniform1i(this.currentShaderProgram.shaderUniforms.uTexture2, 1);

            gl.uniform1f(this.currentShaderProgram.shaderUniforms.uFogStart, this.uFogStart);
            gl.uniform1f(this.currentShaderProgram.shaderUniforms.uFogEnd, this.uFogEnd);

            gl.uniform3fv(this.currentShaderProgram.shaderUniforms.uFogColor, this.fogColor);


            gl.activeTexture(gl.TEXTURE0);
        }
    }
    deactivateM2Shader () {
        var gl = this.gl;
        var instExt = this.sceneApi.extensions.getInstancingExt();

        if (!this.vao_ext) {
            this.deactivateM2ShaderAttribs()
        }
    }
    activateM2InstancingShader () {
        this.currentShaderProgram = this.m2InstancingShader;
        if (this.currentShaderProgram) {
            var gl = this.gl;
            var instExt = this.sceneApi.extensions.getInstancingExt();
            var shaderAttributes = this.sceneApi.shaders.getShaderAttributes();

            gl.useProgram(this.currentShaderProgram.program);

            gl.uniformMatrix4fv(this.currentShaderProgram.shaderUniforms.uLookAtMat, false, this.lookAtMat4);
            gl.uniformMatrix4fv(this.currentShaderProgram.shaderUniforms.uPMatrix, false, this.perspectiveMatrix);

            gl.uniform1i(this.currentShaderProgram.shaderUniforms.uTexture, 0);
            gl.uniform1i(this.currentShaderProgram.shaderUniforms.uTexture2, 1);

            gl.uniform1f(this.currentShaderProgram.shaderUniforms.uFogStart, this.uFogStart);
            gl.uniform1f(this.currentShaderProgram.shaderUniforms.uFogEnd, this.uFogEnd);

            gl.activeTexture(gl.TEXTURE0);
            gl.enableVertexAttribArray(0);
            gl.enableVertexAttribArray(shaderAttributes.aPosition);
            if (shaderAttributes.aNormal) {
                gl.enableVertexAttribArray(shaderAttributes.aNormal);
            }
            gl.enableVertexAttribArray(shaderAttributes.boneWeights);
            gl.enableVertexAttribArray(shaderAttributes.bones);
            gl.enableVertexAttribArray(shaderAttributes.aTexCoord);
            gl.enableVertexAttribArray(shaderAttributes.aTexCoord2);

            gl.enableVertexAttribArray(shaderAttributes.aPlacementMat + 0);
            gl.enableVertexAttribArray(shaderAttributes.aPlacementMat + 1);
            gl.enableVertexAttribArray(shaderAttributes.aPlacementMat + 2);
            gl.enableVertexAttribArray(shaderAttributes.aPlacementMat + 3);
            gl.enableVertexAttribArray(shaderAttributes.aDiffuseColor);
            if (instExt != null) {
                instExt.vertexAttribDivisorANGLE(shaderAttributes.aPlacementMat + 0, 1);
                instExt.vertexAttribDivisorANGLE(shaderAttributes.aPlacementMat + 1, 1);
                instExt.vertexAttribDivisorANGLE(shaderAttributes.aPlacementMat + 2, 1);
                instExt.vertexAttribDivisorANGLE(shaderAttributes.aPlacementMat + 3, 1);
                instExt.vertexAttribDivisorANGLE(shaderAttributes.aDiffuseColor, 1);
            }

            gl.uniform3fv(this.currentShaderProgram.shaderUniforms.uFogColor, this.fogColor);
        }

    }
    deactivateM2InstancingShader () {
        var gl = this.gl;
        var instExt = this.sceneApi.extensions.getInstancingExt();
        var shaderAttributes = this.sceneApi.shaders.getShaderAttributes();

        gl.disableVertexAttribArray(shaderAttributes.aPosition);
        if (shaderAttributes.aNormal) {
            gl.disableVertexAttribArray(shaderAttributes.aNormal);
        }
        gl.disableVertexAttribArray(shaderAttributes.boneWeights);
        gl.disableVertexAttribArray(shaderAttributes.bones);
        gl.disableVertexAttribArray(shaderAttributes.aTexCoord);
        gl.disableVertexAttribArray(shaderAttributes.aTexCoord2);

        if (instExt) {
            instExt.vertexAttribDivisorANGLE(shaderAttributes.aPlacementMat + 0, 0);
            instExt.vertexAttribDivisorANGLE(shaderAttributes.aPlacementMat + 1, 0);
            instExt.vertexAttribDivisorANGLE(shaderAttributes.aPlacementMat + 2, 0);
            instExt.vertexAttribDivisorANGLE(shaderAttributes.aPlacementMat + 3, 0);
        }
        gl.disableVertexAttribArray(shaderAttributes.aPlacementMat + 0);
        gl.disableVertexAttribArray(shaderAttributes.aPlacementMat + 1);
        gl.disableVertexAttribArray(shaderAttributes.aPlacementMat + 2);
        gl.disableVertexAttribArray(shaderAttributes.aPlacementMat + 3);

        gl.enableVertexAttribArray(0);
    }
    activateBoundingBoxShader () {
        this.currentShaderProgram = this.bbShader;
        if (this.currentShaderProgram) {
            var gl = this.gl;
            gl.useProgram(this.currentShaderProgram.program);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bbBoxVars.ibo_elements);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.bbBoxVars.vbo_vertices);

            //gl.enableVertexAttribArray(this.currentShaderProgram.shaderAttributes.aPosition);
            gl.vertexAttribPointer(this.currentShaderProgram.shaderAttributes.aPosition, 3, gl.FLOAT, false, 0, 0);  // position

            gl.uniformMatrix4fv(this.currentShaderProgram.shaderUniforms.uLookAtMat, false, this.lookAtMat4);
            gl.uniformMatrix4fv(this.currentShaderProgram.shaderUniforms.uPMatrix, false, this.perspectiveMatrix);
        }
    }
    activateFrustumBoxShader () {
        this.currentShaderProgram = this.drawFrustumShader;
        if (this.currentShaderProgram) {
            var gl = this.gl;
            gl.useProgram(this.currentShaderProgram.program);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bbBoxVars.ibo_elements);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.bbBoxVars.vbo_vertices);

            gl.enableVertexAttribArray(this.currentShaderProgram.shaderAttributes.aPosition);
            gl.vertexAttribPointer(this.currentShaderProgram.shaderAttributes.aPosition, 3, gl.FLOAT, false, 0, 0);  // position

            gl.uniformMatrix4fv(this.currentShaderProgram.shaderUniforms.uLookAtMat, false, this.lookAtMat4);
            gl.uniformMatrix4fv(this.currentShaderProgram.shaderUniforms.uPMatrix, false, this.perspectiveMatrix);
        }
    }
    activateSkyShader () {
        this.currentShaderProgram = this.skyShader;
        var gl = this.gl;
        gl.useProgram(this.currentShaderProgram.program);

        gl.enableVertexAttribArray(this.currentShaderProgram.shaderAttributes.aPosition);
        gl.vertexAttribPointer(this.currentShaderProgram.shaderAttributes.aPosition, 2, gl.FLOAT, false, 0, 0);

        // Tweak colours at run-time
        if (this.skyWatchStart === undefined) this.skyWatchStart = performance.now();
        var totalSec = (performance.now() - this.skyWatchStart) / 1000;
        var idx = Math.floor(totalSec / 5) % skyPalettes.length;
        var next = (idx + 1) % skyPalettes.length;
        var f = (totalSec % 5) / 5;
        var z = vec3.create();
        var h = vec3.create();
        vec3.lerp(z, skyPalettes[idx].zenith, skyPalettes[next].zenith, f);
        vec3.lerp(h, skyPalettes[idx].horizon, skyPalettes[next].horizon, f);
        gl.uniform3fv(this.currentShaderProgram.shaderUniforms.uZenithColor, z);
        gl.uniform3fv(this.currentShaderProgram.shaderUniforms.uHorizonColor, h);

        gl.uniform1f(this.currentShaderProgram.shaderUniforms.uExponent, 1.4);
    }
    deactivateSkyShader () {
        // nothing special - no attributes other than aPosition are active
    }
    activateDrawPortalShader () {
        this.currentShaderProgram = this.drawPortalShader;
        if (this.currentShaderProgram) {
            var gl = this.gl;
            gl.useProgram(this.currentShaderProgram.program);

            gl.uniformMatrix4fv(this.currentShaderProgram.shaderUniforms.uLookAtMat, false, this.lookAtMat4);
            gl.uniformMatrix4fv(this.currentShaderProgram.shaderUniforms.uPMatrix, false, this.perspectiveMatrix);
        }
    }
    drawTexturedQuad(gl: WebGLRenderingContext, texture: WebGLTexture | null, x: number, y: number, width: number, height: number,
                     canv_width: number, canv_height: number, drawDepth?: boolean) {
        gl.disable(gl.DEPTH_TEST);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertBuffer);

        gl.vertexAttribPointer(this.drawDepthBuffer.shaderAttributes.position, 2, gl.FLOAT, false, 0, 0);

        gl.uniform1f(this.drawDepthBuffer.shaderUniforms.uWidth, width/canv_width);
        gl.uniform1f(this.drawDepthBuffer.shaderUniforms.uHeight, height/canv_height);
        gl.uniform1f(this.drawDepthBuffer.shaderUniforms.uX, x/canv_width);
        gl.uniform1f(this.drawDepthBuffer.shaderUniforms.uY, y/canv_height);
        gl.uniform1i(this.drawDepthBuffer.shaderUniforms.drawDepth, (drawDepth) ? 1 : 0);

        gl.bindTexture(gl.TEXTURE_2D, texture);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        gl.enable(gl.DEPTH_TEST);
    }
    drawFrameBuffer () {
        var gl = this.gl;

        if (this.enableDeferred){
            gl.bindTexture(gl.TEXTURE_2D, this.colorTexture);
        } else {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.frameBufferColorTexture);

            gl.activeTexture(gl.TEXTURE1);
            if (this.depth_texture_ext) {
                gl.bindTexture(gl.TEXTURE_2D, this.frameBufferDepthTexture);
            } else {
                gl.bindTexture(gl.TEXTURE_2D, this.blackPixelTexture);
            }
        }
        var uniforms = this.currentShaderProgram.shaderUniforms;

        if(uniforms.gauss_offsets) {
            gl.uniform1fv(uniforms.gauss_offsets, [0.0/this.canvas.height, 1.0/this.canvas.height, 2.0/this.canvas.height, 3.0/this.canvas.height, 4.0/this.canvas.height]);
            gl.uniform1fv(uniforms.gauss_weights, [0.2270270270, 0.1945945946, 0.1216216216,0.0540540541, 0.0162162162]);
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertBuffer);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    drawCamera () {
        var gl = this.gl;
        var uniforms = this.currentShaderProgram.shaderUniforms;

        gl.disable(gl.DEPTH_TEST);

        var invViewFrustum = mat4.create();
        mat4.invert(invViewFrustum, this.viewCameraForRender);


        gl.uniformMatrix4fv(uniforms.uInverseViewProjection, false, new Float32Array(invViewFrustum));

        gl.drawElements(gl.LINES, 48, gl.UNSIGNED_SHORT, 0);
        gl.enable(gl.DEPTH_TEST);
    }
    draw (deltaTime: number) {
        var gl = this.gl;
        if (!this.depthBuffer) {
            var depthBuffer = new Uint8Array(this.canvas.width*this.canvas.height*4);
            this.depthBuffer = depthBuffer;
        }

        //this.stats.begin();
        var cameraVector: vec3 | vec4;

        if (config.getUseSecondCamera()) {
            cameraVector = this.secondCamera;
        } else {
            cameraVector = this.mainCamera;
        }

        var farPlane = 400;
        var nearPlane = 1;
        var fov = 45.0;

        //If use camera settings
        //Figure out way to assign the object with camera
        //config.setCameraM2(this.graphManager.m2Objects[0]);
        var m2Object = config.getCameraM2();
        if (m2Object && m2Object.loaded) {
            m2Object.updateCameras(deltaTime);

            var cameraSettings = m2Object.cameras[0];
            farPlane = cameraSettings.farClip;
            nearPlane = cameraSettings.nearClip;
            fov = cameraSettings.fov * 32 * Math.PI / 180;

            this.mainCamera = cameraSettings.currentPosition;
            // JS-BUG: an unanimated M2 camera track gives a 3-component position (calcCameras), so transformMat4 reads w = undefined and the camera becomes NaN - probably needs w = 1
            vec4.transformMat4(this.mainCamera, this.mainCamera, m2Object.placementMatrix);
            this.mainCameraLookAt = cameraSettings.currentTarget;
            vec4.transformMat4(this.mainCameraLookAt, this.mainCameraLookAt, m2Object.placementMatrix);
            cameraVecs = {
                lookAtVec3: this.mainCameraLookAt,
                cameraVec3: this.mainCamera,
                staticCamera: true
            }
        }

        if (this.uFogStart == -1) {
            this.uFogStart = farPlane - 10;
        }
        if (this.uFogEnd == -1) {
            this.uFogEnd = farPlane;
        }

        if (!(m2Object && m2Object.loaded) || config.getUseSecondCamera()){
            this.camera.setCameraPos(cameraVector[0], cameraVector[1], cameraVector[2]);
            var cameraVecs: CameraVecs | M2CameraVecs = this.camera.tick(deltaTime);


            if (config.getUseSecondCamera()) {
                this.secondCamera = cameraVecs.cameraVec3;
                this.secondCameraLookAt = cameraVecs.lookAtVec3;
            } else {
                this.mainCamera = cameraVecs.cameraVec3;
                this.mainCameraLookAt = cameraVecs.lookAtVec3;
            }
        }

        var adt_x = Math.floor((32 - (this.mainCamera[1] / 533.33333)));
        var adt_y = Math.floor((32 - (this.mainCamera[0] / 533.33333)));

        //console.log("adt_x: ", adt_x);
        //console.log("adt_y: ", adt_y);

        //TODO: HACK!!
        for (var x = adt_x-1; x <= adt_x+1; x++) {
            for (var y = adt_y-1; y <= adt_y+1; y++) {
                this.addAdtChunkToCurrentMap(x, y);
            }
        }

        var lookAtMat4: mat4 = [];

        mat4.lookAt(lookAtMat4, this.mainCamera, this.mainCameraLookAt, [0,0,1]);

        //Second camera for debug
        var secondLookAtMat: mat4 = [];
        mat4.lookAt(secondLookAtMat, this.secondCamera, this.secondCameraLookAt, [0,0,1]);

        var perspectiveMatrix = mat4.create();
        mat4.perspective(perspectiveMatrix, fov, this.canvas.width / this.canvas.height, nearPlane, farPlane);
        //var o_height = (this.canvas.height * (533.333/256/* zoom 7 in Alram viewer */))/ 8 ;
        //var o_width = o_height * this.canvas.width / this.canvas.height;
        //mat4.ortho(perspectiveMatrix, -o_width, o_width, -o_height, o_height, 1, 1000);


        var skyPerspectiveMatrix = mat4.create();
        mat4.perspective(skyPerspectiveMatrix, fov, this.canvas.width / this.canvas.height, nearPlane, skyFarPlane);

        var perspectiveMatrixForCulling = mat4.create();
        mat4.perspective(perspectiveMatrixForCulling, fov, this.canvas.width / this.canvas.height, nearPlane, farPlane);

        //Camera for rendering
        var perspectiveMatrixForCameraRender = mat4.create();
        mat4.perspective(perspectiveMatrixForCameraRender, fov, this.canvas.width / this.canvas.height, nearPlane, farPlane);

        var viewCameraForRender = mat4.create();
        mat4.multiply(viewCameraForRender, perspectiveMatrixForCameraRender,lookAtMat4)
        //

        this.perspectiveMatrix = perspectiveMatrix;
        this.viewCameraForRender = viewCameraForRender;
        if (!this.isShadersLoaded) return;

        var cameraPos = vec4.fromValues(
            this.mainCamera[0],
            this.mainCamera[1],
            this.mainCamera[2],
            1
        );
        this.graphManager.setCameraPos(cameraPos);

        //Matrixes from previous frame
        if (this.perspectiveMatrix && this.lookAtMat4) {
            //this.graphManager.checkAgainstDepthBuffer(this.perspectiveMatrix, this.lookAtMat4, this.floatDepthBuffer, this.canvas.width, this.canvas.height);
        }

        this.graphManager.setLookAtMat(lookAtMat4);

        // Update objects
        var updateRes = this.graphManager.update(deltaTime);
        try {
            this.worldObjectManager.update(deltaTime, cameraPos, lookAtMat4, this.camera);
        } catch(e) {
            console.log(e)
        }

        // Sync movement flags from camera to animation state
        if (this.playerAnimState) {
            var playerAnimState = this.playerAnimState;
            playerAnimState.isMovingForward = this.camera.isMovingForward;
            playerAnimState.isMovingBackward = this.camera.isMovingBackward;
            playerAnimState.isStrafingLeft = this.camera.isStrafingLeft;
            playerAnimState.isStrafingRight = this.camera.isStrafingRight;
            playerAnimState.isJumping = this.camera.isJumping;
            playerAnimState.isFalling = this.camera.isFalling;
            playerAnimState.isTurningLeft = this.camera.isTurningLeft;
            playerAnimState.isTurningRight = this.camera.isTurningRight;

            // Cancel casts on movement
            if (this.camera.isMoving && (playerAnimState.isCasting || playerAnimState.isChanneling)) {
                if (this.spellManager) this.spellManager.cancelCast();
            }

            // Evaluate desired animation
            var desiredAnim = playerAnimState.evaluate(deltaTime);
            if (desiredAnim !== null) {
                // Apply to the player's model
                var player = this.worldObjectManager.objectMap[localPlayerGuid];
                if (player && player.objectModel && player.objectModel.loaded && this.animationDataDBC) {
                    setAnimationSafe(player.objectModel.animationManager, desiredAnim, this.animationDataDBC);
                }
            }
        }

        if (this.spellManager) this.spellManager.update(deltaTime);
        if (this.wanderManager) this.wanderManager.update(deltaTime);

        this.graphManager.checkCulling(perspectiveMatrixForCulling, lookAtMat4);
        this.graphManager.sortGeometry(perspectiveMatrixForCulling, lookAtMat4);


        // liquid clock: seconds, wrapped every LiquidClockPeriod
        if (this.liquidClockStart === undefined) this.liquidClockStart = performance.now();
        var liquidTime = ((performance.now() - this.liquidClockStart) / 1000) % LiquidClockPeriod;

        gl.viewport(0,0,this.canvas.width, this.canvas.height);
        if (config.getDoubleCameraDebug()) {
            //Draw static camera
            this.isDebugCamera = true;
            this.lookAtMat4 = secondLookAtMat;
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer);

            this.glClearScreen(gl, this.fogColor);

            gl.activeTexture(gl.TEXTURE0);
            gl.depthMask(true);
            gl.enableVertexAttribArray(0);
            this.graphManager.draw(this.lookAtMat4, perspectiveMatrix, liquidTime);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);

            //Draw debug camera from framebuffer into screen
            this.glClearScreen(gl, this.fogColor);
            this.activateRenderFrameShader();
            gl.viewport(0,0,this.canvas.width, this.canvas.height);
            gl.enableVertexAttribArray(0);
            this.drawFrameBuffer();

            this.isDebugCamera = false;
        }

        //Render real camera
        this.lookAtMat4 = lookAtMat4;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer);
        this.glClearScreen(gl, this.fogColor);

        if (config.getRenderSky()) {
            /* draw the sky bg */
            gl.disable(gl.DEPTH_TEST); // background never writes depth

            if (config.getUseDebugSky()) {
                // Debug sky
                if (this.skyQuadVbo) {
                    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyQuadVbo);
                    this.activateSkyShader();
                    if (config.getRenderSkyPolygons()) {
                        // Wireframe view (F5): the edges of the two triangles
                        gl.drawArrays(gl.LINE_LOOP, 0, 3);
                        gl.drawArrays(gl.LINE_LOOP, 3, 3);
                    } else {
                        gl.drawArrays(gl.TRIANGLES, 0, 6);
                    }
                    this.deactivateSkyShader();
                }
            } else if (this.skies) {
                // Use real sky
                // TODO: use time properly?

                // Cycle
                // start clock on first tick
                if (this.skyClockStart === undefined) this.skyClockStart = performance.now();

                // real seconds -> simulated hour 0-23
                var elapsed = (performance.now() - this.skyClockStart) / 1000;
                var hour = Math.floor(elapsed / SecPerSkyHour) % 24;

                // log only when the hour changes
                if (hour != this.lastHour) {
                    console.log("[Sky] hour " + (hour < 10 ? "0" + hour : hour) + "   daytime ticks " + (hour * TicksPerHour));
                    this.lastHour = hour;
                }

                // Feed the lighting / sky systems
                var daytime = hour * TicksPerHour; // 0, 120, 240 ... 2760

                // the sky gets its own projection, see skyFarPlane
                this.skies.drawSky(this.mainCamera, lookAtMat4, skyPerspectiveMatrix, daytime);

                // Optional: restart the day after 24 h of simulated time
                if (elapsed >= SecPerSkyHour * 24) {
                    this.skyClockStart = performance.now();
                    this.lastHour = -1;
                }
            }

            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            gl.enable(gl.DEPTH_TEST); // restore for everything else
        }

        // Draw lowresterrain
        if (config.getRenderLowresTerrain() && this.lowresTerrain) {
            gl.enable(gl.CULL_FACE);
            gl.disable(gl.DEPTH_TEST);
            // the sky's projection has the far plane my_web_wow draws everything with (850)
            this.lowresTerrain.drawAll(lookAtMat4, skyPerspectiveMatrix, this.fogColor);
            gl.disable(gl.CULL_FACE);
            gl.enable(gl.DEPTH_TEST); // restore for everything else
        }

        gl.activeTexture(gl.TEXTURE0);
        gl.depthMask(true);
        gl.enableVertexAttribArray(0);
        this.graphManager.draw(this.lookAtMat4, perspectiveMatrix, liquidTime);

        // node tracking + world-space debug, composited with the scene
        this.hud.updateNodeTracking();
        this.hud.renderWorldDebug(lookAtMat4, perspectiveMatrix);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        if (!config.getDoubleCameraDebug()) {
            //Draw real camera into screen

            this.glClearScreen(gl, this.fogColor);
            gl.enableVertexAttribArray(0);
            this.activateRenderFrameShader();
            gl.viewport(0,0,this.canvas.width, this.canvas.height);
            this.drawFrameBuffer();
        } else {
            //Draw real camera into square at bottom of screen

            this.activateRenderDepthShader();
            gl.enableVertexAttribArray(0);
            this.drawTexturedQuad(gl, this.frameBufferColorTexture,
                this.canvas.width * 0.60,
                0,//this.canvas.height * 0.75,
                this.canvas.width * 0.40,
                this.canvas.height * 0.40,
                this.canvas.width, this.canvas.height);
        }
        if (config.getDrawDepthBuffer() && this.depth_texture_ext) {
            this.activateRenderDepthShader();
            gl.enableVertexAttribArray(0);
            gl.uniform1f(this.drawDepthBuffer.shaderUniforms.uFarPlane, farPlane);
            gl.uniform1f(this.drawDepthBuffer.shaderUniforms.uNearPlane, nearPlane);

            this.drawTexturedQuad(gl, this.frameBufferDepthTexture,
                this.canvas.width * 0.60,
                0,//this.canvas.height * 0.75,
                this.canvas.width * 0.40,
                this.canvas.height * 0.40,
                this.canvas.width, this.canvas.height,
                true);
        }

        // 2D HUD overlay, drawn straight to the screen
        if (config.getUseHud()) {
            this.hud.renderHud2D(this.hud.buildHudState());
        }


        //this.stats.end();
        if (this.glext_ft && this.glext_ft.frameTerminator) {
            this.glext_ft.frameTerminator();
        }

        return {cameraVecs : cameraVecs!, updateResult : updateRes};
    }
    loadM2File (mddf: AdtM2Placement) {
        return this.sceneApi.objects.loadAdtM2Obj(mddf);
    }
    loadWMOFile(modf: WmoPlacement){
        this.graphManager.loadWmoMap(modf);
    }
    loadMap (mapName: string, x: number, y: number){
        var self = this;
        var wdtFileName = "world/maps/"+mapName+"/"+mapName+".wdt";


        wdtLoader(wdtFileName).then(function success(wdtFile){
            self.currentWdt = wdtFile;
            self.currentMapName = mapName;

            self.initSky();
            self.initLowresTerrain();

            if (wdtFile.isWMOMap) {
                self.graphManager.loadWmoMap(wdtFile.modfChunk!);
            } else {
                var adtFileName = "world/maps/"+mapName+"/"+mapName+"_"+x+"_"+y+".adt";
                self.graphManager.addADTObject(x, y, adtFileName);
            }

        }, function error(){
        })
    }
    addAdtChunkToCurrentMap(x: number,y: number) {
        if (!this.currentWdt) return;
        if (this.currentWdt.isWMOMap) return;

        // Debug
        //for (let testY in this.currentWdt.tileTable) {
        //    // Check that the row exists and is not null
        //    let row = this.currentWdt.tileTable[testY];
        //    if (!row) continue;
        //
        //    for (let testX in row) {
        //        let value = row[x];
        //        if (value !== 0 && value != null) {
        //            console.log(`Value at [${testY}][${testX}] = ${value}`);
        //        }
        //    }
        //}

        if ((x < 0) || (x >= 64) || (y < 0) || (y >= 64)) return;
        if (this.currentWdt.tileTable[y][x]) {
            var adtFileName = "world/maps/"+this.currentMapName+"/"+this.currentMapName+"_"+x+"_"+y+".adt";
            this.graphManager.addADTObject(x, y, adtFileName);
        }
    }
    setCameraPos (x: number, y: number, z: number) {
        this.mainCamera = [x,y,z];
        //this.camera.setCameraPos(x,y,z);
    }
    /* switch between the free roam camera and the player character (needs collision triangles), spawning the character the first time */
    setPlayerMode(enabled: boolean) {
        this.camera.setPlayerMode(enabled);
        if (this.camera.collisionActive && !this.playerCharacterRequested) {
            this.playerCharacterRequested = true;
            // the character's model comes from the creature DBCs, which may still be loading
            var self = this;
            this.unitDbcsLoaded.then(function () {
                self.spawnPlayerCharacter();
            });
        }
    }
    /* the player character, as my_web_wow's hardcoded Player1 (display id 26563, scale 1); worldObjectManager places it */
    spawnPlayerCharacter() {
        var newWorldPlayer = new WorldPlayer(this.sceneApi);
        this.worldObjectManager.objectMap[localPlayerGuid] = newWorldPlayer;
        newWorldPlayer.setDisplayId(26563);
        newWorldPlayer.setNativeDisplayId(26563);
        newWorldPlayer.setScale(1.0);
        newWorldPlayer.manualAnimation = true;
        newWorldPlayer.complete();

        var playerAnimState = new PlayerAnimationState();
        this.playerAnimState = playerAnimState;

        // the player's spells, cast from the character (my_web_wow's WowViewer spell setup)
        var spellManager = new SpellManager(this.sceneApi, this.worldObjectManager, localPlayerGuid);
        spellManager.onAnimationStart = function (animType) {
            if (animType === AnimationType.SpellCast2) // channeling
                playerAnimState.onChannelStart(animType);
            else
                playerAnimState.onCastStart(animType);
        };
        spellManager.onAnimationComplete = function (animType) {
            playerAnimState.onCastComplete(animType);
        };
        spellManager.onCastCanceled = function () {
            playerAnimState.onCastCanceled();
        };
        var hud = this.hud;
        spellManager.onDamage = function (unit, amount, crit) {
            hud.addDamageNumberAtUnit(unit, amount, crit);
        };
        this.spellManager = spellManager;
    }
    /* loads the map's wander nodes from the mpq server (the node debugger, the debug drawing and the Wander mode); resolves to the node count */
    loadGameplayNodes(mapId: number): Promise<number> {
        var nodeManager = new NodeManager(mapId);
        this.nodeManager = nodeManager;
        return nodeManager.loadNodes();
    }
    /* sets an animation on a unit through the AnimationData.dbc names, once its model has loaded */
    setUnitAnimation(unit: WorldUnit, animType: AnimationTypeValue) {
        if (!unit.objectModel || !unit.objectModel.loaded || !this.animationDataDBC) return;
        setAnimationSafe(unit.objectModel.animationManager, animType, this.animationDataDBC);
    }
    /*
     * The Wander mode: my_web_wow's two bots (Player2 and Player3) walking from node to node over the
     * navigation paths, once the nodes (loadGameplayNodes) and the creature DBCs have loaded; resolves to
     * the number of bots.
     */
    startWanderMode(mapId: number): Promise<number> {
        var self = this;
        return this.unitDbcsLoaded.then(function () {
            var nodeManager = self.nodeManager;
            if (!nodeManager || nodeManager.nodes.length === 0) {
                console.log("[WanderManager] Map " + mapId + " has no nodes, wandering unavailable.");
                return 0;
            }

            var wanderManager = new WanderManager(mapId, nodeManager, self.hud, function (unit, animType) {
                self.setUnitAnimation(unit, animType);
            });
            self.wanderManager = wanderManager;

            // Player2 / Player3: [objectMap key, display id, scale]
            var bots: [number, number, number][] = [
                [17786930, 8570, 0.3],
                [17786931, window.selectedExpansion === Expansion.CLASSIC ? 5645 : 21135, 0.3]
            ];
            for (var [key, displayId, scale] of bots) {
                var bot = new WorldPlayer(self.sceneApi);
                bot.setDisplayId(displayId);
                bot.setNativeDisplayId(displayId);
                bot.setScale(scale);
                bot.setRotation(0);
                // the WanderController sets the run / idle animations
                bot.manualAnimation = true;
                bot.complete();
                self.worldObjectManager.objectMap[key] = bot;
                // keeps the worldObjectManager's camera-following of 17786930 off the bot
                self.worldObjectManager.wanderKeys.add(key);

                wanderManager.registerWanderer(key, bot, 7);
            }
            return bots.length;
        });
    }
    /* the CreatureMap / SpellMap modes: creature or spell models at the map's wander nodes, spawned once the creature DBCs have loaded (they pick the models' display ids); resolves to the spawn count */
    startSpawnMode(mapId: number, isSpellMap: boolean): Promise<number> {
        var spawnManager = new SpawnManager(this.sceneApi, this.worldObjectManager, mapId);
        this.spawnManagerMap = spawnManager;
        return this.unitDbcsLoaded.then(function () {
            return spawnManager.initializeAndSpawn(isSpellMap);
        });
    }
    setFogStart(value: number) {
        this.uFogStart  = value;
    }
    setFogEnd(value: number) {
        this.uFogEnd = value;
    }
    setFogColor(value: number[]) {
        this.fogColor = value;
    }
    loadPackets() {
        //this.worldObjectManager.loadAllPacket();
        this.worldObjectManager.startPlayingPackets();
    }
    loadAllPackets() {
        this.worldObjectManager.loadAllPacket();
    }
    copyFirstCameraToDebugCamera() {
        this.secondCamera = this.mainCamera
        this.secondCameraLookAt = this.mainCameraLookAt;
    }
}

export default Scene;
