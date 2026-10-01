import fileReadHelper from './fileReadHelper';
import type { FileOffset, FileReadHelper } from './fileReadHelper';
import fileLoader from './fileLoader';

/* A chunk: a FileReadHelper over the chunk data (Object.create(chunkReader, ...)) plus the chunk header.
 * For an empty chunk the prototype is null and the read methods are missing. */
export type Chunk = FileReadHelper & {
    readonly chunkIdent: string;
    readonly chunkLen: number;
    readonly chunkOffset: number;
    readonly chunkDataOffset: number;
    nextChunkOffset: number;
};

// The object a section handler fills differs per parser and per chunk (the file object, an MCNK
// object, ...), so it is any here; each parser types its own handlers.
export type ChunkResultObj = any;

export type ChunkHandler = (resultObj: ChunkResultObj, chunk: Chunk, chunkedFile: ChunkedFile) => void;

/* Reads the chunk's own data and returns the offset where its sub-chunks start */
export type ChunkHeaderHandler = (resultObj: ChunkResultObj, chunk: Chunk) => FileOffset;

export interface ChunkHandlerTable {
    [chunkIdent: string]: ChunkHandler;
}

/* { <chunkIdent>: ChunkHeaderHandler, subChunks: { <subChunkIdent>: ChunkHandler } } */
export type ChunkHandlerWithSubChunks = { [chunkIdent: string]: ChunkHeaderHandler } & { subChunks: ChunkHandlerTable };

export type SectionHandler = ChunkHandler | ChunkHandlerWithSubChunks;

export interface SectionReaders {
    getHandler(sectionName: string): SectionHandler | undefined;
}

export interface ChunkedFile {
    getFileSize(): number;
    setSectionReaders(value: SectionReaders): void;
    processChunkAtOffsWithSize(offs: number, size: number, resultObj: ChunkResultObj): void;
    processChunkAtOffs(offs: number, resultObj: ChunkResultObj): void;
    /* processFile passes sectionReaders as a third argument, which processChunk ignores */
    processChunk(chunk: Chunk, resultObj: ChunkResultObj, sectionReaders?: SectionReaders | null): void;
    processFile(resultObj: ChunkResultObj): void;
    loadChunkAtOffset(offset: number, size?: number): Chunk;
}

export default function (filePath: string, arrayBuffer: ArrayBuffer): ChunkedFile;
export default function (filePath: string): Promise<ChunkedFile>;
export default function (filePath: string, arrayBuffer?: ArrayBuffer): ChunkedFile | Promise<ChunkedFile> {

    function parseArrayBuffer(a: ArrayBuffer): ChunkedFile {
        var fileReader = fileReadHelper(a);

        var sectionReaders: SectionReaders | null  = null;

        var chunkedFileObj: ChunkedFile = {
            getFileSize : function (){
                return fileReader.getLength();
            },
            setSectionReaders : function (value) {
                sectionReaders = value;
            },
            processChunkAtOffsWithSize : function (offs, size, resultObj) {
                var chunk = this.loadChunkAtOffset(offs, size);
                this.processChunk(chunk, resultObj);
            },
            processChunkAtOffs : function (offs, resultObj) {
                var chunk = this.loadChunkAtOffset(offs);
                this.processChunk(chunk, resultObj);
            },
            processChunk : function (chunk, resultObj){
                var sectionHandlerProc = sectionReaders!.getHandler(chunk.chunkIdent);
                if (sectionHandlerProc && chunk.chunkLen !== 0){
                    if (typeof sectionHandlerProc === 'function') {
                        sectionHandlerProc(resultObj, chunk, this);
                    } else {
                        var offset = sectionHandlerProc[chunk.chunkIdent](resultObj, chunk);

                        /* Iteration through subchunks */
                        var subChunk = this.loadChunkAtOffset(chunk.chunkOffset + offset.offs);
                        while (subChunk.chunkIdent != "") {
                            var subchunkHandler = sectionHandlerProc.subChunks[subChunk.chunkIdent];
                            if (subchunkHandler){
                                subchunkHandler(resultObj, subChunk, this);
                            } else {
                                //$log.info("Unknown SubChunk. Ident = " + subChunk.chunkIdent+", file = "+fullPath);
                                //console.log("Unknown SubChunk. Ident = " + subChunk.chunkIdent);
                            }

                            subChunk = this.loadChunkAtOffset(subChunk.nextChunkOffset);
                        }
                    }
                } else {
                    //$log.info("Unknown Chunk. Ident = " + chunk.chunkIdent+", file = "+fullPath);
                    //console.log("Unknown SubChunk. Ident = " + subChunk.chunkIdent);
                }
            },
            processFile: function(resultObj){
                var chunk = this.loadChunkAtOffset(0);

                while (chunk.chunkIdent != "") {
                    this.processChunk(chunk, resultObj, sectionReaders);
                    chunk = this.loadChunkAtOffset(chunk.nextChunkOffset);
                }
            },
            loadChunkAtOffset : function (offset, size){
                var offsetObj = { offs : offset };

                /* Read chunk header */
                var chunkIdent = "";
                var chunkSize = 0;
                var chunkDataOff = -1;

                // 8 is length of chunk header
                if (offsetObj.offs + 8 < fileReader.getLength()) {
                    chunkIdent = fileReader.reverseStr(fileReader.readString(offsetObj, 4));
                    chunkSize = fileReader.readInt32(offsetObj);
                    if (size || size === 0) {
                        chunkSize = size
                    }
                    chunkDataOff = offsetObj.offs;
                }

                /* If chunk is empty - skip it. Otherwise - load the chunkData */
                var chunkReader: FileReadHelper | null = null;
                if (chunkSize > 0) {
                    chunkReader = fileReadHelper(a, offsetObj.offs, chunkSize);
                }

                var chunkPiece: Chunk = Object.create(chunkReader, {
                    chunkIdent :  {value: chunkIdent},
                    chunkLen   :  {value : chunkSize},

                    chunkOffset: {value : offset},
                    chunkDataOffset : {value : chunkDataOff},
                    nextChunkOffset : {value :offset + 8 + chunkSize, writable: true} //8 is length of chunk header
                });
                //chunkPiece.__proto__ = ;

                return chunkPiece;
            }
        };

        return chunkedFileObj;
    }

    if (arrayBuffer) {
        return parseArrayBuffer(arrayBuffer);
    } else  {
        return fileLoader(filePath).then(function success(a) {
            return parseArrayBuffer(a);
        });
    }
}
