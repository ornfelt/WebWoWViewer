import WorldObject from './worldObject'
import TextureCompositionManager from './../../manager/textureCompositionManager'
import WowTextureRegions from './../../math/wowTextureRegions';
import CharacterComponents from '../../algorithms/characterComponents'
import {vec4, mat4, vec3, quat} from 'gl-matrix';
import type {ReadonlyMat4, ReadonlyVec4} from 'gl-matrix';
import Expansion from '../../../Expansion';
import textureHelper from '../../../services/textureHelper';
import type { CharacterFacialHairStylesRecord } from '../../../services/dbc/characterFacialHairStylesDBC';
import type { CharHairGeosetsRecord } from '../../../services/dbc/charHairGeosetsDBC';
import type { CharSectionsRecord } from '../../../services/dbc/charSectionsDBC';
import type { ItemDisplayInfoRecord } from '../../../services/dbc/itemDisplayInfoDBC';
import type { SceneApi } from '../../sceneApi';
import type WorldMDXObject from '../worldM2Object';
import { FactionTeam } from '../../manager/nodeManager';
import type { FactionTeamValue } from '../../manager/nodeManager';

const fHairGeoset = [1, 3, 2, 16, 17];

const UNIT_MAINHAND_SLOT = 0;
const UNIT_OFFHAND_SLOT  = 1;
const UNIT_RANGED_SLOT   = 2;

const virtualItemMap = [1, 0, 1];
const helm_race_names = ['', 'hu', 'or', 'dw', 'ni', 'sc', 'ta', 'gn', 'tr', 'go',
'be', 'dr', 'fo', 'na', 'br', 'sk', 'vr', 'tu', 'ft', 'fwt', 'ns', 'it'];
const helm_gender = ['m', 'f'];

function extractFilePath(filePath: string) {
    for (var i = filePath.length-1; i >0; i-- ) {
        if (filePath[i] == '\\' || filePath[i] == '/') {
            return filePath.substr(0, i+1);
        }
    }

    return '';
}

/* the file name without its directory ('\\' or '/') and extension */
function fileNameWithoutExtension(filePath: string) {
    var fileName = filePath.substr(extractFilePath(filePath).length);
    var dot = fileName.lastIndexOf('.');
    return dot > 0 ? fileName.substr(0, dot) : fileName;
}



function findSectionRec(csd: CharSectionsRecord[], race: number, gender: number, section: number, type: number, color: number) {
    for (var i = 0; i < csd.length; i++) {
        if (csd[i].race == race &&
            csd[i].gender == gender &&
            csd[i].section == section &&
            ((type < 0) || (csd[i].type == type))
            &&
            csd[i].color == color
        ) {
            return csd[i];
        }
    }
    return null;
}
function findHairGeosetRec(chgd: CharHairGeosetsRecord[], race: number, gender: number, type: number ) {
    for (var i = 0; i < chgd.length; i++) {
        if (chgd[i].race == race &&
            chgd[i].gender == gender &&
            chgd[i].hairStyle == type
        ) {
            return chgd[i];
        }
    }
    return null;
}

function findFaceHairStyleRec(cfhsd: CharacterFacialHairStylesRecord[], race: number, gender: number, type: number ) {
    for (var i = 0; i < cfhsd.length; i++) {
        if (cfhsd[i].race == race &&
            cfhsd[i].gender == gender &&
            cfhsd[i].hairStyle == type
        ) {
            return cfhsd[i];
        }
    }
    return null;
}


