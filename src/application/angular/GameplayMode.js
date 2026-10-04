// The gameplay modes, as in my_web_wow's GameplayMode.cs. Only FreeRoam, Wander, SpellMap and CreatureMap
// are implemented in the web version so far.
const GameplayMode = {
  FreeRoam: "FreeRoam",
  Wander: "Wander",
  FreeForAll: "FreeForAll",
  Deathmatch: "Deathmatch",
  SpellMap: "SpellMap",
  CreatureMap: "CreatureMap",
  Dungeon: "Dungeon",      // Not implemented
  RealWorld: "RealWorld"   // Not implemented
};

export const implementedGameplayModes = [GameplayMode.FreeRoam, GameplayMode.Wander, GameplayMode.SpellMap, GameplayMode.CreatureMap];

// A mode from its name (any case) or the short names my_web_wow's --mode takes; undefined if unknown
export function parseGameplayMode(raw) {
  const name = raw.trim().toLowerCase();
  switch (name) {
    case "free": return GameplayMode.FreeRoam;
    case "creature": return GameplayMode.CreatureMap;
    case "spell": return GameplayMode.SpellMap;
  }
  return Object.values(GameplayMode).find((mode) => mode.toLowerCase() === name);
}

export default GameplayMode;
