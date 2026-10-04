import loadDBC from './../dbcLoader';

export interface LightFloatBandRecord {
  id: number;
  noOfEntries: number;
  times: number[];
  values: number[];
}

let lightFloatBandDBCFile: LightFloatBandRecord[] | null = null;

export default function LightFloatBandDBC(): Promise<LightFloatBandRecord[]> {
  return new Promise((resolve, reject) => {
    if (lightFloatBandDBCFile === null) {
      lightFloatBandDBCFile = [];
      loadDBC("DBFilesClient/LightFloatBand.dbc")
        .then((dbcObject) => {
          for (let i = 0; i < dbcObject.getRowCount(); i++) {
            const lightFloatBandDBCRecord = {} as LightFloatBandRecord;

            lightFloatBandDBCRecord.id = dbcObject.readInt32(i, 0);
            lightFloatBandDBCRecord.noOfEntries = dbcObject.readInt32(i, 1);
            lightFloatBandDBCRecord.times = [];
            for (let j = 0; j < lightFloatBandDBCRecord.noOfEntries; j++) {
              // JS-BUG: times start at column 1 (noOfEntries), so times[0] is the entry count and every time is shifted by one (probably should be 2 + j)
              lightFloatBandDBCRecord.times.push(dbcObject.readInt32(i, 1 + j));
            }

            lightFloatBandDBCRecord.values = [];
            for (let j = 0; j < lightFloatBandDBCRecord.noOfEntries; j++) {
              lightFloatBandDBCRecord.values.push(dbcObject.readFloat32(i, 18 + j));
            }

            lightFloatBandDBCFile![lightFloatBandDBCRecord.id] = lightFloatBandDBCRecord;
          }
          resolve(lightFloatBandDBCFile!);
        })
        .catch((error) => {
          reject(error);
        });
    } else {
      resolve(lightFloatBandDBCFile);
    }
  });
}
