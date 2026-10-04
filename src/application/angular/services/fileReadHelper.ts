//import * as textEncodeModule from "text-encoding";
//
//var isLittleEndian = true;
//var textDecoder;
//if (TextDecoder !== undefined) {
//    textDecoder = new TextDecoder("utf-8");
//} else {
//    textDecoder = new textEncodeModule.TextDecoder("utf-8");
//}
//
//function reverseStr(str) {
//    var newStr = '', i;
//    for (i = str.length - 1; i >= 0; i--) {
//        newStr += str.charAt(i);
//    }
//    return newStr;
//}
//
//
//export default function (arrayBuffer, start, end){
//    var dataView;
//    if (start&&end) {
//        dataView = new DataView(arrayBuffer, start, end);
//    } else {
//        dataView = new DataView(arrayBuffer);
//    }
//    var uint8Array;
//    if (start&&end) {
//        uint8Array = new Uint8Array(arrayBuffer, start, end);
//    } else {
//        uint8Array = new Uint8Array(arrayBuffer);
//    }
//    return {
//        getArrayBuffer : function() {
//            return arrayBuffer;
//        },
//        sliceArrayBuffer : function(start, end) {
//            return arrayBuffer.slice(start, end);
//        },
//        getLength : function(){
//            return uint8Array.length;
//        },
//        readInt8 : function (offsetObj) {
//            var result = dataView.getInt8(offsetObj.offs); offsetObj.offs += 1;
//            return result;
//        },
//        readInt16 : function (offsetObj) {
//            var result = dataView.getInt16(offsetObj.offs, isLittleEndian); offsetObj.offs += 2;
//            return result;
//        },
//        readInt32 : function (offsetObj) {
//            var result = dataView.getInt32(offsetObj.offs, isLittleEndian); offsetObj.offs += 4;
//            return result;
//        },
//        readUint8 : function (offsetObj) {
//            var result = dataView.getUint8(offsetObj.offs); offsetObj.offs += 1;
//            return result;
//        },
//        readUint16 : function (offsetObj) {
//            var result = dataView.getUint16(offsetObj.offs, isLittleEndian); offsetObj.offs += 2;
//            return result;
//        },
//        readUint32 : function (offsetObj) {
//            var result = dataView.getUint32(offsetObj.offs, isLittleEndian); offsetObj.offs += 4;
//            return result;
//        },
//        readFloat32 : function (offsetObj) {
//            var result = dataView.getFloat32(offsetObj.offs, isLittleEndian);
//            offsetObj.offs += 4;
//
//            return result;
//        },
//        readFloat64 : function (offsetObj) {
//            var result = dataView.getFloat64(offsetObj.offs, isLittleEndian); offsetObj.offs += 8;
//            return result;
//        },
//        readVector4f : function (offsetObj) {
//            var vector3f = {};
//
//            vector3f.x = this.readFloat32(offsetObj);
//            vector3f.y = this.readFloat32(offsetObj);
//            vector3f.z = this.readFloat32(offsetObj);
//            vector3f.w = this.readFloat32(offsetObj);
//
//            return vector3f;
//        },
//        readVector3f : function (offsetObj) {
//            var vector3f = {};
//
//            vector3f.x = this.readFloat32(offsetObj);
//            vector3f.y = this.readFloat32(offsetObj);
//            vector3f.z = this.readFloat32(offsetObj);
//
//            return vector3f;
//        },
//        readVector2f : function (offsetObj) {
//            var vector2f = {};
//
//            vector2f.x = this.readFloat32(offsetObj);
//            vector2f.y = this.readFloat32(offsetObj);
//
//            return vector2f;
//        },
//        readQuaternion : function (offsetObj) {
//            var quaternion = {};
//
//            /* Imagine part of quaternion */
//            quaternion.imag = this.readVector3f(offsetObj);
//            /* Real part of quaternion */
//            quaternion.real = this.readFloat32(offsetObj);
//
//            return quaternion;
//        },
//        readUint8Array : function (offsetObj, length) {
//            var newArrayBuffer = this.sliceArrayBuffer(dataView.byteOffset + offsetObj.offs, dataView.byteOffset+offsetObj.offs+length);
//            var vector = new Uint8Array(newArrayBuffer);
//            offsetObj.offs += length;
//
//            return vector;
//        },
//        readInt8Array : function (offsetObj, length) {
//            var vector = new Int8Array(length);
//            for (var i = 0; i < length; i ++) {
//                vector[i] = this.readInt8(offsetObj);
//            }
//
//            return vector;
//        },
//        readUint16Array : function (offsetObj, length) {
//            var vector = [];
//            for (var i = 0; i < length; i ++) {
//                vector[i] = this.readUint16(offsetObj);
//            }
//
//            return vector;
//        },
//        readInt16Array : function (offsetObj, length) {
//            var vector = [];
//            for (var i = 0; i < length; i ++) {
//                vector[i] = this.readInt16(offsetObj);
//            }
//
//            return vector;
//        },
//        readInt32Array : function (offsetObj, length) {
//            var vector = [];
//            for (var i = 0; i < length; i ++) {
//                vector[i] = this.readInt32(offsetObj);
//            }
//
//            return vector;
//        },
//        readFloat32Array : function (offsetObj, length) {
//            var vector = [];
//            for (var i = 0; i < length; i ++) {
//                vector[i] = this.readFloat32(offsetObj);
//            }
//
//            return vector;
//        },
//        readString : function (offsetObj, maxlen) {
//            /**
//             * @param array Array where to search
//             * @param valueToFind Value to search for
//             * @param start Start search at this index
//             * @param stop Stop search before this index
//             *
//             * @returns number in array
//             */
//            function findInArray(array, valueToFind, start, stop){
//                for (var i = start; i < stop; i++) {
//                    if (array[i] == valueToFind) {
//                        return i;
//                    }
//                }
//                return stop;
//            }
//            var strStart  = offsetObj.offs;
//            var strEnd = findInArray(uint8Array, 0, strStart, strStart+maxlen);
//
//            var tempStr = textDecoder.decode(uint8Array.subarray(strStart, strEnd));
//            offsetObj.offs = strEnd;
//
//            return tempStr;
//        },
//        /* Read non-zero terminated string */
//        readNZTString : function (offsetObj, maxlen) {
//            var strStart  = offsetObj.offs;
//            var strEnd = strStart+maxlen;
//
//            var tempStr = textDecoder.decode(uint8Array.subarray(strStart, strEnd));
//            offsetObj.offs = strEnd;
//
//            return tempStr;
//        },
//        reverseStr : function(str) {
//            return reverseStr(str);
//        }
//    }
//};

