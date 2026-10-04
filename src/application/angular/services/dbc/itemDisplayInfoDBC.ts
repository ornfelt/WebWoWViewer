import loadDBC from './../dbcLoader';

export interface ItemDisplayInfoRecord {
  leftModel: string;
  rightModel: string;
  leftTextureModel: string;
  rightTextureModel: string;
  inventoryIcon1: string;
  inventoryIcon2: string;
  geosetGroup_1: number;
  geosetGroup_2: number;
  geosetGroup_3: number;
  flags: number;
  spellVisualID: number;
  groupSoundIndex: number;
  helmetGeosetVis_m: number;
  helmetGeosetVis_f: number;
  texture_1: string;
  texture_2: string;
  texture_3: string;
  texture_4: string;
  texture_5: string;
  texture_6: string;
  texture_7: string;
  texture_8: string;
  itemVisual: number;
  particleColorId: number;
}

let itemDisplayInfoDBCFile: { [id: number]: ItemDisplayInfoRecord } | null = null;

export default function itemDisplayInfoDBC(): Promise<{ [id: number]: ItemDisplayInfoRecord }> {
  return new Promise((resolve, reject) => {
    if (itemDisplayInfoDBCFile === null) {
      itemDisplayInfoDBCFile = {};
      loadDBC("DBFilesClient/ItemDisplayInfo.dbc")
        .then((dbcObject) => {
          for (let i = 0; i < dbcObject.getRowCount(); i++) {
            const record = {} as ItemDisplayInfoRecord;
            const id = dbcObject.readInt32(i, 0);
            record.leftModel = dbcObject.readText(i, 1);
            record.rightModel = dbcObject.readText(i, 2);
            record.leftTextureModel = dbcObject.readText(i, 3);
            record.rightTextureModel = dbcObject.readText(i, 4);
            record.inventoryIcon1 = dbcObject.readText(i, 5);
            record.inventoryIcon2 = dbcObject.readText(i, 6);
            record.geosetGroup_1 = dbcObject.readInt32(i, 7);
            record.geosetGroup_2 = dbcObject.readInt32(i, 8);
            record.geosetGroup_3 = dbcObject.readInt32(i, 9);
            record.flags = dbcObject.readInt32(i, 10);
            record.spellVisualID = dbcObject.readInt32(i, 11);
            record.groupSoundIndex = dbcObject.readInt32(i, 12);
            record.helmetGeosetVis_m = dbcObject.readInt32(i, 13);
            record.helmetGeosetVis_f = dbcObject.readInt32(i, 14);
            record.texture_1 = dbcObject.readText(i, 15);
            record.texture_2 = dbcObject.readText(i, 16);
            record.texture_3 = dbcObject.readText(i, 17);
            record.texture_4 = dbcObject.readText(i, 18);
            record.texture_5 = dbcObject.readText(i, 19);
            record.texture_6 = dbcObject.readText(i, 20);
            record.texture_7 = dbcObject.readText(i, 21);
            record.texture_8 = dbcObject.readText(i, 22);
            record.itemVisual = dbcObject.readInt32(i, 23);
            record.particleColorId = dbcObject.readInt32(i, 24);
            itemDisplayInfoDBCFile![id] = record;
          }
          resolve(itemDisplayInfoDBCFile!);
        })
        .catch((error) => {
          reject(error);
        });
    } else {
      resolve(itemDisplayInfoDBCFile);
    }
  });
}
