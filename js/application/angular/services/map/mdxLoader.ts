import linedFileLoader from './../linedfileLoader';
import type { LinedFile, SectionDefinition } from './../linedfileLoader';
import type { Vector3f, Vector4f } from './../fileReadHelper';
import type { Chunk, SectionHandler } from './../chunkedLoader';

/* An animated value: an "ablock" (WotLK) or "ablock_tbc" / "ablock_tbc2" (TBC, classic) - see linedfileLoader.
 * The TBC variants carry their raw counts and offsets as well; only the shared members are listed here. */
export interface M2Track<V> {
    interpolation_type: number;
    global_sequence: number;
    timestampsPerAnimation: number[][];
    valuesPerAnimation: V[][];
}

export interface M2VertexDebug {
    pos: Vector3f;
    bonesWeight: Uint8Array;
    bones: Uint8Array;
    normal: Vector3f;
    textureX: number;
    textureY: number;
    unk1: number;
    unk2: number;
}

export interface M2TextureDefinition {
    texType: number;
    flags: number;
    filenameLen: number;
    ofsFilename: number;
    textureName: string;
}

export interface M2Animation {
    animation_id: number;
    sub_animation_id: number;
    /* read by the 264 / 274 layouts; parseOldFile computes it for the TBC / classic layouts */
    length: number;
    /* TBC / classic layouts only */
    timeStart?: number;
    /* TBC / classic layouts only */
    timeEnd?: number;
    moving_speed: number;
    /* classic layout only */
    loopType?: number;
    flags: number;
    /* not in the classic layout */
    probability?: number;
    /* not in the classic layout */
    _padding?: number;
    minimum_repetitions: number;
    maximum_repetitions: number;
    blend_time: number;
    boundingCorner1: Vector3f;
    boundingCorner2: Vector3f;
    bound_radius: number;
    next_animation: number;
    aliasNext: number;
}

export interface M2Color {
    color: M2Track<Vector3f>;
    alpha: M2Track<number>;
}

export interface M2Transparency {
    values: M2Track<number>;
}

export interface M2Camera {
    type: number;
    fov: number;
    far_clip: number;
    near_clip: number;
    positions: M2Track<Vector3f>;
    position_base: Vector3f;
    target_position: M2Track<Vector3f>;
    target_position_base: Vector3f;
    roll: M2Track<number>;
}

export interface M2Bone {
    key_bone_id: number;
    flags: number;
    parent_bone: number;
    submesh_id: number;
    /* not in the classic layout */
    unk1?: number;
    /* not in the classic layout */
    unk2?: number;
    translation: M2Track<Vector3f>;
    /* uint16Array (264), int16Array (274, TBC) or vector4f (classic) */
    rotation: M2Track<number[] | Vector4f>;
    scale: M2Track<Vector3f>;
    pivot: Vector3f;
}

export interface M2TexAnim {
    translation: M2Track<Vector3f>;
    /* vector4f (264, classic) or int16Array (274, TBC) */
    rotation: M2Track<number[] | Vector4f>;
    scale: M2Track<Vector3f>;
}

export interface M2RenderFlag {
    flags: number;
    blend: number;
}

export interface M2Attachment {
    id: number;
    bone: number;
    unk: number;
    pos: Vector3f;
    animate_attached: M2Track<number>;
}

export interface M2Light {
    type: number;
    bone: number;
    position: Vector3f;
    ambient_color: M2Track<Vector3f>;
    ambient_intensity: M2Track<number>;
    diffuse_color: M2Track<Vector3f>;
    diffuse_intensity: M2Track<number>;
    attenuation_start: M2Track<number>;
    attenuation_end: M2Track<number>;
    unknown: M2Track<number>;
}

/* The parsed M2 header (mdx_ver264 / mdx_ver274 / mdx_ver262 / mdx_ver256) plus fileName.
 * Members only some layouts read are optional; the sections a layout lacks are left unset, and the
 * sections whose count field a layout lacks come out as empty arrays. */
export interface M2File {
    MNameLen: number;
    MNameOffs: number;
    ModelType: number;
    nGlobalSequences: number;
    ofsGlobalSequences: number;
    nAnimations: number;
    ofsAnimations: number;
    /* 264 only */
    nAnimationLookup?: number;
    /* 264 only */
    ofsAnimationLookup?: number;
    /* not in 264 */
    nC?: number;
    /* not in 264 */
    ofsC?: number;
    /* TBC / classic only */
    nD?: number;
    /* TBC / classic only */
    ofsD?: number;
    nBones: number;
    ofsBones: number;
    /* 264 only */
    nKeyBoneLookup?: number;
    /* 264 only */
    ofsKeyBoneLookup?: number;
    /* not in 264 */
    nF?: number;
    /* not in 264 */
    ofsF?: number;
    nVertexes: number;
    ofsVertexes: number;
    nViews: number;
    /* TBC / classic only */
    ofsViews?: number;
    nColors: number;
    ofsColors: number;
    nTextures: number;
    ofsTextures: number;
    nTransparency: number;
    ofsTransparency: number;
    /* TBC / classic only */
    nI?: number;
    /* TBC / classic only */
    ofsI?: number;
    nTexAnims: number;
    ofsTexAnims: number;
    nTexReplace: number;
    ofsTexReplace: number;
    nRenderFlags: number;
    ofsRenderFlags: number;
    /* 264 only */
    nBoneLookupTable?: number;
    /* 264 only */
    ofsBoneLookupTable?: number;
    /* not in 264 */
    nGroupBoneIDs?: number;
    /* not in 264 */
    ofsGroupBoneIDs?: number;
    nTexLookup: number;
    ofsTexLookup: number;
    nTexUnits: number;
    ofsTexUnits: number;
    nTransLookup: number;
    ofsTransLookup: number;
    nTexAnimLookup: number;
    ofsTexAnimLookup: number;
    BoundingCorner1: Vector3f;
    BoundingCorner2: Vector3f;
    BoundingRadius: number;
    Corner1: Vector3f;
    Corner2: Vector3f;
    Radius: number;
    nBoundingTriangles: number;
    ofsBoundingTriangles: number;
    nBoundingVertices: number;
    ofsBoundingVertices: number;
    nBoundingNormals: number;
    ofsBoundingNormals: number;
    nAttachments: number;
    ofsAttachments: number;
    /* 264 only */
    nAttachLookup?: number;
    /* 264 only */
    ofsAttachLookup?: number;
    /* not in 264 */
    nP?: number;
    /* not in 264 */
    ofsP?: number;
    nNumEvents: number;
    ofsNumEvents: number;
    nLights: number;
    ofsLights: number;
    nCameras: number;
    ofsCameras: number;
    nCameraLookup: number;
    ofsCameraLookup: number;
    nRibbonEmitters: number;
    ofsRibbonEmitters: number;
    nParticleEmitters: number;
    ofsParticleEmitters: number;
    /* 264 only */
    nBlendOverrides?: number;
    /* 264 only */
    ofsBlendOverrides?: number;

    vertexes: Uint8Array;
    vertexesDebug: M2VertexDebug[];
    textureDefinition: M2TextureDefinition[];
    globalSequences: number[];
    animations: M2Animation[];
    texLookup: number[];
    colors: M2Color[];
    transparencies: M2Transparency[];
    /* not in the 274 layout */
    cameras?: M2Camera[];
    bones: M2Bone[];
    texAnimLookup: number[];
    /* 264 only, and only when (ModelType & 0x8) > 0 */
    blendOverrides?: number[];
    texAnims: M2TexAnim[];
    transLookup: number[];
    texReplace: number[];
    textUnitLookup: number[];
    renderFlags: M2RenderFlag[];
    /* not in the 274 layout */
    attachments?: M2Attachment[];
    /* not in the 274 layout */
    attachLookups?: number[];
    /* not in the 274 layout */
    animationLookup?: number[];
    /* not in the 274 layout */
    keyBoneLookup?: number[];
    /* not in the 274 layout */
    boneLookupTable?: number[];
    /* not in the 274 layout */
    lights?: M2Light[];

