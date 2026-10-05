import fileLoader from './fileLoader';
import fileReadHelper from './fileReadHelper';
import type { FileOffset, FileReadHelper, Vector3f, Vector4f } from './fileReadHelper';

export type SectionType =
    | "int8" | "int16" | "int32"
    | "uint8" | "uint16" | "uint32"
    | "int32Array" | "uint8Array" | "uint16Array" | "int16Array"
    | "vector3f" | "vector4f" | "float32" | "string"
    | "splineVector3f" | "splineFloat32"
    | "ablock" | "ablock_tbc" | "ablock_tbc2"
    | "layout";

// A definition-driven parse: the fields and their types are decided by the SectionDefinition at
// runtime, so the parsed object is a record of any.
export type ParsedObject = { [field: string]: any };

export interface SectionDefinition {
    name?: string;
    type: SectionType;
    valType?: SectionType;
    /* a number, the name of an already parsed field, or a function of the parent object */
    len?: number | string | ((parentObject: ParsedObject) => number);
    /* a number, or the name of an already parsed field */
    offset?: number | string;
    /* the name of an already parsed field */
    count?: string;
    condition?: (parentObject: ParsedObject) => boolean;
    layout?: LayoutField[];
}

export interface LayoutField extends SectionDefinition {
    name: string;
}

export interface AnimationBlock {
    interpolation_type: number;
    global_sequence: number;
    timestampsPerAnimation: number[][];
    valuesPerAnimation: SectionValue[][];
}

export interface AnimationBlockTbc {
    interpolation_type: number;
    global_sequence: number;
    interpolation_ranges_nb: number;
    ofsRanges: number;
    timestamps_nb: number;
    ofsTimes: number;
    values_nb: number;
    ofsValues: number;
    ranges?: { first: number; second: number }[];
    timestampsPerAnimation: number[][];
    valuesPerAnimation: SectionValue[][];
}

export interface AnimationBlockTbc2 {
    interpolation_type: number;
    global_sequence: number;
    interpolation_ranges_nb: number;
    ofsRanges: number;
    timestamps_nb: number;
    ofsTimes: number;
    values_nb: number;
    ofsValues: number;
    ranges: { first: number; last: number }[];
    timestampsPerAnimation: number[][];
    valuesPerAnimation: SectionValue[][];
}

export type SectionValue =
    | number
    | string
    | number[]
    | Uint8Array
    | Vector3f
    | Vector4f
    | AnimationBlock
    | AnimationBlockTbc
    | AnimationBlockTbc2
    | ParsedObject
    | undefined;

export interface LinedFile extends FileReadHelper {
    loadDataAtOffset(offset: number, length: number): FileReadHelper;
    readType(fileObject: FileReadHelper, sectionDef: SectionDefinition, offset: FileOffset, len?: number): SectionValue;
    parseSectionDefinition(parentObject: ParsedObject, sectionDefinition: SectionDefinition, fileObject: FileReadHelper, offset?: FileOffset, debugPrint?: boolean): SectionValue | SectionValue[];
    /* set only when the file was loaded by path */
    filePath?: string;
}

