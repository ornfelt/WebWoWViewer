import WorldUnit from '../objects/worldObjects/worldUnit'
import WorldPlayer from '../objects/worldObjects/worldPlayer'
import WorldGameObject from '../objects/worldObjects/worldGameObject'
//import packetList from '../../../mountedNpc.json'
//import packetList from '../../../47EC8D2E.json'
//import packetList from '../../../npc_wood.json'
//import packetList from '../../../player.json'
//import packetList from '../../../player2.json'
//import packetList from '../../../player3.json'
//import packetList from '../../../player3_rag.json'

//import packetList from '../../../penguin.json'
import packetList from '../../../rag_no_mount.json'
//import packetList from '../../../proto.json'
//import packetList from '../../../packet.json'
//import packetList from '../../../attacketdMinion1.json'
//let packetList = [];
import {vec3} from 'gl-matrix'
import { HIDDEN_POS } from '../objects/spellProjectile'
import type {ReadonlyMat4, ReadonlyVec4} from 'gl-matrix'
import type { SceneApi } from '../sceneApi';
import type firstPersonCamera from '../camera/firstPersonCamera';

/* the objectMap key of the player character (Scene.spawnPlayerCharacter), apart from the packet GUIDs */
export const localPlayerGuid = -1;

/* One UNIT_VIRTUAL_ITEM_SLOT_DISPLAY entry, completed from UNIT_VIRTUAL_ITEM_INFO when the packet has it */
interface ItemToWear {
    displayId: number;
    itemClass?: number;
    itemSubClass?: number;
    itemMaterial?: number;
    itemInventoryType?: number;
    itemSheath?: number;
}


class WorldObjectManager {
    /* keyed by object GUID */
    objectMap: { [guid: string]: WorldUnit | WorldGameObject };
    sceneApi: SceneApi;
    lastPacketIndex: number;
    playPackets: boolean;
    /* set by startPlayingPackets() */
    serverTime!: number;
    clientTime!: number;
    /* the keys of the Wander mode's bots, which their WanderController places (Scene.startWanderMode) */
    wanderKeys: Set<number>;
    /* the game server's bot mode plays the player (MultiplayerManager), so the player character is put away */
    hideLocalPlayer: boolean;
    /* the keys of the units loaded from a JSON packet file (loadPackets), in insertion order */
    jsonObjectKeys: string[];

    constructor(sceneApi: SceneApi){
        this.objectMap = {};
        this.sceneApi = sceneApi;
        this.lastPacketIndex = 0;

        this.playPackets = false;
        this.wanderKeys = new Set();
        this.hideLocalPlayer = false;
        this.jsonObjectKeys = [];
    }

