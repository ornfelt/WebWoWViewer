// The preset scenes initViewer() can load, as in my_web_wow's MapKey.cs / MapParams.cs / MapParamsRepository.cs

const MapKey = {
  // Azeroth (Eastern Kingdoms)
  DarkshireMap: "DarkshireMap",
  StvMap: "StvMap",
  ForsakenStartMap: "ForsakenStartMap",

  // Kalimdor
  CavernsOfTimeMap: "CavernsOfTimeMap",
  OrgrimmarMap: "OrgrimmarMap",
  DarnassusMap: "DarnassusMap",

  // TBC
  HellfireMap: "HellfireMap",
  ShattrathMap: "ShattrathMap",
  NagrandMap: "NagrandMap",
  BelfMap: "BelfMap",
  DraeneiMap: "DraeneiMap",

  // WOTLK
  DragonblightMap: "DragonblightMap",
  SholazarMap: "SholazarMap",

  // PVP
  AlteracValleyMap: "AlteracValleyMap",
  WarsongGulchMap: "WarsongGulchMap",
  ArathiBasinMap: "ArathiBasinMap",
  EyeOfTheStormMap: "EyeOfTheStormMap",
  StrandOfTheAncientsMap: "StrandOfTheAncientsMap",

  // M2
  RagnarosM2: "RagnarosM2",
  DrakeM2: "DrakeM2",
  VanillaOpeningScreenM2: "VanillaOpeningScreenM2",
  // WOTLK
  PenguinM2: "PenguinM2",
  LichKingM2: "LichKingM2",

  // Static
  ElwynForestTreeM2: "ElwynForestTreeM2",
  WintertreeM2: "WintertreeM2",

  // Spells
  FireballM2: "FireballM2",

  // Arena
  NagrandArena: "NagrandArena",
  BladesEdgeArena: "BladesEdgeArena",

  // Other
  BlackTemple: "BlackTemple",
  HillsbradPast: "HillsbradPast",
  ZulAman: "ZulAman",

  // WMO
  DarkshireBlacksmithWMO: "DarkshireBlacksmithWMO",
  LordaeronArenaWMO: "LordaeronArenaWMO",
};

/* The keys in the groups of MapKey.cs, for the map selection in the settings panel */
const mapKeyGroups = [
  { label: 'Azeroth (Eastern Kingdoms)', keys: [MapKey.DarkshireMap, MapKey.StvMap, MapKey.ForsakenStartMap] },
  { label: 'Kalimdor', keys: [MapKey.CavernsOfTimeMap, MapKey.OrgrimmarMap, MapKey.DarnassusMap] },
  { label: 'TBC', keys: [MapKey.HellfireMap, MapKey.ShattrathMap, MapKey.NagrandMap, MapKey.BelfMap, MapKey.DraeneiMap] },
  { label: 'WOTLK', keys: [MapKey.DragonblightMap, MapKey.SholazarMap] },
  { label: 'PVP', keys: [MapKey.AlteracValleyMap, MapKey.WarsongGulchMap, MapKey.ArathiBasinMap, MapKey.EyeOfTheStormMap, MapKey.StrandOfTheAncientsMap] },
  { label: 'M2', keys: [MapKey.RagnarosM2, MapKey.DrakeM2, MapKey.VanillaOpeningScreenM2, MapKey.PenguinM2, MapKey.LichKingM2] },
  { label: 'Static', keys: [MapKey.ElwynForestTreeM2, MapKey.WintertreeM2] },
  { label: 'Spells', keys: [MapKey.FireballM2] },
  { label: 'Arena', keys: [MapKey.NagrandArena, MapKey.BladesEdgeArena] },
  { label: 'Other', keys: [MapKey.BlackTemple, MapKey.HillsbradPast, MapKey.ZulAman] },
  { label: 'WMO', keys: [MapKey.DarkshireBlacksmithWMO, MapKey.LordaeronArenaWMO] },
];

