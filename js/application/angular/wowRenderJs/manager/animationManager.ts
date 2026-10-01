import {vec4, mat4, vec3, quat} from 'gl-matrix';
import type {ReadonlyVec4} from 'gl-matrix';
import Expansion from '../../Expansion';
import type { Vector3f, Vector4f } from '../../services/fileReadHelper';
import type { M2Animation, M2Bone, M2File, M2TexAnim, M2Track } from '../../services/map/mdxLoader';

/* A value stored in an M2 animation track: Vector3f (translation, scale, color), a number (alpha,
   transparency, light intensities) or a quaternion - Vector4f for classic, an int16 array otherwise */
type M2TrackValue = number | number[] | Vector3f | Vector4f;

/* One entry of M2Object.cameras, written by calcCameras() */
export interface M2CameraDetails {
    /* 4 values when the track is animated, 3 when only the base position is used */
    currentPosition: vec4 | vec3;
    currentTarget: vec4 | vec3;
    farClip: number;
    nearClip: number;
    fov: number;
}

/* One entry of M2Object.lights, written by calcLights() */
export interface M2LightDetails {
    ambient_color: vec4;
    ambient_intensity: number;
    diffuse_color: vec4;
    diffuse_intensity: number;
    attenuation_start: number;
    attenuation_end: number;
    position: vec4;
    unk_ambient: number | undefined;
}

export default class AnimationManager {
    m2File: M2File;
    mainAnimationId: number;
    mainAnimationIndex: number;
    currentAnimationIndex: number;
    currentAnimationTime: number;
    currentAnimationPlayedTimes: number;
    nextSubAnimationIndex: number;
    nextSubAnimationTime: number;
    firstCalc: boolean;
    /* set by setAnimationId() and update() */
    nextSubAnimationActive: boolean | undefined;
    leftHandClosed: boolean | undefined;
    rightHandClosed: boolean | undefined;
    /* set by the init functions the constructor calls */
    globalSequenceTimes!: number[];
    bonesIsCalculated!: boolean[];
    blendMatrixArray!: mat4[];
    childBonesLookup!: number[][];
    /* set once a track has been evaluated */
    isAnimated: boolean | undefined;

    constructor(m2File: M2File){
        this.m2File = m2File;

        this.mainAnimationId = 0;
        this.mainAnimationIndex = 0;

        this.currentAnimationIndex = 0;
        this.currentAnimationTime = 0;
        this.currentAnimationPlayedTimes = 0;

        this.nextSubAnimationIndex = -1;
        this.nextSubAnimationTime = 0;

        this.firstCalc = true;

        this.initBonesIsCalc();
        this.initBlendMatrices();
        this.initGlobalSequenceTimes();
        this.calculateBoneTree();

        if (!this.setAnimationId(0)) { // try Stand(0) animation
            this.setAnimationId(147); // otherwise try Closed(147) animation
        }
    }

    setAnimationId(animationId: number, reset?: boolean): boolean {
        var m2File = this.m2File;
        var animationIndex = -1;
        if ((m2File.nAnimationLookup == 0) && (m2File.nAnimations > 0)) {
            for (var i = 0; i < m2File.nAnimations; i++) {
                var animationRecord = m2File.animations[i];
                if (animationRecord.animation_id == animationId) {
                    animationIndex = i;
                    break;
                }
            }
        } else if (animationId < m2File.nAnimationLookup!) {
            animationIndex = m2File.animationLookup![animationId];
        }
        if ((animationIndex > - 1)&& (reset || (animationIndex != this.mainAnimationIndex) )) {
            //Reset animation
            this.mainAnimationId = animationId;
            this.mainAnimationIndex = animationIndex;

            this.currentAnimationIndex = animationIndex;
            this.currentAnimationTime = 0;
            this.currentAnimationPlayedTimes = 0;

            this.nextSubAnimationIndex = -1;
            this.nextSubAnimationTime = 0;
            this.nextSubAnimationActive = false;

            this.firstCalc = true; //TODO: reset this on going to next subAnimation too
        }
        return (animationIndex > -1)
    }

    setLeftHandClosed(value: boolean) {
        this.leftHandClosed = value;
    }
    setRightHandClosed(value: boolean) {
        this.rightHandClosed = value;
    }

    blendMatrices(origMat: mat4[], blendMat: mat4[], count: number, blendAlpha: number) {
        //Actual blend
        for (var i = 0; i < count; i++) {
            var blendTransformMatrix = blendMat[i];
            var tranformMat = origMat[i];
            mat4.subtract(blendTransformMatrix, blendTransformMatrix, tranformMat);

            mat4.multiplyScalar(blendTransformMatrix, blendTransformMatrix, (1.0 - blendAlpha));
            mat4.add(tranformMat, blendTransformMatrix, tranformMat);
        }
    }

