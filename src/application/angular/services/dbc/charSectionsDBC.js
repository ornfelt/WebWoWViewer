import loadDBC from './../dbcLoader.js';

let charSectionsDBCFile = null;

export default function charSectionsDBC() {
  return new Promise((resolve, reject) => {
    if (charSectionsDBCFile === null) {
      charSectionsDBCFile = [];
      loadDBC("DBFilesClient/CharSections.dbc")
        .then((dbcObject) => {
          for (let i = 0; i < dbcObject.getRowCount(); i++) {
            const record = {};

            const id = dbcObject.readInt32(i, 0);
            record.race     = dbcObject.readInt32(i, 1);
            record.gender   = dbcObject.readInt32(i, 2);
            record.section  = dbcObject.readInt32(i, 3);
            record.texture1 = dbcObject.readText(i, 4);
            record.texture2 = dbcObject.readText(i, 5);
            record.texture3 = dbcObject.readText(i, 6);
            record.unk      = dbcObject.readInt32(i, 7);
            record.type     = dbcObject.readInt32(i, 8);
            record.color    = dbcObject.readInt32(i, 9);

            charSectionsDBCFile[i] = record;
          }
          resolve(charSectionsDBCFile);
        })
        .catch((error) => {
          reject(error);
        });
    } else {
      resolve(charSectionsDBCFile);
    }
  });
}