    fileName: string;
}

// WOTLK
const mdx_ver264: SectionDefinition = {
    name : "header",
    type : "layout",
    layout : [
        {name: "MNameLen",              type: "int32"},
        {name: "MNameOffs",             type: "int32"},
        {name: "ModelType",             type: "int32"},
        {name: "nGlobalSequences",      type: "int32"},
        {name: "ofsGlobalSequences",    type: "int32"},
        {name: "nAnimations",           type: "int32"},
        {name: "ofsAnimations",         type: "int32"},
        {name: "nAnimationLookup",      type: "int32"},
        {name: "ofsAnimationLookup",    type: "int32"},
        {name: "nBones",                type: "int32"},
        {name: "ofsBones",              type: "int32"},
        {name: "nKeyBoneLookup",        type: "int32"},
        {name: "ofsKeyBoneLookup",      type: "int32"},
        {name: "nVertexes",             type: "int32"},
        {name: "ofsVertexes",           type: "int32"},
        {name: "nViews",                type: "int32"},
        {name: "nColors",               type: "int32"},
        {name: "ofsColors",             type: "int32"},
        {name: "nTextures",             type: "int32"},
        {name: "ofsTextures",           type: "int32"},
        {name: "nTransparency",         type: "int32"},
        {name: "ofsTransparency",       type: "int32"},
        {name: "nTexAnims",             type: "int32"},
        {name: "ofsTexAnims",           type: "int32"},
        {name: "nTexReplace",           type: "int32"},
        {name: "ofsTexReplace",         type: "int32"},
        {name: "nRenderFlags",          type: "int32"},
        {name: "ofsRenderFlags",        type: "int32"},
        {name: "nBoneLookupTable",      type: "int32"},
        {name: "ofsBoneLookupTable",    type: "int32"},
        {name: "nTexLookup",            type: "int32"},
        {name: "ofsTexLookup",          type: "int32"},
        {name: "nTexUnits",             type: "int32"},
        {name: "ofsTexUnits",           type: "int32"},
        {name: "nTransLookup",          type: "int32"},
        {name: "ofsTransLookup",        type: "int32"},
        {name: "nTexAnimLookup",        type: "int32"},
        {name: "ofsTexAnimLookup",      type: "int32"},
        {name: "BoundingCorner1",       type: "vector3f"},
        {name: "BoundingCorner2",       type: "vector3f"},
        {name: "BoundingRadius",        type: "float32"},
        {name: "Corner1",               type: "vector3f"},
        {name: "Corner2",               type: "vector3f"},
        {name: "Radius",                type: "float32"},
        {name: "nBoundingTriangles",    type: "int32"},
        {name: "ofsBoundingTriangles",  type: "int32"},
        {name: "nBoundingVertices",     type: "int32"},
        {name: "ofsBoundingVertices",   type: "int32"},
        {name: "nBoundingNormals",      type: "int32"},
        {name: "ofsBoundingNormals",    type: "int32"},
        {name: "nAttachments",          type: "int32"},
        {name: "ofsAttachments",        type: "int32"},
        {name: "nAttachLookup",         type: "int32"},
        {name: "ofsAttachLookup",       type: "int32"},
        {name: "nNumEvents",            type: "int32"},
        {name: "ofsNumEvents",          type: "int32"},
        {name: "nLights",               type: "int32"},
        {name: "ofsLights",             type: "int32"},
        {name: "nCameras",              type: "int32"},
        {name: "ofsCameras",            type: "int32"},
        {name: "nCameraLookup",         type: "int32"},
        {name: "ofsCameraLookup",       type: "int32"},
        {name: "nRibbonEmitters",       type: "int32"},
        {name: "ofsRibbonEmitters",     type: "int32"},
        {name: "nParticleEmitters",     type: "int32"},
        {name: "ofsParticleEmitters",   type: "int32"},
        {name: "nBlendOverrides",     type: "int32"},
        {name: "ofsBlendOverrides",   type: "int32"},
        {
            name : "vertexes",
            offset: "ofsVertexes",
            type : 'uint8Array',
            /*
             count : "nVertexes",

             type : "layout",
             layout: [
             {name: "pos",           type : "vector3f"},
             {name: "bonesWeight",   type : "uint8Array", len: 4},
             {name: "bones",         type : "uint8Array", len: 4},
             {name: "normal",        type : "vector3f"},
             {name: "textureX",      type : "float32"},
             {name: "textureY",      type : "float32"},
             {name : "unk1",         type : "int32"},
             {name : "unk2",         type : "int32"}
             ]
             */
            len : function(obj){
                return obj.nVertexes
                    * (
                        (4 * 3)
                        + 4
                        + 4
                        + (4 * 3)
                        + 4
                        + 4
                        + 4
                        + 4
                    );
            }
        },
        {
            name : "vertexesDebug",
            offset: "ofsVertexes",
            count : "nVertexes",

            type : "layout",
            layout: [
                {name: "pos",           type : "vector3f"},
                {name: "bonesWeight",   type : "uint8Array", len: 4},
                {name: "bones",         type : "uint8Array", len: 4},
                {name: "normal",        type : "vector3f"},
                {name: "textureX",      type : "float32"},
                {name: "textureY",      type : "float32"},
                {name : "unk1",         type : "int32"},
                {name : "unk2",         type : "int32"}
            ]
        },
        {
            name : "textureDefinition",
            offset : "ofsTextures",
            count : "nTextures",
            type: "layout",
            layout: [
                {name: "texType",         type : "uint32"},
                {name: "flags",           type : "uint32"},
                {name: "filenameLen",     type : "uint32"},
                {name: "ofsFilename",     type : "uint32"},
                {
                    name: "textureName",
                    offset : "ofsFilename",
                    len : "filenameLen",
                    type: "string"
                }
            ]
        },
        {
            name : "globalSequences",
            offset : "ofsGlobalSequences",
            count : "nGlobalSequences",
            type: "uint32"
        },
        {
            name : "animations",
            offset : "ofsAnimations",
            count : "nAnimations",
            type: "layout",
            layout: [
                //Adapted from http://www.pxr.dk/wowdev/wiki/index.php?title=M2/WotLK#Animation_sequences
                {name: "animation_id",          type: "uint16"},  // Animation id in AnimationData.dbc
                {name: "sub_animation_id",      type: "uint16"},  // Sub-animation id: Which number in a row of animations this one is.
                {name: "length",                type: "uint32"},  // The length (timestamps) of the animation. I believe this actually the length of the animation in milliseconds.
                {name: "moving_speed",          type: "float32"}, // This is the speed the character moves with in this animation.
                {name: "flags",                 type: "uint32"},  // See below.
                {name: "probability",           type: "int16"},   // This is used to determine how often the animation is played. For all animations of the same type, this adds up to 0x7FFF (32767).
                {name: "_padding",              type: "uint16"},
                {name: "minimum_repetitions",   type: "uint32"},  // May both be 0 to not repeat. Client will pick a random number of repetitions within bounds if given.
                {name: "maximum_repetitions",   type: "uint32"},
                {name: "blend_time",            type: "uint32"},  // The client blends (lerp) animation states between animations where the end and start values differ. This specifies how long that blending takes. Values: 0, 50, 100, 150, 200, 250, 300, 350, 500.
                {name: "boundingCorner1",       type: "vector3f"},
                {name: "boundingCorner2",       type: "vector3f"},
                {name: "bound_radius",          type: "float32"},
                {name: "next_animation",        type: "int16"},   // id of the following animation of this AnimationID, points to an Index or is -1 if none.
                {name: "aliasNext",             type: "uint16"}   // id in the list of animations. Used to find actual animation if this sequence is an alias (flags & 0x40)
            ]
        },
        {
            name : "texLookup",
            offset: "ofsTexLookup",
            count : "nTexLookup",
            type: "uint16"
        },
        {
            name : "colors",
            offset: "ofsColors",
            count : "nColors",
            type: "layout",
            layout: [
                {
                    name: "color",
                    type: "ablock",
                    valType: "vector3f"
                },
                {
                    name: "alpha",
                    type: "ablock",
                    valType: "int16"
                }
            ]
        },
        {
            name : "transparencies",
            offset: "ofsTransparency",
            count : "nTransparency",
            type: "layout",
            layout: [
                {
                    name: "values",
                    type: "ablock",
                    valType: "int16"
                }
            ]
        },
        {
            name : "cameras",
            offset: "ofsCameras",
            count : "nCameras",
            type: "layout",
            layout : [
                {name :"type", type: "uint32"}, // 0: portrait, 1: characterinfo; -1: else (flyby etc.); referenced backwards in the lookup table.
                {name :"fov", type: "float32"},// No radians, no degrees. Multiply by 35 to get degrees.
                {name :"far_clip", type: "float32"},
                {name :"near_clip", type: "float32"},
                {
                    // How the camera's position moves. Should be 3*3 floats.
                    name: "positions",
                    type: "ablock",
                    valType: "vector3f"
                },
                { name: "position_base", type: "vector3f" },
                {
                    name: "target_position",
                    type: "ablock",
                    valType: "vector3f"
                },
                { name: "target_position_base", type: "vector3f" },
                {
                    // The camera can have some roll-effect. Its 0 to 2*Pi.
                    name: "roll",
                    type: "ablock",
                    valType: "float32"
                },
            ]
        },
        {
            name : "bones",
            offset: "ofsBones",
            count : "nBones",
            type: "layout",
            layout: [
                {name: "key_bone_id", type: "int32"},
                {name: "flags", type: "uint32"},
                {name: "parent_bone", type: "int16"},
                {name: "submesh_id", type: "uint16"},
                {name: "unk1", type: "uint16"},
                {name: "unk2", type: "uint16"},
                {
                    name: "translation",
                    type: "ablock",
                    valType: "vector3f"
                },
                {
                    name: "rotation",
                    type: "ablock",
                    valType: "uint16Array",
                    len: 4
                },
                {
                    name: "scale",
                    type: "ablock",
                    valType: "vector3f"
                },
                {name: "pivot", type: "vector3f"}
            ]
        },
        /* Animated textures */
        {
            name : "texAnimLookup",
            offset: "ofsTexAnimLookup",
            count: "nTexAnimLookup",
            type: "int16"
        },
        {
            name : "blendOverrides",
            offset: "ofsBlendOverrides",
            count: "nBlendOverrides",
            type: "int16",
            condition: function(a) {
                return (a.ModelType & 0x8) > 0
            }
        },
        {
            name : "texAnims",
            offset : "ofsTexAnims",
            count : "nTexAnims",
            type: "layout",
            layout: [
                {
                    name: "translation",
                    type: "ablock",
                    valType: "vector3f"
                },
                {
                    name: "rotation",
                    type: "ablock",
                    valType: "vector4f",
                    len: 4
                },
                {
                    name: "scale",
                    type: "ablock",
                    valType: "vector3f"
                }
            ]
        },
        {
            name : "transLookup",
            offset: "ofsTransLookup",
            count : "nTransLookup",
            type: "int16"
        },
        {
            name : "texReplace",
            offset: "ofsTexReplace",
            count : "nTexReplace",
            type: "uint16"
        },
        {
            name : "textUnitLookup",
            offset: "ofsTexUnits",
            count : "nTexUnits",
            type: "uint16"
        },
        {
            name : "renderFlags",
            offset: "ofsRenderFlags",
            count : "nRenderFlags",
            type: "layout",
            layout : [
                {name: "flags",         type : "uint16"},
                {name: "blend",         type : "uint16"}
            ]
        },
        {
            name : "attachments",
            offset: "ofsAttachments",
            count: "nAttachments",
            type: "layout",
            layout: [
                {name : "id",   type : "uint32"},
                {name : "bone", type : "uint16"},
                {name : "unk",  type : "uint16"},
                {name : "pos",  type : "vector3f"},
                {
                    name: "animate_attached",
                    type: "ablock",
                    valType: "uint8"
                }
            ]
        },
        {
            name: "attachLookups",
            offset: "ofsAttachLookup",
            count: "nAttachLookup",
            type: "int16"
        }, {
            name: "animationLookup",
            offset: "ofsAnimationLookup",
            count: "nAnimationLookup",
            type: "int16"
        },
        {
            name: "keyBoneLookup",
            offset: "ofsKeyBoneLookup",
            count: "nKeyBoneLookup",
            type: "int16"
        },
        {
            name: "boneLookupTable",
            offset: "ofsBoneLookupTable",
            count: "nBoneLookupTable",
            type: "int16"
        },
        {
            name : "lights",
            offset: "ofsLights",
            count : "nLights",
            type: "layout",
            layout : [
                {name :"type", type: "uint16"},
                {name :"bone", type: "int16"},// No radians, no degrees. Multiply by 35 to get degrees.
                {name: "position", type: "vector3f" },
                {
                    name: "ambient_color",
                    type: "ablock",
                    valType: "vector3f"
                },
                {
                    name: "ambient_intensity",
                    type: "ablock",
                    valType: "float32"
                },
                {
                    name: "diffuse_color",
                    type: "ablock",
                    valType: "vector3f"
                },
                {
                    name: "diffuse_intensity",
                    type: "ablock",
                    valType: "float32"
                },
                {
                    name: "attenuation_start",
                    type: "ablock",
                    valType: "float32"
                },
                {
                    name: "attenuation_end",
                    type: "ablock",
                    valType: "float32"
                },
                {
                    name: "unknown",
                    type: "ablock",
                    valType: "uint8"
                }
            ]
        },

    ]
};