    updateCameraSimplified(deltaTime: number, cameraDetails: M2CameraDetails[]) {
        var m2File = this.m2File;
        var mainAnimationRecord = m2File.animations[this.mainAnimationIndex];
        var currentAnimationRecord = m2File.animations[this.currentAnimationIndex];

        var currentAnimationTime = this.currentAnimationTime + deltaTime;
        var currentAnimationIndex = this.currentAnimationIndex;

        //Update global sequences
        var globalSequenceTimes: number[] = new Array(this.globalSequenceTimes.length);
        for (var i = 0; i < this.globalSequenceTimes.length; i++) {
            if (m2File.globalSequences[i] > 0) { // Global sequence values can be 0's
                globalSequenceTimes[i] = this.globalSequenceTimes[i] + deltaTime;
                globalSequenceTimes[i] = globalSequenceTimes[i] % m2File.globalSequences[i];
            }
        }

        /* Pick next animation if there is one and no next animation was picked before */
        var nextSubAnimationIndex = this.nextSubAnimationIndex;
        var nextSubAnimationTime = this.nextSubAnimationTime;
        if (nextSubAnimationIndex < 0 && mainAnimationRecord.next_animation > -1) {
            //if (currentAnimationPlayedTimes)
            var probability = Math.floor(Math.random() * (0x7fff + 1));
            var calcProb = 0;

            /* First iteration is out of loop */
            var currentSubAnimIndex = this.mainAnimationIndex;
            var subAnimRecord = m2File.animations[currentSubAnimIndex];
            calcProb += subAnimRecord.probability!;
            while ((calcProb < probability) && (subAnimRecord.next_animation > -1)) {
                currentSubAnimIndex = subAnimRecord.next_animation;
                subAnimRecord = m2File.animations[currentSubAnimIndex];

                calcProb += subAnimRecord.probability!;
            }

            nextSubAnimationIndex = currentSubAnimIndex;
            nextSubAnimationTime = 0;
        }

        var currAnimLeft = currentAnimationRecord.length - this.currentAnimationTime;

        /*if (this.nextSubAnimationActive) {
         this.nextSubAnimationTime += deltaTime;
         }
         */

        var subAnimBlendTime = 0;
        var blendAlpha = 1.0;
        if (nextSubAnimationIndex > -1) {
            // JS-BUG: indexes with this.nextSubAnimationIndex (still -1 after a pick above) instead of the local nextSubAnimationIndex, and the pick is never stored back
            subAnimRecord = m2File.animations[this.nextSubAnimationIndex];
            subAnimBlendTime = subAnimRecord.blend_time;
        }

        var blendAnimationIndex = -1;
        if ((subAnimBlendTime > 0) && (currAnimLeft < subAnimBlendTime)) {
            this.firstCalc = true;
            nextSubAnimationTime = (subAnimBlendTime - currAnimLeft) % subAnimRecord!.length;
            blendAlpha = currAnimLeft / subAnimBlendTime;
            blendAnimationIndex = this.nextSubAnimationIndex
        }

        if (currentAnimationTime >= currentAnimationRecord.length) {
            if (nextSubAnimationIndex > -1) {
                currentAnimationIndex = nextSubAnimationIndex;
                currentAnimationTime = nextSubAnimationTime;

                this.nextSubAnimationIndex = -1;
                this.nextSubAnimationActive = false;
            } else {
                currentAnimationTime = currentAnimationTime % currentAnimationRecord.length;
            }
        }

        this.calcCameras(cameraDetails, currentAnimationIndex, currentAnimationTime, globalSequenceTimes);
    }
    update(deltaTime: number, cameraPosInLocal: ReadonlyVec4, bonesMatrices: mat4[], textAnimMatrices: mat4[], subMeshColors: vec4[],
           transparencies: number[], cameraDetails: M2CameraDetails[], lights: M2LightDetails[]) {
        var m2File = this.m2File;
        var mainAnimationRecord = m2File.animations[this.mainAnimationIndex];
        var currentAnimationRecord = m2File.animations[this.currentAnimationIndex];

        this.currentAnimationTime += deltaTime;
        //Update global sequences
        for (var i = 0; i < this.globalSequenceTimes.length; i++) {
            if (m2File.globalSequences[i] > 0) { // Global sequence values can be 0's
                this.globalSequenceTimes[i] += deltaTime;
                this.globalSequenceTimes[i] = this.globalSequenceTimes[i] % m2File.globalSequences[i];
            }
        }

        /* Pick next animation if there is one and no next animation was picked before */
        //if (window.selectedExpansion === Expansion.WOTLK) {
        // TODO: disable for now...
        if (false) {
          if (this.nextSubAnimationIndex < 0 && mainAnimationRecord.next_animation > -1) {
              //if (currentAnimationPlayedTimes)
              var probability = Math.floor(Math.random() * (0x7fff + 1));
              var calcProb = 0;

              /* First iteration is out of loop */
              var currentSubAnimIndex = this.mainAnimationIndex;
              var subAnimRecord = m2File.animations[currentSubAnimIndex];
              calcProb += subAnimRecord.probability!;

              // TODO: fix
              if (window.selectedExpansion === Expansion.WOTLK) {
                while ((calcProb < probability) && (subAnimRecord.next_animation > -1)) {
                    currentSubAnimIndex = subAnimRecord.next_animation;
                    subAnimRecord = m2File.animations[currentSubAnimIndex];
                
                    calcProb += subAnimRecord.probability!;
                }
              }

              this.nextSubAnimationIndex = currentSubAnimIndex;
              this.nextSubAnimationTime = 0;
          }
        }

        var currAnimLeft = currentAnimationRecord.length - this.currentAnimationTime;

        /*if (this.nextSubAnimationActive) {
            this.nextSubAnimationTime += deltaTime;
        }
        */

        var subAnimBlendTime = 0;
        var blendAlpha = 1.0;
        if (this.nextSubAnimationIndex > -1) {
            subAnimRecord = m2File.animations[this.nextSubAnimationIndex];
            subAnimBlendTime = subAnimRecord.blend_time;
        }

        var blendAnimationIndex = -1;
        if ((subAnimBlendTime > 0) && (currAnimLeft < subAnimBlendTime)) {
            this.firstCalc = true;
            this.nextSubAnimationTime = (subAnimBlendTime - currAnimLeft) % subAnimRecord!.length;
            blendAlpha = currAnimLeft / subAnimBlendTime;
            blendAnimationIndex = this.nextSubAnimationIndex
        }

        //var cycleAnims = true;
        var cycleAnims = false;

        if (this.currentAnimationTime >= currentAnimationRecord.length) {
            if (cycleAnims) {
              // RANDOM
              //this.currentAnimationIndex = Math.floor(Math.random() * m2File.animations.length);
              //this.currentAnimationTime = 0;
              // CYCLE
              this.currentAnimationIndex = (this.currentAnimationIndex + 1) % m2File.animations.length;
              this.currentAnimationTime = 0;
              //console.log("this.currentAnimationTime: ", this.currentAnimationTime);
              console.log(`New animation ID: ${this.currentAnimationIndex} / ${m2File.animations.length - 1}`);
            }
            else if (this.nextSubAnimationIndex > -1) {
                this.currentAnimationIndex = this.nextSubAnimationIndex;
                this.currentAnimationTime = this.nextSubAnimationTime;

                this.firstCalc = true;

                this.nextSubAnimationIndex = -1;
                this.nextSubAnimationActive = false;
            } else {
                this.currentAnimationTime = this.currentAnimationTime % currentAnimationRecord.length;
            }
        }

        /* Update animated values */

        this.calcAnimMatrixes(textAnimMatrices, this.currentAnimationIndex, this.currentAnimationTime);
        if (blendAnimationIndex > -1) {
            this.calcAnimMatrixes(this.blendMatrixArray, blendAnimationIndex, this.nextSubAnimationTime);
            this.blendMatrices(textAnimMatrices, this.blendMatrixArray, m2File.nTexAnims, blendAlpha);
        }

        for (var i = 0; i < m2File.nBones; i++) {
            this.bonesIsCalculated[i] = false;
        }
        this.calcBones(bonesMatrices, this.currentAnimationIndex, this.currentAnimationTime, cameraPosInLocal);
        if (blendAnimationIndex > -1){
            for (var i = 0; i < m2File.nBones; i++) {
                this.bonesIsCalculated[i] = false;
                mat4.identity( this.blendMatrixArray[i]);
            }

            this.calcBones(this.blendMatrixArray, blendAnimationIndex, this.nextSubAnimationTime, cameraPosInLocal);
            this.blendMatrices(bonesMatrices, this.blendMatrixArray, m2File.nBones, blendAlpha)
        }

        this.calcSubMeshColors(subMeshColors, this.currentAnimationIndex, this.currentAnimationTime, blendAnimationIndex, this.nextSubAnimationTime, blendAlpha);
        this.calcTransparencies(transparencies, this.currentAnimationIndex, this.currentAnimationTime, blendAnimationIndex, this.nextSubAnimationTime, blendAlpha);

        this.calcCameras(cameraDetails, this.currentAnimationIndex, this.currentAnimationTime);
        this.calcLights(lights, bonesMatrices, this.currentAnimationIndex, this.currentAnimationTime)
    }