export interface FileOffset {
    offs: number;
}

export interface Vector2f {
    x: number;
    y: number;
}

export interface Vector3f {
    x: number;
    y: number;
    z: number;
}

export interface Vector4f {
    x: number;
    y: number;
    z: number;
    w: number;
}

export interface Quaternion {
    imag: Vector3f;
    real: number;
}

export interface FileReadHelper {
    getArrayBuffer(): ArrayBuffer;
    sliceArrayBuffer(start: number, end: number): ArrayBuffer;
    getLength(): number;
    readInt8(offsetObj: FileOffset): number;
    readInt16(offsetObj: FileOffset): number;
    readInt32(offsetObj: FileOffset): number;
    readUint8(offsetObj: FileOffset): number;
    readUint16(offsetObj: FileOffset): number;
    readUint32(offsetObj: FileOffset): number;
    readFloat32(offsetObj: FileOffset): number;
    readFloat64(offsetObj: FileOffset): number;
    readVector4f(offsetObj: FileOffset): Vector4f;
    readVector3f(offsetObj: FileOffset): Vector3f;
    readVector2f(offsetObj: FileOffset): Vector2f;
    readQuaternion(offsetObj: FileOffset): Quaternion;
    readUint8Array(offsetObj: FileOffset, length: number): Uint8Array;
    readInt8Array(offsetObj: FileOffset, length: number): Int8Array;
    readUint16Array(offsetObj: FileOffset, length: number): number[];
    readInt16Array(offsetObj: FileOffset, length: number): number[];
    readInt32Array(offsetObj: FileOffset, length: number): number[];
    readFloat32Array(offsetObj: FileOffset, length: number): number[];
    readString(offsetObj: FileOffset, maxlen: number): string;
    readNZTString(offsetObj: FileOffset, maxlen: number): string;
    reverseStr(str: string): string;
}

let isLittleEndian: boolean = true;

// Always use native TextDecoder:
let textDecoder: TextDecoder = new TextDecoder("utf-8");

// Basic helper for reversing strings (unchanged):
function reverseStr(str: string): string {
  let newStr = '';
  for (let i = str.length - 1; i >= 0; i--) {
    newStr += str.charAt(i);
  }
  return newStr;
}

