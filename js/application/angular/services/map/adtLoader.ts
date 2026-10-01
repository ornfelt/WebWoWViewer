import chunkedLoader from './../chunkedLoader';
import type { Chunk, ChunkedFile, ChunkHandlerTable } from './../chunkedLoader';
import fileReadHelper from './../fileReadHelper';
import type { Vector3f } from './../fileReadHelper';
import Liquid from './../../wowRenderJs/liquid/liquid';

/* MCIN record - read and used to find the MCNK, not kept */
export interface AdtMcinEntry {
    offsetMCNK: number;
    size: number;
    flags: number;
    asyncId: number;
}

export interface AdtTextureLayer {
    textureID: number;
    flags: number;
    alphaMap: number;
    detailTex: number;
    /* added by addTextureNames() after the file is processed */
    textureName?: string;
}

export interface AdtMcnkObj {
    flags: number;
    ix: number;
    iy: number;
    nLayers: number;
    nDoodadRefs: number;
    m2Refs: number[];
    sizeAlpha: number;
    sizeShadow: number;
    areaid: number;
    nMapObjRefs: number;
    wmoRefs: number[];
    holes: number;
    s1: number;
    s2: number;
    d1: number;
    d2: number;
    d3: number;
    predTex: number;
    pos: Vector3f;
    textureId: number;
    props: number;
    effectId: number;
    /* MCVT */
    heights: number[];
    /* MCNR */
    normales: number[];
    /* MCLY - unset when the chunk is empty */
    textureLayers?: AdtTextureLayer[];
    /* MCAL - unset when sizeAlpha is 0 */
    alphaArray?: Uint8Array;
    /* MCLQ - unset when sizeLiquid is 0 */
    hasWater?: boolean;
    waterLevel?: number;
    liquidInfo?: Liquid | null;
}

/* MDDF record */
export interface AdtM2Placement {
    nameID: number;
    uniqueId: number;
    pos: Vector3f;
    rotation: Vector3f;
    scale: number;
    flags: number;
    fileName: string;
}

/* MODF record */
export interface AdtModfChunk {
    nameId: number;
    uniqueId: number;
    pos: Vector3f;
    rotation: Vector3f;
    bb1: Vector3f;
    bb2: Vector3f;
    doodadSet: number;
    nameSet: number;
    flags: number;
    fileName: string;
}

/* A chunk handler is not called for an empty chunk, so every chunk below MCIN may leave its field unset */
export interface AdtFile {
    filename: string;
    mcnkObjs: AdtMcnkObj[];
    mtex?: string[];
    mmdx?: Uint8Array | null;
    mmid?: number[] | null;
    mwmo?: Uint8Array | null;
    mwid?: number[] | null;
    mddf?: AdtM2Placement[];
    wmoObjs?: AdtModfChunk[];
}

const TILESIZE = 533.33333;