    /* Init function */
    initGlobalSequenceTimes() {
        var m2File = this.m2File;

        var globalSequenceTimes: number[] = new Array(m2File.nGlobalSequences > 0 ? m2File.nGlobalSequences : 0);
        for (var i = 0; i < globalSequenceTimes.length; i++) {
            globalSequenceTimes[i] = 0;
        }

        this.globalSequenceTimes = globalSequenceTimes;
    }
    initBonesIsCalc() {
        var m2File = this.m2File;
        var bonesIsCalculated: boolean[] = new Array(m2File.nBones);

        for (var i = 0; i < m2File.nBones; i++) {
            bonesIsCalculated[i] = false;
        }

        this.bonesIsCalculated = bonesIsCalculated;
    }
    initBlendMatrices() {
        var m2File = this.m2File;
        var matCount = Math.max(m2File.nBones, m2File.nTexAnims)
        var blendMatrixArray: mat4[] = new Array(matCount);

        for (var i = 0; i < matCount; i++) {
            blendMatrixArray[i] = mat4.create();
        }

        this.blendMatrixArray = blendMatrixArray;
    }

    /* Interpolate functions */
    interpolateValues(currentTime: number, interpolType: number, time1: number, time2: number, value1: vec4, value2: vec4, valueType: number): vec4 | undefined {
        //Support and use only linear interpolation for now
        if (interpolType == 0) {
            return value1;
        } else if (interpolType >= 1) {

            if (valueType == 1 || valueType == 3) {
                var result = vec4.create();
                quat.slerp(result, value1, value2, (currentTime - time1)/(time2 - time1));
                vec4.normalize(result, result); //quaternion has to be normalized after lerp operation
            } else {
                var diff = vec4.create();
                vec4.subtract(diff, value2, value1);
                vec4.scale(diff, diff, (currentTime - time1)/(time2 - time1));
                var result = vec4.create();
                vec4.add(result, value1, diff);
            }

            return result;
        }
    }
    getTimedValue(value_type: number, currTime: number, maxTime: number, animation: number, animationBlock: M2Track<M2TrackValue>,
                  globalSequenceTimes?: number[]): vec4 | null | undefined {
        function convertUint16ToFloat(value: number): number {
            return (value * 0.000030518044) - 1.0;
        }

        function decodeM2ShortQuat(shortArray: number[] /* e.g. [sx, sy, sz, sw] */): number[] {
            //console.log("shortArray: ", shortArray);
            // Each sx,sy,sz,sw is an *signed* 16-bit value in [-32767,+32767]
            const sx = shortArray[0];
            const sy = shortArray[1];
            const sz = shortArray[2];
            const sw = shortArray[3];

            const x = (sx < 0 ? sx + 32768 : sx - 32767) / 32767;
            const y = (sy < 0 ? sy + 32768 : sy - 32767) / 32767;
            const z = (sz < 0 ? sz + 32768 : sz - 32767) / 32767;
            const w = (sw < 0 ? sw + 32768 : sw - 32767) / 32767;

            return [x, y, z, w];
        }

        //function decodeM2FloatQuat(floatArray) {
        //  //console.log("floatArray: ", floatArray);
        //    return [
        //        floatArray[0],
        //        floatArray[1],
        //        floatArray[2],
        //        floatArray[3],
        //    ];
        //}

        // Ahh right... the vector4f is an object!
        function decodeM2FloatQuat(quatObj: Vector4f): number[] {
          return [
            quatObj.x,
            quatObj.y,
            quatObj.z,
            quatObj.w
          ];
        }

        /* the type of value follows from type: 0 Vector3f, 1 quaternion, 2 and 4 number, 3 Vector4f */
        function convertValueTypeToVec4(value: M2TrackValue, type: number): number[] | undefined {
            //console.log("convertValueTypeToVec4 called with values:");
            //console.log("value:", value);
            //console.log("type:", type);
            if (type == 0) {
                return [(value as Vector3f).x, (value as Vector3f).y, (value as Vector3f).z, 0];
            } else if (type == 1) {
                if (window.selectedExpansion === Expansion.CLASSIC) {
                  return decodeM2FloatQuat(value as Vector4f);
                } else if (window.selectedExpansion === Expansion.TBC) {
                  return decodeM2ShortQuat(value as number[]);
                }
                return [convertUint16ToFloat((value as number[])[0]),
                    convertUint16ToFloat((value as number[])[1]),
                    convertUint16ToFloat((value as number[])[2]),
                    convertUint16ToFloat((value as number[])[3])];
            } else if (type == 2) {
                return [(value as number)/32767,(value as number)/32767, (value as number)/32767, (value as number)/32767];
            } else if (type == 3) {
                return [(value as Vector4f).x,(value as Vector4f).y, (value as Vector4f).z, (value as Vector4f).w];
            } else if (type == 4) {
                return [value as number, 0,0,0];
            }
        }

        if (window.selectedExpansion !== Expansion.WOTLK) {
          // Test (will show up as non-animated)
          //return undefined;

          // TODO: fix
          // Problem: for example druidbear in tbc starts with animationIndex 2 even if setting 0 via SetAnimationId...
          // In js i don't need AnimationLookup for non-wotlk so it doesn't affect it... Should try to figure out SetAnimationId...
          // Only first animation works currently...
          //animation = 0;
          //this.currentAnimationIndex = 0;

          // JS-BUG: wraps the time into this.currentAnimationIndex's range whatever the animation parameter is (closed-hand and blend animations get the wrong time); NaN when timeEnd == timeStart
          const currentAnimationRecord = this.m2File.animations[this.currentAnimationIndex];
          //console.log("m2file:", this.m2File);
          const tmax = currentAnimationRecord.timeEnd! - currentAnimationRecord.timeStart!;

          // Loop 't' within that range
          //currTime = parseInt(currTime / 10, 10);
          currTime = currTime % tmax;
          currTime += currentAnimationRecord.timeStart!;
        }

        // Debug
        // if (value_type == 1)
        //console.log("getTimedValue called with:");
        //console.log("value_type:", value_type);
        //console.log("currTime:", currTime);
        //console.log("maxTime:", maxTime);
        //console.log("animation:", animation);
        //console.log("animationBlock:", animationBlock);
        //console.log("globalSequenceTimes:", globalSequenceTimes);

        var globalSequence = animationBlock.global_sequence;
        var interpolType = animationBlock.interpolation_type;

        if (animation < 0
            || animation >= animationBlock.timestampsPerAnimation.length
            || animation >= animationBlock.valuesPerAnimation.length)
        {
            return null;
        }

        var times = animationBlock.timestampsPerAnimation[animation];
        var values =  animationBlock.valuesPerAnimation[animation];

        //Hack
        if (times == undefined) {
            animation = 0;
            times = animationBlock.timestampsPerAnimation[animation];
            values =  animationBlock.valuesPerAnimation[animation];
        }
        if (!times || times.length == 0) {
            return undefined;
        }

        if (globalSequence >=0) {
            if (globalSequenceTimes) {
                currTime = globalSequenceTimes[globalSequence];
            } else {
                currTime = this.globalSequenceTimes[globalSequence];
            }
            maxTime = this.m2File.globalSequences[globalSequence];
        }

        var times_len = times.length;
        var result: vec4 | undefined;
        if (times_len > 1) {
            // JS-BUG: overwrites maxTime (the parameter, or the global sequence length) with the last timestamp, so the branch below that tests animTime > times[times_len-1] && animTime <= maxTime never runs
            var maxTime = times[times_len-1];

            var animTime = currTime;
            if (window.selectedExpansion === Expansion.WOTLK) {
              animTime = currTime % maxTime;
            }

            if (animTime > times[times_len-1] && animTime <= maxTime) {
                //console.log("[Line A] About to call convertValueTypeToVec4 with:", values[0]);
                result = convertValueTypeToVec4(values[0], value_type);
            } else {
                // Note: if we really want the “last value,” this should be values[times_len-1].
                //console.log("[Line B] About to call convertValueTypeToVec4 with:", times[times_len - 1]);
                //result =  convertValueTypeToVec4(times[times_len-1], value_type);
                result = convertValueTypeToVec4(values[times_len - 1], value_type);

                for (var i = 0; i < times_len; i++) {
                    if (times[i] > animTime) {

                        if (i - 1 < 0)
                        {
                            return null;
                        }

                        var value1: M2TrackValue | undefined = values[i - 1];
                        var value2: M2TrackValue | undefined = values[i];

                        var time1 = times[i - 1];
                        var time2 = times[i];

                        //console.log("[Line C] About to call convertValueTypeToVec4(value1):", value1);
                        //console.log("[Line D] About to call convertValueTypeToVec4(value2):", value2);
                        value1 = convertValueTypeToVec4(value1, value_type);
                        value2 = convertValueTypeToVec4(value2, value_type);

                        result = this.interpolateValues(animTime,
                            interpolType, time1, time2, value1!, value2!, value_type);

                        break;
                    }
                }
            }
        } else {
            //console.log("[Line E] About to call convertValueTypeToVec4 with:", values[0]);
            result = convertValueTypeToVec4(values[0], value_type);
        }

        return result;
    }

