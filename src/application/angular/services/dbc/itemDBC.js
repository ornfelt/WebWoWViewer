import loadDBC from './../dbcLoader.js';

let itemDBCFile = null;

export default function itemDBC() {
  return new Promise((resolve, reject) => {
    if (itemDBCFile === null) {
      itemDBCFile = {};
      loadDBC("DBFilesClient/Item.dbc")
        .then((dbcObject) => {
          // The layout differs per expansion:
          //   TBC   (4 fields): ID, DisplayInfoID, InventoryType, SheatheType
          //   WotLK (8 fields): ID, ClassID, SubclassID, SoundOverrideSubclassID,
          //                     Material, DisplayInfoID, InventoryType, SheatheType
          const displayIdCol = dbcObject.getColCount() >= 8 ? 5 : 1;
          for (let i = 0; i < dbcObject.getRowCount(); i++) {
            const record = {};
            const id = dbcObject.readInt32(i, 0);
            record.displayId = dbcObject.readInt32(i, displayIdCol);
            itemDBCFile[id] = record;
          }
          resolve(itemDBCFile);
        })
        .catch((error) => {
          reject(error);
        });
    } else {
      resolve(itemDBCFile);
    }
  });
}
