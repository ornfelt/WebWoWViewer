import loadDBC from './../dbcLoader';

export interface GameObjectDisplayInfoRecord {
  modelName: string;
}

let gameObjectDisplayInfoDBCFile: { [id: number]: GameObjectDisplayInfoRecord } | null = null;

export default function gameObjectDisplayInfoDBC(): Promise<{ [id: number]: GameObjectDisplayInfoRecord }> {
  return new Promise((resolve, reject) => {
    if (gameObjectDisplayInfoDBCFile === null) {
      gameObjectDisplayInfoDBCFile = {};
      loadDBC("DBFilesClient/GameObjectDisplayInfo.dbc")
        .then((dbcObject) => {
          for (let i = 0; i < dbcObject.getRowCount(); i++) {
            const record = {} as GameObjectDisplayInfoRecord;
            const id = dbcObject.readInt32(i, 0);
            record.modelName = dbcObject.readText(i, 1);
            gameObjectDisplayInfoDBCFile![id] = record;
          }
          resolve(gameObjectDisplayInfoDBCFile!);
        })
        .catch((error) => {
          reject(error);
        });
    } else {
      resolve(gameObjectDisplayInfoDBCFile);
    }
  });
}