    /* Calculate animation transform */
    calcAnimationTransform(tranformMat: mat4, isBone: boolean,
                            pivotPoint: vec4, negatePivotPoint: vec4,
                            animationData: M2Bone | M2TexAnim,
                            animationIndex: number, animationRecord: M2Animation, time: number,
                            billboardMatrix: mat4 | null)
    {

        transVec = mat4.translate(tranformMat, tranformMat, pivotPoint);

        if (animationData.translation.valuesPerAnimation.length > 0) {
            var transVec = this.getTimedValue(
                0,
                time,
                animationRecord.length,
                animationIndex,
                animationData.translation);

            var resultTrans1 = [0,0,0,0];
            if (transVec) {
                resultTrans1 = [
                    transVec[0],
                    transVec[1],
                    transVec[2],
                    0
                ]
            }

            mat4.translate(tranformMat, tranformMat, resultTrans1);

            this.isAnimated = true;
        }
        if (billboardMatrix != null) {
            mat4.multiply(tranformMat, tranformMat, billboardMatrix);
        } else if (animationData.rotation.valuesPerAnimation.length > 0) {
          // For now since classic model rotation doesn't quite work :(
          //if (window.selectedExpansion !== Expansion.CLASSIC) {
          if (true) {
            var rotationType = (isBone)? 1: 3;

            var quaternionResult1 = this.getTimedValue(
              rotationType,
              time,
              animationRecord.length,
              animationIndex,
              animationData.rotation);

            if (quaternionResult1) {
              var orientMatrix = mat4.create();

              mat4.fromQuat(orientMatrix, quaternionResult1);
              mat4.multiply(tranformMat, tranformMat, orientMatrix);
            }
            this.isAnimated = true;
          }
        }

        if (animationData.scale.valuesPerAnimation.length > 0) {

            var scaleResult1 = this.getTimedValue(
                0,
                time,
                animationRecord.length,
                animationIndex,
                animationData.scale);

            if (scaleResult1) {
               mat4.scale(tranformMat, tranformMat, [
                        scaleResult1[0],
                        scaleResult1[1],
                        scaleResult1[2]
                    ]
                );
            }
            this.isAnimated = true;
        }
        mat4.translate(tranformMat, tranformMat, negatePivotPoint);
    }

