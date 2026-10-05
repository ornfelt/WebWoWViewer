import WorldUnit from './worldUnit';
import type { SceneApi } from '../../sceneApi';
import type { ItemRecord } from '../../../services/dbc/itemDBC';

//For ref: http://images.staticjw.com/wor/3751/addon-use-char.png
const player_item_HEAD = 1;
const player_item_NECK = 2;
const player_item_SHOULDERS = 3;
const player_item_BODY = 4;
const player_item_CHEST = 5;
const player_item_WAIST = 6;
const player_item_LEGS = 7;
const player_item_FEET = 8;
const player_item_WRIST = 9;
const player_item_HAND = 10;
const player_item_FINGER1 = 11;
const player_item_FINGER2 = 12;
const player_item_TRINKET1 = 13;
const player_item_TRINKET2 = 14;
const player_item_BACK = 15;
const player_item_MAINHAND = 16;
const player_item_OFFHAND = 17;
const player_item_RELIC = 18;
const player_item_TABARD = 19;

class WorldPlayer extends WorldUnit {
    headItemId: number;
    neckItemId: number;
    shoulderItemId: number;
    bodyItemId: number;
    chestItemId: number;
    waistItemId: number;
    legsItemId: number;
    feetItemId: number;
    wristItemId: number;
    handsItemId: number;
    backItemId: number;
    mainHandItemId: number;
    offHandItemId: number;
    tabardItemId: number;
    /* set from the update packet (PLAYER_BYTES / PLAYER_BYTES_2) before complete(); 0 when the packet has none */
    playerFaceFeatures: number;
    playerSkin: number;
    playerFace: number;
    playerHair: number;
    playerHairColor: number;

    constructor(sceneApi: SceneApi) {
        super(sceneApi);

        this.headItemId = -1;
        this.neckItemId = -1;
        this.shoulderItemId = -1;
        this.bodyItemId = -1;
        this.chestItemId = -1;
        this.waistItemId = -1;
        this.legsItemId = -1;
        this.feetItemId = -1;
        this.wristItemId = -1;
        this.handsItemId = -1;
        this.backItemId = -1;
        this.mainHandItemId = -1;
        this.offHandItemId = -1;
        this.tabardItemId = -1;

        // the first style / colour of each, like my_web_wow's int fields: left undefined, a packet without
        // PLAYER_BYTES / PLAYER_BYTES_2 matched no CharSections / facial hair record (no skin, face or hair)
        this.playerFaceFeatures = 0;
        this.playerSkin = 0;
        this.playerFace = 0;
        this.playerHair = 0;
        this.playerHairColor = 0;
    }

    setPlayerFaceFeatures(faceFeatures: number) {
        this.playerFaceFeatures = faceFeatures;
    }

    setPlayerSkin(skin: number) {
        this.playerSkin = skin;
    }

    setPlayerFace(face: number) {
        this.playerFace = face;
    }

    setPlayerHair(hair: number) {
        this.playerHair = hair;
    }

    setPlayerHairColor(hairColor: number) {
        this.playerHairColor = hairColor;
    }

    /* Items */
    /* Item.dbc is only loaded for WotLK, and only once it has been read */
    getItemRecord(entry: number): ItemRecord | undefined {
        var itemDBC = this.sceneApi.dbc.getItemDBC();
        return itemDBC ? itemDBC[entry] : undefined;
    }

    setHeadItem(entry: number) {
        var itemRecord = this.getItemRecord(entry);
        if (itemRecord) {
            this.headItemId = itemRecord.displayId;
        }

    }

    setNeckItem(entry: number) {
        var itemRecord = this.getItemRecord(entry);
        if (itemRecord) {
            this.neckItemId = itemRecord.displayId;
        }
    }

    setShouldersItem(entry: number) {
        var itemRecord = this.getItemRecord(entry);
        if (itemRecord) {
            this.shoulderItemId = itemRecord.displayId;
        }
    }

    setBodyItem(entry: number) {
        var itemRecord = this.getItemRecord(entry);
        if (itemRecord) {
            this.bodyItemId = itemRecord.displayId;
        }
    }

    setChestItem(entry: number) {
        var itemRecord = this.getItemRecord(entry);
        if (itemRecord) {
            this.chestItemId = itemRecord.displayId;
        }
    }

    setWaistItem(entry: number) {
        var itemRecord = this.getItemRecord(entry);
        if (itemRecord) {
            this.waistItemId = itemRecord.displayId;
        }
    }

    setLegsItem(entry: number) {
        var itemRecord = this.getItemRecord(entry);
        if (itemRecord) {
            this.legsItemId = itemRecord.displayId;
        }
    }

    setFeetItem(entry: number) {
        var itemRecord = this.getItemRecord(entry);
        if (itemRecord) {
            this.feetItemId = itemRecord.displayId;
        }
    }

    setWristItem(entry: number) {
        var itemRecord = this.getItemRecord(entry);
        if (itemRecord) {
            this.wristItemId = itemRecord.displayId;
        }
    }

    setHandsItem(entry: number) {
        var itemRecord = this.getItemRecord(entry);
        if (itemRecord) {
            this.handsItemId = itemRecord.displayId;
        }
    }

    setBackItem(entry: number) {
        var itemRecord = this.getItemRecord(entry);
        if (itemRecord) {
            this.backItemId = itemRecord.displayId;
        }
    }

    setMainHandItem(entry: number) {
        var itemRecord = this.getItemRecord(entry);
        if (itemRecord) {
            this.mainHandItemId = itemRecord.displayId;
        }
    }

    setOffHandItem(entry: number) {
        var itemRecord = this.getItemRecord(entry);
        if (itemRecord) {
            this.offHandItemId = itemRecord.displayId;
        }
    }

    setTabardItem(entry: number) {
        var itemRecord = this.getItemRecord(entry);
        if (itemRecord) {
            this.tabardItemId = itemRecord.displayId;
        }
    }

    /* ---------------*/

    createMaterialFromOwnItem(replaceTextures: string[], meshIds: number[]) {
        this.createMaterialData(replaceTextures, meshIds,
            this.unitRace, this.unitGender,


            this.playerSkin, this.playerFace, this.playerHair, this.playerHairColor, this.playerFaceFeatures,
             //-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1);
            this.headItemId, this.shoulderItemId, this.backItemId, this.chestItemId, -1, this.tabardItemId,
            this.wristItemId, this.handsItemId, this.waistItemId, this.legsItemId, this.feetItemId);

        return true;
    }
}
export default WorldPlayer;
