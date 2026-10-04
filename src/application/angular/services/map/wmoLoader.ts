import chunkedLoader from '../chunkedLoader';
import type { Chunk, ChunkHandlerWithSubChunks, SectionHandler, SectionReaders } from '../chunkedLoader';
import fileReadHelper from './../fileReadHelper';
import type { Quaternion, Vector3f, Vector4f } from './../fileReadHelper';

/* Group file (wmoGroupLoader) */

export interface WmoMogp {
    GroupName: number;
    dGroupName: number;
    Flags: number;
    BoundBoxCorner1: Vector3f;
    BoundBoxCorner2: Vector3f;
    moprIndex: number;
    numItems: number;
    numBatchesA: number;
    numBatchesB: number;
    numBatchesC: number;
    Indeces: Uint8Array;
    Unk1: number;
    groupID: number;
    Unk2: number;
    Unk3: number;
    /* the group's liquid type: a LiquidType.dbc id when the root's MOHD flags have 0x4 (WotLK) */
    groupLiquid: number;
}

/* MLIQ: the liquid of a group, in the WMO's local coordinates */
export interface WmoLiquid {
    xverts: number;
    yverts: number;
    xtiles: number;
    ytiles: number;
    corner: Vector3f;
    /* into the root's MOMT */
    materialId: number;
    /* xverts * yverts, row by row */
    heights: number[];
    /* xtiles * ytiles, row by row */
    tileFlags: Uint8Array;
}

/* MOBA record */
export interface WmoRenderBatch {
    unk: Uint8Array;
    startIndex: number;
    count: number;
    minIndex: number;
    maxIndex: number;
    flags: number;
    tex: number;
}

/* MOBN record */
export interface WmoBspNode {
    planeType: number;
    children1: number;
    children2: number;
    numFaces: number;
    firstFace: number;
    fDist: number;
}

/* verticles, normals and the texture coordinates are flat float arrays: the only caller
 * (wmoGeomCache) passes loadPlainVertexes = true. The other branch is broken, see its JS-BUG.
 * The optional fields belong to chunks a group may lack; the others are in every group file. */
export interface WmoGroupFile {
    /* initialised to [] before the file is processed, replaced by the second MOCV */
    colorVerticles2: Uint8Array | never[];
    /* initialised to [] before the file is processed, replaced by the second MOTV */
    textCoords2: number[];
    mogp: WmoMogp;
    indicies: number[];
    verticles: number[];
    normals: number[];
    textCoords: number[];
    firstMotvLoaded?: boolean;
    secondMotvLoaded?: boolean;
    textCoords3?: number[];
    colorVerticles?: Uint8Array;
    doodadRefs?: number[];
    renderBatches: WmoRenderBatch[];
    nodes: WmoBspNode[];
    mobr: number[];
    liquid?: WmoLiquid;
}

/* Root file (wmoLoader) */

/* MOGI record */
export interface WmoGroupInfo {
    flags: number;
    bb1: Vector3f;
    bb2: Vector3f;
    nameoffset: number;
}

/* MOPT record */
export interface WmoPortalInfo {
    base_index: number;
    index_count: number;
    plane: Vector4f;
}

/* MOPR record */
export interface WmoPortalRelation {
    portal_index: number;
    group_index: number;
    side: number;
    unk: number;
}

/* MOLT record */
export interface WmoLight {
    lightType: number;
    type: number;
    useAtten: number;
    pad: number;
    color: number;
    position: Vector3f;
    intensity: number;
    attenStart: number;
    attenEnd: number;
    unk1: number;
    unk2: number;
    unk3: number;
    unk4: number;
}

/* MOMT record */
export interface WmoMaterial {
    flags1: number;
    shader: number;
    blendMode: number;
    namestart1: number;
    color1: number;
    flags_1: number;
    namestart2: number;
    color2: number;
    flags_2: number;
    color_3: number;
    unk: number;
    dx: number[];
    textureName1: string;
    textureName2: string;
}

