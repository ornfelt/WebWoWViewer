import modelTextures from '../../model_textures.json';
import config from './config';

// Texture lookup for the hard-coded (non-WotLK) unit models, from model_textures.json:
//   0. Random picker (if config.getUseRandomTextures() and the model has a registered picker)
//   1. JSON lookup (hardcoded/curated mappings)
//   2. Cow fallback (Creature\Cow\cow.blp)
// (my_web_wow's TextureHelper also searches its creature DB and the MPQ directory, which the
// browser cannot.)

const cowFallback = "Creature\\Cow\\cow.blp";

// Remove extension, lowercase, forward slashes, clean doubles
function normalizeModelPath(path: string): string {
    if (!path) return "";
    var result = path.replace(/\.[^.\\/]*$/, "");
    result = result.toLowerCase()
        .replace(/\\/g, "/")
        .replace(/\/\//g, "/")
        .replace(/^\/+/, "");
    return result;
}

// Normalize keys on load (an entry can hold null for a slot without a texture)
var cache: { [modelPath: string]: (string | null)[] } = {};
var rawModelTextures: { [modelPath: string]: (string | null)[] } = modelTextures;
for (var key in rawModelTextures) {
    cache[normalizeModelPath(key)] = rawModelTextures[key];
}

// Registered random pickers: normalized model path -> function(slotIndex) -> texture path
var randomPickers: { [modelPath: string]: (slotIndex: number) => string } = {};

// Register a random texture picker for a model; it returns a full texture path (e.g. "creature\\sheep\\sheepblack.blp")
function registerRandomPicker(modelPath: string, picker: (slotIndex: number) => string) {
    randomPickers[normalizeModelPath(modelPath)] = picker;
}

function getFromJson(modelPath: string): (string | null)[] | null {
    var textures = cache[normalizeModelPath(modelPath)];
    return textures ? textures : null;
}

function resolveTextures(modelPath: string, maxSlots: number = 3): (string | null)[] {
    // 0. Random picker (when enabled and registered for this model)
    if (config.getUseRandomTextures()) {
        var picker = randomPickers[normalizeModelPath(modelPath)];
        if (picker) {
            var results: string[] = [];
            for (var i = 0; i < maxSlots; i++)
                results[i] = picker(i);
            // Filter out empty ones and return if any succeeded
            var valid = results.filter(function (r) { return !!r; });
            if (valid.length > 0)
                return valid;
        }
    }

    var jsonResult = getFromJson(modelPath);
    if (jsonResult != null && jsonResult.length > 0)
        return jsonResult;

    console.log("[TextureHelper] All lookups failed for " + modelPath + ", using cow fallback");
    return [cowFallback];
}

function getFileNameWithoutExtension(path: string): string {
    var name = path.substring(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);
    return name.replace(/\.[^.]*$/, "");
}

function sortByTrailingDigit(textures: (string | null)[]): (string | null)[] {
    if (textures.length <= 1)
        return textures;

    // Only sort if every entry ends with a digit (before extension)
    for (var i = 0; i < textures.length; i++) {
        var texture = textures[i];
        if (!texture || !/[0-9]$/.test(getFileNameWithoutExtension(texture)))
            return textures;
    }

    var trailingNumber = function (texture: string | null): number {
        return parseInt(getFileNameWithoutExtension(texture!).match(/[0-9]+$/)![0], 10);
    };
    return textures.slice().sort(function (a, b) {
        return trailingNumber(a) - trailingNumber(b);
    });
}

// Populate a replaceTextures array (slots 11, 12, 13)
function populateReplaceTextures(modelPath: string, replaceTextures: string[], startSlot: number = 11, maxSlots: number = 3) {
    var textures = sortByTrailingDigit(resolveTextures(modelPath));
    var count = Math.min(textures.length, maxSlots);

    for (var i = 0; i < count; i++) {
        var texture = textures[i];
        if (texture)
            replaceTextures[startSlot + i] = texture;
    }

    if (replaceTextures[startSlot] == null)
        replaceTextures[startSlot] = cowFallback;
}

export default {
    populateReplaceTextures: populateReplaceTextures,
    registerRandomPicker: registerRandomPicker
}
