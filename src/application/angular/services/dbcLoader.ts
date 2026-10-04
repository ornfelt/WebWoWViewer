import fileLoader from './fileLoader';
import fileReadHelper from './fileReadHelper';
import type { FileOffset } from './fileReadHelper';

export interface DbcObject {
  fileSize: number;
  getRowCount(): number;
  getColCount(): number;
  getRowSize(): number;
  readInt32(row: number, col: number): number;
  readFloat32(row: number, col: number): number;
  readUInt32(row: number, col: number): number;
  readText(row: number, col: number): string;
}

export default function (dbcFilePath: string): Promise<DbcObject> {
  const dbcHeaderLen = 20;

  return new Promise((resolve, reject) => {
    fileLoader(dbcFilePath)
      .then((a) => {
        const fileReader = fileReadHelper(a);
        const offset = { offs: 0 };

        const dbcIdent = fileReader.readString(offset, 4);

        const rowCount = fileReader.readInt32(offset);
        const colCount = fileReader.readInt32(offset);
        const rowSize  = fileReader.readInt32(offset);
        const textSize = fileReader.readInt32(offset);

        const textSectionStart = dbcHeaderLen + rowCount * (colCount * 4);

        function calcOffset(row: number, col: number): FileOffset {
          const offs = dbcHeaderLen + row * (colCount * 4) + col * 4;
          return { offs };
        }
        function getTextOffset(row: number, col: number): FileOffset {
          const offs = calcOffset(row, col);
          const textOffs = fileReader.readUint32(offs);
          const result = textSectionStart + textOffs;
          return { offs: result };
        }

        const dbcObject: DbcObject = {
          fileSize    : a.byteLength,
          getRowCount : () => rowCount,
          getColCount : () => colCount,
          getRowSize  : () => rowSize,
          readInt32   : (row, col) => fileReader.readInt32(calcOffset(row, col)),
          readFloat32 : (row, col) => fileReader.readFloat32(calcOffset(row, col)),
          readUInt32  : (row, col) => fileReader.readUint32(calcOffset(row, col)),
          readText    : (row, col) => fileReader.readString(getTextOffset(row, col), textSize)
        };

        resolve(dbcObject);
      })
      .catch(() => {
        reject(null);
      });
  });
};
