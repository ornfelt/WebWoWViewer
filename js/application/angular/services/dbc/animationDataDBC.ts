import loadDBC from './../dbcLoader';

export interface AnimationDataRecord {
  id: number;
  name: string;
  weaponFlags: number;
  bodyFlags: number;
  flags: number;
  fallbackID: number;
  behaviorID: number;
  behaviorTier: number;
}

let animationDataDBCFile: AnimationDataRecord[] | null = null;

export default function animationDataDBC(): Promise<AnimationDataRecord[]> {
  return new Promise((resolve, reject) => {
    if (animationDataDBCFile === null) {
      animationDataDBCFile = [];
      loadDBC("DBFilesClient/AnimationData.dbc")
        .then((dbcObject) => {
          for (let i = 0; i < dbcObject.getRowCount(); i++) {
            const record = {} as AnimationDataRecord;

            record.id             = dbcObject.readInt32(i, 0);
            record.name           = dbcObject.readText(i, 1);
            record.weaponFlags    = dbcObject.readInt32(i, 2);
            record.bodyFlags      = dbcObject.readInt32(i, 3);
            record.flags          = dbcObject.readInt32(i, 4);
            record.fallbackID     = dbcObject.readInt32(i, 5);
            record.behaviorID     = dbcObject.readInt32(i, 6);
            record.behaviorTier   = dbcObject.readInt32(i, 7);

            animationDataDBCFile![record.id] = record;
          }
          resolve(animationDataDBCFile!);
        })
        .catch((error) => {
          reject(error);
        });
    } else {
      resolve(animationDataDBCFile);
    }
  });
}