function saveObjectToFile(obj: unknown, filename: string = 'output.txt') {
  const jsonStr = JSON.stringify(obj, null, 2); // Pretty-printed JSON
  const blob = new Blob([jsonStr], { type: 'text/plain' });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

class WorldUnit extends WorldObject {
    sceneApi: SceneApi;
    currentTime: number;
    movementFlag: number;
    speedWalk: number;
    speedRun: number;
    speedRunBack: number;
    speedSwim: number;
    speedSwimBack: number;
    speedFly: number;
    speedFlyBack: number;
    speedTurnRate: number;
    isMoving: boolean;
    objectModel: WorldMDXObject | null;
    mountModel: WorldMDXObject | null;
    items: WorldMDXObject[];
    helmet: WorldMDXObject | null;
    textureCompositionManager: TextureCompositionManager;
    /* set by createMaterialData() for a unit with a shoulder item */
    leftShoulder: WorldMDXObject | undefined;
    rightShoulder: WorldMDXObject | undefined;
    /* set by createModelFromDisplayId() */
    modelScale!: number;
    displayIDScale!: number;
    /* set by setMovingData() / moveToFromCurrent() */
    currentMovingTime!: number;
    totalMovingTime!: number;
    pointsArray!: vec3[];
    pointsTotalPath!: number[];
    onStopfaceToGuid!: boolean;
    onStopfaceToFloat!: boolean;
    /* set by setFacingOnMovementEndGuid() / setFacingOnMovementEndFacing() */
    faceToGuid: string | number | undefined;
    faceToRotation!: number;
    /* set from the update packet before complete() */
    unitRace!: number;
    unitClass!: number;
    unitGender!: number;
    mountDisplayId!: number;
    mountModelChanged: boolean | undefined;
    displayId: number | undefined;
    modelChanged: boolean | number | undefined;
    nativeDisplayId!: number;
    entry: number | undefined;
    /* a model to load by its path instead of nativeDisplayId, and which of its display ids to use */
    modelPathInput: string;
    chosenModelIndex: number;
    /* true when the animation is set from outside (the player character, see PlayerAnimationState), so update() leaves it */
    manualAnimation: boolean;
    /* replaces the rotation by f when set (a spell projectile's model correction, see SpellProjectile) */
    customRotationMatrix: mat4 | null;

    // --- HUD / combat state ---
    healthPoints: number;
    healthPointsTotal: number;
    manaPoints: number;
    manaPointsTotal: number;
    myFactionTeam: FactionTeamValue;
    target: WorldUnit | null;
    targetIndex: number;

    constructor(sceneApi: SceneApi){
        super();

        this.sceneApi = sceneApi;

        this.currentTime = 0;

        this.movementFlag = 0;

        /* Speed block */
        this.speedWalk = 0;
        this.speedRun = 0;
        this.speedRunBack = 0;
        this.speedSwim = 0;
        this.speedSwimBack = 0;
        this.speedFly = 0;
        this.speedFlyBack = 0;
        this.speedTurnRate = 0;

        this.isMoving = false;


        this.objectModel = null;
        this.mountModel = null;
        this.items = new Array(3);
        this.helmet = null;
        this.textureCompositionManager = new TextureCompositionManager(sceneApi);

        this.modelPathInput = '';
        this.chosenModelIndex = 0;
        this.manualAnimation = false;
        this.customRotationMatrix = null;

        this.healthPoints = 100;
        this.healthPointsTotal = 100;
        this.manaPoints = 100;
        this.manaPointsTotal = 100;
        this.myFactionTeam = FactionTeam.None;
        this.target = null;
        this.targetIndex = 0;
    }
    setRotationMatrix(rotationMatrix: mat4) {
        this.customRotationMatrix = rotationMatrix;
    }
    clearRotationMatrix() {
        this.customRotationMatrix = null;
    }
    setSpeedWalk(value: number){
        this.speedWalk = value;
    }
    setSpeedRun(value: number) {
        this.speedRun = value;
    }
    setSpeedRunBack(value: number) {
        this.speedRunBack = value;
    }
    setSpeedSwim(value: number) {
        this.speedSwim = value;
    }
    setSpeedSwimBack(value: number) {
        this.speedSwimBack = value;
    }
    setSpeedFly(value: number) {
        this.speedFly = value;
    }
    setSpeedFlyBack(value: number) {
        this.speedFlyBack = value;
    }
    setSpeedTurnRate(value: number) {
        this.speedTurnRate = value; // rads per second?
    }
    getAnimationIdByMovementFlag(){
        var animationId = 0;
        if ((this.movementFlag & 0x100) > 0) {
            animationId = 5;
        } else {
            animationId = 4;
        }

        // 5 is run
        // 4 is walk
        // 42 is swim
        //animationId = 42;
        // animationId = 16; mount fighting
        //animationId = 23; // Fly fight?
        //animationId = 35;  // FLYING
        //animationId = 37;  // start flying from ground
        //animationId = 39; // NPC fly?
        //animationId = 40; // Strafe fly?
        //animationId = 46; // MOunt run on ground?
        //animationId = 49; // NPC fly?
        //animationId = 50; // fly backwards
        //animationId = 60; // NPC fly faster?
        //animationId = 68; // fly backwards2
        //animationId = 75; // fly jump?
        //animationId = 77; // FLY FAST!!
        //animationId = 78; // FLY jump?
        //animationId = 80; // FLY backwards
        //animationId = 91; // Try next!

        return animationId;
    }

    /* WorldPlayer overrides it with (replaceTextures, meshIds) and returns true; this one returns undefined */
    createMaterialFromOwnItem(replaceTextures?: string[], meshIds?: number[]): boolean | void;
    createMaterialFromOwnItem(){

    }

    createMaterialData(replaceTextures: string[], meshIds: number[], race: number, gender: number,
                       skin: number, face: number, hairType: number, hairStyle: number, faceHairStyle: number,
                       helmItem: number, shoulderItem: number, capeItem: number, chestItem: number, shirtItem: number, tabardItem: number, wristItem: number, glovesItem: number, beltItem: number, legsItem: number, bootsItem: number) {


        var idid = this.sceneApi.dbc.getItemDisplayInfoDBC();
        var csd = this.sceneApi.dbc.getCharSectionsDBC();
        var chgd = this.sceneApi.dbc.getCharHairGeosetsDBC();
        var cfhsd = this.sceneApi.dbc.getCharacterFacialHairStylesDBC();
        var hgvd = this.sceneApi.dbc.getHelmetGeosetVisDataDBC();

        //Base Skin
        var charSect = findSectionRec(csd, race,gender, 0, -1, skin);
        if (charSect != null) {
            //replaceTextures[1] = charSect.texture1
            this.textureCompositionManager.addTexture(WowTextureRegions.Base, charSect.texture1, null);
        }
        //Face
        var charSect = findSectionRec(csd, race,gender, 1, face, skin);
        if (charSect != null) {
            this.textureCompositionManager.addTexture(WowTextureRegions.FaceLower, charSect.texture1, null);
            this.textureCompositionManager.addTexture(WowTextureRegions.FaceUpper, charSect.texture2, null);
        }

        //Hair
        var charSect = findSectionRec(csd, race,gender, 3, hairType, hairStyle);
        if (charSect != null) {
            replaceTextures[6] = charSect.texture1;

            this.textureCompositionManager.addTexture(WowTextureRegions.FaceLower, charSect.texture2, null);
            this.textureCompositionManager.addTexture(WowTextureRegions.FaceUpper, charSect.texture3, null);
            //charSect.texture2 == scalp Lower
            //charSect.texture3 == scalp Upper
        }

        var charHair = findHairGeosetRec(chgd, race, gender, hairType);
        if ((charHair != null) && (charHair.geoset != 0))
            meshIds[0] = charHair.geoset;

        //FaceHair
        var charSect = findSectionRec(csd, race,gender, 2, faceHairStyle, hairStyle);
        if (charSect != null) {
            this.textureCompositionManager.addTexture(WowTextureRegions.FaceLower, charSect.texture1, null);
            this.textureCompositionManager.addTexture(WowTextureRegions.FaceUpper, charSect.texture2, null);

        }
        var charFHStyle = findFaceHairStyleRec(cfhsd, race, gender, faceHairStyle);
        if (charFHStyle != null) {
            for (var i = 0; i < 3; i++)
                if (charFHStyle.geoset[i] != 0)
                    meshIds[fHairGeoset[i]] = charFHStyle.geoset[i];
        }

        //Underwear
        var charSect = findSectionRec(csd, race,gender, 4, -1, skin);
        if (charSect != null) {
            //replaceTextures[1] = charSect.texture1
            this.textureCompositionManager.addTexture(WowTextureRegions.LegUpper, charSect.texture1, null);
            this.textureCompositionManager.addTexture(WowTextureRegions.TorsoUpper, charSect.texture2, null);
        }

        /* Items */
        var ItemDInfo = idid[shoulderItem];
        if (ItemDInfo) {
            var leftModel = ItemDInfo.leftModel;
            var rightModel = ItemDInfo.rightModel;

            var leftModelTexture = ItemDInfo.leftTextureModel;
            var rightModelTexture = ItemDInfo.rightTextureModel;

            this.leftShoulder = this.createShoulderFromItemDisplayInfo(leftModel, leftModelTexture);
            this.rightShoulder = this.createShoulderFromItemDisplayInfo(rightModel, rightModelTexture);


        }
        ItemDInfo = idid[shirtItem];
        if (ItemDInfo){
            CharacterComponents.addAllTextures(this.textureCompositionManager, ItemDInfo, gender);
        }
        ItemDInfo = idid[wristItem];
        if (ItemDInfo){
            CharacterComponents.addAllTextures(this.textureCompositionManager, ItemDInfo, gender);
        }


        ItemDInfo = idid[chestItem];
        if (ItemDInfo) {
            meshIds[8] = 1 + ItemDInfo.geosetGroup_1;
            CharacterComponents.addAllTextures(this.textureCompositionManager, ItemDInfo, gender);
        }

        ItemDInfo = idid[beltItem];
        if (ItemDInfo) {
            meshIds[18] = 1 + ItemDInfo.geosetGroup_3;
            CharacterComponents.addAllTextures(this.textureCompositionManager, ItemDInfo, gender);
        }
        ItemDInfo = idid[legsItem];
        if (ItemDInfo) {
            if (meshIds[8] > 1)
                meshIds[13] = 1 + ItemDInfo.geosetGroup_3;

            CharacterComponents.addAllTextures(this.textureCompositionManager, ItemDInfo, gender);
        }
        ItemDInfo = idid[bootsItem];
        if (ItemDInfo) {
            meshIds[5] = 1 + ItemDInfo.geosetGroup_1;

            CharacterComponents.addAllTextures(this.textureCompositionManager, ItemDInfo, gender);
        }
        ItemDInfo = idid[glovesItem];
        if (ItemDInfo) {
            meshIds[4] = 1 + ItemDInfo.geosetGroup_1;

            CharacterComponents.addAllTextures(this.textureCompositionManager, ItemDInfo, gender);
        }
        ItemDInfo = idid[tabardItem];
        if (ItemDInfo) {
            if (meshIds[8] == 1) {
                meshIds[12] = 1 + ItemDInfo.geosetGroup_1;
                CharacterComponents.addAllTextures(this.textureCompositionManager, ItemDInfo, gender);
            }

        }
        ItemDInfo = idid[capeItem];
        if (ItemDInfo) {
            replaceTextures[2] ='Item\\ObjectComponents\\Cape\\'+ ItemDInfo.leftTextureModel + '.BLP';
            meshIds[15] = 1 + ItemDInfo.geosetGroup_1;
            CharacterComponents.addAllTextures(this.textureCompositionManager, ItemDInfo, gender);
        }

        var ItemDInfo = idid[helmItem];
        if (ItemDInfo) {
            this.helmet = this.createHelmetFromItemDisplayInfo(race, gender, ItemDInfo)

            if (gender == 0) {
                var helmetGeoset = ItemDInfo.helmetGeosetVis_m;
            } else {
                var helmetGeoset = ItemDInfo.helmetGeosetVis_f;
            }
            if (helmetGeoset > 0) {
                var hgvdRec = hgvd[helmetGeoset];
                if (hgvdRec) {

                    function checkGeoset(geoset: number, race: number, mask: number) {
                        if ((mask & (1 << race)) > 0) {
                            return 1;
                        } else {
                            return geoset;
                        }
                    }

                    meshIds[0] =  checkGeoset(meshIds[0], race, hgvdRec.geoset0);
                    meshIds[1] =  checkGeoset(meshIds[1], race, hgvdRec.geoset1);
                    meshIds[2] =  checkGeoset(meshIds[2], race, hgvdRec.geoset2);
                    meshIds[3] =  checkGeoset(meshIds[3], race, hgvdRec.geoset3);
                    meshIds[7] =  checkGeoset(meshIds[7], race, hgvdRec.geoset4);
                    meshIds[16] = checkGeoset(meshIds[16], race, hgvdRec.geoset5);
                    meshIds[17] = checkGeoset(meshIds[17], race, hgvdRec.geoset6);
                }
            }

        }
    }

    createModelFromDisplayId(value: number) {
        //const useHardcodedData = false;
        //const useHardcodedData = true;
        const useHardcodedData = (window.selectedExpansion !== Expansion.WOTLK);

        if (useHardcodedData) {
          // Hardcoded data

          // Static
          //var modelFilename = "World\\Khazmodan\\Ironforge\\Passivedoodads\\Trees\\Wintertree02.Mdx";
          //var modelFilename = "World\\Dungeon\\Cave\\Passivedoodads\\Icicles\\Caveicicle1.Mdl";

          var modelFilename = "creature\\Cow\\cow.mdx";

          if (value == 11121)
            modelFilename = "creature\\ragnaros\\ragnaros.mdx";
          else if (value == 8570)
            modelFilename = "creature\\dragon\\dragononyxia.mdx";
          else if (value == 21135)
            modelFilename = "Creature\\Illidan\\Illidan.mdx";
          else if (value == 5645)
            modelFilename = "creature\\drake\\drake.mdx";
          else if (value == 24978)
            modelFilename = "creature/northrendpenguin/northrendpenguin.m2";
          else if (value == 26563)
            modelFilename = "creature/skeletonnaked/skeletonnaked.m2";
          else if (value == 112)
            modelFilename = "creature/orcmalewarriorlight/orcmalewarriorlight.m2";
          else if (value == 856)
            modelFilename = "creature/sheep/sheep.m2";
          else if (value == 164)
            modelFilename = "creature/humanmaleguard/humanmaleguard.m2";
          else if (value == 19708)
            modelFilename = "creature/bloodelfguard/bloodelfmale_guard.m2";
          else if (value == 1021)
            modelFilename = "creature/tempdeathguard/deathguard.m2";
          else if (value == 11380)
            modelFilename = "creature/dragon/dragonnefarian.m2";
          else if (value == 17890)
            modelFilename = "creature/ridingphoenix/ridingphoenix.m2";
          else if (value == 16314)
            modelFilename = "creature/netherdrake/netherdrake.m2";
          else if (value == 18812)
            modelFilename = "creature/felorcnetherdrake/felorcnetherdrake.m2";
          else if (value == 20539)
            modelFilename = "creature/netherdrake/netherdrakeoutland.m2";
          else if (value == 24725)
            modelFilename = "creature/netherdrake/netherdrakeelite.m2";

          //var modelFilename = "creature\\druidbear\\druidbear.mdx";
          //var modelFilename = "creature\\dragon\\dragononyxia.mdx";
          //var modelFilename = "creature\\drake\\drake.mdx";
          //var modelFilename = "creature\\SkeletonNaked\\SkeletonNaked.mdx";
          // TODO: need skins
          //var modelFilename = "creature\\rabbit\\rabbit.mdx";
          //var modelFilename = "creature\\Cow\\cow.mdx";
          //var modelFilename = "creature\\diablo\\DiabloFunSized.mdx";
          //var modelFilename = "creature\\panda\\pandacub.mdx";
          //var modelFilename = "character\\scourge\\male\\scourgemale.mdx";
          //var modelFilename = "creature\\raptor\\raptor.mdx";

          //var modelFilename = "spells\\PyroBlast_Missile.mdx";
          //var modelFilename = "spells\\frostbolt.mdx";
          //var modelFilename = "spells\\Onyxia_Impact_Base.mdx";
          //var modelFilename = "spells\\Fireball_Missile_High.mdx";
          //var modelFilename = "spells\\Blizzard_Impact_Base.mdx";

          //var modelFilename = "creature\\voidwalker\\voidwalker.mdx";
          //var modelFilename = "creature\\ogre\\ogre.mdx";
          //var modelFilename = "creature\\wolf\\wolf.mdx";

          //var modelFilename = "creature\\ogre\\ogremage.mdx";
          //var modelFilename = "creature\\ogre\\ogrewarlord.mdx";
          //var modelFilename = "creature\\netherdrake\\netherdrake.mdx";
          //var modelFilename = "creature\\netherray\\netherray.mdx";

          var modelScale = 1;
          var displayIDScale = 1;

          this.modelScale = modelScale;
          this.displayIDScale = displayIDScale;

          var replaceTextures: string[] = [];
          textureHelper.populateReplaceTextures(modelFilename, replaceTextures);

          // ...

          var meshIds: number[] = [];
          for (var i = 0; i < 19; i++) {
              meshIds[i] = 1;
          }

          var useMeshId = true;

          // Debug info
          console.log("Creating model from displayId:", value);
          console.log("Model path:", modelFilename);
          console.log("Model scale:", modelScale);
          console.log("DisplayID scale:", displayIDScale);
          console.log("Replace textures:", replaceTextures);
          console.log("Use mesh IDs:", useMeshId);
          if (useMeshId) {
              console.log("Mesh IDs:", meshIds);
          }

          var model = this.sceneApi.objects.loadWorldM2Obj(modelFilename, useMeshId ? meshIds : null, replaceTextures);

          return model;
        }

        var cdid = this.sceneApi.dbc.getCreatureDisplayInfoDBC();
        var cdied = this.sceneApi.dbc.getCreatureDisplayInfoExtraDBC();
        var cmdd = this.sceneApi.dbc.getCreatureModelDataDBC();

        // Debug (too large to print, print to file instead)
        //console.log("CreatureDisplayInfoDBC: ", cdid);
        //saveObjectToFile(cdid, 'CreatureDisplayInfoDBC.txt');
        //saveObjectToFile(cdied, 'CreatureDisplayInfoExtraDBC.txt');
        //saveObjectToFile(cmdd, 'CreatureModelDataDBC.txt');

        var displayInf = cdid[value];
        var displayIDScale = displayInf.modelScale;
        this.displayIDScale = displayIDScale;

        var modelFilename = cmdd[displayInf.model1].modelName;
        var modelScale = cmdd[displayInf.model1].modelScale;
        this.modelScale = modelScale;

        var replaceTextures: string[] = [];
        if (displayInf.skin1 != '')
            replaceTextures[11] = extractFilePath(modelFilename)+displayInf.skin1+'.blp';

        if (displayInf.skin2 != '')
            replaceTextures[12] = extractFilePath(modelFilename)+displayInf.skin2+'.blp';

        if (displayInf.skin3 != '')
            replaceTextures[13] = extractFilePath(modelFilename)+displayInf.skin3+'.blp';

        var meshIds: number[] = [];
        for (var i = 0; i < 19; i++)
            meshIds[i] = 1;

        var useMeshId = false;
        if (displayInf.displayExtra > 0 || displayInf.creatureGeosetData > 0) {
            var useMeshId = true;
        }

        if (displayInf.displayExtra > 0) {

            var displayExtraInfo = cdied[displayInf.displayExtra];

            replaceTextures[1] = 'Textures\\BakedNpcTextures\\'+displayExtraInfo.skinTexture;

            this.createMaterialData(replaceTextures, meshIds, displayExtraInfo.race, displayExtraInfo.gender,
                displayExtraInfo.skin, displayExtraInfo.face, displayExtraInfo.hairType, displayExtraInfo.hairStyle, displayExtraInfo.faceHairStyle,
                displayExtraInfo.helmItem, displayExtraInfo.shoulderItem, displayExtraInfo.capeItem,
                displayExtraInfo.cuirassItem, displayExtraInfo.shirtItem, displayExtraInfo.tabardItem, displayExtraInfo.wristItem,
                displayExtraInfo.glovesItem, displayExtraInfo.beltItem, displayExtraInfo.legsItem ,displayExtraInfo.bootsItem);


        } else {
            if (this.createMaterialFromOwnItem(replaceTextures, meshIds)) {
                useMeshId = true;
            }
        }//DisplayExtra

        // Debug
        console.log("Creating model from displayId:", value);
        console.log("Model path:", modelFilename);
        console.log("Model scale:", modelScale);
        console.log("DisplayID scale:", displayIDScale);
        console.log("Replace textures:", replaceTextures);
        console.log("Use mesh IDs:", useMeshId);
        if (useMeshId) {
            console.log("Mesh IDs:", meshIds);
        }

        var model = this.sceneApi.objects.loadWorldM2Obj(modelFilename,(useMeshId) ? meshIds : null, replaceTextures);

        return model;

    }
    getDisplayIdFromModelName(inputModelName: string, chosenIndex: number = 0): number | null {
        var cdid = this.sceneApi.dbc.getCreatureDisplayInfoDBC();
        var cmdd = this.sceneApi.dbc.getCreatureModelDataDBC();
        if (!cdid || !cmdd) return null;

        // Normalize input
        inputModelName = inputModelName.replace(/\.m2/gi, '.mdx');

        var matches: number[] = [];

        // First try: exact match on full model name
        for (var key in cdid) {
            var modelData = cmdd[cdid[key].model1];
            if (modelData && modelData.modelName.toLowerCase() === inputModelName.toLowerCase()) {
                console.log("Found exact match via dbModelName: " + modelData.modelName);
                matches.push(Number(key));
            }
        }

        // If no exact match is found, match on the file name without its extension (so a bare 'arthaslichking' matches too)
        if (matches.length === 0) {
            var inputFileName = fileNameWithoutExtension(inputModelName).toLowerCase();
            for (var key in cdid) {
                var modelData = cmdd[cdid[key].model1];
                if (modelData && fileNameWithoutExtension(modelData.modelName).toLowerCase() === inputFileName) {
                    console.log("Found fallback match via dbModelName: " + modelData.modelName);
                    matches.push(Number(key));
                }
            }

            if (matches.length > 1) {
                console.log("Fallback used: Found " + matches.length + " matches for file name '" + inputFileName + "': " + matches.join(', '));
            }
        } else if (matches.length > 1) {
            console.log("Found multiple exact matches (" + matches.length + ") for model name: '" + inputModelName + "': " + matches.join(', '));
        }

        if (matches.length === 0) {
            console.log("No matching display ID found for model name: " + inputModelName);
            return null;
        }

        // If chosenIndex is out of bounds, default to the first match
        var index = (chosenIndex < matches.length) ? chosenIndex : 0;
        var chosenDisplayId = matches[index];

        if (matches.length > 1) {
            console.log("Returning match at index " + index + " (display ID: " + chosenDisplayId + ").");
        }

        return chosenDisplayId;
    }
    createModelFromModelPath(modelPath: string, chosenIndex: number) {
        var useHardcodedData = (window.selectedExpansion !== Expansion.WOTLK);

        var displayIdBasedOnModelPath = this.getDisplayIdFromModelName(modelPath, chosenIndex);
        var value = -1;

        if (displayIdBasedOnModelPath !== null) {
            value = displayIdBasedOnModelPath;
            this.setDisplayId(value);
            this.setNativeDisplayId(value);
        } else {
            useHardcodedData = true;
        }

        if (!useHardcodedData) {
            return this.createModelFromDisplayId(value);
        }

        // Hardcoded data: load the model file itself
        var modelFilename = modelPath;

        var modelScale = 1;
        var displayIDScale = 1;

        this.modelScale = modelScale;
        this.displayIDScale = displayIDScale;

        var replaceTextures: string[] = [];
        textureHelper.populateReplaceTextures(modelFilename, replaceTextures);

        var meshIds: number[] = [];
        for (var i = 0; i < 19; i++) {
            meshIds[i] = 1;
        }

        var useMeshId = true;

        // Debug info
        console.log("Creating model from displayId:", value);
        console.log("Model path:", modelFilename);
        console.log("Model scale:", modelScale);
        console.log("DisplayID scale:", displayIDScale);
        console.log("Replace textures:", replaceTextures);
        console.log("Use mesh IDs:", useMeshId);
        if (useMeshId) {
            console.log("Mesh IDs:", meshIds);
        }

        return this.sceneApi.objects.loadWorldM2Obj(modelFilename, useMeshId ? meshIds : null, replaceTextures);
    }
    createHelmetFromItemDisplayInfo(race: number, gender: number, ItemDInfo: ItemDisplayInfoRecord) {
        var helmPath = "Item\\ObjectComponents\\head\\";
        var suffix = "_" + helm_race_names[race] + helm_gender[gender];

        var modelName = helmPath + ItemDInfo.leftModel;
        var nameTemplate = modelName.split('.')[0];
        modelName = nameTemplate + suffix + '.m2';

        var replaceTextures: string[] = [];
        if (ItemDInfo.leftTextureModel)
            replaceTextures[2] = helmPath + ItemDInfo.leftTextureModel + '.blp';


        var model = this.sceneApi.objects.loadWorldM2Obj(modelName, null, replaceTextures);
        return model
    }
    createShoulderFromItemDisplayInfo(modelName: string, texture: string) {
        var shoulderPath = "item/objectcomponents/shoulder/";
        var suffix = '';
        var trueModelName = shoulderPath + modelName;
        var nameTemplate = trueModelName.split('.')[0];
        trueModelName = nameTemplate + suffix + '.m2';

        var replaceTextures: string[] = [];
        if (texture)
            replaceTextures[2] = shoulderPath + texture + '.blp';


        var model = this.sceneApi.objects.loadWorldM2Obj(trueModelName, null, replaceTextures);
        return model
    }

    update (deltaTime: number, cameraPos: ReadonlyVec4, viewMat: ReadonlyMat4) {
        var objectModelIsLoaded = this.objectModel && this.objectModel.m2Geom && this.objectModel.m2Geom.m2File;
        var objectModelHasBones = objectModelIsLoaded &&  this.objectModel!.bonesMatrices;

        /* 1. Calculate current position */
        if (this.isMoving) {
            if ((this.currentMovingTime + deltaTime) >= this.totalMovingTime) {
                this.setPosition(this.pointsArray[this.pointsArray.length - 1]);

                if (this.onStopfaceToFloat) {
                    this.setRotation(this.faceToRotation);
                }

                this.isMoving = false;
            } else {
                //Take the totalPath by last point
                var totalPath = this.pointsTotalPath[this.pointsTotalPath.length - 1];
                var currentPath = (totalPath / this.totalMovingTime) * (this.currentMovingTime + deltaTime);
                var pointIndex = 0;
                // JS-BUG: starts as a path length (a number), not a point (probably meant this.pointsArray[0]); only reaches setPosition() if no segment matches, which the time check above rules out
                var result: number | vec3 = this.pointsTotalPath[0]

                for (var i = 1; i < this.pointsArray.length; i++) {
                    if (currentPath < this.pointsTotalPath[i]) {
                        var value1 = this.pointsArray[i - 1];
                        var value2 = this.pointsArray[i];

                        var path1 = this.pointsTotalPath[i - 1];
                        var path2 = this.pointsTotalPath[i];

                        var diff = vec4.create();
                        vec3.subtract(diff, value2, value1);
                        vec3.scale(diff, diff, (currentPath - path1)/(path2 - path1));
                        var result: number | vec3 = vec3.create();
                        vec3.add(result, value1, diff);

                        //CalcF
                        //vec3.scale(diff, diff, -1)
                        vec3.normalize(diff, diff);
                        if (diff[1] < 0) {
                            this.setRotation(2 * Math.PI - Math.acos(diff[0]));
                        } else {
                            this.setRotation(Math.acos(diff[0]));
                        }

                        break;
                    }
                }

                this.setPosition(result as vec3);
            }
            this.currentMovingTime += deltaTime;
        }

        /* 2. Update position for all models */
        var properScale = this.displayIDScale * this.modelScale;
        if (this.scale! > 0.0001) {
            properScale = this.displayIDScale * this.modelScale *  this.scale!;
        }

        if (this.mountModel && objectModelIsLoaded) {
            if (this.isMoving) {
                var animationId = this.getAnimationIdByMovementFlag();
                // JS-BUG: setAnimationId takes one argument; the second (false) is ignored - harmless (also the two calls below)
                // @ts-expect-error setAnimationId takes one argument; ported as-is
                this.mountModel.setAnimationId(animationId, false);
            } else {
                this.mountModel.setAnimationId(0); //Stand(0) animation
            }

            /* Update placement matrix */
            this.mountModel.createPlacementMatrix(this.pos, this.f, properScale);

            /* Update bone matrices */
            if (this.mountModel.loaded) {
                this.mountModel.objectUpdate(deltaTime, cameraPos, viewMat);
            }

            if (this.mountModel.bonesMatrices) {
                /* Update main model */
                this.objectModel!.createPlacementMatrixFromParent(this.mountModel, 0, properScale);
                // @ts-expect-error setAnimationId takes one argument; ported as-is
                this.objectModel!.setAnimationId(91, false);
            }
            //this.objectModel.animation
        } else if (objectModelIsLoaded){
            if (this.manualAnimation) {
                // set from outside
            } else if (this.isMoving) {
                var animationId = this.getAnimationIdByMovementFlag()
                // @ts-expect-error setAnimationId takes one argument; ported as-is
                this.objectModel!.setAnimationId(animationId, false);
            } else {
                this.objectModel!.setAnimationId(0); //Stand(0) animation
            }
            if (this.customRotationMatrix !== null) {
                this.objectModel!.createPlacementMatrix(this.pos, this.f, properScale, this.customRotationMatrix);
            } else {
                this.objectModel!.createPlacementMatrix(this.pos, this.f, properScale);
            }
        }

        /* Configure hands */
        if (objectModelIsLoaded) {
            if (this.items[0] && this.items[0].m2Geom) {
                this.objectModel!.setRightHandClosed(true)
            }
            if (this.items[1] && this.items[1].m2Geom) {
                this.objectModel!.setLeftHandClosed(true)
            }
        }

        //this.mountModel.setAnimationId(7); // Cool mount walk
        //this.mountModel.setAnimationId(5);

        /* Update bone matrices */
        if (this.objectModel) {
            this.objectModel.objectUpdate(deltaTime, cameraPos, viewMat);
        }

        if (objectModelIsLoaded && objectModelHasBones && this.helmet) {
            /* Update helm model */
            this.helmet.createPlacementMatrixFromParent(this.objectModel!, 11, properScale);

            if (this.helmet.loaded) {
                this.helmet.objectUpdate(deltaTime, cameraPos, viewMat);
            }
        }

        if (objectModelIsLoaded && objectModelHasBones && this.leftShoulder) {
            /* Update left shoulder model */
            this.leftShoulder.createPlacementMatrixFromParent(this.objectModel!, 6, properScale);

            if (this.leftShoulder.loaded) {
                this.leftShoulder.objectUpdate(deltaTime, cameraPos, viewMat);
            }
        }
        if (objectModelIsLoaded && objectModelHasBones && this.rightShoulder) {
            /* Update right shoulder model */
            this.rightShoulder.createPlacementMatrixFromParent(this.objectModel!, 5, properScale);

            if (this.rightShoulder.loaded) {
                this.rightShoulder.objectUpdate(deltaTime, cameraPos, viewMat);
            }
        }


        //3. Update placement matrices for items
        if ( objectModelIsLoaded && objectModelHasBones) {
            for (var i = 0; i < this.items.length; i++) {
                if (this.items[i]) {
                    this.items[i].createPlacementMatrixFromParent(this.objectModel!, virtualItemMap[i], properScale);
                    if (this.items[i].loaded) {
                        this.items[i].objectUpdate(deltaTime, cameraPos, viewMat);
                    }
                }
            }
        }

        if (this.objectModel && this.objectModel.loaded) {
            if (this.textureCompositionManager.update()) {
                this.objectModel.overrideModelTexture(this.textureCompositionManager.texture);
            }
        }




        this.currentTime += deltaTime;
    }
    setMovingData(currentMovingTime: number, totalMovingTime: number, movementFlag: number, points: vec3[]) {
        this.onStopfaceToGuid = false;
        this.onStopfaceToFloat = false;

        this.currentMovingTime = currentMovingTime;
        this.totalMovingTime = totalMovingTime;
        this.pointsArray = points;

        //Calculate total path for points
        var totalPath = 0;
        var pointsTotalPath = new Array(this.pointsArray.length);
        var prevPoint = this.pointsArray[0];
        for (var i = 0; i < this.pointsArray.length; i++) {
            var deltaX = prevPoint[0] - this.pointsArray[i][0];
            var deltaY = prevPoint[1] - this.pointsArray[i][1];
            var deltaZ = prevPoint[2] - this.pointsArray[i][2];

            totalPath += Math.sqrt(deltaX*deltaX + deltaY*deltaY + deltaZ * deltaZ);
            pointsTotalPath[i] = totalPath;

            prevPoint = this.pointsArray[i];
        }
        this.pointsTotalPath = pointsTotalPath;
        this.movementFlag = movementFlag;

        this.isMoving = true;
    }
    moveToFromCurrent(time: number, packetPoints: vec3[]) {
        this.onStopfaceToGuid = false;
        this.onStopfaceToFloat = false;

        var packetPointsReal = new Array();
        packetPointsReal.push(this.getPosition());
        for (var i = 0; i < packetPoints.length; i++) {
            packetPointsReal.push(packetPoints[i])
        }

        this.currentMovingTime = 0;
        this.totalMovingTime = time;
        this.pointsArray = packetPointsReal;

        //Calculate total path for points
        var totalPath = 0;
        var pointsTotalPath = new Array(this.pointsArray.length);
        var prevPoint = this.pointsArray[0];
        for (var i = 0; i < this.pointsArray.length; i++) {
            var deltaX = prevPoint[0] - this.pointsArray[i][0];
            var deltaY = prevPoint[1] - this.pointsArray[i][1];
            var deltaZ = prevPoint[2] - this.pointsArray[i][2];

            totalPath += Math.sqrt(deltaX*deltaX + deltaY*deltaY + deltaZ * deltaZ);
            pointsTotalPath[i] = totalPath;

            prevPoint = this.pointsArray[i];
        }
        this.pointsTotalPath = pointsTotalPath;
        this.movementFlag = 0;
        this.isMoving = true;
    }
    setFacingOnMovementEndGuid(guid: string | number) {
        this.onStopfaceToGuid = true;
        this.faceToGuid = guid;
    }
    setFacingOnMovementEndFacing(float: number) {
        this.onStopfaceToFloat = true;
        this.faceToRotation = float;
    }
    setCurrentTime(value: number){
        this.currentTime = value;
    }
    setUnitRace(race: number) {
        this.unitRace = race;
    }
    setUnitClass(unitClass: number) {
        this.unitClass = unitClass;
    }
    setUnitGender(gender: number){
        this.unitGender = gender;
    }
    setUnitPowerType(powerType: number){

    }
    setVirtualItemSlot(slot: number, displayId: number, itemClass: number | undefined, itemSubClass: number | undefined, itemInventoryType: number | undefined) {
        var idid = this.sceneApi.dbc.getItemDisplayInfoDBC();
        /* ItemDisplayInfo.dbc is only loaded for WotLK, and only once it has been read */
        if (!idid) return;

        /* 1. Free previous model */

        /* 2. Configure new model */
        var modelPath;
        if (itemInventoryType == 14) {
            modelPath = "item/objectcomponents/shield/";
        } else {
            modelPath = "item/objectcomponents/weapon/";
        }
        var ItemDInfo = idid[displayId];
        if (ItemDInfo) {
            var modelName: string;
            var replaceTextures: string[] = [];

            modelName = ItemDInfo.leftModel;
            if (ItemDInfo.leftTextureModel)
                replaceTextures[2] = modelPath + ItemDInfo.leftTextureModel + '.blp';

            if (slot != UNIT_MAINHAND_SLOT) {
                if (ItemDInfo.rightModel != "") {
                    modelName = ItemDInfo.rightModel;
                    if (ItemDInfo.rightTextureModel)
                        replaceTextures[2] = modelPath + ItemDInfo.rightTextureModel + '.blp';
                }
            }
            modelName = modelPath + modelName;

            var model = this.sceneApi.objects.loadWorldM2Obj(modelName, null, replaceTextures);

            this.items[slot] = model;
        }
    }

    setMountDisplayId(value: number) {
        this.mountDisplayId = value;
        this.mountModelChanged = true;

    }
    setDisplayId( value: number ) {
        this.displayId = value;
        // JS-BUG: stores the display id instead of true (setNativeDisplayId / setMountDisplayId store true) - harmless, any non-zero id is truthy and complete() loads nativeDisplayId either way
        this.modelChanged = value;
    }
    setNativeDisplayId( value: number ) {
        this.nativeDisplayId = value;
        this.modelChanged = true;
    }
    setEntry ( value: number ) {
        this.entry = value;
    }
    complete () {
        if (this.modelChanged)  {
            var model = this.modelPathInput.length > 0
                ? this.createModelFromModelPath(this.modelPathInput, this.chosenModelIndex)
                : this.createModelFromDisplayId(this.nativeDisplayId);
            this.objectModel = model;
        }

        if (this.mountModelChanged) {
            var model = this.createModelFromDisplayId(this.mountDisplayId);
            this.mountModel = model;
        }
    }
}

export default WorldUnit;