const mdx_ver274: SectionDefinition = {
    name : "header",
    type : "layout",
    layout : [
        {name: "MNameLen",              type: "int32"},
        {name: "MNameOffs",             type: "int32"},
        {name: "ModelType",             type: "int32"},
        {name: "nGlobalSequences",      type: "int32"},
        {name: "ofsGlobalSequences",    type: "int32"},
        {name: "nAnimations",           type: "int32"},
        {name: "ofsAnimations",         type: "int32"},
        {name: "nC",                    type: "int32"},
        {name: "ofsC",                  type: "int32"},
        {name: "nBones",                type: "int32"},
        {name: "ofsBones",              type: "int32"},
        {name: "nF",                    type: "int32"},
        {name: "ofsF",                  type: "int32"},
        {name: "nVertexes",             type: "int32"},
        {name: "ofsVertexes",           type: "int32"},
        {name: "nViews",                type: "int32"},
        {name: "nColors",               type: "int32"},
        {name: "ofsColors",             type: "int32"},
        {name: "nTextures",             type: "int32"},
        {name: "ofsTextures",           type: "int32"},
        {name: "nTransparency",         type: "int32"},
        {name: "ofsTransparency",       type: "int32"},
        {name: "nTexAnims",             type: "int32"},
        {name: "ofsTexAnims",           type: "int32"},
        {name: "nTexReplace",           type: "int32"},
        {name: "ofsTexReplace",         type: "int32"},
        {name: "nRenderFlags",          type: "int32"},
        {name: "ofsRenderFlags",        type: "int32"},
        {name: "nGroupBoneIDs",         type: "int32"},
        {name: "ofsGroupBoneIDs",       type: "int32"},
        {name: "nTexLookup",            type: "int32"},
        {name: "ofsTexLookup",          type: "int32"},
        {name: "nTexUnits",             type: "int32"},
        {name: "ofsTexUnits",           type: "int32"},
        {name: "nTransLookup",          type: "int32"},
        {name: "ofsTransLookup",        type: "int32"},
        {name: "nTexAnimLookup",        type: "int32"},
        {name: "ofsTexAnimLookup",      type: "int32"},
        {name: "BoundingCorner1",       type: "vector3f"},
        {name: "BoundingCorner2",       type: "vector3f"},
        {name: "BoundingRadius",        type: "float32"},
        {name: "Corner1",               type: "vector3f"},
        {name: "Corner2",               type: "vector3f"},
        {name: "Radius",                type: "float32"},
        {name: "nBoundingTriangles",    type: "int32"},
        {name: "ofsBoundingTriangles",  type: "int32"},
        {name: "nBoundingVertices",     type: "int32"},
        {name: "ofsBoundingVertices",   type: "int32"},
        {name: "nBoundingNormals",      type: "int32"},
        {name: "ofsBoundingNormals",    type: "int32"},
        {name: "nAttachments",          type: "int32"},
        {name: "ofsAttachments",        type: "int32"},
        {name: "nP",                    type: "int32"},
        {name: "ofsP",                  type: "int32"},
        {name: "nNumEvents",            type: "int32"},
        {name: "ofsNumEvents",          type: "int32"},
        {name: "nLights",               type: "int32"},
        {name: "ofsLights",             type: "int32"},
        {name: "nCameras",              type: "int32"},
        {name: "ofsCameras",            type: "int32"},
        {name: "nCameraLookup",         type: "int32"},
        {name: "ofsCameraLookup",       type: "int32"},
        {name: "nRibbonEmitters",       type: "int32"},
        {name: "ofsRibbonEmitters",     type: "int32"},
        {name: "nParticleEmitters",     type: "int32"},
        {name: "ofsParticleEmitters",   type: "int32"},
        {
            name : "vertexes",
            offset: "ofsVertexes",
            type : 'uint8Array',
            /*
             count : "nVertexes",

             type : "layout",
             layout: [
             {name: "pos",           type : "vector3f"},
             {name: "bonesWeight",   type : "uint8Array", len: 4},
             {name: "bones",         type : "uint8Array", len: 4},
             {name: "normal",        type : "vector3f"},
             {name: "textureX",      type : "float32"},
             {name: "textureY",      type : "float32"},
             {name : "unk1",         type : "int32"},
             {name : "unk2",         type : "int32"}
             ]
             */
            len : function(obj){
                return obj.nVertexes
                    * (
                        (4 * 3)
                        + 4
                        + 4
                        + (4 * 3)
                        + 4
                        + 4
                        + 4
                        + 4
                    );
            }
        },
        {
            name : "vertexesDebug",
            offset: "ofsVertexes",
            count : "nVertexes",

            type : "layout",
            layout: [
                {name: "pos",           type : "vector3f"},
                {name: "bonesWeight",   type : "uint8Array", len: 4},
                {name: "bones",         type : "uint8Array", len: 4},
                {name: "normal",        type : "vector3f"},
                {name: "textureX",      type : "float32"},
                {name: "textureY",      type : "float32"},
                {name : "unk1",         type : "int32"},
                {name : "unk2",         type : "int32"}
            ]
        },
        {
            name : "textureDefinition",
            offset : "ofsTextures",
            count : "nTextures",
            type: "layout",
            layout: [
                {name: "texType",         type : "uint32"},
                {name: "flags",           type : "uint32"},
                {name: "filenameLen",     type : "uint32"},
                {name: "ofsFilename",     type : "uint32"},
                {
                    name: "textureName",
                    offset : "ofsFilename",
                    len : "filenameLen",
                    type: "string"
                }
            ]
        },
        {
            name : "globalSequences",
            offset : "ofsGlobalSequences",
            count : "nGlobalSequences",
            type: "uint32"
        },
        {
            name : "animations",
            offset : "ofsAnimations",
            count : "nAnimations",
            type: "layout",
            layout: [
                //Adapted from http://www.pxr.dk/wowdev/wiki/index.php?title=M2/WotLK#Animation_sequences
                {name: "animation_id",          type: "uint16"},  // Animation id in AnimationData.dbc
                {name: "sub_animation_id",      type: "uint16"},  // Sub-animation id: Which number in a row of animations this one is.
                {name: "length",                type: "uint32"},  // The length (timestamps) of the animation. I believe this actually the length of the animation in milliseconds.
                {name: "moving_speed",          type: "float32"}, // This is the speed the character moves with in this animation.
                {name: "flags",                 type: "uint32"},  // See below.
                {name: "probability",           type: "int16"},   // This is used to determine how often the animation is played. For all animations of the same type, this adds up to 0x7FFF (32767).
                {name: "_padding",              type: "uint16"},
                {name: "minimum_repetitions",   type: "uint32"},  // May both be 0 to not repeat. Client will pick a random number of repetitions within bounds if given.
                {name: "maximum_repetitions",   type: "uint32"},
                {name: "blend_time",            type: "uint32"},  // The client blends (lerp) animation states between animations where the end and start values differ. This specifies how long that blending takes. Values: 0, 50, 100, 150, 200, 250, 300, 350, 500.
                {name: "boundingCorner1",       type: "vector3f"},
                {name: "boundingCorner2",       type: "vector3f"},
                {name: "bound_radius",          type: "float32"},
                {name: "next_animation",        type: "int16"},   // id of the following animation of this AnimationID, points to an Index or is -1 if none.
                {name: "aliasNext",             type: "uint16"}   // id in the list of animations. Used to find actual animation if this sequence is an alias (flags & 0x40)
            ]
        },
        {
            name : "texLookup",
            offset: "ofsTexLookup",
            count : "nTexLookup",
            type: "uint16"
        },
        {
            name : "colors",
            offset: "ofsColors",
            count : "nColors",
            type: "layout",
            layout: [
                {
                    name: "color",
                    type: "ablock",
                    valType: "vector3f"
                },
                {
                    name: "alpha",
                    type: "ablock",
                    valType: "int16"
                }
            ]
        },
        {
            name : "transparencies",
            offset: "ofsTransparency",
            count : "nTransparency",
            type: "layout",
            layout: [
                {
                    name: "values",
                    type: "ablock",
                    valType: "int16"
                }
            ]
        },
        {
            name : "bones",
            offset: "ofsBones",
            count : "nBones",
            type: "layout",
            layout: [
                {name: "key_bone_id", type: "int32"},
                {name: "flags", type: "uint32"},
                {name: "parent_bone", type: "int16"},
                {name: "submesh_id", type: "uint16"},
                {name: "unk1", type: "uint16"},
                {name: "unk2", type: "uint16"},
                {
                    name: "translation",
                    type: "ablock",
                    valType: "vector3f"
                },
                {
                    name: "rotation",
                    type: "ablock",
                    valType: "int16Array",
                    len: 4
                },
                {
                    name: "scale",
                    type: "ablock",
                    valType: "vector3f"
                },
                {name: "pivot", type: "vector3f"}
            ]
        },
        /* Animated textures */
        {
            name : "texAnimLookup",
            offset: "ofsTexAnimLookup",
            count: "nTexAnimLookup",
            type: "int16"
        },
        {
            name : "texAnims",
            offset : "ofsTexAnims",
            count : "nTexAnims",
            type: "layout",
            layout: [
                {
                    name: "translation",
                    type: "ablock",
                    valType: "vector3f"
                },
                {
                    name: "rotation",
                    type: "ablock",
                    valType: "int16Array",
                    len: 4
                },
                {
                    name: "scale",
                    type: "ablock",
                    valType: "vector3f"
                }
            ]
        },
        {
            name : "transLookup",
            offset: "ofsTransLookup",
            count : "nTransLookup",
            type: "int16"
        },
        {
            name : "texReplace",
            offset: "ofsTexReplace",
            count : "nTexReplace",
            type: "uint16"
        },
        {
            name : "textUnitLookup",
            offset: "ofsTexUnits",
            count : "nTexUnits",
            type: "uint16"
        },
        // JS-BUG: the 274 layout has no cameras, attachments, lookups or lights sections, but animationManager reads animationLookup / keyBoneLookup unconditionally (TypeError for 274 models)
        {
            name : "renderFlags",
            offset: "ofsRenderFlags",
            count : "nRenderFlags",
            type: "layout",
            layout : [
                {name: "flags",         type : "uint16"},
                {name: "blend",         type : "uint16"}
            ]
        }
    ]
};

