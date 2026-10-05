import fileLoader from './fileLoader.js';
import fileReadHelper from './fileReadHelper.js';

/* the value types read as M2SplineKeys (the camera tracks) */
function isSplineType(valType) {
    return valType === "splineVector3f" || valType === "splineFloat32";
}

export default function (filePath , arrayBuffer) {

    function parseLinedFileObj(a){
        var fileReader = fileReadHelper(a);

        function LinedFileObj(){
            this.loadDataAtOffset = function (offset, length) {
                return fileReadHelper(a, offset, length)
            };
            this.readType = function(fileObject, sectionDef, offset, len) {
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
                        result = fileObject.readInt32Array(offset, len);
                        break;
                    case "uint8Array" :
                        result = fileObject.readUint8Array(offset, len);
                        break;
                    case "uint16Array" :
                        result = fileObject.readUint16Array(offset, len);
                        break;
                    case "int16Array" :
                        result = fileObject.readInt16Array(offset, len);
                        break;
                    case "int32Array" :
                        result = fileObject.readInt32Array(offset, len);
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
                    // an M2SplineKey (the camera tracks): the value, then the in and out tangents (an animation
                    // block keeps the values with its other values and the tangents in lists of their own)
                    case "splineVector3f" :
                        result = {
                            value: fileObject.readVector3f(offset),
                            inTan: fileObject.readVector3f(offset),
                            outTan: fileObject.readVector3f(offset)
                        };
                        break;
                    case "splineFloat32" :
                        result = {
                            value: fileObject.readFloat32(offset),
                            inTan: fileObject.readFloat32(offset),
                            outTan: fileObject.readFloat32(offset)
                        };
                        break;
                    case "string" :
                        if (len != undefined) {
                            result = fileObject.readNZTString(offset, len);
                        } else {
                            result = fileObject.readString(offset, 9999);
                        }
                        break;

                    case "ablock" :

                        result = {};
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
                        // the tangents of a spline track (the camera tracks), next to its values
                        var isSpline = isSplineType(sectionDef.valType);
                        if (isSpline) {
                            result.inTanPerAnimation = new Array(valuesAnimationsCnt);
                            result.outTanPerAnimation = new Array(valuesAnimationsCnt);
                        }

                        var offs1 = {offs: valuesAnimationsOffset} ;
                        for (var i = 0; i < valuesAnimationsCnt; i++) {

                            var valuesCnt = fileObject.readUint32(offs1);
                            var valuesOffset = fileObject.readUint32(offs1);

                            result.valuesPerAnimation[i] = new Array(valuesCnt);
                            if (isSpline) {
                                result.inTanPerAnimation[i] = new Array(valuesCnt);
                                result.outTanPerAnimation[i] = new Array(valuesCnt);
                            }

                            var offs2 = {offs : valuesOffset};
                            for (var j = 0; j < valuesCnt; j++) {
                                var value = self.readType(
                                    fileObject,
                                    {type : sectionDef.valType, len: sectionDef.len},
                                    offs2,
                                    sectionDef.len
                                );
                                if (isSpline) {
                                    var key = value;
                                    result.inTanPerAnimation[i][j] = key.inTan;
                                    result.outTanPerAnimation[i][j] = key.outTan;
                                    value = key.value;
                                }
                                result.valuesPerAnimation[i][j] = value;
                            }
                        }

                        break;

                    case "ablock_tbc": {
                        result = {};

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
                        // the tangents of a spline track (the camera tracks), next to its values
                        var isSpline = isSplineType(sectionDef.valType);
                        if (isSpline) {
                            result.inTanPerAnimation = [[]];
                            result.outTanPerAnimation = [[]];
                        }
                        
                        if (result.values_nb > 0) {
                            var offValues = { offs: result.ofsValues };
                            for (var i = 0; i < result.values_nb; i++) {
                                var value = self.readType(
                                    fileObject,
                                    { type: sectionDef.valType, len: sectionDef.len },
                                    offValues,
                                    sectionDef.len
                                );
                                if (isSpline) {
                                    var key = value;
                                    result.inTanPerAnimation[0].push(key.inTan);
                                    result.outTanPerAnimation[0].push(key.outTan);
                                    value = key.value;
                                }
                                result.valuesPerAnimation[0].push(value);
                            }
                        }

                        //console.log("red ablock_tbc: ", result);
                        break;
                    }

                    case "ablock_tbc2": {
                        const block = {};
                        const interpolationType        = block.interpolation_type      = fileObject.readUint16(offset);
                        const globalSequence           = block.global_sequence         = fileObject.readInt16(offset);
                        const rangesCnt                = block.interpolation_ranges_nb = fileObject.readUint32(offset);
                        const rangesOff                = block.ofsRanges               = fileObject.readUint32(offset);
                        const timeCnt                  = block.timestamps_nb           = fileObject.readUint32(offset);
                        const timesOff                 = block.ofsTimes                = fileObject.readUint32(offset);
                        const valueCnt                 = block.values_nb               = fileObject.readUint32(offset);
                        const valuesOff                = block.ofsValues               = fileObject.readUint32(offset);

                        // Ranges table
                        const ranges = [];
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
                        const flatTimes = [];
                        if (timeCnt > 0) {
                            const off = { offs: timesOff };
                            for (let i = 0; i < timeCnt; ++i) {
                                flatTimes.push(fileObject.readUint32(off));
                            }
                        }

                        // Flat values
                        const flatValues = [];
                        if (valueCnt > 0) {
                            const off = { offs: valuesOff };
                            for (let i = 0; i < valueCnt; ++i) {
                                flatValues.push(
                                    self.readType(
                                        fileObject,
                                        { type: sectionDef.valType, len: sectionDef.len },
                                        off,
                                        sectionDef.len
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
                            const ts   = new Array(sliceLen);
                            const vals = new Array(sliceLen);

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
                        var layout = sectionDef.layout;
                        var resultObj = {};

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

            this.parseSectionDefinition = function(parentObject, sectionDefinition, fileObject, offset, debugPrint=false){
                var offs;
                if (typeof sectionDefinition.offset == "string") {
                    offs = parentObject[sectionDefinition.offset];
                } else {
                    //Assume this is number
                    offs = sectionDefinition.offset;
                }

                var len = sectionDefinition.len;
                if (typeof sectionDefinition.len == "string") {
                    len = parentObject[len];
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

                var fieldObject;
                var fieldArray = [];

                var count = 1;
                var countIsGiven = sectionDefinition.count !== undefined;
                if (countIsGiven) {
                    count = parentObject[sectionDefinition.count];
                }

                for (var j = 0; j < count; j++) {
                    fieldObject = this.readType(fileObject, sectionDefinition, offset, len);

                    // Debug
                    //if (debugPrint) console.log(`DEBUG: Field "${sectionDefinition.name}" (type: "${sectionDefinition.type}") ->`, fieldObject);
                    //console.log(`DEBUG: Field "${sectionDefinition.name}" (type: "${sectionDefinition.type}") ->`, fieldObject);

                    fieldArray.push(fieldObject);
                }
                var resultObj;
                if (countIsGiven) {
                    resultObj = fieldArray;
                } else {
                    resultObj = fieldArray[0];
                }

                return resultObj;
            }
        }
        LinedFileObj.prototype = fileReader;

        var linedFileObj = new LinedFileObj();
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
