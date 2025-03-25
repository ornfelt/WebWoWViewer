import chunkedLoader from './../chunkedLoader.js';
import fileReadHelper from './../fileReadHelper.js';

export default function(wdtFilePath) {
  return new Promise((resolve, reject) => {
    chunkedLoader(wdtFilePath)
      .then(function(chunkedFile) {
        /* First chunk in file has to be MVER */
        let chunk = chunkedFile.loadChunkAtOffset(0);
        if (chunk.chunkIdent !== "MVER") {
          reject("Got bad WDT file " + wdtFilePath);
          return;
        }

        chunk = chunkedFile.loadChunkAtOffset(chunk.nextChunkOffset);
        const wdtObj = {};
        while (chunk.chunkIdent !== "") {
          switch (chunk.chunkIdent) {
            case "MAIN": {
              const chunkOffs = { offs: 0 };
              const tileTable = {};

              for (let i = 0; i < 64; i++) {
                const tile = {};
                for (let j = 0; j < 64; j++) {
                  tile[j] = chunk.readInt32(chunkOffs);
                  chunkOffs.offs += 4; // skip next 4 bytes. They are plain zeros
                }
                tileTable[i] = tile;
              }
              wdtObj.tileTable = tileTable;
              break;
            }
            case "MPHD": {
              const offset = { offs: 0 };
              wdtObj.flags = chunk.readUint8(offset);
              wdtObj.isWMOMap = (wdtObj.flags & 1) > 0;
              break;
            }
            case "MWMO": {
              const offset = { offs: 0 };
              let wmoNames = null;
              if (chunk.chunkLen > 0) {
                wmoNames = chunk.readUint8Array(offset, chunk.chunkLen);
              }
              wdtObj.mwmo = wmoNames;
              break;
            }
            case "MODF": {
              const offset = { offs: 0 };
              const modfChunk = {};
              const mwmoBuff = fileReadHelper(wdtObj.mwmo.buffer);

              modfChunk.nameId = chunk.readInt32(offset);
              modfChunk.uniqueId = chunk.readInt32(offset);
              modfChunk.pos = chunk.readVector3f(offset);
              modfChunk.rotation = chunk.readVector3f(offset);
              modfChunk.unkVector1 = chunk.readVector3f(offset);
              modfChunk.unkVector2 = chunk.readVector3f(offset);
              modfChunk.doodadSet = chunk.readUint16(offset);
              modfChunk.nameSet = chunk.readUint16(offset);
              modfChunk.flags = chunk.readInt32(offset);

              const nameOffset = modfChunk.nameId;
              modfChunk.fileName = mwmoBuff.readString({ offs: nameOffset }, mwmoBuff.getLength() - nameOffset);
              wdtObj.modfChunk = modfChunk;
              break;
            }
            default:
              console.info("Unknown Chunk. Ident = " + chunk.chunkIdent + ", file = " + wdtFilePath);
          }
          chunk = chunkedFile.loadChunkAtOffset(chunk.nextChunkOffset);
        }
        resolve(wdtObj);
      })
      .catch(() => {
        reject();
      });
  });
}