const maps = {
  // Azeroth (Eastern Kingdoms)
  [MapKey.DarkshireMap]: {
    name: 'Darkshire',
    source: 'http',
    sceneType: 'map',
    mapId: 0,
    mapName: 'Azeroth',
    x: -10559.7, y: -1189.02, z: 29.0698
  },
  [MapKey.StvMap]: {
    name: 'stv',
    source: 'http',
    sceneType: 'map',
    mapId: 0,
    mapName: 'Azeroth',
    x: -13325.42, y: 110.50, z: 54.79
  },
  [MapKey.ForsakenStartMap]: {
    name: 'Forsaken start',
    source: 'http',
    sceneType: 'map',
    mapId: 0,
    mapName: 'Azeroth',
    x: 2000.0, y: 1600.0, z: 137.0
  },

  // Kalimdor
  [MapKey.CavernsOfTimeMap]: {
    name: 'Caverns of Time',
    source: 'http',
    sceneType: 'map',
    mapId: 1,
    mapName: 'Kalimdor',
    x: -8181.35, y: -4596.92, z: -125.34
  },
  [MapKey.OrgrimmarMap]: {
    name: 'Orgrimmar',
    source: 'http',
    sceneType: 'map',
    mapId: 1,
    mapName: 'Kalimdor',
    x: 1096.1, y: -4549.0, z: 135.0
  },
  [MapKey.DarnassusMap]: {
    name: 'Darnassus',
    source: 'http',
    sceneType: 'map',
    mapId: 1,
    mapName: 'Kalimdor',
    x: 9797.1, y: 2529.0, z: 1331.0
  },

  // TBC
  [MapKey.HellfireMap]: {
    name: 'Hellfire Citadel',
    source: 'http',
    sceneType: 'map',
    mapId: 530,
    mapName: 'Expansion01',
    x: -170.0, y: 1344.0, z: 108.0
  },
  [MapKey.ShattrathMap]: {
    name: 'Shattrath city',
    source: 'http',
    sceneType: 'map',
    mapId: 530,
    mapName: 'Expansion01',
    x: -1663, y: 5098, z: 27
  },
  [MapKey.NagrandMap]: {
    name: 'Nagrand',
    source: 'http',
    sceneType: 'map',
    mapId: 530,
    mapName: 'Expansion01',
    x: -743, y: 8385, z: 33
  },
  [MapKey.BelfMap]: {
    name: "Eversong woods / Silvermoon city / Quel'Thalas",
    source: 'http',
    sceneType: 'map',
    mapId: 530,
    mapName: 'Expansion01',
    x: 9466, y: -6622, z: 196
  },
  [MapKey.DraeneiMap]: {
    name: 'Azuremyst isle / Exodar city',
    source: 'http',
    sceneType: 'map',
    mapId: 530,
    mapName: 'Expansion01',
    x: -4044, y: -12500, z: 142
  },

  // WOTLK
  [MapKey.DragonblightMap]: {
    name: 'Northrend Dragonblight',
    source: 'http',
    sceneType: 'map',
    mapId: 571,
    mapName: 'Northrend',
    x: 4134.04, y: 1029.00, z: 148.33
  },
  [MapKey.SholazarMap]: {
    name: 'Northrend Sholazar',
    source: 'http',
    sceneType: 'map',
    mapId: 571,
    mapName: 'Northrend',
    x: 5307.26, y: 5606.34, z: -77.70
  },

  // PVP
  [MapKey.AlteracValleyMap]: {
    name: 'AV',
    source: 'http',
    sceneType: 'map',
    mapId: 30,
    mapName: 'PVPZone01',
    //x: -531, y: 0, z: 267
    x: 275, y: -235, z: 53 // Water
  },
  [MapKey.WarsongGulchMap]: {
    name: 'WSG',
    source: 'http',
    sceneType: 'map',
    mapId: 489,
    mapName: 'PVPZone03',
    x: 1101, y: 1313, z: 568
  },
  [MapKey.ArathiBasinMap]: {
    name: 'AB',
    source: 'http',
    sceneType: 'map',
    mapId: 529,
    mapName: 'PVPZone04',
    x: 1177, y: 841, z: 176
  },
  [MapKey.EyeOfTheStormMap]: {
    name: 'Eye of Storm',
    source: 'http',
    sceneType: 'map',
    mapId: 566,
    mapName: 'NetherstormBG',
    x: 2110, y: 1489, z: 1474
  },
  [MapKey.StrandOfTheAncientsMap]: {
    name: 'Strand of the Ancients',
    source: 'http',
    sceneType: 'map',
    mapId: 607,
    mapName: 'northrendbg',
    x: 1083.13, y: -139.93, z: 146.22
  },

  // M2
  [MapKey.RagnarosM2]: {
    name: 'ragnaros',
    source: 'http',
    sceneType: 'm2',
    modelName: 'creature\\ragnaros\\ragnaros.m2'
  },
  [MapKey.DrakeM2]: {
    name: 'drake',
    source: 'http',
    sceneType: 'm2',
    modelName: 'creature\\drake\\drake.mdx'
  },
  [MapKey.VanillaOpeningScreenM2]: {
    name: 'Vanilla Opening screen',
    source: 'http',
    sceneType: 'm2',
    modelName: 'Interface\\GLUES\\MODELS\\UI_MAINMENU\\UI_MainMenu.m2'
    //cameraIndex: 0,
    //fogStart: 0,
    //fogEnd: 1200,
    //fogColor: [0.25, 0.06, 0.015]
  },
  [MapKey.PenguinM2]: {
    name: 'Penguin',
    source: 'http',
    sceneType: 'm2',
    modelName: 'creature/northrendpenguin/northrendpenguin.m2',
    chosenModelIndex: 4
    //cameraIndex: 0
  },
  [MapKey.LichKingM2]: {
    name: 'LichKing',
    source: 'http',
    sceneType: 'm2',
    modelName: 'arthaslichking',
    chosenModelIndex: 0
  },

  // Static
  [MapKey.ElwynForestTreeM2]: {
    name: 'elwyn forest tree',
    source: 'http',
    sceneType: 'm2',
    modelName: 'world\\azeroth\\elwynn\\passivedoodads\\trees\\elwynntreecanopy03.m2'
  },
  [MapKey.WintertreeM2]: {
    name: 'wintertree02',
    source: 'http',
    sceneType: 'm2',
    modelName: 'world\\khazmodan\\ironforge\\passivedoodads\\trees\\wintertree02.m2'
  },

  // Spells
  [MapKey.FireballM2]: {
    name: 'Test fireball',
    source: 'http',
    sceneType: 'm2',
    modelName: 'spells\\fireball_missile_low.m2'
  },

  // Arena
  [MapKey.NagrandArena]: {
    name: 'Nagrand arena',
    source: 'http',
    sceneType: 'map',
    mapId: 559,
    mapName: 'PVPZone05',
    x: 4084.11, y: 2869.94, z: 12.1
  },
  [MapKey.BladesEdgeArena]: {
    name: "Blade's Edge arena",
    source: 'http',
    sceneType: 'map',
    mapId: 562,
    mapName: 'bladesedgearena',
    x: 6257.0, y: 452.0, z: 293.1
  },

  // Other maps
  [MapKey.BlackTemple]: {
    name: 'Black temple',
    source: 'http',
    sceneType: 'map',
    mapId: 564,
    mapName: 'blacktemple',
    x: 685.1, y: 882.1, z: 275.1
  },
  [MapKey.HillsbradPast]: {
    name: 'HillsbradPast',
    source: 'http',
    sceneType: 'map',
    mapId: 560,
    mapName: 'hillsbradpast',
    x: 1064.0, y: -11.0, z: 285.1
  },
  [MapKey.ZulAman]: {
    name: 'ZulAman',
    source: 'http',
    sceneType: 'map',
    mapId: 568,
    mapName: 'zulaman',
    x: 222.0, y: 1777.0, z: 257.1
  },

  // WMO
  [MapKey.DarkshireBlacksmithWMO]: {
    name: 'Darkshire blacksmith',
    source: 'http',
    sceneType: 'wmo',
    fileName: 'WORLD\\WMO\\AZEROTH\\BUILDINGS\\DUSKWOOD_BLACKSMITH\\DUSKWOOD_BLACKSMITH.WMO'
  },
  [MapKey.LordaeronArenaWMO]: {
    name: 'arena wmo',
    source: 'http',
    sceneType: 'wmo',
    fileName: 'world\\wmo\\pvp\\buildings\\lordaeron\\pvp_lordaeron_arena.wmo'
    //fileName: 'world\\wmo\\pvp\\buildings\\ancientorcarena\\ancorc_pvpstadium.wmo' // Nagrand arena!
    //fileName: 'world\\wmo\\dungeon\\ol_ogrehuts\\pvp_ogre_arena01.wmo'
    //fileName: 'world\\wmo\\azeroth\\collidable doodads\\stranglethorn\\stranglethornarena\\stranglegladiatorarena.wmo'
    // wotlk+ arenas
    //fileName: 'world\\wmo\\pvp\\buildings\\dalaran\\dalaran_sewer_arena.wmo'
    //fileName: 'world\\wmo\\pvp\\buildings\\orgrimmar\\orgrimmararena.wmo'
  },
};

export { MapKey, mapKeyGroups };

export default {
  get: function (key) {
    return maps[key];
  },
  /* the key whose name matches value, ignoring case, or undefined */
  findKey: function (value) {
    const lower = value.trim().toLowerCase();
    return Object.values(MapKey).find(key => key.toLowerCase() === lower);
  },
};