    update(deltaTime: number, cameraPos: ReadonlyVec4, viewMat: ReadonlyMat4, camera: firstPersonCamera) {
        /* 1. Load the next portion of packets */
        if (this.playPackets) {
            this.serverTime += deltaTime;
            this.clientTime += deltaTime;

            //console.log("servertime: " + this.serverTime);
            //console.log("clientTime: " + this.clientTime);

            for (var i = this.lastPacketIndex; i < packetList.length; i++) {
                if (this.clientTime > packetList[i].tickcount) {
                    this.processPacket(packetList[i]);
                    this.lastPacketIndex = i+1;
                } else {
                    break;
                }
            }
        }

        /* Place the player character (before the models update, which builds the placement matrix from it) */
        var player = this.objectMap[localPlayerGuid];
        if (player && this.hideLocalPlayer) {
            player.setPosition(vec3.clone(HIDDEN_POS));
        } else if (player) {
            if (camera.collisionActive) {
                // Player mode / third-person: the player position drives collision and the
                // camera sits behind/above it, so the model goes at the player position.
                // The facing follows the camera only when right-mouse steering.
                player.setPosition(vec3.clone(camera.playerPosition));
                player.setRotation(camera.characterYaw);
            } else {
                // Free roam: in front of the camera (consider horizontal and vertical camera angle)
                var yawRad = -camera.ah * (Math.PI / 180);
                // flip pitch sign (if model moves down when camera goes up and vice versa):
                var pitchRad = -camera.av * (Math.PI / 180);

                // Compute 3D forward direction (same math as Camera.tick)
                var dist = 20;
                var cosPitch = Math.cos(pitchRad);
                var forwardX = Math.cos(yawRad) * cosPitch * dist;
                var forwardY = Math.sin(yawRad) * cosPitch * dist;
                var forwardZ = Math.sin(pitchRad) * dist;

                player.setPosition(vec3.fromValues(
                    cameraPos[0] + forwardX,
                    cameraPos[1] + forwardY,
                    cameraPos[2] + forwardZ - 6
                ));
                player.setRotation(yawRad);
            }
        }

        /* Park the units of a JSON packet file in front of the camera */
        this.parkJsonObjectsInFrontOfCamera(cameraPos, camera);

        /* 2. Update models */
        for (var field in this.objectMap) {
            if (this.objectMap.hasOwnProperty(field)) {
                this.objectMap[field].update(deltaTime, cameraPos, viewMat);
            }
        }

        //console.log("Update! cameraPos: " + cameraPos);
        //console.log("cameraPos: " + cameraPos);
        //console.log("cameraPos: " + cameraPos[0]);
        //console.log("type: " + typeof(cameraPos));
        if (this.objectMap[17786964]) {
            var vectorArray: number[] = new Array();
            //vectorArray[0] = cameraPos[0]+10;
            //vectorArray[1] = cameraPos[1]-10;

            vectorArray[0] = cameraPos[0]-15;
            vectorArray[1] = cameraPos[1]+15;
            vectorArray[2] = cameraPos[2]-8;
            //console.log("Update playerpos: " + vectorArray);
            this.objectMap[17786964].setPosition(vectorArray);
        }

        if (this.objectMap[17786930] && !this.wanderKeys.has(17786930)) {
            var vectorArray: number[] = new Array();
            vectorArray[0] = cameraPos[0]-15;
            vectorArray[1] = cameraPos[1]+15;
            vectorArray[2] = cameraPos[2]-8;
            this.objectMap[17786930].setPosition(vectorArray);
        }

        if (this.objectMap[333]) {
            //var vectorArray = new Array();
            //vectorArray[0] = cameraPos[0]-15;
            //vectorArray[1] = cameraPos[1]+15;
            //vectorArray[2] = cameraPos[2]-8;
            // the M2 scenes' unit stands where it was placed (the camera is aimed at it), as in my_web_wow
            //var vectorArray: number[] = [0+30, 0+30, 0];
            //this.objectMap[333].setPosition(vectorArray);
        }
        // Debug
        //console.log("this.objectMap:", this.objectMap);
    }

