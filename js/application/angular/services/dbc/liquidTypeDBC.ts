import loadDBC from './../dbcLoader';

/* LiquidType.dbc (WotLK 3.3.5 layout) - only the fields the liquids use */
export interface LiquidTypeRecord {
  id: number;
  name: string;
  flags: number;
  /* liquid class: 0 water, 1 ocean, 2 magma, 3 slime */
  type: number;
  /* the first texture, with %d for the frame number (e.g. XTextures\river\lake_a.%d.blp) */
  texture: string;
}

let liquidTypeDBCFile: { [id: number]: LiquidTypeRecord } | null = null;

export default function liquidTypeDBC(): Promise<{ [id: number]: LiquidTypeRecord }> {
  return new Promise((resolve, reject) => {
    if (liquidTypeDBCFile === null) {
      liquidTypeDBCFile = {};
      loadDBC("DBFilesClient/LiquidType.dbc")
        .then((dbcObject) => {
          for (let i = 0; i < dbcObject.getRowCount(); i++) {
            const liquidTypeDBCRecord = {} as LiquidTypeRecord;

            liquidTypeDBCRecord.id      = dbcObject.readInt32(i, 0);
            liquidTypeDBCRecord.name    = dbcObject.readText(i, 1);
            liquidTypeDBCRecord.flags   = dbcObject.readInt32(i, 2);
            liquidTypeDBCRecord.type    = dbcObject.readInt32(i, 3);
            liquidTypeDBCRecord.texture = dbcObject.readText(i, 15);

            liquidTypeDBCFile![liquidTypeDBCRecord.id] = liquidTypeDBCRecord;
          }
          resolve(liquidTypeDBCFile!);
        })
        .catch((error) => {
          reject(error);
        });
    } else {
      resolve(liquidTypeDBCFile);
    }
  });
}
