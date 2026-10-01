import linedFileLoader from './../linedfileLoader';
import type { SectionDefinition } from './../linedfileLoader';
import type { Vector3f } from './../fileReadHelper';
import Expansion from '../../Expansion';

export interface SkinSubMesh {
    meshID: number;
    vStart: number;
    vCount: number;
    StartTriangle: number;
    nTriangles: number;
    nBones: number;
    OfsBoneList: number;
    boneInfluences: number;
    rootBone: number;
    pos: Vector3f;
    /* not in the classic layout */
    centerBoundingBox?: Vector3f;
    /* not in the classic layout */
    radius?: number;
}

export interface SkinTex {
    flags: number;
    shaderId: number;
    submeshIndex: number;
    submesh_index2: number;
    colorIndex: number;
    renderFlagIndex: number;
    layer: number;
    op_count: number;
    textureIndex: number;
    textureUnitNum: number;
    transpIndex: number;
    textureAnim: number;
}

/* skinDefinition / skinDefinitionClassic */
export interface SkinHeader {
    nIndex: number;
    ofsIndex: number;
    nTris: number;
    ofsTris: number;
    nProps: number;
    ofsProps: number;
    nSub: number;
    ofsSub: number;
    nTex: number;
    ofsTex: number;
    LOD: number;
    indexes: number[];
    triangles: number[];
    subMeshes: SkinSubMesh[];
    texs: SkinTex[];
}

/* mdx_ver262 - the M2 header, read before the embedded skin of a pre-WotLK model */
export interface SkinModelHeader {
    MNameLen: number;
    MNameOffs: number;
    ModelType: number;
    nGlobalSequences: number;
    ofsGlobalSequences: number;
    nAnimations: number;
    ofsAnimations: number;
    nC: number;
    ofsC: number;
    nD: number;
    ofsD: number;
    nBones: number;
    ofsBones: number;
    nF: number;
    ofsF: number;
    nVertexes: number;
    ofsVertexes: number;
    nViews: number;
    ofsViews: number;
    nColors: number;
    ofsColors: number;
    nTextures: number;
    ofsTextures: number;
    nTransparency: number;
    ofsTransparency: number;
    nI: number;
    ofsI: number;
    nTexAnims: number;
    ofsTexAnims: number;
    nTexReplace: number;
    ofsTexReplace: number;
    nRenderFlags: number;
    ofsRenderFlags: number;
    nGroupBoneIDs: number;
    ofsGroupBoneIDs: number;
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
    nP: number;
    ofsP: number;
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
}

export interface SkinFile {
    header: SkinHeader;
    /* empty for WotLK, the parsed mdx_ver262 header otherwise */
    modelHeader: Partial<SkinModelHeader>;
    fileName: string;
}

const skinDefinition: SectionDefinition = {
    name: "header",
    type: "layout",
    layout: [
        {name: "nIndex", type: "int32"},
        {name: "ofsIndex", type: "int32"},
        {name: "nTris", type: "int32"},
        {name: "ofsTris", type: "int32"},
        {name: "nProps", type: "int32"},
        {name: "ofsProps", type: "int32"},
        {name: "nSub", type: "int32"},
        {name: "ofsSub", type: "int32"},
        {name: "nTex", type: "int32"},
        {name: "ofsTex", type: "int32"},
        {name: "LOD", type: "int32"} ,

        {
            name: "indexes",
            offset: "ofsIndex",
            len : "nIndex",
            type : "uint16Array"
        },
        {
            name: "triangles",
            offset: "ofsTris",
            len : "nTris",
            type : "uint16Array"
        },
        {
            name: "subMeshes",
            offset: "ofsSub",
            count : "nSub",
            type : "layout",
            layout : [
                {name : "meshID",         type: "int32"},
                {name : "vStart",         type: "uint16"},
                {name : "vCount",         type: "uint16"},
                {name : "StartTriangle",  type: "uint16"},
                {name : "nTriangles",     type: "uint16"},
                {name : "nBones",         type: "uint16"},
                {name : "OfsBoneList",    type: "uint16"},
                {name : "boneInfluences", type: "uint16"},
                {name : "rootBone",       type: "uint16"},
                {name : "pos",            type: "vector3f"},
                {name : "centerBoundingBox",         type: "vector3f"},
                {name : "radius",       type: "float32"},
            ]
        },
        {
            name: "texs",
            offset: "ofsTex",
            count : "nTex",
            type : "layout",
            layout : [
                {name : "flags",               type: "uint16"},
                {name : "shaderId",            type: "int16"},
                {name : "submeshIndex",        type: "uint16"},
                {name : "submesh_index2",      type: "uint16"},
                {name : "colorIndex",          type: "int16"},
                {name : "renderFlagIndex",     type: "uint16"},
                {name : "layer",               type: "uint16"},
                {name : "op_count",            type: "uint16"},
                {name : "textureIndex",        type: "uint16"},
                {name : "textureUnitNum",      type: "uint16"},
                {name : "transpIndex",         type: "uint16"},
                {name : "textureAnim",         type: "uint16"}
            ]
        }
    ]
};

