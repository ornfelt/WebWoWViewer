import fileLoader from './fileLoader.js';
import fileReadHelper from './fileReadHelper.js';
import BinaryParser from './tbc/BinaryParser.js';
import Animated from './tbc/Animated.js';
import Vec3D from './tbc/vec3d.js';
import Quaternion from './tbc/quaternion.js';

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

                        var offs1 = {offs: valuesAnimationsOffset} ;
                        for (var i = 0; i < valuesAnimationsCnt; i++) {

                            var valuesCnt = fileObject.readUint32(offs1);
                            var valuesOffset = fileObject.readUint32(offs1);

                            result.valuesPerAnimation[i] = new Array(valuesCnt);

                            var offs2 = {offs : valuesOffset};
                            for (var j = 0; j < valuesCnt; j++) {
                                result.valuesPerAnimation[i][j] = self.readType(
                                    fileObject,
                                    {type : sectionDef.valType, len: sectionDef.len},
                                    offs2,
                                    sectionDef.len
                                );
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
                        if (result.interpolation_ranges_nb > 0) {
                            result.ranges = [];
                            var offRanges = { offs: result.ofsRanges };
                            for (var i = 0; i < result.interpolation_ranges_nb; i++) {
                                // Each range is two int32s: min and max
                                var minimum = fileObject.readInt32(offRanges);
                                var maximum = fileObject.readInt32(offRanges);
                                result.ranges.push({ first: minimum, second: maximum });
                            }
                        } else if (this.interpolation_type !== 0 && this.global_sequence === -1) {
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
                                        { type: sectionDef.valType, len: sectionDef.len },
                                        offValues,
                                        sectionDef.len
                                    )
                                );
                            }
                        }

                        const arrayBuf = fileObject.getArrayBuffer(); 
                        const binaryParser = new BinaryParser(arrayBuf);

                        // No-op for testing
                        //const animatedObj = new Animated((val) => val);
                        
                        let converterName = "convertToRaw";

                        if (sectionDef.valType === "vector3f")
                          converterName = "convertToVec3D";
                        else if (sectionDef.valType === "float32")
                          converterName = "convertToFloat";
                        else if (sectionDef.valType === "int16")
                          converterName = "convertShortToFloat";
                        else if (sectionDef.valType === "int16Array")
                          converterName = "convertToQuaternion";

                        const animatedObj = new Animated(converterName);

                        animatedObj.init(result, binaryParser, /*TODO: global sequences*/ [], false);
                        console.log("New animated created:", animatedObj);

                        if (sectionDef.valType === "vector3f")
                          animatedObj.fix(v => v.fixCoordSystem());
                        else if (sectionDef.valType === "int16Array")
                          animatedObj.fix(q => Quaternion.fixCoordSystemQuat(q));

                        result.animated = animatedObj;

                        break;
                    }

                    case "ablock_tbc_": {
                        const ablock = {};

                        ablock.interpolation_type      = fileObject.readUint16(offset);
                        ablock.global_sequence         = fileObject.readInt16(offset);
                        ablock.interpolation_ranges_nb = fileObject.readUint32(offset);
                        ablock.ofsRanges               = fileObject.readUint32(offset);
                        ablock.timestamps_nb           = fileObject.readUint32(offset);
                        ablock.ofsTimes                = fileObject.readUint32(offset);
                        ablock.values_nb               = fileObject.readUint32(offset);
                        ablock.ofsValues               = fileObject.readUint32(offset);

                        // Read the ranges
                        ablock.ranges = [];
                        if (ablock.interpolation_ranges_nb > 0) {
                            let offRanges = { offs: ablock.ofsRanges };
                            for (let i = 0; i < ablock.interpolation_ranges_nb; i++) {
                                let minimum = fileObject.readInt32(offRanges);
                                let maximum = fileObject.readInt32(offRanges);
                                ablock.ranges.push({ first: minimum, second: maximum });
                            }
                        } else if (ablock.interpolation_type !== 0 && ablock.global_sequence === -1) {
                          ablock.ranges.push({ first: 0, second: ablock.values_nb - 1 });
                        }

                        // Read all timestamps into a single array first
                        let allTimes = [];
                        if (ablock.timestamps_nb > 0) {
                            let offTimes = { offs: ablock.ofsTimes };
                            for (let i = 0; i < ablock.timestamps_nb; i++) {
                                allTimes.push(fileObject.readInt32(offTimes));
                            }
                        }

                        // Read all values into a single array
                        let allVals = [];
                        if (ablock.values_nb > 0) {
                            let offValues = { offs: ablock.ofsValues };
                            for (let i = 0; i < ablock.values_nb; i++) {
                                allVals.push(
                                    self.readType(
                                        fileObject,
                                        { type: sectionDef.valType, len: sectionDef.len },
                                        offValues,
                                        sectionDef.len
                                    )
                                );
                            }
                        }

                        // Now produce WotLK-like arrays: timestampsPerAnimation[i] / valuesPerAnimation[i]
                        ablock.timestampsPerAnimation = [];
                        ablock.valuesPerAnimation = [];

                        for (let i = 0; i < ablock.interpolation_ranges_nb; i++) {
                            let range = ablock.ranges[i];
                            // range.first, range.second are the start/end indices in the big arrays
                            if (range.first < 0 || range.second < 0 || range.second < range.first) {
                                // Means no data for this animation, handle as you like
                                ablock.timestampsPerAnimation[i] = [];
                                ablock.valuesPerAnimation[i] = [];
                                continue;
                            }

                            ablock.timestampsPerAnimation[i] = allTimes.slice(range.first, range.second + 1);
                            ablock.valuesPerAnimation[i]     = allVals.slice(range.first,  range.second + 1);
                        }

                        return ablock;
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