/* MODS record */
export interface WmoDoodadSet {
    name: string;
    index: number;
    number: number;
    unused: number;
}

/* MODD record */
export interface WmoDoodad {
    nameIndex: number;
    modelName: string;
    pos: Vector3f;
    rotation: Quaternion;
    scale: number;
    color: number;
}

/* MFOG */
export interface WmoFog {
    flag: number;
    pos: Vector3f;
    smaller_radius: number;
    larger_radius: number;
    fog_end: number;
    fog_startScalar: number;
    fog_color: number;
    fog_colorF: number[];
    underwater_fog_end: number;
    underwater_fog_startScalar: number;
    underwater_fog_color: number;
    underwater_fog_colorF: number[];
}

/* A chunk handler is not called for an empty chunk; the chunks a WMO may lack leave their field unset */
export interface WmoFile {
    nTextures: number;
    nGroups: number;
    nPortals: number;
    nLights: number;
    nModels: number;
    nDoodads: number;
    nDoodadSets: number;
    ambColor: number;
    unk1: number;
    BoundBoxCorner1: Vector3f;
    BoundBoxCorner2: Vector3f;
    WMOId: number;
    /* 0x4: the groups' groupLiquid is a LiquidType.dbc id */
    flags: number;
    groupInfos: WmoGroupInfo[];
    portalVerticles?: number[];
    portalInfos?: WmoPortalInfo[];
    portalRelations?: WmoPortalRelation[];
    lights?: WmoLight[];
    momt: WmoMaterial[];
    motx: Uint8Array;
    modn?: Uint8Array;
    mods: WmoDoodadSet[];
    modd?: WmoDoodad[];
    mfog: WmoFog;
}

type WmoHandlerTable = { [sectionName: string]: SectionHandler };