    processPacket(packet: any) { // a mock packet from the JSON capture, walked field by field
        if (packet.opcode == 'SMSG_COMPRESSED_UPDATE_OBJECT') {
            var updates = packet.payload.updates;
            for (var j = 0; j < updates.length; j++) {
                if (updates[j].updateType == 'UPDATE_TYPE_CREATE_FULL' || updates[j].updateType == 'UPDATE_TYPE_CREATE_SELF'){

                    var update = updates[j];
                    var updateFields = update.updateFields;

                    var guid = update.objectGuid;
                    /*
                    for (var k = 0; k < updateFields['OBJECT_FIELD_GUID'].length; k++) {
                        guid += updateFields['OBJECT_FIELD_GUID'][k].value << (updateFields['OBJECT_FIELD_GUID'][k].index*32);
                    }*/

                    if (this.objectMap[guid]) continue;

                    if (update.obj_type == 3 || update.obj_type == 4) {
                        //Player + unit;
                        var newWorldUnit: WorldUnit
                        if (update.obj_type == 4) {
                            newWorldUnit = new WorldPlayer(this.sceneApi);
                        } else {
                            newWorldUnit = new WorldUnit(this.sceneApi);
                        }
                        this.objectMap[guid] = newWorldUnit;

                        newWorldUnit.setSpeedWalk(update.speedWalk);
                        newWorldUnit.setSpeedRun(update.speedRun);
                        newWorldUnit.setSpeedRunBack(update.speedRunBack);
                        newWorldUnit.setSpeedSwim(update.speedSwim);
                        newWorldUnit.setSpeedSwimBack(update.speedSwimBack);
                        newWorldUnit.setSpeedFly(update.speedFly);
                        newWorldUnit.setSpeedFlyBack(update.speedFlyBack);
                        newWorldUnit.setSpeedTurnRate(update.speedTurnRate);

                        if (update.points) {
                            var vectorArray = new Array(update.points.length);
                            for (var i = 0; i < vectorArray.length; i++) {
                                var pointObj = update.points[i];
                                vectorArray[i] = [pointObj.x, pointObj.y, pointObj.z];
                            }
                            newWorldUnit.setMovingData(update.curr_time, update.total_time, update.movementflag, vectorArray);
                        }

                        newWorldUnit.setCurrentTime(update.timestamp);
                        newWorldUnit.setPosition(vec3.fromValues(update.x, update.y, update.z));
                        newWorldUnit.setRotation(update.f);
                        if (updateFields.hasOwnProperty("UNIT_FIELD_DISPLAYID")) {
                            newWorldUnit.setDisplayId(updateFields["UNIT_FIELD_DISPLAYID"]);
                        }
                        if (updateFields.hasOwnProperty("UNIT_FIELD_NATIVEDISPLAYID")) {
                            newWorldUnit.setNativeDisplayId(updateFields["UNIT_FIELD_NATIVEDISPLAYID"]);
                        }
                        if (updateFields.hasOwnProperty("UNIT_FIELD_MOUNTDISPLAYID")) {
                            newWorldUnit.setMountDisplayId(updateFields["UNIT_FIELD_MOUNTDISPLAYID"])
                        }

                        if (updateFields.hasOwnProperty("OBJECT_FIELD_SCALE_X")) {
                            newWorldUnit.setScale(updateFields["OBJECT_FIELD_SCALE_X"])
                        }

                        //Items to wear
                        var itemsToWear: ItemToWear[] = [];
                        if (updateFields['UNIT_VIRTUAL_ITEM_SLOT_DISPLAY']) {
                            for (var k = 0; k < updateFields['UNIT_VIRTUAL_ITEM_SLOT_DISPLAY'].length; k++) {
                                var item_index = updateFields['UNIT_VIRTUAL_ITEM_SLOT_DISPLAY'][k].index;

                                itemsToWear[item_index] = {
                                    displayId: updateFields['UNIT_VIRTUAL_ITEM_SLOT_DISPLAY'][k].value
                                }
                            }
                        }
                        if (updateFields['UNIT_VIRTUAL_ITEM_INFO']) {
                            for (var k = 0; k < updateFields['UNIT_VIRTUAL_ITEM_INFO'].length; k++) {
                                var infoIndex = updateFields['UNIT_VIRTUAL_ITEM_INFO'][k].index;
                                var itemIndex = (infoIndex / 2) | 0;
                                var itemInfoType = infoIndex % 2;

                                var item_valueInfo = updateFields['UNIT_VIRTUAL_ITEM_INFO'][k].value;
                                var itemToWear = itemsToWear[itemIndex];

                                if (itemInfoType == 0) {
                                    itemToWear.itemClass = item_valueInfo[0];
                                    itemToWear.itemSubClass = item_valueInfo[1];
                                    itemToWear.itemMaterial = item_valueInfo[2];
                                } else if (itemInfoType == 1) {
                                    itemToWear.itemInventoryType = item_valueInfo[0];
                                    itemToWear.itemSheath = item_valueInfo[1];
                                }
                            }
                        }

                        for (var k = 0; k < itemsToWear.length; k++) {
                            var itemToWear = itemsToWear[k];
                            newWorldUnit.setVirtualItemSlot(k, itemToWear.displayId, itemToWear.itemClass,
                                itemToWear.itemSubClass, itemToWear.itemInventoryType)
                        }


                        if (updateFields.hasOwnProperty('UNIT_FIELD_BYTES_0')) {

                            var race = updateFields['UNIT_FIELD_BYTES_0'][0];
                            var clas = updateFields['UNIT_FIELD_BYTES_0'][1];
                            var gender = updateFields['UNIT_FIELD_BYTES_0'][2];
                            var powerType = updateFields['UNIT_FIELD_BYTES_0'][3];
                            newWorldUnit.setUnitRace(race);
                            newWorldUnit.setUnitClass(clas);
                            newWorldUnit.setUnitGender(gender);
                            newWorldUnit.setUnitPowerType(powerType);
                        }

                        if (update.obj_type == 4) {
                            //Player
                            if (updateFields.hasOwnProperty("PLAYER_BYTES")) {
                                // skin, face, hair, haircolor
                                var skin = updateFields['PLAYER_BYTES'][0];
                                var face = updateFields['PLAYER_BYTES'][1];
                                var hair = updateFields['PLAYER_BYTES'][2];
                                var hairColor = updateFields['PLAYER_BYTES'][3];

                                (newWorldUnit as WorldPlayer).setPlayerSkin(skin);
                                (newWorldUnit as WorldPlayer).setPlayerFace(face);
                                (newWorldUnit as WorldPlayer).setPlayerHair(hair);
                                (newWorldUnit as WorldPlayer).setPlayerHairColor(hairColor);
                            }

                            if (updateFields.hasOwnProperty("PLAYER_BYTES_2")) {
                                // facehair
                                var faceFeatures = updateFields['PLAYER_BYTES_2'][0];
                                (newWorldUnit as WorldPlayer).setPlayerFaceFeatures(faceFeatures);
                            }

                            //Head
                            if (updateFields.hasOwnProperty("PLAYER_VISIBLE_ITEM_1_0")) {
                                var itemData = updateFields['PLAYER_VISIBLE_ITEM_1_0'];
                                for (var kk =0 ; kk < itemData.length; kk++) {
                                    if (itemData[kk].index == 0) {
                                        (newWorldUnit as WorldPlayer).setHeadItem(itemData[kk].value);
                                    }
                                }
                            }
                            //Neck
                            if (updateFields.hasOwnProperty("PLAYER_VISIBLE_ITEM_2_0")) {
                                var itemData = updateFields['PLAYER_VISIBLE_ITEM_2_0'];
                                for (var kk =0 ; kk < itemData.length; kk++) {
                                    if (itemData[kk].index == 0) {
                                        (newWorldUnit as WorldPlayer).setNeckItem(itemData[kk].value);
                                    }
                                }
                            }
                            //Shoulders
                            if (updateFields.hasOwnProperty("PLAYER_VISIBLE_ITEM_3_0")) {
                                var itemData = updateFields['PLAYER_VISIBLE_ITEM_3_0'];
                                for (var kk =0 ; kk < itemData.length; kk++) {
                                    if (itemData[kk].index == 0) {
                                        (newWorldUnit as WorldPlayer).setShouldersItem(itemData[kk].value);
                                    }
                                }
                            }

                            //BODY
                            if (updateFields.hasOwnProperty("PLAYER_VISIBLE_ITEM_4_0")) {
                                var itemData = updateFields['PLAYER_VISIBLE_ITEM_4_0'];
                                for (var kk =0 ; kk < itemData.length; kk++) {
                                    if (itemData[kk].index == 0) {
                                        (newWorldUnit as WorldPlayer).setBodyItem(itemData[kk].value);
                                    }
                                }
                            }

                            //Chest
                            if (updateFields.hasOwnProperty("PLAYER_VISIBLE_ITEM_5_0")) {
                                var itemData = updateFields['PLAYER_VISIBLE_ITEM_5_0'];
                                for (var kk =0 ; kk < itemData.length; kk++) {
                                    if (itemData[kk].index == 0) {
                                        (newWorldUnit as WorldPlayer).setChestItem(itemData[kk].value);
                                    }
                                }
                            }

                            //Waist
                            if (updateFields.hasOwnProperty("PLAYER_VISIBLE_ITEM_6_0")) {
                                var itemData = updateFields['PLAYER_VISIBLE_ITEM_6_0'];
                                for (var kk =0 ; kk < itemData.length; kk++) {
                                    if (itemData[kk].index == 0) {
                                        (newWorldUnit as WorldPlayer).setWaistItem(itemData[kk].value);
                                    }
                                }
                            }

                            //Legs
                            if (updateFields.hasOwnProperty("PLAYER_VISIBLE_ITEM_7_0")) {
                                var itemData = updateFields['PLAYER_VISIBLE_ITEM_7_0'];
                                for (var kk =0 ; kk < itemData.length; kk++) {
                                    if (itemData[kk].index == 0) {
                                        (newWorldUnit as WorldPlayer).setLegsItem(itemData[kk].value);
                                    }
                                }
                            }
                            //Boots
                            if (updateFields.hasOwnProperty("PLAYER_VISIBLE_ITEM_8_0")) {
                                var itemData = updateFields['PLAYER_VISIBLE_ITEM_8_0'];
                                for (var kk =0 ; kk < itemData.length; kk++) {
                                    if (itemData[kk].index == 0) {
                                        (newWorldUnit as WorldPlayer).setFeetItem(itemData[kk].value);
                                    }
                                }
                            }
                            //Wrist
                            if (updateFields.hasOwnProperty("PLAYER_VISIBLE_ITEM_9_0")) {
                                var itemData = updateFields['PLAYER_VISIBLE_ITEM_9_0'];
                                for (var kk =0 ; kk < itemData.length; kk++) {
                                    if (itemData[kk].index == 0) {
                                        (newWorldUnit as WorldPlayer).setWristItem(itemData[kk].value);
                                    }
                                }
                            }
                            //Hands
                            if (updateFields.hasOwnProperty("PLAYER_VISIBLE_ITEM_10_0")) {
                                var itemData = updateFields['PLAYER_VISIBLE_ITEM_10_0'];
                                for (var kk =0 ; kk < itemData.length; kk++) {
                                    if (itemData[kk].index == 0) {
                                        (newWorldUnit as WorldPlayer).setHandsItem(itemData[kk].value);
                                    }
                                }
                            }
                            //Back
                            if (updateFields.hasOwnProperty("PLAYER_VISIBLE_ITEM_15_0")) {
                                var itemData = updateFields['PLAYER_VISIBLE_ITEM_15_0'];
                                for (var kk =0 ; kk < itemData.length; kk++) {
                                    if (itemData[kk].index == 0) {
                                        (newWorldUnit as WorldPlayer).setBackItem(itemData[kk].value);
                                    }
                                }
                            }
                            //Main hand
                            if (updateFields.hasOwnProperty("PLAYER_VISIBLE_ITEM_16_0")) {
                                var itemData = updateFields['PLAYER_VISIBLE_ITEM_16_0'];
                                for (var kk =0 ; kk < itemData.length; kk++) {
                                    if (itemData[kk].index == 0) {
                                        (newWorldUnit as WorldPlayer).setMainHandItem(itemData[kk].value);
                                    }
                                }
                            }
                            //Off hand
                            if (updateFields.hasOwnProperty("PLAYER_VISIBLE_ITEM_17_0")) {
                                var itemData = updateFields['PLAYER_VISIBLE_ITEM_17_0'];
                                for (var kk =0 ; kk < itemData.length; kk++) {
                                    if (itemData[kk].index == 0) {
                                        (newWorldUnit as WorldPlayer).setOffHandItem(itemData[kk].value);
                                    }
                                }
                            }
                            //Tabard
                            if (updateFields.hasOwnProperty("PLAYER_VISIBLE_ITEM_19_0")) {
                                var itemData = updateFields['PLAYER_VISIBLE_ITEM_19_0'];
                                for (var kk =0 ; kk < itemData.length; kk++) {
                                    if (itemData[kk].index == 0) {
                                        (newWorldUnit as WorldPlayer).setTabardItem(itemData[kk].value);
                                    }
                                }
                            }

                        }

                        newWorldUnit.complete()

                    } else if (update.obj_type == 5) {
                        var newWorldGameObject = new WorldGameObject(this.sceneApi);

                        this.objectMap[guid] = newWorldGameObject;

                        newWorldGameObject.setPosition(
                            vec3.fromValues(updates[j].static_x, update.static_y, update.static_z));
                        newWorldGameObject.setRotation(update.static_f);
                        newWorldGameObject.setDisplayId(updateFields["GAMEOBJECT_DISPLAYID"]);

                        var rotationQuaternion = [0, 0, 0, 0];
                        for (var k = 0; k < updateFields['GAMEOBJECT_ROTATION'].length; k++) {
                            rotationQuaternion[updateFields['GAMEOBJECT_ROTATION'][k].index] =
                                updateFields['GAMEOBJECT_ROTATION'][k].value;
                        }
                        newWorldGameObject.setRotationQuaternion(rotationQuaternion);

                        if (updateFields.hasOwnProperty("OBJECT_FIELD_SCALE_X")) {
                            newWorldGameObject.setScale(updateFields["OBJECT_FIELD_SCALE_X"])
                        }



                    }
                }
            }
        } else if (packet.opcode == 'SMSG_MONSTER_MOVE'){
            var payload = packet.payload;
            var guid = payload.m_guid;

            if (!this.objectMap[guid]) return;

            var packetPoints = [];
            packetPoints.push([payload.m_x, payload.m_y, payload.m_z]);
            var moveTime = payload.m_move_time;
            if (payload.m_stop_flag != 1) {
                if ((payload.m_move_flag & 0x200) == 0) {
                    //packed
                    var halfVector = [
                        (payload.m_x + payload.m_end_x) * 0.5,
                        (payload.m_y + payload.m_end_y) * 0.5,
                        (payload.m_z + payload.m_end_z) * 0.5,
                    ];
                    for (var i = 0; i < payload.m_move_point_run.length; i++) {
                        var uint32 = payload.m_move_point_run[i];
                        // packed offsets: x in bits 0-10, y in bits 11-21, z in bits 22-31, each signed (in 0.25 units)
                        var x = ((uint32 << 21) >> 21) * 0.25;
                        var y = ((uint32 << 10) >> 21) * 0.25;
                        var z = (uint32 >> 22) * 0.25;

                        packetPoints.push([
                                halfVector[0] - x,
                                halfVector[1] - y,
                                halfVector[2] - z
                            ]
                        );
                    }
                } else {
                    for (var i = 0; i < payload.m_move_point_run.length; i++) {
                        var pointObj = payload.m_move_point_run[i]
                        packetPoints.push([pointObj.x, pointObj.y, pointObj.z]);
                    }
                }
                packetPoints.push([payload.m_end_x, payload.m_end_y, payload.m_end_z]);
                (this.objectMap[guid] as WorldUnit).setMovingData(0, moveTime, payload.m_move_flag, packetPoints);
                if (payload.m_stop_flag == 3) {
                    (this.objectMap[guid] as WorldUnit).setFacingOnMovementEndGuid(payload.m_stop_flag_turn_to_guid)
                } else if (payload.m_stop_flag == 4) {
                    (this.objectMap[guid] as WorldUnit).setFacingOnMovementEndFacing(payload.m_stop_flag_face_to)
                }
            } else {
                (this.objectMap[guid] as WorldUnit).moveToFromCurrent(1000, packetPoints);
            }

        }
    }
    startPlayingPackets() {
        this.serverTime = 0;
        this.clientTime = packetList[0].tickcount - 500;
        this.lastPacketIndex = 0;

        this.playPackets = true;
    }

