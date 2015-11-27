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
attribute vec2 aTexCoord;
attribute vec2 aTexCoord2;

attribute vec4 aColor;

uniform mat4 uLookAtMat;
uniform mat4 uPMatrix;
uniform int isBillboard;

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

void main() {
    vec4 worldPoint;
    if (isBillboard == 1) {
        mat4 modelView = uLookAtMat * uPlacementMat;
        modelView[0][0] = 1.0;
        modelView[0][1] = 0.0;
        modelView[0][2] = 0.0;

        // Second colunm.
        modelView[1][0] = 0.0;
        modelView[1][1] = 1.0;
        modelView[1][2] = 0.0;

        // Thrid colunm.
        modelView[2][0] = 0.0;
        modelView[2][1] = 0.0;
        modelView[2][2] = 1.0;

        worldPoint = modelView * vec4(aPosition, 1);
    } else {
        worldPoint = uLookAtMat * uPlacementMat * vec4(aPosition, 1);
    }

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
        tex.a);

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
