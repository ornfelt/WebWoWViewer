import loadDBC from './../dbcLoader';

export interface LightIntBandRecord {
  id: number;
  noOfEntries: number;
  times: number[];
  values: number[];
  floatValues: [number, number, number, number][];
}

let lightIntBandDBCFile: LightIntBandRecord[] | null = null;

export default function LightIntBandDBC(): Promise<LightIntBandRecord[]> {
  return new Promise((resolve, reject) => {
    if (lightIntBandDBCFile === null) {
      lightIntBandDBCFile = [];
      loadDBC("DBFilesClient/LightIntBand.dbc")
        .then((dbcObject) => {
          for (let i = 0; i < dbcObject.getRowCount(); i++) {
            const lightIntBandDBCRecord = {} as LightIntBandRecord;
            lightIntBandDBCRecord.id = dbcObject.readInt32(i, 0);
            lightIntBandDBCRecord.noOfEntries = dbcObject.readInt32(i, 1);
            lightIntBandDBCRecord.times = [];
            for (let j = 0; j < lightIntBandDBCRecord.noOfEntries; j++) {
              // JS-BUG: times start at column 1 (noOfEntries), so times[0] is the entry count and every time is shifted by one (probably should be 2 + j)
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
            lightIntBandDBCFile![lightIntBandDBCRecord.id] = lightIntBandDBCRecord;
          }
          resolve(lightIntBandDBCFile!);
        })
        .catch((error) => {
          reject(error);
        });
    } else {
      resolve(lightIntBandDBCFile);
    }
  });
}