const skinDefinitionClassic: SectionDefinition = {
    name: "header",
    type: "layout",
    layout: [
        {name: "nIndex", type: "int32"},
        {name: "ofsIndex", type: "int32"},
        {name: "nTris", type: "int32"},
        {name: "ofsTris", type: "int32"},
        {name: "nProps", type: "int32"},
        {name: "ofsProps", type: "int32"},
        {name: "nSub", type: "int32"},
        {name: "ofsSub", type: "int32"},
        {name: "nTex", type: "int32"},
        {name: "ofsTex", type: "int32"},
        {name: "LOD", type: "int32"} ,

        {
            name: "indexes",
            offset: "ofsIndex",
            len : "nIndex",
            type : "uint16Array"
        },
        {
            name: "triangles",
            offset: "ofsTris",
            len : "nTris",
            type : "uint16Array"
        },
        {
            name: "subMeshes",
            offset: "ofsSub",
            count : "nSub",
            type : "layout",
            layout : [
                {name : "meshID",         type: "int32"},
                {name : "vStart",         type: "uint16"},
                {name : "vCount",         type: "uint16"},
                {name : "StartTriangle",  type: "uint16"},
                {name : "nTriangles",     type: "uint16"},
                {name : "nBones",         type: "uint16"},
                {name : "OfsBoneList",    type: "uint16"},
                {name : "boneInfluences", type: "uint16"},
                {name : "rootBone",       type: "uint16"},
                {name : "pos",            type: "vector3f"},
                //{name : "centerBoundingBox",         type: "vector3f"},
                //{name : "radius",       type: "float32"},
            ]
        },
        {
            name: "texs",
            offset: "ofsTex",
            count : "nTex",
            type : "layout",
            layout : [
                {name : "flags",               type: "uint16"},
                {name : "shaderId",            type: "int16"},
                {name : "submeshIndex",        type: "uint16"},
                {name : "submesh_index2",      type: "uint16"},
                {name : "colorIndex",          type: "int16"},
                {name : "renderFlagIndex",     type: "uint16"},
                {name : "layer",               type: "uint16"},
                {name : "op_count",            type: "uint16"},
                {name : "textureIndex",        type: "uint16"},
                {name : "textureUnitNum",      type: "uint16"},
                {name : "transpIndex",         type: "uint16"},
                {name : "textureAnim",         type: "uint16"}
            ]
        }
    ]
};

const mdx_ver262: SectionDefinition = {
    name : "modelHeader",
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
  ]
};

export default function(filePath: string): Promise<SkinFile> {
    var promise = linedFileLoader(filePath);

    // HEHE: to test without models (for tbc and classic debugging)
    //return true;

    // Debug
    //console.log("Loading skin file:", filePath);

    var newPromise = promise.then(function success(fileObject){
            var resultSkinObject = {
                header : {},
                modelHeader: {}
            } as SkinFile;

            /* Read the header */
            var offset = {offs : 0};

            if (window.selectedExpansion !== Expansion.WOTLK) {
              offset.offs += 8;
              resultSkinObject.modelHeader = fileObject.parseSectionDefinition(resultSkinObject, mdx_ver262, fileObject, offset) as SkinModelHeader;
              //console.log("SKIN resultSkinObject:", resultSkinObject);
              offset.offs = resultSkinObject.modelHeader.ofsViews!;
              //console.log("SKIN TBC views offset:", offset);
            }
            else {
              var fileIdent = fileObject.readNZTString(offset, 4);
              //var fileVersion  = fileObject.readInt32(offset); //is this really version?

              /* Check the ident */
              if (fileIdent != "SKIN"){
                  var errorMessage = "Unknown SKIN file ident = "+ fileIdent + ", filepath = " +  filePath;
                  //$log.error(errorMessage);
                  console.error(errorMessage);
                  throw errorMessage;
              }
            }

            /* Parse the header */

            if (window.selectedExpansion === Expansion.CLASSIC) {
              resultSkinObject.header = fileObject.parseSectionDefinition(resultSkinObject, skinDefinitionClassic, fileObject, offset) as SkinHeader;
            } else {
              resultSkinObject.header = fileObject.parseSectionDefinition(resultSkinObject, skinDefinition, fileObject, offset) as SkinHeader;
            }

            // Debug
            //console.log("SKIN resultSkinObject:", resultSkinObject);

            resultSkinObject.fileName = filePath;
            return resultSkinObject;
        });

    return newPromise;
}