const handlerTable: ChunkHandlerTable = {
    "MVER" : function (adtObject: AdtFile, chunk: Chunk) {
        if (chunk.chunkIdent !== "MVER") {
            // JS-BUG: filename is not defined in this scope (ReferenceError); unreachable, the handler is only called for MVER chunks
            // @ts-expect-error filename is not in scope - see the JS-BUG above
            throw "Got bad group ADT file " + filename;
        }
        var version = chunk.readInt32({offs: 0});
        //$log.info("Loading ", filename, ", version ", version);
    },
    "MHDR" : function (adtObject: AdtFile, chunk: Chunk, chunkedFile: ChunkedFile) {
        var offs = {offs : 0};

        var flags = chunk.readUint32(offs);
        var mcinOffs = chunk.readUint32(offs);
        var mtexOffs = chunk.readUint32(offs);
        var mmdxOffs = chunk.readUint32(offs);
        var mmidOffs = chunk.readUint32(offs);
        var mwmoOffs = chunk.readUint32(offs);
        var mwidOffs = chunk.readUint32(offs);
        var mddfOffs = chunk.readUint32(offs);
        var modfOffs = chunk.readUint32(offs);
        var mfboOffs = chunk.readUint32(offs); // this is only set if flags & mhdr_MFBO.
        var mh2oOffs = chunk.readUint32(offs);
        var mtxfOffs = chunk.readUint32(offs);
        var pad4 = chunk.readUint32(offs);
        var pad5 = chunk.readUint32(offs);
        var pad6 = chunk.readUint32(offs);
        var pad7 = chunk.readUint32(offs);

        //1. Load MCIN
        chunkedFile.processChunkAtOffs(chunk.chunkDataOffset + mcinOffs, adtObject);
        //2. Load MTEX
        chunkedFile.processChunkAtOffs(chunk.chunkDataOffset + mtexOffs, adtObject);
        //3. Load MMDX
        chunkedFile.processChunkAtOffs(chunk.chunkDataOffset + mmdxOffs, adtObject);
        //4. Load MMID
        chunkedFile.processChunkAtOffs(chunk.chunkDataOffset + mmidOffs, adtObject);
        //5. Load MWMO
        chunkedFile.processChunkAtOffs(chunk.chunkDataOffset + mwmoOffs, adtObject);
        //6. Load MWID
        chunkedFile.processChunkAtOffs(chunk.chunkDataOffset + mwidOffs, adtObject);
        //7. Load MDDF
        chunkedFile.processChunkAtOffs(chunk.chunkDataOffset + mddfOffs, adtObject);
        //8. Load MODF
        chunkedFile.processChunkAtOffs(chunk.chunkDataOffset + modfOffs, adtObject);

        //Stop loading
        chunk.nextChunkOffset = chunkedFile.getFileSize();
    },
    "MCIN" : function (adtObject: AdtFile, chunk: Chunk, chunkedFile: ChunkedFile) {
        var offs = {offs : 0};
        //16x16 records
        var mcnkObjs: AdtMcnkObj[] = [];
        for (var i = 0; i < 256; i++) {
            var MCINEntry = {} as AdtMcinEntry;
            MCINEntry.offsetMCNK = chunk.readUint32(offs);
            MCINEntry.size = chunk.readUint32(offs);
            MCINEntry.flags = chunk.readUint32(offs);
            MCINEntry.asyncId = chunk.readUint32(offs);

            //Load and process MCNK for this block
            var mcnkObj = {} as AdtMcnkObj;
            chunkedFile.processChunkAtOffs(MCINEntry.offsetMCNK, mcnkObj);
            mcnkObjs.push(mcnkObj);
        }
        adtObject.mcnkObjs = mcnkObjs;
    },
    "MCNK" : function (mcnkObj: AdtMcnkObj, chunk: Chunk, chunkedFile: ChunkedFile) {
        var offs = {offs : 0};
        mcnkObj.flags             = chunk.readUint32(offs);
        mcnkObj.ix                = chunk.readUint32(offs);
        mcnkObj.iy                = chunk.readUint32(offs);
        mcnkObj.nLayers           = chunk.readUint32(offs);
        mcnkObj.nDoodadRefs       = chunk.readUint32(offs);
        var ofsHeight             = chunk.readUint32(offs);
        var ofsNormal             = chunk.readUint32(offs);
        var ofsLayer              = chunk.readUint32(offs);
        var ofsRefs               = chunk.readUint32(offs);
        mcnkObj.m2Refs = [];
        var ofsAlpha              = chunk.readUint32(offs);
        mcnkObj.sizeAlpha         = chunk.readUint32(offs);
        var ofsShadow             = chunk.readUint32(offs);
        mcnkObj.sizeShadow        = chunk.readUint32(offs);
        mcnkObj.areaid            = chunk.readUint32(offs);
        mcnkObj.nMapObjRefs       = chunk.readUint32(offs);
        mcnkObj.wmoRefs = [];
        mcnkObj.holes             = chunk.readUint32(offs);
        mcnkObj.s1                 = chunk.readUint16(offs);
        mcnkObj.s2                 = chunk.readUint16(offs);
        mcnkObj.d1                = chunk.readUint32(offs);
        mcnkObj.d2                = chunk.readUint32(offs);
        mcnkObj.d3                = chunk.readUint32(offs);
        mcnkObj.predTex           = chunk.readUint32(offs);
        var nEffectDoodad         = chunk.readUint32(offs);
        var ofsSndEmitters        = chunk.readUint32(offs);
        var nSndEmitters          = chunk.readUint32(offs);
        var ofsLiquid             = chunk.readUint32(offs);
        var sizeLiquid            = chunk.readUint32(offs);
        mcnkObj.pos               = chunk.readVector3f(offs);
        mcnkObj.textureId         = chunk.readUint32(offs);
        mcnkObj.props             = chunk.readUint32(offs);
        mcnkObj.effectId          = chunk.readUint32(offs);

        //1. Load MCVT
        chunkedFile.processChunkAtOffs(chunk.chunkOffset + ofsHeight, mcnkObj);
        //2. Load MCNR
        chunkedFile.processChunkAtOffs(chunk.chunkOffset + ofsNormal, mcnkObj);
        //3. Load MCLY
        chunkedFile.processChunkAtOffs(chunk.chunkOffset + ofsLayer, mcnkObj);
        //4. Load MCAL
        chunkedFile.processChunkAtOffsWithSize(chunk.chunkOffset + ofsAlpha, mcnkObj.sizeAlpha, mcnkObj);
        //5. Load MCLQ
        chunkedFile.processChunkAtOffsWithSize(chunk.chunkOffset + ofsLiquid, sizeLiquid, mcnkObj);
        //6. Load MCRF

        chunkedFile.processChunkAtOffs(chunk.chunkOffset + ofsRefs, mcnkObj);
    },
    "MCVT" : function (mcnkObj: AdtMcnkObj, chunk: Chunk, chunkedFile: ChunkedFile) {
        var offs = {offs : 0};

        var heights = chunk.readFloat32Array(offs, 145);
        mcnkObj.heights = heights;
    },
    "MCNR" : function (mcnkObj: AdtMcnkObj, chunk: Chunk, chunkedFile: ChunkedFile) {
        var offs = {offs : 0};
        var normales: number[] = [];

        for (var i = 0; i < 9*9 + 8*8; i++) {
            var x = chunk.readInt8(offs) / 127;
            var y = chunk.readInt8(offs) / 127;
            var z = chunk.readInt8(offs) / 127;

            normales.push(x);
            normales.push(y);
            normales.push(z);
        }
        mcnkObj.normales = normales;
    },
    "MCLY" : function (mcnkObj: AdtMcnkObj, chunk: Chunk, chunkedFile: ChunkedFile) {
        var offs = {offs : 0};
        var recCount = chunk.chunkLen >> 4;
        var textureLayers: AdtTextureLayer[] = [];

        for (var i = 0; i < recCount; i++) {
            var textureLayer = {} as AdtTextureLayer;
            textureLayer.textureID  = chunk.readInt32(offs); //offset into MTEX list

            textureLayer.flags      = chunk.readInt32(offs);
            textureLayer.alphaMap   = chunk.readInt32(offs);
            textureLayer.detailTex  = chunk.readInt32(offs);
            textureLayers.push(textureLayer);
        }

        mcnkObj.textureLayers = textureLayers;
    },
    "MCAL" : function (mcnkObj: AdtMcnkObj, chunk: Chunk, chunkedFile: ChunkedFile) {
        var offset = {offs: 0};
        var alphaArray = chunk.readUint8Array(offset, chunk.chunkLen);

        mcnkObj.alphaArray = alphaArray;
    },
    "MCRF": function (mcnkObj: AdtMcnkObj, chunk: Chunk, chunkedFile: ChunkedFile) {
        var offset = {offs: 0};
        var m2Refs = chunk.readInt32Array(offset, mcnkObj.nDoodadRefs);
        var wmoRefs = chunk.readInt32Array(offset, mcnkObj.nMapObjRefs);

        mcnkObj.m2Refs = m2Refs;
        mcnkObj.wmoRefs = wmoRefs;
    },
    "MCLQ": function (mcnkObj: AdtMcnkObj, chunk: Chunk, chunkedFile: ChunkedFile) {
        var off = {offs: 0};

        // read water height (float)
        var waterLevel = chunk.readFloat32(off);
        off.offs -= 4;

        // next 4 bytes tell us if liquid section is empty ("MCSE")
        var subId = chunk.reverseStr(chunk.readNZTString(off, 4));   // == "MCSE" -> dry chunk

        if (subId == "MCSE") {      // no liquid for this chunk
            mcnkObj.hasWater = false;
            mcnkObj.liquidInfo = null;
            return;
        }

        // we DO have water
        mcnkObj.hasWater = true;
        mcnkObj.waterLevel = waterLevel;

        off.offs += 4;

        // From wow coords:
        var normCoords = [TILESIZE * 32 - mcnkObj.pos.y, mcnkObj.pos.z, TILESIZE * 32 - mcnkObj.pos.x];

        mcnkObj.liquidInfo = new Liquid(8, 8, [normCoords[0], mcnkObj.waterLevel, normCoords[2]]);
        mcnkObj.liquidInfo.initFromTerrain(chunk, off, mcnkObj.flags);
    },
    "MTEX" : function (adtObject: AdtFile, chunk: Chunk) {
        var offset = {offs: 0};
        var textureNames: string[] = [];

        while (offset.offs < chunk.chunkLen) {
            var textStr = chunk.readString(offset, chunk.chunkLen - offset.offs); offset.offs += 1;
            textureNames.push(textStr);
        }

        adtObject.mtex = textureNames;
    },
    "MMDX" : function (adtObject: AdtFile, chunk: Chunk) {
        var offset = {offs: 0};
        var m2Names: Uint8Array | null = null;

        if (chunk.chunkLen > 0) {
            m2Names = chunk.readUint8Array(offset, chunk.chunkLen);
        }

        adtObject.mmdx = m2Names;
    },
    "MMID" : function (adtObject: AdtFile, chunk: Chunk) {
        var offset = {offs: 0};
        var mmid: number[] | null = null;

        if (chunk.chunkLen > 0) {
            mmid = chunk.readInt32Array(offset, chunk.chunkLen >> 2);
        }

        adtObject.mmid = mmid;
    },
    "MWMO" : function (adtObject: AdtFile, chunk: Chunk) {
        var offset = {offs: 0};
        var wmoNames: Uint8Array | null = null;

        if (chunk.chunkLen > 0) {
            wmoNames = chunk.readUint8Array(offset, chunk.chunkLen);
        }

        adtObject.mwmo = wmoNames;
    },
    "MWID" : function (adtObject: AdtFile, chunk: Chunk) {
        var offset = {offs: 0};

        var mwid: number[] | null = null;

        if (chunk.chunkLen > 0) {
            mwid = chunk.readInt32Array(offset, chunk.chunkLen >> 2);
        }

        adtObject.mwid = mwid;
    },
    "MDDF" : function (adtObject: AdtFile, chunk: Chunk) {
        var m2Objs: AdtM2Placement[] = [];
        var offset = {offs : 0};

        var mddfCount = (chunk.chunkLen / (4 + 4 + 4*3 + 4*3 + 4));
        if (mddfCount > 0) {
            var mmdxBuff = fileReadHelper(adtObject.mmdx!.buffer as ArrayBuffer);
        }
        for (var i = 0; i < mddfCount; i++){
            var m2Placement = {} as AdtM2Placement;

            m2Placement.nameID    = chunk.readInt32(offset);
            m2Placement.uniqueId  = chunk.readInt32(offset);
            m2Placement.pos       = chunk.readVector3f(offset);
            m2Placement.rotation  = chunk.readVector3f(offset);
            m2Placement.scale     = chunk.readUint16(offset);
            m2Placement.flags     = chunk.readUint16(offset);

            var nameOffset = adtObject.mmid![m2Placement.nameID];
            m2Placement.fileName  = mmdxBuff!.readString({offs : nameOffset}, mmdxBuff!.getLength() - nameOffset);
            m2Objs.push(m2Placement);
        }

        adtObject.mddf = m2Objs;
    },
    "MODF" : function (adtObject: AdtFile, chunk: Chunk) {
        var offset = { offs : 0 };
        var wmoObjs: AdtModfChunk[] = [];
        var modfCount = (chunk.chunkLen / (4 + 4 + 4*3 + 4*3 +4*3 + 4*3 + 2 + 2 + 4));

        if (modfCount > 0)  {
            var mwmoBuff = fileReadHelper(adtObject.mwmo!.buffer as ArrayBuffer);
        }

        for (var i = 0; i < modfCount; i++) {
            var modfChunk = {} as AdtModfChunk;

            modfChunk.nameId = chunk.readInt32(offset);
            modfChunk.uniqueId = chunk.readInt32(offset);

            modfChunk.pos        = chunk.readVector3f(offset);
            modfChunk.rotation   = chunk.readVector3f(offset);
            modfChunk.bb1        = chunk.readVector3f(offset);
            modfChunk.bb2        = chunk.readVector3f(offset);

            modfChunk.doodadSet = chunk.readUint16(offset);
            modfChunk.nameSet   = chunk.readUint16(offset);
            modfChunk.flags     = chunk.readInt32(offset);

            var nameOffset = adtObject.mwid![modfChunk.nameId];
            modfChunk.fileName  = mwmoBuff!.readString({offs : nameOffset}, mwmoBuff!.getLength() - nameOffset);

            wmoObjs.push(modfChunk);
        }

        adtObject.wmoObjs = wmoObjs;
    }
};

class ADTLoader {
    getHandler(sectionName: string) {
        return handlerTable[sectionName];
    }
}

const defaultAdtLoader = new ADTLoader();

export default function(filename: string): Promise<AdtFile> {
  function addTextureNames(adtObj: AdtFile): void {
    // Add texture names
    for (let i = 0; i < adtObj.mcnkObjs.length; i++) {
      const mcnkObj = adtObj.mcnkObjs[i];
      const mtex = adtObj.mtex;
      if (!mcnkObj.textureLayers) continue;
      for (let j = 0; j < mcnkObj.textureLayers.length; j++) {
        const textIndex = mcnkObj.textureLayers[j].textureID;
        const textureName = mtex![textIndex];
        mcnkObj.textureLayers[j].textureName = textureName;
      }
    }
  }

  return new Promise((resolve, reject) => {
    chunkedLoader(filename)
      .then((chunkedFile) => {
        /* First chunk in file has to be MVER */
        const adtObj = {} as AdtFile;
        adtObj.filename = filename;
        chunkedFile.setSectionReaders(defaultAdtLoader);
        chunkedFile.processFile(adtObj);
        addTextureNames(adtObj);
        resolve(adtObj);
      })
      .catch(() => {
        reject();
      });
  });
}
