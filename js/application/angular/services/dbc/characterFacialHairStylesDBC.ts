import loadDBC from './../dbcLoader';

export interface CharacterFacialHairStylesRecord {
  race: number;
  gender: number;
  hairStyle: number;
  geoset: number[];
}

let characterFacialHairStylesDBCFile: CharacterFacialHairStylesRecord[] | null = null;

export default function characterFacialHairStylesDBC(): Promise<CharacterFacialHairStylesRecord[]> {
  return new Promise((resolve, reject) => {
    if (characterFacialHairStylesDBCFile === null) {
      characterFacialHairStylesDBCFile = [];
      loadDBC("DBFilesClient/CharacterFacialHairStyles.dbc")
        .then((dbcObject) => {
          for (let i = 0; i < dbcObject.getRowCount(); i++) {
            const record = {} as CharacterFacialHairStylesRecord;
            record.race      = dbcObject.readInt32(i, 0);
            record.gender    = dbcObject.readInt32(i, 1);
            record.hairStyle = dbcObject.readInt32(i, 2);
            record.geoset  = [];
            for (let j = 0; j < 5; j++) {
              record.geoset[j] = dbcObject.readInt32(i, 3 + j);
            }
            characterFacialHairStylesDBCFile![i] = record;
          }
          resolve(characterFacialHairStylesDBCFile!);
        })
        .catch((error) => {
          reject(error);
        });
    } else {
      resolve(characterFacialHairStylesDBCFile);
    }
  });
}