function wmoGroupLoader(wmoFilePath: string, loadPlainVertexes: boolean): Promise<WmoGroupFile> {
    var wmogroup_ver17: WmoHandlerTable = {
        "MOGP" : {
            "MOGP": function (groupWMOObject: WmoGroupFile, chunk: Chunk) {
                var offset = {offs : 0};
                var mogp = {} as WmoMogp;

                mogp.GroupName       = chunk.readInt32(offset);
                mogp.dGroupName      = chunk.readInt32(offset);
                mogp.Flags           = chunk.readUint32(offset);
                mogp.BoundBoxCorner1 = chunk.readVector3f(offset);
                mogp.BoundBoxCorner2 = chunk.readVector3f(offset);
                mogp.moprIndex       = chunk.readInt16(offset);
                mogp.numItems        = chunk.readInt16(offset);
                mogp.numBatchesA     = chunk.readInt16(offset);
                mogp.numBatchesB     = chunk.readInt16(offset);
                mogp.numBatchesC     = chunk.readInt16(offset);
                // JS-BUG: the uint16 after numBatchesC is not read, so Indeces, Unk1, groupID, Unk2 and Unk3 are read 2 bytes early (the returned offset is right again thanks to the 10-byte skip); none of them is used today
                mogp.Indeces         = chunk.readUint8Array(offset, 4);
                mogp.Unk1            = chunk.readInt32(offset);
                mogp.groupID         = chunk.readInt32(offset);
                mogp.Unk2            = chunk.readInt32(offset);
                mogp.Unk3            = chunk.readInt32(offset);

                /* Skip 14 more bytes */
                offset.offs += 10;

                // read on its own: the fields above are read 2 bytes early (see the JS-BUG)
                mogp.groupLiquid     = chunk.readUint32({offs: 0x34});

                groupWMOObject.mogp = mogp;

                return offset;
            },
            subChunks : {
                "MOPY": function (groupWMOObject: WmoGroupFile, chunk: Chunk) {
                    //Materials. Ignore for now
                    var offset = {offs: 0};
                    var mopy = {};

                    // JS-BUG: a chunk has no length property (getLength() or chunkLen was meant), so n is NaN; unused, harmless
                    // @ts-expect-error Chunk has no length - see the JS-BUG above
                    var n = chunk.length / 2;
                },
                "MOVI": function (groupWMOObject: WmoGroupFile, chunk: Chunk) {
                    // Indices.
                    var indicesLen = chunk.chunkLen / 2;
                    groupWMOObject.indicies = chunk.readUint16Array({offs:0}, indicesLen);

                },
                "MOVT": function (groupWMOObject: WmoGroupFile, chunk: Chunk) {
                    if (loadPlainVertexes) {
                        groupWMOObject.verticles = chunk.readFloat32Array({offs: 0}, chunk.chunkLen/4)
                    } else {
                        var verticesLen = chunk.chunkLen/ 12;
                        // JS-BUG: readVector3f reads a single vector and ignores the count, so this branch stores one Vector3f instead of all vertices; unreachable today (wmoGeomCache always passes loadPlainVertexes = true)
                        // @ts-expect-error readVector3f takes no count and returns one Vector3f, not number[] - see the JS-BUG above
                        groupWMOObject.verticles = chunk.readVector3f({offs: 0}, verticesLen);
                    }
                },
                "MONR": function (groupWMOObject: WmoGroupFile, chunk: Chunk) {
                    var normalsLen = chunk.chunkLen/ 12;
                    if (loadPlainVertexes) {
                        groupWMOObject.normals = chunk.readFloat32Array({offs: 0}, chunk.chunkLen/4);
                    } else {
                        // JS-BUG: readVector3f reads a single vector (see MOVT); unreachable today
                        // @ts-expect-error readVector3f takes no count and returns one Vector3f, not number[] - see the JS-BUG above
                        groupWMOObject.normals = chunk.readVector3f({offs: 0}, normalsLen);
                    }
                },
                "MOTV": function (groupWMOObject: WmoGroupFile, chunk: Chunk) {

                    var textureCoordsLen = chunk.chunkLen / 8;

                    var textCoords: number[];
                    if (loadPlainVertexes) {
                        textCoords = chunk.readFloat32Array({offs: 0}, chunk.chunkLen/4);
                    } else {
                        // JS-BUG: readVector2f reads a single vector (see MOVT); unreachable today
                        // @ts-expect-error readVector2f takes no count and returns one Vector2f, not number[] - see the JS-BUG above
                        textCoords = chunk.readVector2f({offs:0}, textureCoordsLen)
                    }
                    if ( !groupWMOObject.firstMotvLoaded) {
                        groupWMOObject.textCoords = textCoords;
                        groupWMOObject.firstMotvLoaded = true;
                    } else if (!groupWMOObject.secondMotvLoaded){
                        groupWMOObject.textCoords2 = textCoords;
                        groupWMOObject.secondMotvLoaded = true;
                    } else {
                        groupWMOObject.textCoords3 = textCoords;
                    }
                },
                "MOCV": function (groupWMOObject: WmoGroupFile, chunk: Chunk) {
                    var offset = {offs : 0};
                    var cvLen = chunk.chunkLen / 4;
                    /*
                     var colorArray = [];
                     for (var i = 0; i < cvLen; i++) {
                     var color = {};
                     var b = chunk.readUint8(offset) / 255;
                     var g = chunk.readUint8(offset) / 255;
                     var r = chunk.readUint8(offset) / 255;
                     var a = chunk.readUint8(offset) / 255;

                     //colorArray.push(color);
                     colorArray.push(r);
                     colorArray.push(g);
                     colorArray.push(b);
                     colorArray.push(a);
                     } */
                    var colorArray = chunk.readUint8Array({offs:0}, chunk.chunkLen);
                    if (groupWMOObject.colorVerticles == undefined) {
                        groupWMOObject.colorVerticles = colorArray;
                    } else {
                        groupWMOObject.colorVerticles2 = colorArray;
                    }
                },
                "MODR": function (groupWMOObject: WmoGroupFile, chunk: Chunk) {
                    var offset = {offs : 0};
                    var len = chunk.chunkLen / 2;
                    var doodadRefs = chunk.readUint16Array(offset, len);

                    groupWMOObject.doodadRefs = doodadRefs;
                },
                "MOBA": function (groupWMOObject: WmoGroupFile, chunk: Chunk) {
                    var offset = {offs : 0};
                    var len = chunk.chunkLen / 24;

                    var renderBatches: WmoRenderBatch[] = [];
                    for (var i = 0; i < Math.floor(len); i++) {
                        var renderBatch = {} as WmoRenderBatch;
                        renderBatch.unk = chunk.readUint8Array(offset, 12);

                        renderBatch.startIndex = chunk.readUint32(offset);
                        renderBatch.count      = chunk.readUint16(offset);
                        renderBatch.minIndex   = chunk.readInt16(offset);
                        renderBatch.maxIndex   = chunk.readInt16(offset);
                        renderBatch.flags      = chunk.readInt8(offset);
                        renderBatch.tex        = chunk.readUint8(offset);

                        renderBatches.push(renderBatch);
                    }

                    groupWMOObject.renderBatches = renderBatches;
                },
                "MOBN" : function (groupWMOObject: WmoGroupFile, chunk: Chunk) {
                    var offset = {offs : 0};
                    var len = chunk.chunkLen / 16;
                    var nodes: WmoBspNode[] = new Array(len);
                    for (var i = 0; i < len; i++) {
                        var node = {} as WmoBspNode;

                        node.planeType = chunk.readUint16(offset);
                        node.children1 = chunk.readInt16(offset);
                        node.children2 = chunk.readInt16(offset);
                        node.numFaces = chunk.readUint16(offset);
                        node.firstFace = chunk.readUint32(offset);
                        node.fDist = chunk.readFloat32(offset);
                        nodes[i] = node;
                    }

                    groupWMOObject.nodes = nodes;
                },
                "MOBR" : function (groupWMOObject: WmoGroupFile, chunk: Chunk) {
                    var offset = {offs : 0};
                    var len = chunk.chunkLen / 2;
                    groupWMOObject.mobr = chunk.readUint16Array(offset, len);
                },
                "MLIQ" : function (groupWMOObject: WmoGroupFile, chunk: Chunk) {
                    var offset = {offs : 0};
                    var liquid = {} as WmoLiquid;

                    liquid.xverts     = chunk.readInt32(offset);
                    liquid.yverts     = chunk.readInt32(offset);
                    liquid.xtiles     = chunk.readInt32(offset);
                    liquid.ytiles     = chunk.readInt32(offset);
                    liquid.corner     = chunk.readVector3f(offset);
                    liquid.materialId = chunk.readUint16(offset);

                    // per vertex: 4 bytes of flow (water) or texture coordinates (magma), then the height
                    var vCount = liquid.xverts * liquid.yverts;
                    liquid.heights = new Array(vCount);
                    for (var i = 0; i < vCount; i++) {
                        offset.offs += 4;
                        liquid.heights[i] = chunk.readFloat32(offset);
                    }

                    liquid.tileFlags = chunk.readUint8Array(offset, liquid.xtiles * liquid.ytiles);

                    groupWMOObject.liquid = liquid;
                }
            }
        } as unknown as ChunkHandlerWithSubChunks // the subChunks member cannot satisfy ChunkHandlerWithSubChunks' index signature
    };

    function BaseGroupWMOLoader(this: SectionReaders) {
        var handlerTable: WmoHandlerTable = {
            "MVER" : function (wmoObject: WmoGroupFile, chunk: Chunk) {
                if (chunk.chunkIdent !== "MVER") {
                    throw "Got bad group WMO file " + wmoFilePath;
                }
                var version = chunk.readInt32({offs: 0});
                //$log.info("Loading ", wmoFilePath, ", version ", version);

                /* Versioning */
                if (version == 17) {
                    handlerTable = wmogroup_ver17;
                }
            }
        };

        this.getHandler = function (sectionName: string) {
            return handlerTable[sectionName];
        }
    }

    var promise = chunkedLoader(wmoFilePath);
    var newPromise = promise.then(function (chunkedFile) {
        /* First chunk in file has to be MVER */

        var wmoObj = {
            colorVerticles2 : [],
            textCoords2 : []
        } as unknown as WmoGroupFile;
        chunkedFile.setSectionReaders(new (BaseGroupWMOLoader as unknown as new () => SectionReaders)());
        chunkedFile.processFile(wmoObj);

        return wmoObj;
    });

    return newPromise;
}
function wmoLoader(wmoFilePath: string): Promise<WmoFile> {
    var wmo_ver17: WmoHandlerTable = {
        "MOHD" : function(wmoObj: WmoFile, chunk: Chunk) {
            var offset = {offs: 0};
            wmoObj.nTextures = chunk.readInt32(offset);
            wmoObj.nGroups = chunk.readInt32(offset);
            wmoObj.nPortals = chunk.readInt32(offset);
            wmoObj.nLights = chunk.readInt32(offset);
            wmoObj.nModels = chunk.readInt32(offset);
            wmoObj.nDoodads = chunk.readInt32(offset);
            wmoObj.nDoodadSets = chunk.readInt32(offset);
            wmoObj.ambColor = chunk.readUint32(offset);
            wmoObj.unk1 = chunk.readInt32(offset);

            wmoObj.BoundBoxCorner1 = chunk.readVector3f(offset);
            wmoObj.BoundBoxCorner2 = chunk.readVector3f(offset);

            wmoObj.WMOId = chunk.readInt32(offset);

            // MOHD is 64 bytes: the wmo id comes before the bounding box (read as unk1), so the WMOId above
            // is really the flags (uint16) and the LOD count (uint16); the flags are read on their own
            wmoObj.flags = chunk.readUint16({offs: 60});
        },
        "MOGI" : function (wmoObj: WmoFile, chunk: Chunk) {
            var offset = {offs: 0};

            var groupInfos: WmoGroupInfo[] = [];
            for (var i = 0; i < wmoObj.nGroups; i++) {
                var groupInfo = {} as WmoGroupInfo;
                groupInfo.flags = chunk.readUint32(offset);
                groupInfo.bb1 = chunk.readVector3f(offset);
                groupInfo.bb2 = chunk.readVector3f(offset);
                groupInfo.nameoffset = chunk.readInt32(offset);

                groupInfos.push(groupInfo);
            }

            wmoObj.groupInfos = groupInfos;
        },
        "MLIQ" : function (wmoObj: WmoFile, chunk: Chunk) {

        },
        "MOPV": function (wmoObj: WmoFile, chunk: Chunk) {
            var offset = {offs: 0};
            var arrayLen = chunk.chunkLen/4;

            wmoObj.portalVerticles = chunk.readFloat32Array({offs: 0}, arrayLen)
        },
        "MOPT" : function (wmoObj: WmoFile, chunk: Chunk) {
            var offset = {offs: 0};
            var recordCount = chunk.chunkLen / 20;
            var portalInfos: WmoPortalInfo[] = new Array(recordCount);

            for (var i = 0; i < recordCount; i++) {
                var portalInfo = {} as WmoPortalInfo;
                portalInfo.base_index = chunk.readUint16(offset);
                portalInfo.index_count = chunk.readUint16(offset);
                portalInfo.plane = chunk.readVector4f(offset);

                portalInfos[i] = portalInfo;
            }

            wmoObj.portalInfos = portalInfos;
        },
        "MOPR" : function (wmoObj: WmoFile, chunk: Chunk) {
            var offset = {offs: 0};
            var recordCount = chunk.chunkLen / 8;
            var portalRelations: WmoPortalRelation[] = new Array(recordCount);
            for (var i = 0; i < recordCount; i++) {
                var portalRelation = {} as WmoPortalRelation;
                portalRelation.portal_index = chunk.readUint16(offset);  // into MOPR
                portalRelation.group_index = chunk.readUint16(offset);   // the other one
                portalRelation.side = chunk.readInt16(offset);          // positive or negative.
                portalRelation.unk = chunk.readInt16(offset);

                portalRelations[i] = portalRelation;
            }

            wmoObj.portalRelations = portalRelations;
        },
        "MOLT": function (wmoObj: WmoFile, chunk: Chunk) {
            var offset = {offs: 0};
            var recordLen = chunk.chunkLen / wmoObj.nLights;
            var lightsArr: WmoLight[] = [];
            for (var i = 0; i < wmoObj.nLights; i++) {
                var lightRecord = {} as WmoLight;
                lightRecord.lightType = chunk.readUint8(offset);
                lightRecord.type      = chunk.readUint8(offset);
                lightRecord.useAtten  = chunk.readUint8(offset);
                lightRecord.pad       = chunk.readUint8(offset);
                lightRecord.color     = chunk.readUint32(offset);    // Color (B,G,R,A)
                lightRecord.position  = chunk.readVector3f(offset);  // Position (X,Y,Z)
                lightRecord.intensity = chunk.readFloat32(offset);
                lightRecord.attenStart = chunk.readFloat32(offset);
                lightRecord.attenEnd = chunk.readFloat32(offset);
                lightRecord.unk1 = chunk.readFloat32(offset);
                lightRecord.unk2 = chunk.readFloat32(offset);
                lightRecord.unk3 = chunk.readFloat32(offset);
                lightRecord.unk4 = chunk.readFloat32(offset);

                lightsArr.push(lightRecord);
            }

            wmoObj.lights = lightsArr;
        },
        "MOMT": function (wmoObj: WmoFile, chunk: Chunk) {
            var offset = {offs: 0};
            var textures: WmoMaterial[] = [];
            var textureNames = wmoObj.motx;
            for (var i = 0; i < wmoObj.nTextures; i++) {
                var textureData = {} as WmoMaterial;

                textureData.flags1 = chunk.readUint32(offset);
                textureData.shader = chunk.readUint32(offset);
                textureData.blendMode = chunk.readUint32(offset);
                textureData.namestart1 = chunk.readInt32(offset);
                textureData.color1 = chunk.readUint32(offset);
                textureData.flags_1 = chunk.readInt32(offset);
                textureData.namestart2 = chunk.readInt32(offset);
                textureData.color2 = chunk.readUint32(offset);
                textureData.flags_2 = chunk.readInt32(offset);
                textureData.color_3 = chunk.readUint32(offset);
                textureData.unk = chunk.readInt32(offset);
                textureData.dx = chunk.readInt32Array(offset, 5);

                textureData.textureName1 = fileReadHelper(textureNames.buffer as ArrayBuffer).readString({offs : textureData.namestart1}, textureNames.length);
                textureData.textureName2 = fileReadHelper(textureNames.buffer as ArrayBuffer).readString({offs : textureData.namestart2}, textureNames.length);

                textures.push(textureData);
            }

            wmoObj.momt = textures;
        },
        "MOTX": function (wmoObj: WmoFile, chunk: Chunk) {
            var offset = {offs: 0};
            var textureNames = chunk.readUint8Array(offset, chunk.chunkLen);

            wmoObj.motx = textureNames;
        },
        "MODN": function (wmoObj: WmoFile, chunk: Chunk) {
            var offset = {offs: 0};
            var modelNames = chunk.readUint8Array(offset, chunk.chunkLen);

            /*
             var m2Names = [];
             for (var i = 0; i < wmoObj.nModels; i++) {
             var str = chunk.readString(offset);
             offset.offs++;
             m2Names.push(str);
             }     */

            wmoObj.modn = modelNames;
        },
        "MODS": function (wmoObj: WmoFile, chunk: Chunk) {
            var offset = {offs: 0};
            var doodadSets: WmoDoodadSet[] = [];

            for (var i = 0; i < wmoObj.nDoodadSets; i++) {
                var doodadSet = {} as WmoDoodadSet;
                doodadSet.name = chunk.readNZTString(offset, 20);
                doodadSet.index = chunk.readInt32(offset);
                doodadSet.number = chunk.readInt32(offset);
                doodadSet.unused = chunk.readInt32(offset);

                doodadSets.push(doodadSet);
            }
            wmoObj.mods = doodadSets;
        },
        "MODD" : function(wmoObj: WmoFile,chunk: Chunk) {
            /* Requires loaded MODS chunk. Pure parsing is not possible =(*/
            var offset = {offs: 0};
            var modelNames = wmoObj.modn!;
            var doodadsNum = chunk.chunkLen / 40;
            var doodads: WmoDoodad[] = new Array(doodadsNum);

            for (var j = 0; j < doodadsNum; j++) {
                var doodad = {} as WmoDoodad;
                doodad.nameIndex = chunk.readInt32(offset);
                doodad.nameIndex = doodad.nameIndex & 0xffffff;
                doodad.modelName = fileReadHelper(modelNames.buffer as ArrayBuffer).readString({offs : doodad.nameIndex}, modelNames.length - doodad.nameIndex);
                doodad.pos       = chunk.readVector3f(offset);
                doodad.rotation  = chunk.readQuaternion(offset);
                doodad.scale     = chunk.readFloat32(offset);
                doodad.color     = chunk.readUint32(offset);

                doodads[j] = doodad;
            }

            wmoObj.modd = doodads;
        },
        "MFOG": function (wmoObj: WmoFile,chunk: Chunk) {
            var offset = {offs: 0};
            var fogInfo = {} as WmoFog;

            fogInfo.flag =              chunk.readInt32(offset);
            fogInfo.pos =               chunk.readVector3f(offset);

            fogInfo.smaller_radius =    chunk.readFloat32(offset);
            fogInfo.larger_radius =     chunk.readFloat32(offset);

            fogInfo.fog_end =           chunk.readFloat32(offset);
            fogInfo.fog_startScalar =   chunk.readFloat32(offset);
            fogInfo.fog_color =         chunk.readUint32(offset);
            fogInfo.fog_colorF =
                [(fogInfo.fog_color & 0xff) / 255.0,
                ((fogInfo.fog_color>> 8 ) & 0xff) / 255.0,
                ((fogInfo.fog_color>> 16) & 0xff) / 255.0,
                ((fogInfo.fog_color>> 24) & 0xff) / 255.0];

            fogInfo.underwater_fog_end =         chunk.readFloat32(offset);
            fogInfo.underwater_fog_startScalar = chunk.readFloat32(offset);
            fogInfo.underwater_fog_color =         chunk.readUint32(offset);
            fogInfo.underwater_fog_colorF =
                [(fogInfo.underwater_fog_color & 0xff) / 255.0,
                ((fogInfo.underwater_fog_color>> 8 ) & 0xff) / 255.0,
                ((fogInfo.underwater_fog_color>> 16) & 0xff) / 255.0,
                ((fogInfo.underwater_fog_color>> 24) & 0xff) / 255.0];

            wmoObj.mfog = fogInfo;
        }
    };

    function BaseWMOLoader(this: SectionReaders){
        var handlerTable: WmoHandlerTable = {
            MVER : function(wmoObject: WmoFile, chunk: Chunk){
                if (chunk.chunkIdent !== "MVER") {
                    throw "Got bad WMO file " + wmoFilePath;
                }
                var version = chunk.readInt32({offs : 0});
                //$log.info("Loading ", wmoFilePath, ", version ", version);

                /* Versioning */
                if (version == 17){
                    handlerTable = wmo_ver17;
                }
            }
        };

        this.getHandler = function(sectionName: string) {
            return handlerTable[sectionName];
        }
    }

    var promise = chunkedLoader(wmoFilePath);
    var newPromise = promise.then(function(chunkedFile){
        /* First chunk in file has to be MVER */

        //debugger;
        var wmoObj = {} as WmoFile;
        chunkedFile.setSectionReaders( new (BaseWMOLoader as unknown as new () => SectionReaders)());
        chunkedFile.processFile(wmoObj);

        return wmoObj;
    });

    return newPromise;
}

export { wmoLoader as wmoLoader, wmoGroupLoader as wmoGroupLoader};
