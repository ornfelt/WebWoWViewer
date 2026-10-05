import loadDBC from './../dbcLoader.js';

let lightFloatBandDBCFile = null;

export default function LightFloatBandDBC() {
  return new Promise((resolve, reject) => {
    if (lightFloatBandDBCFile === null) {
      lightFloatBandDBCFile = [];
      loadDBC("DBFilesClient/LightFloatBand.dbc")
        .then((dbcObject) => {
          for (let i = 0; i < dbcObject.getRowCount(); i++) {
            const lightFloatBandDBCRecord = {};

            lightFloatBandDBCRecord.id = dbcObject.readInt32(i, 0);
            lightFloatBandDBCRecord.noOfEntries = dbcObject.readInt32(i, 1);
            lightFloatBandDBCRecord.times = [];
            for (let j = 0; j < lightFloatBandDBCRecord.noOfEntries; j++) {
              // columns 2 + j (column 1 is noOfEntries)
              lightFloatBandDBCRecord.times.push(dbcObject.readInt32(i, 2 + j));
            }

            lightFloatBandDBCRecord.values = [];
            for (let j = 0; j < lightFloatBandDBCRecord.noOfEntries; j++) {
              lightFloatBandDBCRecord.values.push(dbcObject.readFloat32(i, 18 + j));
            }

            lightFloatBandDBCFile[lightFloatBandDBCRecord.id] = lightFloatBandDBCRecord;
          }
          resolve(lightFloatBandDBCFile);
        })
        .catch((error) => {
          reject(error);
        });
    } else {
      resolve(lightFloatBandDBCFile);
    }
  });
}
