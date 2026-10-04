import loadDBC from './../dbcLoader';

export interface CharHairGeosetsRecord {
  race: number;
  gender: number;
  hairStyle: number;
  geoset: number;
  unk: number;
}

let charHairGeosetsDBCFile: CharHairGeosetsRecord[] | null = null;

// JS-BUG: default export is named characterFacialHairStylesDBC (copy-paste from that module); harmless, importers pick their own name
export default function characterFacialHairStylesDBC(): Promise<CharHairGeosetsRecord[]> {
  return new Promise((resolve, reject) => {
    if (charHairGeosetsDBCFile === null) {
      charHairGeosetsDBCFile = [];
      loadDBC("DBFilesClient/CharHairGeosets.dbc")
        .then((dbcObject) => {
          for (let i = 0; i < dbcObject.getRowCount(); i++) {
            const record = {} as CharHairGeosetsRecord;

            const id = dbcObject.readInt32(i, 0);
            record.race      = dbcObject.readInt32(i, 1);
            record.gender    = dbcObject.readInt32(i, 2);
            record.hairStyle = dbcObject.readInt32(i, 3);
            record.geoset    = dbcObject.readInt32(i, 4);
            record.unk       = dbcObject.readInt32(i, 5);

            charHairGeosetsDBCFile![i] = record;
          }
          resolve(charHairGeosetsDBCFile!);
        })
        .catch((error) => {
          reject(error);
        });
    } else {
      resolve(charHairGeosetsDBCFile);
    }
  });
}