    loadAllPacket(){
        for (var i = 0; i < packetList.length; i++){
            this.processPacket(packetList[i]);
        }
    }

    /*
     * Process every packet of a JSON packet file (services/packetJson), as loadAllPacket does for the built-in
     * packets and my_web_wow's LoadPacketsFromFile; the units it creates are parked in front of the camera.
     */
    loadPackets(packets: unknown[]) {
        var keysBefore = new Set(Object.keys(this.objectMap));
        for (var packet of packets) {
            this.processPacket(packet);
        }
        for (var key of Object.keys(this.objectMap)) {
            if (!keysBefore.has(key) && this.jsonObjectKeys.indexOf(key) < 0)
                this.jsonObjectKeys.push(key);
        }
        console.log("[WorldObjectManager] Processed " + packets.length + " packet(s); objectMap now has " + Object.keys(this.objectMap).length + " object(s).");
    }

    /*
     * Places every JSON-loaded unit in front of the camera each frame, unless it is following a packet movement
     * path (isMoving), as my_web_wow's ParkJsonObjectsInFrontOfCamera. The player character is skipped, it has
     * its own placement in update(). Multiple objects are spread out laterally so they don't overlap.
     */
    parkJsonObjectsInFrontOfCamera(cameraPos: ReadonlyVec4, camera: firstPersonCamera) {
        if (this.jsonObjectKeys.length === 0)
            return;

        var yawRad = -camera.ah * (Math.PI / 180);
        var pitchRad = -camera.av * (Math.PI / 180);
        var dist = 20;

        var cosPitch = Math.cos(pitchRad);
        var fx = Math.cos(yawRad) * cosPitch;
        var fy = Math.sin(yawRad) * cosPitch;
        var fz = Math.sin(pitchRad);

        // Right vector (perpendicular to forward in the XY plane) for lateral spacing.
        var rx = Math.sin(yawRad);
        var ry = -Math.cos(yawRad);

        var shown = 0;
        for (var key of this.jsonObjectKeys) {
            if (key === String(localPlayerGuid)) continue; // the player character: handled in update
            var unit = this.objectMap[key];
            if (!(unit instanceof WorldUnit)) continue;
            if (unit.isMoving) continue;   // respect packet movement paths

            var lateral = shown * 4;
            unit.setPosition(vec3.fromValues(
                cameraPos[0] + fx * dist + rx * lateral,
                cameraPos[1] + fy * dist + ry * lateral,
                cameraPos[2] + fz * dist - 6));
            unit.setRotation(yawRad);
            shown++;
        }
    }

}
export default WorldObjectManager;