// TBC
const mdx_ver262: SectionDefinition = {
    name : "header",
    type : "layout",
    layout : [
        {name: "MNameLen",              type: "int32"},
        {name: "MNameOffs",             type: "int32"},
        {name: "ModelType",             type: "int32"},
        {name: "nGlobalSequences",      type: "int32"},
        {name: "ofsGlobalSequences",    type: "int32"},
        {name: "nAnimations",           type: "int32"},
        {name: "ofsAnimations",         type: "int32"},
        {name: "nC",                    type: "int32"},
        {name: "ofsC",                  type: "int32"},
        {name: "nD",                    type: "int32"},
        {name: "ofsD",                  type: "int32"},
        {name: "nBones",                type: "int32"},
        {name: "ofsBones",              type: "int32"},
        {name: "nF",                    type: "int32"},
        {name: "ofsF",                  type: "int32"},
        {name: "nVertexes",             type: "int32"},
        {name: "ofsVertexes",           type: "int32"},
        {name: "nViews",                type: "int32"},
        {name: "ofsViews",             type: "int32"},
        {name: "nColors",               type: "int32"},
        {name: "ofsColors",             type: "int32"},

        {name: "nTextures",             type: "int32"},
        {name: "ofsTextures",           type: "int32"},

        {name: "nTransparency",         type: "int32"},
        {name: "ofsTransparency",       type: "int32"},

        {name: "nI",                    type: "int32"},
        {name: "ofsI",                  type: "int32"},

        {name: "nTexAnims",             type: "int32"},
        {name: "ofsTexAnims",           type: "int32"},

        {name: "nTexReplace",           type: "int32"},
        {name: "ofsTexReplace",         type: "int32"},

        {name: "nRenderFlags",          type: "int32"},
        {name: "ofsRenderFlags",        type: "int32"},

        {name: "nGroupBoneIDs",         type: "int32"},
        {name: "ofsGroupBoneIDs",       type: "int32"},
        {name: "nTexLookup",            type: "int32"},
        {name: "ofsTexLookup",          type: "int32"},
        {name: "nTexUnits",             type: "int32"},
        {name: "ofsTexUnits",           type: "int32"},
        {name: "nTransLookup",          type: "int32"},
        {name: "ofsTransLookup",        type: "int32"},
        {name: "nTexAnimLookup",        type: "int32"},
        {name: "ofsTexAnimLookup",      type: "int32"},

        {name: "BoundingCorner1",       type: "vector3f"},
        {name: "BoundingCorner2",       type: "vector3f"},
        {name: "BoundingRadius",        type: "float32"},
        {name: "Corner1",               type: "vector3f"},
        {name: "Corner2",               type: "vector3f"},
        {name: "Radius",                type: "float32"},
        {name: "nBoundingTriangles",    type: "int32"},
        {name: "ofsBoundingTriangles",  type: "int32"},
        {name: "nBoundingVertices",     type: "int32"},
        {name: "ofsBoundingVertices",   type: "int32"},
        {name: "nBoundingNormals",      type: "int32"},
        {name: "ofsBoundingNormals",    type: "int32"},
        {name: "nAttachments",          type: "int32"},
        {name: "ofsAttachments",        type: "int32"},
        {name: "nP",                    type: "int32"},
        {name: "ofsP",                  type: "int32"},
        {name: "nNumEvents",            type: "int32"},
        {name: "ofsNumEvents",          type: "int32"},

        {name: "nLights",               type: "int32"},
        {name: "ofsLights",             type: "int32"},
        {name: "nCameras",              type: "int32"},
        {name: "ofsCameras",            type: "int32"},
        {name: "nCameraLookup",         type: "int32"},
        {name: "ofsCameraLookup",       type: "int32"},
        {name: "nRibbonEmitters",       type: "int32"},
        {name: "ofsRibbonEmitters",     type: "int32"},
        {name: "nParticleEmitters",     type: "int32"},
        {name: "ofsParticleEmitters",   type: "int32"},
        {
            name : "vertexes",
            offset: "ofsVertexes",
            type : 'uint8Array',

            len : function(obj){
                return obj.nVertexes
                    * (
                        (4 * 3)
                        + 4
                        + 4
                        + (4 * 3)
                        + 4
                        + 4
                        + 4
                        + 4
                    );
            }
        },
        {
            name : "vertexesDebug",
            offset: "ofsVertexes",
            count : "nVertexes",
        
            type : "layout",
            layout: [
                {name: "pos",           type : "vector3f"},
                {name: "bonesWeight",   type : "uint8Array", len: 4},
                {name: "bones",         type : "uint8Array", len: 4},
                {name: "normal",        type : "vector3f"},
                {name: "textureX",      type : "float32"},
                {name: "textureY",      type : "float32"},
                {name : "unk1",         type : "int32"},
                {name : "unk2",         type : "int32"}
            ]
        },
        {
            name : "textureDefinition",
            offset : "ofsTextures",
            count : "nTextures",
            type: "layout",
            layout: [
                {name: "texType",         type : "uint32"},
                {name: "flags",           type : "uint32"},
                {name: "filenameLen",     type : "uint32"},
                {name: "ofsFilename",     type : "uint32"},
                {
                    name: "textureName",
                    offset : "ofsFilename",
                    len : "filenameLen",
                    type: "string"
                }
            ]
        },
        {
            name : "globalSequences",
            offset : "ofsGlobalSequences",
            count : "nGlobalSequences",
            type: "uint32"
        },
        {
            name : "animations",
            offset : "ofsAnimations",
            count : "nAnimations",
            type: "layout",
            layout: [
                // Adapted for tbc
                {name: "animation_id",          type: "uint16"},  // Animation id in AnimationData.dbc
                {name: "sub_animation_id",      type: "uint16"},  // Sub-animation id: Which number in a row of animations this one is.
                {name: "timeStart",                type: "uint32"},  // The length (timestamps) of the animation. I believe this actually the length of the animation in milliseconds.
                {name: "timeEnd",                type: "uint32"},  // The length (timestamps) of the animation. I believe this actually the length of the animation in milliseconds.
                {name: "moving_speed",          type: "float32"}, // This is the speed the character moves with in this animation.
                //{name: "loopType",                 type: "uint32"},  // See below.
                {name: "flags",                 type: "uint32"},  // See below.
                {name: "probability",           type: "int16"},   // This is used to determine how often the animation is played. For all animations of the same type, this adds up to 0x7FFF (32767).
                {name: "_padding",              type: "uint16"},
                {name: "minimum_repetitions",   type: "uint32"},  // May both be 0 to not repeat. Client will pick a random number of repetitions within bounds if given.
                {name: "maximum_repetitions",   type: "uint32"},
                {name: "blend_time",            type: "uint32"},  // The client blends (lerp) animation states between animations where the end and start values differ. This specifies how long that blending takes. Values: 0, 50, 100, 150, 200, 250, 300, 350, 500.
                {name: "boundingCorner1",       type: "vector3f"},
                {name: "boundingCorner2",       type: "vector3f"},
                {name: "bound_radius",          type: "float32"},
                {name: "next_animation",        type: "int16"},   // id of the following animation of this AnimationID, points to an Index or is -1 if none.
                {name: "aliasNext",             type: "uint16"}   // id in the list of animations. Used to find actual animation if this sequence is an alias (flags & 0x40)
            ]
        },
        {
            name : "texLookup",
            offset: "ofsTexLookup",
            count : "nTexLookup",
            type: "uint16"
        },
        {
            name : "colors",
            offset: "ofsColors",
            count : "nColors",
            type: "layout",
            layout: [
                {
                    name: "color",
                    type: "ablock_tbc",
                    valType: "vector3f"
                },
                {
                    name: "alpha",
                    type: "ablock_tbc",
                    valType: "int16"
                }
            ]
        },
        {
            name : "transparencies",
            offset: "ofsTransparency",
            count : "nTransparency",
            type: "layout",
            layout: [
                {
                    name: "values",
                    type: "ablock_tbc",
                    valType: "int16"
                }
            ]
        },

        {
            name : "cameras",
            offset: "ofsCameras",
            count : "nCameras",
            type: "layout",
            layout : [
                {name :"type", type: "uint32"}, // 0: portrait, 1: characterinfo; -1: else (flyby etc.); referenced backwards in the lookup table.
                {name :"fov", type: "float32"},// No radians, no degrees. Multiply by 35 to get degrees.
                {name :"far_clip", type: "float32"},
                {name :"near_clip", type: "float32"},
                {
                    // How the camera's position moves. Should be 3*3 floats.
                    name: "positions",
                    type: "ablock_tbc",
                    valType: "vector3f"
                },
                { name: "position_base", type: "vector3f" },
                {
                    name: "target_position",
                    type: "ablock_tbc",
                    valType: "vector3f"
                },
                { name: "target_position_base", type: "vector3f" },
                {
                    // The camera can have some roll-effect. Its 0 to 2*Pi.
                    name: "roll",
                    type: "ablock_tbc",
                    valType: "float32"
                },
            ]
        },

        {
            name : "bones",
            offset: "ofsBones",
            count : "nBones",
            type: "layout",
            layout: [
                {name: "key_bone_id", type: "int32"},
                {name: "flags", type: "uint32"},
                {name: "parent_bone", type: "int16"},
                {name: "submesh_id", type: "uint16"},
                {name: "unk1", type: "uint16"},
                {name: "unk2", type: "uint16"},
                {
                    name: "translation",
                    type: "ablock_tbc2",
                    valType: "vector3f"
                },
                {
                    name: "rotation",
                    type: "ablock_tbc2",
                    valType: "int16Array",
                    len: 4
                },
                {
                    name: "scale",
                    type: "ablock_tbc2",
                    valType: "vector3f"
                },
                {name: "pivot", type: "vector3f"}
            ]
        },
        /* Animated textures */
        {
            name : "texAnimLookup",
            offset: "ofsTexAnimLookup",
            count: "nTexAnimLookup",
            type: "int16"
        },
        {
            name : "texAnims",
            offset : "ofsTexAnims",
            count : "nTexAnims",
            type: "layout",
            layout: [
                {
                    name: "translation",
                    type: "ablock_tbc",
                    valType: "vector3f"
                },
                {
                    name: "rotation",
                    type: "ablock_tbc",
                    valType: "int16Array",
                    len: 4
                },
                {
                    name: "scale",
                    type: "ablock_tbc",
                    valType: "vector3f"
                }
            ]
        },
        {
            name : "transLookup",
            offset: "ofsTransLookup",
            count : "nTransLookup",
            type: "int16"
        },
        {
            name : "texReplace",
            offset: "ofsTexReplace",
            count : "nTexReplace",
            type: "uint16"
        },
        {
            name : "textUnitLookup",
            offset: "ofsTexUnits",
            count : "nTexUnits",
            type: "uint16"
        },
        {
            name : "renderFlags",
            offset: "ofsRenderFlags",
            count : "nRenderFlags",
            type: "layout",
            layout : [
                {name: "flags",         type : "uint16"},
                {name: "blend",         type : "uint16"}
            ]
        },
        {
            name : "attachments",
            offset: "ofsAttachments",
            count: "nAttachments",
            type: "layout",
            layout: [
                {name : "id",   type : "uint32"},
                {name : "bone", type : "uint16"},
                {name : "unk",  type : "uint16"},
                {name : "pos",  type : "vector3f"},
                {
                    name: "animate_attached",
                    type: "ablock_tbc",
                    valType: "uint8"
                }
            ]
        },
        // JS-BUG: this header has no nAttachLookup / nAnimationLookup / nKeyBoneLookup / nBoneLookupTable (they are the unnamed nC / nF / ... fields), so these four lookups always come out empty
        {
            name: "attachLookups",
            offset: "ofsAttachLookup",
            count: "nAttachLookup",
            type: "int16"
        }, {
            name: "animationLookup",
            offset: "ofsAnimationLookup",
            count: "nAnimationLookup",
            type: "int16"
        },
        {
            name: "keyBoneLookup",
            offset: "ofsKeyBoneLookup",
            count: "nKeyBoneLookup",
            type: "int16"
        },
        {
            name: "boneLookupTable",
            offset: "ofsBoneLookupTable",
            count: "nBoneLookupTable",
            type: "int16"
        },
        {
            name : "lights",
            offset: "ofsLights",
            count : "nLights",
            type: "layout",
            layout : [
                {name :"type", type: "uint16"},
                {name :"bone", type: "int16"},// No radians, no degrees. Multiply by 35 to get degrees.
                {name: "position", type: "vector3f" },
                {
                    name: "ambient_color",
                    type: "ablock_tbc",
                    valType: "vector3f"
                },
                {
                    name: "ambient_intensity",
                    type: "ablock_tbc",
                    valType: "float32"
                },
                {
                    name: "diffuse_color",
                    type: "ablock_tbc",
                    valType: "vector3f"
                },
                {
                    name: "diffuse_intensity",
                    type: "ablock_tbc",
                    valType: "float32"
                },
                {
                    name: "attenuation_start",
                    type: "ablock_tbc",
                    valType: "float32"
                },
                {
                    name: "attenuation_end",
                    type: "ablock_tbc",
                    valType: "float32"
                },
                {
                    name: "unknown",
                    type: "ablock_tbc",
                    valType: "uint8"
                }
            ]
        },
    ]
};