    /* Texture function */
    calcAnimMatrixes (textAnimMatrices: mat4[], animationIndex: number, time: number) {
        var m2File = this.m2File;

        var pivotPoint = vec4.fromValues(0.5, 0.5, 0, 0);
        var negatePivotPoint = vec4.create();
        vec4.negate(negatePivotPoint, pivotPoint);

        var animationRecord = m2File.animations[animationIndex];
        for (var i = 0; i < m2File.texAnims.length; i++) {
            var textAnimData = m2File.texAnims[i];

            mat4.identity(textAnimMatrices[i]);
            this.calcAnimationTransform(textAnimMatrices[i], false,
                pivotPoint, negatePivotPoint,
                textAnimData,
                animationIndex, animationRecord, time,
                null);
        }
    }

    /* Bone init functions */
    calculateBoneTree() {
        var m2File = this.m2File;

        var childBonesLookup: number[][] = new Array(m2File.bones.length);
        for (var i = 0; i < m2File.bones.length; i++) {
            var childBones: number[] = [];
            for (var j = 0; j < m2File.bones.length; j++) {
                if (m2File.bones[j].parent_bone == i) {
                    childBones.push(j)
                }
            }
            childBonesLookup[i] = childBones;
        }

        this.childBonesLookup = childBonesLookup;
    }

