import loadDBC from './../dbcLoader';

export interface WmoAreaTableRecord {
  id: number;
  mapId: number;
  x: number;
  y: number;
  z: number;
  falloffStart: number;
  falloffEnd: number;
  skyAndFog: number;
  sunset: number;
  other: number;
  death: number;
  unk1: number;
  unk2: number;
  unk3: number;
}

let lightDBCFile: WmoAreaTableRecord[] | null = null;

// JS-BUG: a copy of lightDBC: loads Light.dbc and builds light records instead of reading WMOAreaTable.dbc; nothing imports it
export default function lightDBC(): Promise<WmoAreaTableRecord[]> {
  return new Promise((resolve, reject) => {
    if (lightDBCFile === null) {
      lightDBCFile = [];
      loadDBC("DBFilesClient/Light.dbc")
        .then((dbcObject) => {
          for (let i = 0; i < dbcObject.getRowCount(); i++) {
            const lightDBCRecord = {} as WmoAreaTableRecord;
            lightDBCRecord.id           = dbcObject.readInt32(i, 0);
            lightDBCRecord.mapId        = dbcObject.readInt32(i, 1);
            lightDBCRecord.x            = dbcObject.readFloat32(i, 2);
            lightDBCRecord.y            = dbcObject.readFloat32(i, 3);
            lightDBCRecord.z            = dbcObject.readFloat32(i, 4);
            lightDBCRecord.falloffStart = dbcObject.readFloat32(i, 5);
            lightDBCRecord.falloffEnd   = dbcObject.readFloat32(i, 6);
            lightDBCRecord.skyAndFog    = dbcObject.readInt32(i, 7);
            lightDBCRecord.sunset       = dbcObject.readInt32(i, 8);
            lightDBCRecord.other        = dbcObject.readInt32(i, 9);
            lightDBCRecord.death        = dbcObject.readInt32(i, 10);
            lightDBCRecord.unk1         = dbcObject.readInt32(i, 11);
            lightDBCRecord.unk2         = dbcObject.readInt32(i, 12);
            lightDBCRecord.unk3         = dbcObject.readInt32(i, 13);
            lightDBCFile![lightDBCRecord.id] = lightDBCRecord;
          }
          resolve(lightDBCFile!);
        })
        .catch((error) => {
          reject(error);
        });
    } else {
      resolve(lightDBCFile);
    }
  });
}