// Classic
const mdx_ver256: SectionDefinition = {
    name : "header",
    type : "layout",
    layout : [
        {name: "MNameLen",              type: "int32"},
        {name: "MNameOffs",             type: "int32"},
        {name: "ModelType",             type: "int32"},
        {name: "nGlobalSequences",      type: "int32"},
        {name: "ofsGlobalSequences",    type: "int32"},
        {name: "nAnimations",           type: "int32"},
        {name: "ofsAnimations",         type: "int32"},
        {name: "nC",                    type: "int32"},
        {name: "ofsC",                  type: "int32"},
        {name: "nD",                    type: "int32"},
        {name: "ofsD",                  type: "int32"},
        {name: "nBones",                type: "int32"},
        {name: "ofsBones",              type: "int32"},
        {name: "nF",                    type: "int32"},
        {name: "ofsF",                  type: "int32"},
        {name: "nVertexes",             type: "int32"},
        {name: "ofsVertexes",           type: "int32"},
        {name: "nViews",                type: "int32"},
        {name: "ofsViews",             type: "int32"},
        {name: "nColors",               type: "int32"},
        {name: "ofsColors",             type: "int32"},

        {name: "nTextures",             type: "int32"},
        {name: "ofsTextures",           type: "int32"},

        {name: "nTransparency",         type: "int32"},
        {name: "ofsTransparency",       type: "int32"},

        {name: "nI",                    type: "int32"},
        {name: "ofsI",                  type: "int32"},

        {name: "nTexAnims",             type: "int32"},
        {name: "ofsTexAnims",           type: "int32"},

        {name: "nTexReplace",           type: "int32"},
        {name: "ofsTexReplace",         type: "int32"},

        {name: "nRenderFlags",          type: "int32"},
        {name: "ofsRenderFlags",        type: "int32"},

        {name: "nGroupBoneIDs",         type: "int32"},
        {name: "ofsGroupBoneIDs",       type: "int32"},
        {name: "nTexLookup",            type: "int32"},
        {name: "ofsTexLookup",          type: "int32"},
        {name: "nTexUnits",             type: "int32"},
        {name: "ofsTexUnits",           type: "int32"},
        {name: "nTransLookup",          type: "int32"},
        {name: "ofsTransLookup",        type: "int32"},
        {name: "nTexAnimLookup",        type: "int32"},
        {name: "ofsTexAnimLookup",      type: "int32"},

        {name: "BoundingCorner1",       type: "vector3f"},
        {name: "BoundingCorner2",       type: "vector3f"},
        {name: "BoundingRadius",        type: "float32"},
        {name: "Corner1",               type: "vector3f"},
        {name: "Corner2",               type: "vector3f"},
        {name: "Radius",                type: "float32"},
        {name: "nBoundingTriangles",    type: "int32"},
        {name: "ofsBoundingTriangles",  type: "int32"},
        {name: "nBoundingVertices",     type: "int32"},
        {name: "ofsBoundingVertices",   type: "int32"},
        {name: "nBoundingNormals",      type: "int32"},
        {name: "ofsBoundingNormals",    type: "int32"},
        {name: "nAttachments",          type: "int32"},
        {name: "ofsAttachments",        type: "int32"},
        {name: "nP",                    type: "int32"},
        {name: "ofsP",                  type: "int32"},
        {name: "nNumEvents",            type: "int32"},
        {name: "ofsNumEvents",          type: "int32"},

        {name: "nLights",               type: "int32"},
        {name: "ofsLights",             type: "int32"},
        {name: "nCameras",              type: "int32"},
        {name: "ofsCameras",            type: "int32"},
        {name: "nCameraLookup",         type: "int32"},
        {name: "ofsCameraLookup",       type: "int32"},
        {name: "nRibbonEmitters",       type: "int32"},
        {name: "ofsRibbonEmitters",     type: "int32"},
        {name: "nParticleEmitters",     type: "int32"},
        {name: "ofsParticleEmitters",   type: "int32"},
        {
            name : "vertexes",
            offset: "ofsVertexes",
            type : 'uint8Array',

            len : function(obj){
                return obj.nVertexes
                    * (
                        (4 * 3)
                        + 4
                        + 4
                        + (4 * 3)
                        + 4
                        + 4
                        + 4
                        + 4
                    );
            }
        },
        {
            name : "vertexesDebug",
            offset: "ofsVertexes",
            count : "nVertexes",
        
            type : "layout",
            layout: [
                {name: "pos",           type : "vector3f"},
                {name: "bonesWeight",   type : "uint8Array", len: 4},
                {name: "bones",         type : "uint8Array", len: 4},
                {name: "normal",        type : "vector3f"},
                {name: "textureX",      type : "float32"},
                {name: "textureY",      type : "float32"},
                {name : "unk1",         type : "int32"},
                {name : "unk2",         type : "int32"}
            ]
        },
        {
            name : "textureDefinition",
            offset : "ofsTextures",
            count : "nTextures",
            type: "layout",
            layout: [
                {name: "texType",         type : "uint32"},
                {name: "flags",           type : "uint32"},
                {name: "filenameLen",     type : "uint32"},
                {name: "ofsFilename",     type : "uint32"},
                {
                    name: "textureName",
                    offset : "ofsFilename",
                    len : "filenameLen",
                    type: "string"
                }
            ]
        },
        {
            name : "globalSequences",
            offset : "ofsGlobalSequences",
            count : "nGlobalSequences",
            type: "uint32"
        },
        {
            name : "animations",
            offset : "ofsAnimations",
            count : "nAnimations",
            type: "layout",
            layout: [
                // Adapted for tbc
                //{name: "animation_id",          type: "uint32"},  // Animation id in AnimationData.dbc
                {name: "animation_id",          type: "uint16"},  // Animation id in AnimationData.dbc
                {name: "sub_animation_id",      type: "uint16"},  // Sub-animation id: Which number in a row of animations this one is.
                {name: "timeStart",                type: "uint32"},  // The length (timestamps) of the animation. I believe this actually the length of the animation in milliseconds.
                {name: "timeEnd",                type: "uint32"},  // The length (timestamps) of the animation. I believe this actually the length of the animation in milliseconds.
                {name: "moving_speed",          type: "float32"}, // This is the speed the character moves with in this animation.
                {name: "loopType",                 type: "uint32"},  // See below.
                {name: "flags",                 type: "uint32"},  // See below.
                {name: "minimum_repetitions",   type: "uint32"},  // May both be 0 to not repeat. Client will pick a random number of repetitions within bounds if given.
                {name: "maximum_repetitions",   type: "uint32"},
                {name: "blend_time",            type: "uint32"},  // The client blends (lerp) animation states between animations where the end and start values differ. This specifies how long that blending takes. Values: 0, 50, 100, 150, 200, 250, 300, 350, 500.
                {name: "boundingCorner1",       type: "vector3f"},
                {name: "boundingCorner2",       type: "vector3f"},
                {name: "bound_radius",          type: "float32"},
                {name: "next_animation",        type: "int16"},   // id of the following animation of this AnimationID, points to an Index or is -1 if none.
                {name: "aliasNext",             type: "uint16"}   // id in the list of animations. Used to find actual animation if this sequence is an alias (flags & 0x40)
            ]
        },
        {
            name : "texLookup",
            offset: "ofsTexLookup",
            count : "nTexLookup",
            type: "uint16"
        },
        {
            name : "colors",
            offset: "ofsColors",
            count : "nColors",
            type: "layout",
            layout: [
                {
                    name: "color",
                    type: "ablock_tbc",
                    valType: "vector3f"
                },
                {
                    name: "alpha",
                    type: "ablock_tbc",
                    valType: "int16"
                }
            ]
        },
        {
            name : "transparencies",
            offset: "ofsTransparency",
            count : "nTransparency",
            type: "layout",
            layout: [
                {
                    name: "values",
                    type: "ablock_tbc",
                    valType: "int16"
                }
            ]
        },

        {
            name : "cameras",
            offset: "ofsCameras",
            count : "nCameras",
            type: "layout",
            layout : [
                {name :"type", type: "uint32"}, // 0: portrait, 1: characterinfo; -1: else (flyby etc.); referenced backwards in the lookup table.
                {name :"fov", type: "float32"},// No radians, no degrees. Multiply by 35 to get degrees.
                {name :"far_clip", type: "float32"},
                {name :"near_clip", type: "float32"},
                {
                    // How the camera's position moves. Should be 3*3 floats.
                    name: "positions",
                    type: "ablock_tbc",
                    valType: "vector3f"
                },
                { name: "position_base", type: "vector3f" },
                {
                    name: "target_position",
                    type: "ablock_tbc",
                    valType: "vector3f"
                },
                { name: "target_position_base", type: "vector3f" },
                {
                    // The camera can have some roll-effect. Its 0 to 2*Pi.
                    name: "roll",
                    type: "ablock_tbc",
                    valType: "float32"
                },
            ]
        },

        {
            name : "bones",
            offset: "ofsBones",
            count : "nBones",
            type: "layout",
            layout: [
                {name: "key_bone_id", type: "int32"},
                {name: "flags", type: "uint32"},
                {name: "parent_bone", type: "int16"},
                {name: "submesh_id", type: "uint16"},
                {
                    name: "translation",
                    type: "ablock_tbc2",
                    valType: "vector3f"
                },
                {
                    name: "rotation",
                    type: "ablock_tbc2",
                    //valType: "int16Array",
                    //len: 4
                    valType: "vector4f"
                },
                {
                    name: "scale",
                    type: "ablock_tbc2",
                    valType: "vector3f"
                },
                {name: "pivot", type: "vector3f"}
            ]
        },
        /* Animated textures */
        {
            name : "texAnimLookup",
            offset: "ofsTexAnimLookup",
            count: "nTexAnimLookup",
            type: "int16"
        },
        {
            name : "texAnims",
            offset : "ofsTexAnims",
            count : "nTexAnims",
            type: "layout",
            layout: [
                {
                    name: "translation",
                    type: "ablock_tbc",
                    valType: "vector3f"
                },
                {
                    name: "rotation",
                    type: "ablock_tbc",
                    //valType: "int16Array",
                    //len: 4
                    valType: "vector4f"
                },
                {
                    name: "scale",
                    type: "ablock_tbc",
                    valType: "vector3f"
                }
            ]
        },
        {
            name : "transLookup",
            offset: "ofsTransLookup",
            count : "nTransLookup",
            type: "int16"
        },
        {
            name : "texReplace",
            offset: "ofsTexReplace",
            count : "nTexReplace",
            type: "uint16"
        },
        {
            name : "textUnitLookup",
            offset: "ofsTexUnits",
            count : "nTexUnits",
            type: "uint16"
        },
        {
            name : "renderFlags",
            offset: "ofsRenderFlags",
            count : "nRenderFlags",
            type: "layout",
            layout : [
                {name: "flags",         type : "uint16"},
                {name: "blend",         type : "uint16"}
            ]
        },
        {
            name : "attachments",
            offset: "ofsAttachments",
            count: "nAttachments",
            type: "layout",
            layout: [
                {name : "id",   type : "uint32"},
                {name : "bone", type : "uint16"},
                {name : "unk",  type : "uint16"},
                {name : "pos",  type : "vector3f"},
                {
                    name: "animate_attached",
                    type: "ablock_tbc",
                    valType: "uint8"
                }
            ]
        },
        // JS-BUG: this header has no nAttachLookup / nAnimationLookup / nKeyBoneLookup / nBoneLookupTable (they are the unnamed nC / nF / ... fields), so these four lookups always come out empty
        {
            name: "attachLookups",
            offset: "ofsAttachLookup",
            count: "nAttachLookup",
            type: "int16"
        }, {
            name: "animationLookup",
            offset: "ofsAnimationLookup",
            count: "nAnimationLookup",
            type: "int16"
        },
        {
            name: "keyBoneLookup",
            offset: "ofsKeyBoneLookup",
            count: "nKeyBoneLookup",
            type: "int16"
        },
        {
            name: "boneLookupTable",
            offset: "ofsBoneLookupTable",
            count: "nBoneLookupTable",
            type: "int16"
        },
        {
            name : "lights",
            offset: "ofsLights",
            count : "nLights",
            type: "layout",
            layout : [
                {name :"type", type: "uint16"},
                {name :"bone", type: "int16"},// No radians, no degrees. Multiply by 35 to get degrees.
                {name: "position", type: "vector3f" },
                {
                    name: "ambient_color",
                    type: "ablock_tbc",
                    valType: "vector3f"
                },
                {
                    name: "ambient_intensity",
                    type: "ablock_tbc",
                    valType: "float32"
                },
                {
                    name: "diffuse_color",
                    type: "ablock_tbc",
                    valType: "vector3f"
                },
                {
                    name: "diffuse_intensity",
                    type: "ablock_tbc",
                    valType: "float32"
                },
                {
                    name: "attenuation_start",
                    type: "ablock_tbc",
                    valType: "float32"
                },
                {
                    name: "attenuation_end",
                    type: "ablock_tbc",
                    valType: "float32"
                },
                {
                    name: "unknown",
                    type: "ablock_tbc",
                    valType: "uint8"
                }
            ]
        },
    ]
};