    /* Bone animation functons */
    calcBones (boneMatrices: mat4[], animation: number, time: number, cameraPosInLocal: ReadonlyVec4) {
        var m2File = this.m2File;

        if (this.firstCalc || this.isAnimated) {
            //Animate everything with standard animation
            for (var i = 0; i < m2File.nBones; i++) {
                this.calcBoneMatrix(boneMatrices, i, animation, time, cameraPosInLocal);
            }

            /* Animate mouth */
            /*
             if (m2File.keyBoneLookup[6] > -1) { // BONE_HEAD = 6
             var boneId = m2File.keyBoneLookup[6];
             this.calcBoneMatrix(boneId, this.bones[boneId], animation, time, cameraPos, invPlacementMat);
             }
             if (m2File.keyBoneLookup[7] > -1) { // BONE_JAW = 7
             var boneId = m2File.keyBoneLookup[7];
             this.calcBoneMatrix(boneId, this.bones[boneId], animation, time, cameraPos, invPlacementMat);
             }
             */

            var closedHandAnimation = -1;
            if (m2File.animationLookup!.length > 15 && m2File.animationLookup![15] > 0) { //ANIMATION_HANDSCLOSED = 15
                closedHandAnimation = m2File.animationLookup![15];
            }

            if (closedHandAnimation >= 0){
                if (this.leftHandClosed) {
                    for (var j = 0; j < 5; j++) {
                        if (m2File.keyBoneLookup![13 + j] > -1) { // BONE_LFINGER1 = 13
                            var boneId = m2File.keyBoneLookup![13 + j];
                            this.bonesIsCalculated[boneId] = false;
                            this.calcBoneMatrix(boneMatrices, boneId, closedHandAnimation, 1, cameraPosInLocal);
                            // JS-BUG: calcChildBones takes 8 parameters; cameraPosInLocal lands in blendAnimationIndex (see calcChildBones)
                            this.calcChildBones(boneMatrices, boneId, closedHandAnimation, 1, cameraPosInLocal)
                        }
                    }
                }
                if (this.rightHandClosed) {
                    for (var j = 0; j < 5; j++) {
                        if (m2File.keyBoneLookup![8 + j] > -1) { // BONE_RFINGER1 = 8
                            var boneId = m2File.keyBoneLookup![8 + j];
                            this.bonesIsCalculated[boneId] = false;
                            this.calcBoneMatrix(boneMatrices, boneId, closedHandAnimation, 1, cameraPosInLocal);
                            // JS-BUG: calcChildBones takes 8 parameters; cameraPosInLocal lands in blendAnimationIndex (see calcChildBones)
                            this.calcChildBones(boneMatrices, boneId, closedHandAnimation, 1, cameraPosInLocal)
                        }
                    }
                }

            }
        }
        this.firstCalc = false;
    }
    calcBoneBillboardMatrix(boneMatrices: mat4[], boneDefinition: M2Bone, parentBone: number, pivotPoint: ReadonlyVec4, cameraPosInLocal: ReadonlyVec4): mat4 {
        var modelForward = vec3.create();

        var cameraPoint = vec4.create();
        vec4.copy(cameraPoint, cameraPosInLocal);
        if (parentBone>=0) {
            var parentMatrix = boneMatrices[parentBone];
            var invertParentMat = mat4.create();
            mat4.invert(invertParentMat, parentMatrix);


            vec4.transformMat4(cameraPoint, cameraPoint, invertParentMat);
        }

        vec4.subtract(cameraPoint, cameraPoint, pivotPoint);

        vec3.normalize(modelForward, cameraPoint);

        if ((boneDefinition.flags & 0x40) > 0) {
            //Cylindrical billboard

            var modelUp = vec3.fromValues(0,0,1);

            var modelRight = vec3.create();
            vec3.cross(modelRight, modelUp, modelForward);
            vec3.normalize(modelRight, modelRight);

            vec3.cross(modelForward, modelRight, modelUp);
            vec3.normalize(modelForward, modelForward);

            vec3.cross(modelRight, modelUp, modelForward);
            vec3.normalize(modelRight, modelRight);

        } else {
            //Spherical billboard
            var modelRight = vec3.create();
            vec3.cross(modelRight, [0, 0, 1], modelForward);
            vec3.normalize(modelRight, modelRight);

            var modelUp = vec3.create();
            vec3.cross(modelUp, modelForward, modelRight);
            vec3.normalize(modelUp, modelUp);
        }


        var billboardMatrix = mat4.fromValues(
            modelForward[0],modelForward[1],modelForward[2],0,
            modelRight[0],modelRight[1],modelRight[2],0,
            modelUp[0],modelUp[1],modelUp[2],0,
            0,0,0,1
        );

        return billboardMatrix;
    }
    calcBoneMatrix (boneMatrices: mat4[], boneIndex: number, animationIndex: number, time: number, cameraPosInLocal: ReadonlyVec4){
        if (this.bonesIsCalculated[boneIndex]) return;

        var m2File = this.m2File;

        var animationRecord = m2File.animations[animationIndex];
        var boneDefinition = m2File.bones[boneIndex];

        var parentBone = boneDefinition.parent_bone;

        /* 2. Prepare bone part of animation process */
        var tranformMat = boneMatrices[boneIndex];
        tranformMat = mat4.identity(tranformMat);

        if (parentBone>=0) {
            this.calcBoneMatrix(boneMatrices, parentBone, animationIndex, time, cameraPosInLocal);
            mat4.multiply(tranformMat, tranformMat, boneMatrices[parentBone]);
        }

        if ((boneDefinition.flags & 0x278) == 0) {
            this.bonesIsCalculated[boneIndex] = true;
            return
        }

        //return new Vec3D(this.x, this.z, this.y);
        var pivotPoint = vec4.fromValues(
            boneDefinition.pivot.x,
            boneDefinition.pivot.y,
            boneDefinition.pivot.z,
            //boneDefinition.pivot.x,
            //boneDefinition.pivot.z,
            //boneDefinition.pivot.y,
            0
        );
        var negatePivotPoint = vec4.fromValues(
            -boneDefinition.pivot.x,
            -boneDefinition.pivot.y,
            -boneDefinition.pivot.z,
            //-boneDefinition.pivot.x,
            //-boneDefinition.pivot.z,
            //-boneDefinition.pivot.y,
            0
        );

        /* 2.1 Calculate billboard matrix if needed */
        var billboardMatrix: mat4 | null = null;
        if (((boneDefinition.flags & 0x8) > 0) || ((boneDefinition.flags & 0x40) > 0)) {
            //From http://gamedev.stackexchange.com/questions/112270/calculating-rotation-matrix-for-an-object-relative-to-a-planets-surface-in-monog
            billboardMatrix = this.calcBoneBillboardMatrix(boneMatrices, boneDefinition, parentBone, pivotPoint, cameraPosInLocal);
            this.isAnimated = true;
        }

        /* 3. Calculate matrix */
        this.calcAnimationTransform(tranformMat, true,
            pivotPoint, negatePivotPoint,
            boneDefinition,
            animationIndex, animationRecord, time,
            billboardMatrix);

        this.bonesIsCalculated[boneIndex] = true;
    }
    /* calcBones() passes only five arguments, so blendAnimationIndex receives the camera position and the last three are undefined */
    calcChildBones(boneMatrices: mat4[], boneIndex: number, animationIndex: number, time: number, blendAnimationIndex: ReadonlyVec4,
                   blendAnimationTime?: unknown, blendAlpha?: unknown, cameraPosInLocal?: unknown) {
        var childBones = this.childBonesLookup[boneIndex];
        for (var i = 0; i < childBones.length; i++) {
            var childBoneIndex = childBones[i];
            this.bonesIsCalculated[childBoneIndex] = false;
            // JS-BUG: passes eight arguments to the five-parameter calcBoneMatrix - the camera position in blendAnimationIndex becomes its cameraPosInLocal, so it works by accident
            // @ts-expect-error calcBoneMatrix takes five arguments; the JavaScript passes eight (bug 52)
            this.calcBoneMatrix(boneMatrices, childBoneIndex, animationIndex, time, blendAnimationIndex, blendAnimationTime, blendAlpha, cameraPosInLocal);
            this.calcChildBones(boneMatrices, childBoneIndex, animationIndex, time, blendAnimationIndex, blendAnimationTime, blendAlpha, cameraPosInLocal);
        }
    }

