import loadDBC from './../dbcLoader.js';

let helmetGeosetVisDataDBCFile = null;

export default function helmetGeosetVisDataDBC() {
  return new Promise((resolve, reject) => {
    if (helmetGeosetVisDataDBCFile === null) {
      helmetGeosetVisDataDBCFile = {};
      loadDBC("DBFilesClient/helmetGeosetVisData.dbc")
        .then((dbcObject) => {
          for (let i = 0; i < dbcObject.getRowCount(); i++) {
            const record = {};
            const id = dbcObject.readInt32(i, 0);

            // 0, 100, 200, 300, 700, 1600, 1700, Legion: +2400, 2500
            record.geoset0 = dbcObject.readUInt32(i, 1);
            record.geoset1 = dbcObject.readUInt32(i, 2);
            record.geoset2 = dbcObject.readUInt32(i, 3);
            record.geoset3 = dbcObject.readUInt32(i, 4);
            record.geoset4 = dbcObject.readUInt32(i, 5);
            record.geoset5 = dbcObject.readUInt32(i, 6);
            record.geoset6 = dbcObject.readUInt32(i, 7);

            helmetGeosetVisDataDBCFile[id] = record;
          }
          resolve(helmetGeosetVisDataDBCFile);
        })
        .catch((error) => {
          reject(error);
        });
    } else {
      resolve(helmetGeosetVisDataDBCFile);
    }
  });
}
