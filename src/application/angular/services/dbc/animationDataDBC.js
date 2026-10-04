import loadDBC from './../dbcLoader.js';

let animationDataDBCFile = null;

export default function animationDataDBC() {
  return new Promise((resolve, reject) => {
    if (animationDataDBCFile === null) {
      animationDataDBCFile = [];
      loadDBC("DBFilesClient/AnimationData.dbc")
        .then((dbcObject) => {
          for (let i = 0; i < dbcObject.getRowCount(); i++) {
            const record = {};

            record.id             = dbcObject.readInt32(i, 0);
            record.name           = dbcObject.readText(i, 1);
            record.weaponFlags    = dbcObject.readInt32(i, 2);
            record.bodyFlags      = dbcObject.readInt32(i, 3);
            record.flags          = dbcObject.readInt32(i, 4);
            record.fallbackID     = dbcObject.readInt32(i, 5);
            record.behaviorID     = dbcObject.readInt32(i, 6);
            record.behaviorTier   = dbcObject.readInt32(i, 7);

            animationDataDBCFile[record.id] = record;
          }
          resolve(animationDataDBCFile);
        })
        .catch((error) => {
          reject(error);
        });
    } else {
      resolve(animationDataDBCFile);
    }
  });
}