    calcSubMeshColors (subMeshColors: vec4[], animationIndex: number, time: number, blendAnimationIndex: number, blendAnimationTime: number, blendAlpha: number) {
        var colors = this.m2File.colors;
        var animationRecord = this.m2File.animations[animationIndex];
        var blendAnimationRecord: M2Animation | null = null;
        if (blendAnimationIndex > -1) {
            blendAnimationRecord = this.m2File.animations[blendAnimationIndex];
        }

        for (var i = 0; i < colors.length; i++) {
            var colorVec = this.getTimedValue(
                0,
                time,
                animationRecord.length,
                animationIndex,
                colors[i].color);

            var colorResult1: vec4 = [1.0, 1.0, 1.0, 1.0];
            if (colorVec) {
                colorResult1 = [colorVec[0], colorVec[1], colorVec[2],1]
            }

            // Support for blend
            if (blendAnimationRecord != null) {
                colorVec = this.getTimedValue(
                    0,
                    blendAnimationTime,
                    blendAnimationRecord.length,
                    blendAnimationIndex,
                    colors[i].color);
                if (colorVec) {
                    var colorResult2 = [colorVec[0], colorVec[1], colorVec[2],1]
                    colorResult1 = this.interpolateValues(1.0 - blendAlpha, 1, 0, 1, colorResult1, colorResult2, 0)!
                }
            }

            subMeshColors[i] = colorResult1;

            var alpha = this.getTimedValue(
                2,
                time,
                animationRecord.length,
                animationIndex,
                colors[i].alpha);

            var resultAlpha1 = 1.0;
            if (alpha) {
                resultAlpha1 = alpha[0];
            }

            // Support for blend
            if (blendAnimationRecord != null) {
                // JS-BUG: evaluates the current animation again (time, animationRecord, animationIndex) instead of the blend animation, so alpha is not blended
                alpha = this.getTimedValue(
                    2,
                    time,
                    animationRecord.length,
                    animationIndex,
                    colors[i].alpha);

                if (alpha) {
                    var resultAlpha2 = alpha[0];
                    resultAlpha1 = (resultAlpha1 * blendAlpha) + ((1-blendAlpha) * resultAlpha2)
                }
            }

            subMeshColors[i][3] = resultAlpha1;
        }
    }
    calcTransparencies(transparencies: number[], animationIndex: number, time: number, blendAnimationIndex: number, blendAnimationTime: number, blendAlpha: number) {
        var transparencyRecords = this.m2File.transparencies;
        var animationRecord = this.m2File.animations[animationIndex];
        var blendAnimationRecord: M2Animation | null = null;
        if (blendAnimationIndex > -1) {
            blendAnimationRecord = this.m2File.animations[blendAnimationIndex];
        }

        for (var i = 0; i < transparencyRecords.length; i++) {
            var transparency = this.getTimedValue(
                2,
                time,
                animationRecord.length,
                animationIndex,
                transparencyRecords[i].values);

            var result1 = 1.0;
            if (transparency) {
                result1 = transparency[0];
            }
            // Support for blend
            if (blendAnimationRecord != null) {
                transparency = this.getTimedValue(
                    2,
                    blendAnimationTime,
                    blendAnimationRecord.length,
                    blendAnimationIndex,
                    transparencyRecords[i].values);

                if (transparency) {
                    var result2 = transparency[0];
                    result1 = (result1 * blendAlpha) + ((1-blendAlpha) * result2)
                }
            }

            transparencies[i] = result1;
        }
    }

