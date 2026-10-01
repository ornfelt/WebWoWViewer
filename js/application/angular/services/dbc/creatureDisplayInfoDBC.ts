import loadDBC from './../dbcLoader';

export interface CreatureDisplayInfoRecord {
  model1: number;
  sound: number;
  displayExtra: number;
  modelScale: number;
  opacity: number;
  skin1: string;
  skin2: string;
  skin3: string;
  creatureGeosetData: number;
}

let creatureDisplayInfoDBCFile: { [id: number]: CreatureDisplayInfoRecord } | null = null;

export default function creatureDisplayInfoDBC(): Promise<{ [id: number]: CreatureDisplayInfoRecord }> {
  return new Promise((resolve, reject) => {
    if (creatureDisplayInfoDBCFile === null) {
      creatureDisplayInfoDBCFile = {};
      loadDBC("DBFilesClient/CreatureDisplayInfo.dbc")
        .then((dbcObject) => {
          for (let i = 0; i < dbcObject.getRowCount(); i++) {
            const record = {} as CreatureDisplayInfoRecord;
            const id = dbcObject.readInt32(i, 0);
            record.model1 = dbcObject.readInt32(i, 1);
            record.sound = dbcObject.readInt32(i, 2);
            record.displayExtra = dbcObject.readInt32(i, 3);
            record.modelScale = dbcObject.readFloat32(i, 4);
            record.opacity = dbcObject.readInt32(i, 5);
            record.skin1 = dbcObject.readText(i, 6);
            record.skin2 = dbcObject.readText(i, 7);
            record.skin3 = dbcObject.readText(i, 8);
            record.creatureGeosetData = dbcObject.readUInt32(i, 14);
            creatureDisplayInfoDBCFile![id] = record;
          }
          resolve(creatureDisplayInfoDBCFile!);
        })
        .catch((error) => {
          reject(error);
        });
    } else {
      resolve(creatureDisplayInfoDBCFile);
    }
  });
}
