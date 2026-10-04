import loadDBC from './../dbcLoader.js';

let creatureDisplayInfoExtraDBCFile = null;

export default function creatureDisplayInfoExtraDBC() {
  return new Promise((resolve, reject) => {
    if (creatureDisplayInfoExtraDBCFile === null) {
      creatureDisplayInfoExtraDBCFile = {};
      loadDBC("DBFilesClient/CreatureDisplayInfoExtra.dbc")
        .then((dbcObject) => {
          for (let i = 0; i < dbcObject.getRowCount(); i++) {
            const record = {};
            const id = dbcObject.readInt32(i, 0);

            record.race          = dbcObject.readInt32(i, 1);
            record.gender        = dbcObject.readInt32(i, 2);
            record.skin          = dbcObject.readInt32(i, 3);
            record.face          = dbcObject.readInt32(i, 4);
            record.hairType      = dbcObject.readInt32(i, 5);
            record.hairStyle     = dbcObject.readInt32(i, 6);
            record.faceHairStyle = dbcObject.readInt32(i, 7);
            record.helmItem      = dbcObject.readInt32(i, 8);
            record.shoulderItem  = dbcObject.readInt32(i, 9);
            record.shirtItem     = dbcObject.readInt32(i, 10);
            record.cuirassItem   = dbcObject.readInt32(i, 11);
            record.beltItem      = dbcObject.readInt32(i, 12);
            record.legsItem      = dbcObject.readInt32(i, 13);
            record.bootsItem     = dbcObject.readInt32(i, 14);
            record.wristItem     = dbcObject.readInt32(i, 15);
            record.glovesItem    = dbcObject.readInt32(i, 16);
            record.tabardItem    = dbcObject.readInt32(i, 17);
            record.capeItem      = dbcObject.readInt32(i, 18);
            record.CanEquip      = dbcObject.readInt32(i, 19);
            record.skinTexture   = dbcObject.readText(i, 20);

            creatureDisplayInfoExtraDBCFile[id] = record;
          }
          resolve(creatureDisplayInfoExtraDBCFile);
        })
        .catch((error) => {
          reject(error);
        });
    } else {
      resolve(creatureDisplayInfoExtraDBCFile);
    }
  });
}