    calcCameras(cameraDetails: M2CameraDetails[], animationIndex: number, animationTime: number, globalSequenceTimes?: number[]) {
        var m2File = this.m2File;
        var cameras = m2File.cameras;
        if (!cameras) return;

        var animationRecord = this.m2File.animations[animationIndex];

        for (var i = 0; i < cameras.length; i++) {
            var cameraRecord = cameras[i];
            var currentPosition = this.getTimedValue(
                0,
                animationTime,
                animationRecord.length,
                animationIndex,
                cameraRecord.positions,
                globalSequenceTimes);

            if (currentPosition) {
                currentPosition[0] += cameraRecord.position_base.x;
                currentPosition[1] += cameraRecord.position_base.y;
                currentPosition[2] += cameraRecord.position_base.z;
            } else {
                currentPosition = new Array(3);
                currentPosition[0] = cameraRecord.position_base.x;
                currentPosition[1] = cameraRecord.position_base.y;
                currentPosition[2] = cameraRecord.position_base.z;
            }
            var currentTarget = this.getTimedValue(
                0,
                animationTime,
                animationRecord.length,
                animationIndex,
                cameraRecord.target_position,
                globalSequenceTimes);

            if (currentTarget) {
                currentTarget[0] += cameraRecord.target_position_base.x;
                currentTarget[1] += cameraRecord.target_position_base.y;
                currentTarget[2] += cameraRecord.target_position_base.z;
            } else {
                currentTarget = new Array(3);
                currentTarget[0] = cameraRecord.target_position_base.x;
                currentTarget[1] = cameraRecord.target_position_base.y;
                currentTarget[2] = cameraRecord.target_position_base.z;
            }
            //TODO: Implement Roll

            //Write values
            cameraDetails[i].currentPosition = currentPosition;
            cameraDetails[i].currentTarget = currentTarget;
            cameraDetails[i].farClip = cameraRecord.far_clip;
            cameraDetails[i].nearClip = cameraRecord.near_clip
            cameraDetails[i].fov = cameraRecord.fov;
        }
    }

    calcLights(lights: M2LightDetails[], bonesMatrices: mat4[], animationIndex: number, animationTime: number) {
        var m2File = this.m2File;
        var lightRecords = m2File.lights;
        if (!lightRecords) return;

        var animationRecord = this.m2File.animations[animationIndex];

        for (var i = 0; i < lightRecords.length; i++) {
            var lightRecord = lightRecords[i];

            // JS-BUG: indexes and scales the results without checking them - a light track without keys for this animation (null / undefined) throws a TypeError
            var ambient_color = this.getTimedValue(
                0,
                animationTime,
                animationRecord.length,
                animationIndex,
                lightRecord.ambient_color);

            var ambient_intensity = this.getTimedValue(
                4,
                animationTime,
                animationRecord.length,
                animationIndex,
                lightRecord.ambient_intensity)![0];
            var diffuse_color = this.getTimedValue(
                0,
                animationTime,
                animationRecord.length,
                animationIndex,
                lightRecord.diffuse_color);
            var diffuse_intensity = this.getTimedValue(
                4,
                animationTime,
                animationRecord.length,
                animationIndex,
                lightRecord.diffuse_intensity)![0];
            var attenuation_start = this.getTimedValue(
                4,
                animationTime,
                animationRecord.length,
                animationIndex,
                lightRecord.attenuation_start)![0];
            var attenuation_end = this.getTimedValue(
                4,
                animationTime,
                animationRecord.length,
                animationIndex,
                lightRecord.attenuation_end)![0];

            var unk_ambient: vec4 | number | null | undefined = this.getTimedValue(
                4,
                animationTime,
                animationRecord.length,
                animationIndex,
                lightRecord.unknown);
            if (unk_ambient !== undefined) {
                unk_ambient = unk_ambient![0];
            }

            var boneMat = bonesMatrices[lightRecord.bone];
            var pos_vec = lightRecord.position;

            var position = vec4.fromValues(pos_vec.x, pos_vec.y, pos_vec.z, 1.0);
            vec4.transformMat4(position, position, boneMat);

            lights[i].ambient_color = ambient_color!;
            lights[i].ambient_intensity = ambient_intensity;
            lights[i].ambient_color[0] *= ambient_intensity;
            lights[i].ambient_color[1] *= ambient_intensity;
            lights[i].ambient_color[2] *= ambient_intensity;
            lights[i].ambient_color[3] *= ambient_intensity;

            lights[i].diffuse_color = diffuse_color!;
            lights[i].diffuse_intensity = diffuse_intensity;
            lights[i].attenuation_start = attenuation_start;
            lights[i].attenuation_end = attenuation_end;
            lights[i].position = position;
            lights[i].unk_ambient = unk_ambient as number | undefined;
        }
    }
}
