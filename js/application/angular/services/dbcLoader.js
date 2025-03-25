import fileLoader from './fileLoader.js';
import fileReadHelper from './fileReadHelper.js';

export default function (dbcFilePath) {
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

        function calcOffset(row, col) {
          const offs = dbcHeaderLen + row * (colCount * 4) + col * 4;
          return { offs };
        }
        function getTextOffset(row, col) {
          const offs = calcOffset(row, col);
          const textOffs = fileReader.readUint32(offs);
          const result = textSectionStart + textOffs;
          return { offs: result };
        }

        const dbcObject = {
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
