import loadDBC from './../dbcLoader';

export interface LightParamsRecord {
  id: number;
  highlightSky: number;
  lightSkyboxID: number;
  cloudTypeID: number;
  glow: number;
  waterShallowAlpha: number;
  waterDeepAlpha: number;
  oceanShallowAlpha: number;
  oceanDeepAlpha: number;
}

let lightParamsDBCFile: LightParamsRecord[] | null = null;

export default function lightParamsDBC(): Promise<LightParamsRecord[]> {
  return new Promise((resolve, reject) => {
    if (lightParamsDBCFile === null) {
      lightParamsDBCFile = [];
      loadDBC("DBFilesClient/LightParams.dbc")
        .then((dbcObject) => {
          for (let i = 0; i < dbcObject.getRowCount(); i++) {
            const lightParamsDBCRecord = {} as LightParamsRecord;
            try {
              lightParamsDBCRecord.id = dbcObject.readInt32(i, 0);
              lightParamsDBCRecord.highlightSky = dbcObject.readInt32(i, 1);
              // integer ids (they were read as floats, which turned them into tiny denormals)
              lightParamsDBCRecord.lightSkyboxID = dbcObject.readInt32(i, 2);
              lightParamsDBCRecord.cloudTypeID = dbcObject.readInt32(i, 3);
              lightParamsDBCRecord.glow = dbcObject.readFloat32(i, 4);
              lightParamsDBCRecord.waterShallowAlpha = dbcObject.readFloat32(i, 5);
              lightParamsDBCRecord.waterDeepAlpha = dbcObject.readFloat32(i, 6);
              lightParamsDBCRecord.oceanShallowAlpha = dbcObject.readFloat32(i, 7);
              lightParamsDBCRecord.oceanDeepAlpha = dbcObject.readFloat32(i, 8);
              // Optionally: lightParamsDBCRecord.flags = dbcObject.readInt32(i, 9);
              lightParamsDBCFile![lightParamsDBCRecord.id] = lightParamsDBCRecord;
            } catch (e) {
              console.log(e);
            }
          }
          resolve(lightParamsDBCFile!);
        })
        .catch((error) => {
          reject(error);
        });
    } else {
      resolve(lightParamsDBCFile);
    }
  });
}