const mdxTablePerVersion: { [version: string]: SectionDefinition } = {
    "256" : mdx_ver256,
    "260" : mdx_ver262,
    "261" : mdx_ver262,
    "262" : mdx_ver262,
    "263" : mdx_ver262,
    "264" : mdx_ver264,
    "272" : mdx_ver264,
    "274" : mdx_ver274
};

const mdxChunked: { [chunkIdent: string]: (mdxObj: M2File, chunk: Chunk) => void } = {
    'DIFA' : function (mdxObj, chunk) {

    },
    'DIFB' : function (mdxObj, chunk) {

    },
    'DIFP': function (mdxObj, chunk) {
        var offset = {offs: 0};
    },
    'DIFS': function (mdxObj, chunk) {
        var offset = {offs: 0};
    },
    '12DM': function (mdxObj, chunk) {
        var offset = {offs: 0};
        var arrayBuffer = chunk.sliceArrayBuffer(chunk.chunkOffset+8, chunk.chunkOffset+8+chunk.chunkLen);
        var fileObj = linedFileLoader("", arrayBuffer);
        var resultMDXObject = parseOldFile(fileObj);
        console.log("wtf");

        // JS-BUG: $ (jQuery) is neither imported nor loaded, so this throws a ReferenceError (probably meant Object.assign(mdxObj, resultMDXObject))
        // @ts-expect-error $ is not declared anywhere; ported as-is
        $.extend(mdxObj, resultMDXObject);
    }
};