export default function (arrayBuffer: ArrayBuffer, start?: number, end?: number): FileReadHelper {
    let dataView: DataView;
    if (start && end) {
        dataView = new DataView(arrayBuffer, start, end);
    } else {
        dataView = new DataView(arrayBuffer);
    }
    let uint8Array: Uint8Array;
    if (start && end) {
        uint8Array = new Uint8Array(arrayBuffer, start, end);
    } else {
        uint8Array = new Uint8Array(arrayBuffer);
    }

    return {
        getArrayBuffer : function() {
            return arrayBuffer;
        },
        sliceArrayBuffer : function(start: number, end: number) {
            return arrayBuffer.slice(start, end);
        },
        getLength : function(){
            return uint8Array.length;
        },
        readInt8 : function (offsetObj: FileOffset) {
            let result = dataView.getInt8(offsetObj.offs);
            offsetObj.offs += 1;
            return result;
        },
        readInt16 : function (offsetObj: FileOffset) {
            let result = dataView.getInt16(offsetObj.offs, isLittleEndian);
            offsetObj.offs += 2;
            return result;
        },
        readInt32 : function (offsetObj: FileOffset) {
            let result = dataView.getInt32(offsetObj.offs, isLittleEndian);
            offsetObj.offs += 4;
            return result;
        },
        readUint8 : function (offsetObj: FileOffset) {
            let result = dataView.getUint8(offsetObj.offs);
            offsetObj.offs += 1;
            return result;
        },
        readUint16 : function (offsetObj: FileOffset) {
            let result = dataView.getUint16(offsetObj.offs, isLittleEndian);
            offsetObj.offs += 2;
            return result;
        },
        readUint32 : function (offsetObj: FileOffset) {
            let result = dataView.getUint32(offsetObj.offs, isLittleEndian);
            offsetObj.offs += 4;
            return result;
        },
        readFloat32 : function (offsetObj: FileOffset) {
            let result = dataView.getFloat32(offsetObj.offs, isLittleEndian);
            offsetObj.offs += 4;
            return result;
        },
        readFloat64 : function (offsetObj: FileOffset) {
            let result = dataView.getFloat64(offsetObj.offs, isLittleEndian);
            offsetObj.offs += 8;
            return result;
        },
        readVector4f : function (offsetObj: FileOffset) {
            return {
                x: this.readFloat32(offsetObj),
                y: this.readFloat32(offsetObj),
                z: this.readFloat32(offsetObj),
                w: this.readFloat32(offsetObj)
            };
        },
        readVector3f : function (offsetObj: FileOffset) {
            return {
                x: this.readFloat32(offsetObj),
                y: this.readFloat32(offsetObj),
                z: this.readFloat32(offsetObj)
            };
        },
        readVector2f : function (offsetObj: FileOffset) {
            return {
                x: this.readFloat32(offsetObj),
                y: this.readFloat32(offsetObj)
            };
        },
        readQuaternion : function (offsetObj: FileOffset) {
            return {
                imag: this.readVector3f(offsetObj),
                real: this.readFloat32(offsetObj)
            };
        },
        readUint8Array : function (offsetObj: FileOffset, length: number) {
            let newArrayBuffer = this.sliceArrayBuffer(
                dataView.byteOffset + offsetObj.offs,
                dataView.byteOffset + offsetObj.offs + length
            );
            let vector = new Uint8Array(newArrayBuffer);
            offsetObj.offs += length;
            return vector;
        },
        readInt8Array : function (offsetObj: FileOffset, length: number) {
            let vector = new Int8Array(length);
            for (let i = 0; i < length; i++) {
                vector[i] = this.readInt8(offsetObj);
            }
            return vector;
        },
        readUint16Array : function (offsetObj: FileOffset, length: number) {
            let vector: number[] = [];
            for (let i = 0; i < length; i++) {
                vector[i] = this.readUint16(offsetObj);
            }
            return vector;
        },
        readInt16Array : function (offsetObj: FileOffset, length: number) {
            let vector: number[] = [];
            for (let i = 0; i < length; i++) {
                vector[i] = this.readInt16(offsetObj);
            }
            return vector;
        },
        readInt32Array : function (offsetObj: FileOffset, length: number) {
            let vector: number[] = [];
            for (let i = 0; i < length; i++) {
                vector[i] = this.readInt32(offsetObj);
            }
            return vector;
        },
        readFloat32Array : function (offsetObj: FileOffset, length: number) {
            let vector: number[] = [];
            for (let i = 0; i < length; i++) {
                vector[i] = this.readFloat32(offsetObj);
            }
            return vector;
        },
        readString : function (offsetObj: FileOffset, maxlen: number) {
            // Finds 0 within a subarray
            function findInArray(array: Uint8Array, valueToFind: number, start: number, stop: number): number {
                for (let i = start; i < stop; i++) {
                    if (array[i] === valueToFind) {
                        return i;
                    }
                }
                return stop;
            }
            let strStart = offsetObj.offs;
            let strEnd   = findInArray(uint8Array, 0, strStart, strStart + maxlen);

            let tempStr = textDecoder.decode(uint8Array.subarray(strStart, strEnd));
            offsetObj.offs = strEnd;
            return tempStr;
        },
        // Read a fixed-length (non-zero-terminated) string
        readNZTString : function (offsetObj: FileOffset, maxlen: number) {
            let strStart = offsetObj.offs;
            let strEnd   = strStart + maxlen;

            let tempStr  = textDecoder.decode(uint8Array.subarray(strStart, strEnd));
            offsetObj.offs = strEnd;
            return tempStr;
        },
        reverseStr : function(str: string) {
            return reverseStr(str);
        }
    };
};
