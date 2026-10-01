import loadDBC from './../dbcLoader.js';

let liquidTypeDBCFile = null;

export default function liquidTypeDBC() {
  return new Promise((resolve, reject) => {
    if (liquidTypeDBCFile === null) {
      liquidTypeDBCFile = {};
      loadDBC("DBFilesClient/LiquidType.dbc")
        .then((dbcObject) => {
          for (let i = 0; i < dbcObject.getRowCount(); i++) {
            const liquidTypeDBCRecord = {};

            liquidTypeDBCRecord.id      = dbcObject.readInt32(i, 0);
            liquidTypeDBCRecord.name    = dbcObject.readText(i, 1);
            liquidTypeDBCRecord.flags   = dbcObject.readInt32(i, 2);
            liquidTypeDBCRecord.type    = dbcObject.readInt32(i, 3);
            liquidTypeDBCRecord.texture = dbcObject.readText(i, 15);

            liquidTypeDBCFile[liquidTypeDBCRecord.id] = liquidTypeDBCRecord;
          }
          resolve(liquidTypeDBCFile);
        })
        .catch((error) => {
          reject(error);
        });
    } else {
      resolve(liquidTypeDBCFile);
    }
  });
}