function parseOldFile(fileObject: LinedFile): M2File {
    var offset = {offs : 0};
    var fileIdent =  fileObject.readNZTString(offset, 4);
    var fileVersion = fileObject.readInt32(offset); //is this really version?
    // Debug
    //console.log(`fileVersion: ${fileVersion}`);

    var mdxDescription = mdxTablePerVersion[fileVersion];

    if (mdxDescription == undefined) {
        let errorMessage = "Unknown MDX file version = " + fileVersion;
        console.error(errorMessage);
        throw errorMessage;
    }

    /* Parse the header */
    var resultMDXObject = {} as M2File;
    try {
        resultMDXObject = fileObject.parseSectionDefinition(resultMDXObject, mdxDescription, fileObject, offset) as M2File;

        if (Array.isArray(resultMDXObject.animations)) {
            resultMDXObject.animations.forEach((anim) => {
                if (
                    anim.hasOwnProperty("timeStart") &&
                    anim.hasOwnProperty("timeEnd")
                ) {
                    // Create length property
                    // TODO: is this correct?
                    if (anim.timeStart! > anim.timeEnd!)
                    {
                        var timeStartTemp = anim.timeStart!;
                        anim.timeStart = anim.timeEnd;
                        // JS-BUG: a swap would assign timeStartTemp; subtracting makes timeEnd (old end - old start) negative and length -(old start) (the TODO above doubts it too)
                        anim.timeEnd! -= timeStartTemp;
                    }
                    anim.length = anim.timeEnd! - anim.timeStart!;
                }
            });
        }

        // Debug
        //console.log("resultMDXObject:", resultMDXObject);
    } catch (e) {
        throw e;
    }
    return resultMDXObject;
}


