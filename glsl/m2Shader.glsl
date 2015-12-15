//https://www.khronos.org/registry/webgl/extensions/WEBGL_draw_buffers/
//For drawbuffers in glsl of webgl you need to use GL_EXT_draw_buffers instead of WEBGL_draw_buffers

#ifdef ENABLE_DEFERRED
#ifdef GL_EXT_draw_buffers
    #extension GL_EXT_draw_buffers: require
    #extension OES_texture_float_linear : enable
    #define drawBuffersIsSupported 1
#endif
#endif

#ifdef COMPILING_VS
/* vertex shader code */
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec4 bones;
attribute vec4 boneWeights;
attribute vec2 aTexCoord;
attribute vec2 aTexCoord2;

attribute vec4 aColor;

uniform mat4 uLookAtMat;
uniform mat4 uPMatrix;
uniform int isBillboard;
uniform mat4 uBoneMatrixes[100]; //TODO: investigate maximal number for this

#ifdef INSTANCED
attribute mat4 uPlacementMat;
#else
uniform mat4 uPlacementMat;
#endif

varying vec2 vTexCoord;
varying vec2 vTexCoord2;
varying vec4 vColor;

#ifdef drawBuffersIsSupported
varying vec3 vNormal;
varying vec3 vPosition;
#endif


mat3 inverse(mat3 m) {
    float a00 = m[0][0], a01 = m[0][1], a02 = m[0][2];
    float a10 = m[1][0], a11 = m[1][1], a12 = m[1][2];
    float a20 = m[2][0], a21 = m[2][1], a22 = m[2][2];

    float b01 =  a22 * a11 - a12 * a21;
    float b11 = -a22 * a10 + a12 * a20;
    float b21 =  a21 * a10 - a11 * a20;

    float det = a00 * b01 + a01 * b11 + a02 * b21;

    return mat3(b01, (-a22 * a01 + a02 * a21), (a12 * a01 - a02 * a11),
                b11, (a22 * a00 - a02 * a20), (-a12 * a00 + a02 * a10),
                b21, (-a21 * a00 + a01 * a20), (a11 * a00 - a01 * a10)) / det;
}

void main() {
    vec4 worldPoint = vec4(0,0,0,0);
    vec4 aPositionVec4 = vec4(aPosition, 1);

    worldPoint += (boneWeights.x ) * (uBoneMatrixes[int(bones.x)] * aPositionVec4);
    worldPoint += (boneWeights.y ) * (uBoneMatrixes[int(bones.y)] * aPositionVec4);
    worldPoint += (boneWeights.z ) * (uBoneMatrixes[int(bones.z)] * aPositionVec4);
    worldPoint += (boneWeights.w ) * (uBoneMatrixes[int(bones.w)] * aPositionVec4);

    worldPoint = uLookAtMat * uPlacementMat * vec4(worldPoint.xyz, 1);

    vTexCoord = aTexCoord;
    vTexCoord2 = aTexCoord2;
    vColor = aColor;

#ifndef drawBuffersIsSupported
    gl_Position = uPMatrix * worldPoint;
#else
    gl_Position = worldPoint;

    vNormal = normalize((uPlacementMat * vec4(aNormal, 0)).xyz);
    vPosition = worldPoint.xyz;
#endif //drawBuffersIsSupported

}
#endif //COMPILING_VS

#ifdef COMPILING_FS

precision lowp float;
varying vec3 vNormal;
varying vec2 vTexCoord;
varying vec2 vTexCoord2;
varying vec4 vColor;
varying vec3 vPosition;

//uniform vec4  uGlobalLighting;
uniform float uAlphaTest;
uniform sampler2D uTexture;
uniform sampler2D uTexture2;


void main() {
    vec4 tex = texture2D(uTexture, vTexCoord).rgba;
    vec4 tex2 = texture2D(uTexture2, vTexCoord2).rgba;

    vec4 finalColor = vec4(
        (tex.r * vColor.b) ,
        (tex.g * vColor.g) ,
        (tex.b * vColor.r) ,
        tex.a * vColor.a);

    finalColor = finalColor * tex2;

    if(finalColor.a < uAlphaTest)
        discard;

    //Apply global lighting
/*
    finalColor = vec4(
        (finalColor.r + uGlobalLighting.r) ,
        (finalColor.g + uGlobalLighting.g) ,
        (finalColor.b + uGlobalLighting.b) ,
        finalColor.a);
  */
    //finalColor.a = 1.0; //do I really need it now?

#ifndef drawBuffersIsSupported
    //Forward rendering without lights
    gl_FragColor = finalColor;
#else
    //Deferred rendering
    gl_FragData[0] = finalColor;
    gl_FragData[1] = vec4(vPosition.xyz,0);
    gl_FragData[2] = vec4(vNormal.xyz,0);
#endif //drawBuffersIsSupported
}

#endif //COMPILING_FS