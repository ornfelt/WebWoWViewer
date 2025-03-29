import linedFileLoader from './../linedfileLoader.js';
import Expansion from '../../Expansion.js';

const skinDefinition = {
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

const mdx_ver262 = {
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

export default function(filePath) {
    var promise = linedFileLoader(filePath);

    // HEHE: to test without models (for tbc and classic debugging)
    //return true;

    // Debug
    //console.log("Loading skin file:", filePath);

    var newPromise = promise.then(function success(fileObject){
            var resultSkinObject = {
                header : {},
                modelHeader: {}
            };

            /* Read the header */
            var offset = {offs : 0};

            if (window.selectedExpansion !== Expansion.WOTLK) {
              offset.offs += 8;
              resultSkinObject.modelHeader = fileObject.parseSectionDefinition(resultSkinObject, mdx_ver262, fileObject, offset);
              //console.log("SKIN resultSkinObject:", resultSkinObject);
              offset.offs = resultSkinObject.modelHeader.ofsViews;
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

            resultSkinObject.header = fileObject.parseSectionDefinition(resultSkinObject, skinDefinition, fileObject, offset);

            // Debug
            console.log("SKIN resultSkinObject:", resultSkinObject);

            resultSkinObject.fileName = filePath;
            return resultSkinObject;
        },
        function error(errorObj){
            return errorObj;
        });

    return newPromise;
}