class BaseMdxChunkedLoader {
    getHandler(sectionName: string): SectionHandler | undefined {
        // JS-BUG: handlerTable is not declared anywhere (probably meant mdxChunked), so every call throws a ReferenceError
        // @ts-expect-error handlerTable is not declared anywhere; ported as-is
        return handlerTable[sectionName];
    }
}
const mdxChunkedLoader = new BaseMdxChunkedLoader();


export default function(filePath: string): Promise<M2File> {
    // Debug
    //console.log(`loading file: ${filePath}`);
    var promise = linedFileLoader(filePath);

    var newPromise = promise.then(function success(fileObject){
        /* Read the header */
        var offset = {offs : 0};
        var fileIdent = fileObject.readNZTString(offset, 4);
        // Debug
        //console.log(`fileIdent: ${fileIdent}`);

        /* Check the ident */
        if (fileIdent != "MD20" && fileIdent != "MD21"){
            var errorMessage = "Unknown MDX file ident = " + fileIdent + ", filepath = " +  filePath;
            //$log.error(errorMessage);
            console.error(errorMessage);
            throw errorMessage;
        }

        if (fileIdent == 'MD21') {
            var resultMDXObject = {} as M2File;
            // JS-BUG: chunkedLoader is not imported, so every MD21 model fails here with a ReferenceError (the promise rejects)
            // @ts-expect-error chunkedLoader is not imported in this module; ported as-is
            var chunkedFile = chunkedLoader(filePath, fileObject.getArrayBuffer());
            chunkedFile.setSectionReaders(mdxChunkedLoader);
            chunkedFile.processFile(resultMDXObject);

            return resultMDXObject;
        } else {
            /* Check the version */

            resultMDXObject = parseOldFile(fileObject);
        }
        /* Debug
        if (resultMDXObject.bones.filter((a) => ((a.flags & 0x40) > 0)).length > 0){
            $log.info("File "+ filePath + " has cylindric billboarding bones")
        }
        */

        resultMDXObject.fileName = filePath;
        return resultMDXObject;
    },
    // JS-BUG: the rejection handler returns errorObj, so a failed load resolves with the error as if it were the M2File
    function error(errorObj: unknown): M2File {
        return errorObj as M2File;
    });

    return newPromise;
}
