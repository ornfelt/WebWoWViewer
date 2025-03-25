import loadDBC from './../dbcLoader.js';

let lightIntBandDBCFile = null;

export default function LightIntBandDBC() {
  return new Promise((resolve, reject) => {
    if (lightIntBandDBCFile === null) {
      lightIntBandDBCFile = [];
      loadDBC("DBFilesClient/LightIntBand.dbc")
        .then((dbcObject) => {
          for (let i = 0; i < dbcObject.getRowCount(); i++) {
            const lightIntBandDBCRecord = {};
            lightIntBandDBCRecord.id = dbcObject.readInt32(i, 0);
            lightIntBandDBCRecord.noOfEntries = dbcObject.readInt32(i, 1);
            lightIntBandDBCRecord.times = [];
            for (let j = 0; j < lightIntBandDBCRecord.noOfEntries; j++) {
              lightIntBandDBCRecord.times.push(dbcObject.readInt32(i, 1 + j));
            }
            lightIntBandDBCRecord.values = [];
            for (let j = 0; j < lightIntBandDBCRecord.noOfEntries; j++) {
              lightIntBandDBCRecord.values.push(dbcObject.readInt32(i, 18 + j));
            }
            lightIntBandDBCRecord.floatValues = [];
            for (let j = 0; j < lightIntBandDBCRecord.noOfEntries; j++) {
              lightIntBandDBCRecord.floatValues.push([
                (lightIntBandDBCRecord.values[j] & 0xff) / 255.0,
                ((lightIntBandDBCRecord.values[j] >> 8) & 0xff) / 255.0,
                ((lightIntBandDBCRecord.values[j] >> 16) & 0xff) / 255.0,
                ((lightIntBandDBCRecord.values[j] >> 24) & 0xff) / 255.0,
              ]);
            }
            lightIntBandDBCFile[lightIntBandDBCRecord.id] = lightIntBandDBCRecord;
          }
          resolve(lightIntBandDBCFile);
        })
        .catch((error) => {
          reject(error);
        });
    } else {
      resolve(lightIntBandDBCFile);
    }
  });
}
