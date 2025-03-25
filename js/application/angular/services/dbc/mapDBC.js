import loadDBC from './../dbcLoader.js';

let mapDBCFile = null;

export default function mapDBC() {
  return new Promise((resolve, reject) => {
    if (mapDBCFile === null) {
      mapDBCFile = {};
      loadDBC("DBFilesClient/Map.dbc")
        .then((dbcObject) => {
          for (let i = 0; i < dbcObject.getRowCount(); i++) {
            const mapDBCRecord = {};
            mapDBCRecord.id = dbcObject.readInt32(i, 0);
            mapDBCRecord.wdtName = dbcObject.readText(i, 1);
            mapDBCRecord.mapName = dbcObject.readText(i, 5);
            mapDBCFile[mapDBCRecord.id] = mapDBCRecord;
          }
          resolve(mapDBCFile);
        })
        .catch((error) => {
          reject(error);
        });
    } else {
      resolve(mapDBCFile);
    }
  });
}
