import loadDBC from './../dbcLoader.js';

let creatureModelDataDBCFile = null;

export default function creatureDisplayInfoExtraDBC() {
  return new Promise((resolve, reject) => {
    if (creatureModelDataDBCFile === null) {
      creatureModelDataDBCFile = {};
      loadDBC("DBFilesClient/CreatureModelData.dbc")
        .then((dbcObject) => {
          for (let i = 0; i < dbcObject.getRowCount(); i++) {
            const record = {};

            const id = dbcObject.readInt32(i, 0);

            record.unk = dbcObject.readInt32(i, 1);
            record.modelName = dbcObject.readText(i, 2);
            record.sizeClass = dbcObject.readInt32(i, 3);
            record.modelScale = dbcObject.readFloat32(i, 4);

            record.minCorner = {
              x: dbcObject.readFloat32(i, 18),
              y: dbcObject.readFloat32(i, 19),
              z: dbcObject.readFloat32(i, 20)
            };
            record.maxCorner = {
              x: dbcObject.readFloat32(i, 21),
              y: dbcObject.readFloat32(i, 22),
              z: dbcObject.readFloat32(i, 23)
            };

            creatureModelDataDBCFile[id] = record;
          }
          resolve(creatureModelDataDBCFile);
        })
        .catch((error) => {
          reject(error);
        });
    } else {
      resolve(creatureModelDataDBCFile);
    }
  });
}
