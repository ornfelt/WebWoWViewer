import loadDBC from './../dbcLoader';

export interface ItemRecord {
  displayId: number;
}

let itemDBCFile: { [id: number]: ItemRecord } | null = null;

export default function itemDBC(): Promise<{ [id: number]: ItemRecord }> {
  return new Promise((resolve, reject) => {
    if (itemDBCFile === null) {
      itemDBCFile = {};
      loadDBC("DBFilesClient/Item.dbc")
        .then((dbcObject) => {
          for (let i = 0; i < dbcObject.getRowCount(); i++) {
            const record = {} as ItemRecord;
            const id = dbcObject.readInt32(i, 0);
            record.displayId = dbcObject.readInt32(i, 5);
            itemDBCFile![id] = record;
          }
          resolve(itemDBCFile!);
        })
        .catch((error) => {
          reject(error);
        });
    } else {
      resolve(itemDBCFile);
    }
  });
}
