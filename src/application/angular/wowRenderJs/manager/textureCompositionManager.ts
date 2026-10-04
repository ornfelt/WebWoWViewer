import wowTextureRegions from './../math/wowTextureRegions';
import type { SceneApi } from './../sceneApi';
import type { Texture } from './../texture/textureCache';

/* One texture drawn into a region; textureObj stays null until the texture has loaded */
export interface OverrideTextureRecord {
    fileName: string;
    textureObj: Texture | null;
}

class TextureCompositionManager {
    sceneApi: SceneApi;
    needsUpdate: boolean;
    /* indexed by texture region (wowTextureRegions); a slot stays empty until a texture is added */
    textureArray: OverrideTextureRecord[][];
    /* the composed 1024x1024 texture, in the shape M2Object.overrideModelTexture() reads */
    texture: { texture: WebGLTexture };

    constructor (sceneApi: SceneApi) {
        this.sceneApi = sceneApi;
        this.needsUpdate = false;

        this.textureArray = new Array(13);

        var gl = this.sceneApi.getGlContext();
        var colorTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, colorTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1024, 1024, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindTexture(gl.TEXTURE_2D, null);

        this.texture = { texture: colorTexture};
    }


    clear() {
        this.textureArray = new Array(13);
    }
    addTexture(slot: number, textureName: string, gender: number | null) {
        var self = this;
        if (!textureName) return;
        if (!this.textureArray[slot]) {
            this.textureArray[slot] = new Array();
        }

        var actualTextureName = textureName;
        var recordForOverideTexture: OverrideTextureRecord = {fileName: textureName, textureObj: null}
        actualTextureName = textureName;
        if (gender != null) {
            actualTextureName = textureName +'.blp';
        }

        this.sceneApi.resources.loadTexture(actualTextureName).then(function(texture) {
            recordForOverideTexture.textureObj = texture;
            self.needsUpdate = true;
        }, function (error) {
            if (gender == null) return null;
            var gender_prefix = (gender == 1) ? "_m" : "_f";
            actualTextureName = textureName+gender_prefix+'.blp';

            self.sceneApi.resources.loadTexture(actualTextureName).then(function (texture) {
                recordForOverideTexture.textureObj = texture;
                self.needsUpdate = true;
            }, function (error) {
                actualTextureName = textureName + '_u' + '.blp';
                recordForOverideTexture.fileName = actualTextureName;
                self.sceneApi.resources.loadTexture(actualTextureName).then(function (texture) {
                    recordForOverideTexture.textureObj = texture;
                    self.needsUpdate = true;
                });
            });
        });

        this.textureArray[slot].push(recordForOverideTexture);

        //this.needsUpdate = true;
    }

    drawTexturesFromArray(slot: number) {
        var gl = this.sceneApi.getGlContext();
        var shaderUniforms = this.sceneApi.shaders.getShaderUniforms();
        var textureArray = this.textureArray[slot];
        if (!textureArray) return;

        var region = wowTextureRegions.old[slot];

        gl.uniform1f(shaderUniforms.x, region.x!) ;
        gl.uniform1f(shaderUniforms.y, region.y!) ;
        gl.uniform1f(shaderUniforms.width, region.w!) ;
        gl.uniform1f(shaderUniforms.height, region.h!);

        for (var i = 0; i < textureArray.length; i++) {
            var textureObject = textureArray[i].textureObj;
            if (!textureObject) {
                continue;
            }

            if (textureObject.hasAlpha) {
                gl.enable(gl.BLEND);
            } else {
                gl.disable(gl.BLEND);
            }

            gl.bindTexture(gl.TEXTURE_2D, textureObject.texture);
            gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        }
    }
    update() {
        if (!this.needsUpdate) return null;
        this.needsUpdate = false;

        this.sceneApi.shaders.activateTextureCompositionShader(this.texture.texture);
        var gl = this.sceneApi.getGlContext();
        //1. draw body
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); // default blend func
        this.drawTexturesFromArray(wowTextureRegions.Base);

        this.drawTexturesFromArray(wowTextureRegions.FaceUpper);
        this.drawTexturesFromArray(wowTextureRegions.FaceLower);

        this.drawTexturesFromArray(wowTextureRegions.LegLower);
        this.drawTexturesFromArray(wowTextureRegions.LegUpper);

        this.drawTexturesFromArray(wowTextureRegions.TorsoUpper);
        this.drawTexturesFromArray(wowTextureRegions.TorsoLower);
        this.drawTexturesFromArray(wowTextureRegions.ArmUpper);
        this.drawTexturesFromArray(wowTextureRegions.ArmLower);

        this.drawTexturesFromArray(wowTextureRegions.Foot);
        this.drawTexturesFromArray(wowTextureRegions.Hand);


        this.sceneApi.shaders.deactivateTextureCompositionShader();

        return true;

    }

}

export default TextureCompositionManager;