export default function (filePath: string, arrayBuffer: ArrayBuffer): LinedFile;
export default function (filePath: string): Promise<LinedFile>;
export default function (filePath: string , arrayBuffer?: ArrayBuffer): LinedFile | Promise<LinedFile> {

    function parseLinedFileObj(a: ArrayBuffer): LinedFile {
        var fileReader = fileReadHelper(a);

        function LinedFileObj(this: LinedFile){
            this.loadDataAtOffset = function (offset: number, length: number) {
                return fileReadHelper(a, offset, length)
            };
            this.readType = function(this: LinedFile, fileObject: FileReadHelper, sectionDef: SectionDefinition, offset: FileOffset, len?: number): SectionValue {
                var self = this;
                var result;

                var type = sectionDef.type;
                switch (type) {
                    case "int8":
                        result = fileObject.readInt8(offset);
                        break;
                    case "int16":
                        result = fileObject.readInt16(offset);
                        break;
                    case "int32" :
                        result = fileObject.readInt32(offset);
                        break;
                    case "uint8":
                        result = fileObject.readUint8(offset);
                        break;
                    case "uint16":
                        result = fileObject.readUint16(offset);
                        break;
                    case "uint32":
                        result = fileObject.readUint32(offset);
                        break;
                    case "int32Array" :
                        result = fileObject.readInt32Array(offset, len!);
                        break;
                    case "uint8Array" :
                        result = fileObject.readUint8Array(offset, len!);
                        break;
                    case "uint16Array" :
                        result = fileObject.readUint16Array(offset, len!);
                        break;
                    case "int16Array" :
                        result = fileObject.readInt16Array(offset, len!);
                        break;
                    // JS-BUG: duplicate case "int32Array" - unreachable, harmless
                    case "int32Array" :
                        result = fileObject.readInt32Array(offset, len!);
                        break;
                    case "vector3f" :
                        result = fileObject.readVector3f(offset);
                        break;
                    case "vector4f" :
                        result = fileObject.readVector4f(offset);
                        break;
                    case "float32" :
                        result = fileObject.readFloat32(offset);
                        break;
                    // an M2SplineKey (the camera tracks): the value, then the in and out tangents, which are skipped
                    case "splineVector3f" :
                        result = fileObject.readVector3f(offset);
                        offset.offs += 2 * 12;
                        break;
                    case "splineFloat32" :
                        result = fileObject.readFloat32(offset);
                        offset.offs += 2 * 4;
                        break;
                    case "string" :
                        if (len != undefined) {
                            result = fileObject.readNZTString(offset, len);
                        } else {
                            result = fileObject.readString(offset, 9999);
                        }
                        break;

                    case "ablock" :

                        result = {} as AnimationBlock;
                        result.interpolation_type = fileObject.readUint16(offset);
                        result.global_sequence = fileObject.readInt16(offset);

                        /* 1. Timestamps  */
                        var timeStampAnimationsCnt = fileObject.readInt32(offset);
                        var timeStampAnimationsOffset = fileObject.readInt32(offset);

                        timeStampAnimationsCnt = (timeStampAnimationsCnt < 0) ? 0 : timeStampAnimationsCnt;

                        result.timestampsPerAnimation = new Array(timeStampAnimationsCnt);

                        var off1 = {offs: timeStampAnimationsOffset};
                        for (var i = 0; i < timeStampAnimationsCnt; i++) {
                            var timestampsCnt = fileObject.readUint32(off1);
                            var timestampsOff = fileObject.readUint32(off1);

                            result.timestampsPerAnimation[i] = new Array(timestampsCnt);

                            var offs2 = {offs : timestampsOff};
                            for (var j = 0; j < timestampsCnt; j++) {
                                result.timestampsPerAnimation[i][j] = fileObject.readUint32(offs2);
                            }
                        }

                        /* 2. Values */
                        var valuesAnimationsCnt = fileObject.readInt32(offset);
                        var valuesAnimationsOffset = fileObject.readInt32(offset);

                        valuesAnimationsCnt = (valuesAnimationsCnt <= 0) ? 0 : valuesAnimationsCnt;

                        result.valuesPerAnimation = new Array(valuesAnimationsCnt);

                        var offs1 = {offs: valuesAnimationsOffset} ;
                        for (var i = 0; i < valuesAnimationsCnt; i++) {

                            var valuesCnt = fileObject.readUint32(offs1);
                            var valuesOffset = fileObject.readUint32(offs1);

                            result.valuesPerAnimation[i] = new Array(valuesCnt);

                            var offs2 = {offs : valuesOffset};
                            for (var j = 0; j < valuesCnt; j++) {
                                result.valuesPerAnimation[i][j] = self.readType(
                                    fileObject,
                                    {type : sectionDef.valType!, len: sectionDef.len},
                                    offs2,
                                    sectionDef.len as number | undefined
                                );
                            }
                        }

                        break;

                    case "ablock_tbc": {
                        result = {} as AnimationBlockTbc;

                        result.interpolation_type      = fileObject.readUint16(offset);
                        result.global_sequence         = fileObject.readInt16(offset);
                        result.interpolation_ranges_nb = fileObject.readUint32(offset);
                        result.ofsRanges               = fileObject.readUint32(offset);
                        result.timestamps_nb           = fileObject.readUint32(offset);
                        result.ofsTimes                = fileObject.readUint32(offset);
                        result.values_nb               = fileObject.readUint32(offset);
                        result.ofsValues               = fileObject.readUint32(offset);

                        // Load interpolation ranges
                        result.ranges = [];
                        if (result.interpolation_ranges_nb > 0) {
                            var offRanges = { offs: result.ofsRanges };
                            for (var i = 0; i < result.interpolation_ranges_nb; i++) {
                                // Each range is two int32s: min and max
                                var minimum = fileObject.readInt32(offRanges);
                                var maximum = fileObject.readInt32(offRanges);
                                result.ranges.push({ first: minimum, second: maximum });
                            }
                        } else if (result.interpolation_type !== 0 && result.global_sequence === -1) {
                          // an implicit whole-track range, as my_web_wow's LinedFileObj
                          result.ranges.push({ first: 0, second: result.values_nb - 1 });
                        }
                        
                        // Read timestamps as a single “animation”, so that:
                        //    result.timestampsPerAnimation[0][frame]
                        // matches the WotLK ablock structure.
                        result.timestampsPerAnimation = [];
                        result.timestampsPerAnimation[0] = [];
                        
                        if (result.timestamps_nb > 0 && result.timestamps_nb === result.values_nb) {
                            var offTimes = { offs: result.ofsTimes };
                            for (var i = 0; i < result.timestamps_nb; i++) {
                                result.timestampsPerAnimation[0].push(fileObject.readInt32(offTimes));
                                // hmmm...
                                //var bajs = fileObject.readInt32(offTimes);
                                //result.timestampsPerAnimation[0].push(30 * i);
                            }
                        }
                        
                        // Read values similarly
                        result.valuesPerAnimation = [];
                        result.valuesPerAnimation[0] = [];
                        
                        if (result.values_nb > 0) {
                            var offValues = { offs: result.ofsValues };
                            for (var i = 0; i < result.values_nb; i++) {
                                result.valuesPerAnimation[0].push(
                                    self.readType(
                                        fileObject,
                                        { type: sectionDef.valType!, len: sectionDef.len },
                                        offValues,
                                        sectionDef.len as number | undefined
                                    )
                                );
                            }
                        }

                        //console.log("red ablock_tbc: ", result);
                        break;
                    }

                    case "ablock_tbc2": {
                        const block = {} as AnimationBlockTbc2;
                        const interpolationType        = block.interpolation_type      = fileObject.readUint16(offset);
                        const globalSequence           = block.global_sequence         = fileObject.readInt16(offset);
                        const rangesCnt                = block.interpolation_ranges_nb = fileObject.readUint32(offset);
                        const rangesOff                = block.ofsRanges               = fileObject.readUint32(offset);
                        const timeCnt                  = block.timestamps_nb           = fileObject.readUint32(offset);
                        const timesOff                 = block.ofsTimes                = fileObject.readUint32(offset);
                        const valueCnt                 = block.values_nb               = fileObject.readUint32(offset);
                        const valuesOff                = block.ofsValues               = fileObject.readUint32(offset);

                        // Ranges table
                        const ranges: { first: number; last: number }[] = [];
                        if (rangesCnt > 0) {
                            const off = { offs: rangesOff };
                            for (let i = 0; i < rangesCnt; ++i) {
                                const first = fileObject.readInt32(off);
                                const last  = fileObject.readInt32(off);
                                ranges.push({ first, last });
                            }
                        } else if (interpolationType !== 0 && globalSequence === -1) {
                            // whole‑track range
                            ranges.push({ first: 0, last: valueCnt - 1 });
                        }
                        block.ranges = ranges;

                        // Flat timestamps
                        const flatTimes: number[] = [];
                        if (timeCnt > 0) {
                            const off = { offs: timesOff };
                            for (let i = 0; i < timeCnt; ++i) {
                                flatTimes.push(fileObject.readUint32(off));
                            }
                        }

                        // Flat values
                        const flatValues: SectionValue[] = [];
                        if (valueCnt > 0) {
                            const off = { offs: valuesOff };
                            for (let i = 0; i < valueCnt; ++i) {
                                flatValues.push(
                                    self.readType(
                                        fileObject,
                                        { type: sectionDef.valType!, len: sectionDef.len },
                                        off,
                                        sectionDef.len as number | undefined
                                    )
                                );
                            }
                        }

                        // Slice into per‑animation lists
                        const animCnt = ranges.length;
                        block.timestampsPerAnimation = new Array(animCnt);
                        block.valuesPerAnimation     = new Array(animCnt);

                        for (let i = 0; i < animCnt; ++i) {
                            let { first, last } = ranges[i];

                            // clamp to avoid corrupt files blowing up
                            first = Math.max(0, Math.min(first, valueCnt - 1));
                            last  = Math.max(first, Math.min(last, valueCnt - 1));

                            const sliceLen = last - first + 1;
                            const ts: number[]   = new Array(sliceLen);
                            const vals: SectionValue[] = new Array(sliceLen);

                            for (let k = 0; k < sliceLen; ++k) {
                                const idx = first + k;
                                ts[k]   = flatTimes[idx]  ?? 0;
                                vals[k] = flatValues[idx] ?? undefined;
                            }

                            block.timestampsPerAnimation[i] = ts;
                            block.valuesPerAnimation[i]     = vals;
                        }

                        result = block; // hand the finished block back to the caller
                        break;
                    }

                    case "layout" :
                        /*
                         * Parse layout
                         */
                        var layout = sectionDef.layout!;
                        var resultObj: ParsedObject = {};

                        // JS-BUG: (!layout) instanceof Array is always false, so the check never throws (should be !(layout instanceof Array))
                        // @ts-expect-error !layout is a boolean, so this instanceof is always false; ported as-is
                        if (!layout instanceof Array) {
                            throw "layout is not array";
                        }

                        for (var i = 0; i < layout.length; i++) {
                            var paramName = layout[i].name;
                            resultObj[paramName] = this.parseSectionDefinition(resultObj, layout[i], fileObject, offset, true);
                        }

                        return resultObj;

                    default:
                        console.info("Unknown type in layout. type = ", type);
                        break
                }

                return result;
            };

            this.parseSectionDefinition = function(this: LinedFile, parentObject: ParsedObject, sectionDefinition: SectionDefinition, fileObject: FileReadHelper, offset?: FileOffset, debugPrint=false){
                var offs: number | undefined;
                if (typeof sectionDefinition.offset == "string") {
                    offs = parentObject[sectionDefinition.offset];
                } else {
                    //Assume this is number
                    offs = sectionDefinition.offset;
                }

                var len = sectionDefinition.len;
                if (typeof sectionDefinition.len == "string") {
                    len = parentObject[len as string];
                } else if (typeof sectionDefinition.len == "function") {
                    len = sectionDefinition.len(parentObject);
                }
                if (sectionDefinition.condition) {
                    if (!sectionDefinition.condition(parentObject)) return;
                }

                if (offset && offs) {
                    offset =  {offs : offs};
                } else if (offs){
                    offset = { offs : offs };
                } else if (!offset){
                    offset = { offs : 0};
                }

                var fieldObject: SectionValue;
                var fieldArray: SectionValue[] = [];

                var count = 1;
                var countIsGiven = sectionDefinition.count !== undefined;
                if (countIsGiven) {
                    count = parentObject[sectionDefinition.count!];
                }

                for (var j = 0; j < count; j++) {
                    fieldObject = this.readType(fileObject, sectionDefinition, offset, len as number | undefined);

                    // Debug
                    //if (debugPrint) console.log(`DEBUG: Field "${sectionDefinition.name}" (type: "${sectionDefinition.type}") ->`, fieldObject);
                    //console.log(`DEBUG: Field "${sectionDefinition.name}" (type: "${sectionDefinition.type}") ->`, fieldObject);

                    fieldArray.push(fieldObject);
                }
                var resultObj: SectionValue | SectionValue[];
                if (countIsGiven) {
                    resultObj = fieldArray;
                } else {
                    resultObj = fieldArray[0];
                }

                return resultObj;
            }
        }
        LinedFileObj.prototype = fileReader;

        var linedFileObj = new (LinedFileObj as unknown as new () => LinedFile)();
        return linedFileObj;
    }


    if (arrayBuffer) {
        var linedFileObj = parseLinedFileObj(arrayBuffer);
        return linedFileObj;
    } else {
        return fileLoader(filePath).then(function success(a) {
            var linedFileObj = parseLinedFileObj(a);
            linedFileObj.filePath = filePath;

            return linedFileObj;
        }, function error(e) {
            throw e;
        });
    }

};
