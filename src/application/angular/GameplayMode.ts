// The gameplay modes, as in my_web_wow's GameplayMode.cs. Dungeon and RealWorld are not implemented (in
// the C# either).
const GameplayMode = {
  FreeRoam: "FreeRoam",
  Wander: "Wander",
  FreeForAll: "FreeForAll",
  Deathmatch: "Deathmatch",
  SpellMap: "SpellMap",
  CreatureMap: "CreatureMap",
  Dungeon: "Dungeon",      // Not implemented
  RealWorld: "RealWorld"   // Not implemented
} as const;

export type GameplayModeValue = typeof GameplayMode[keyof typeof GameplayMode];

export const implementedGameplayModes: GameplayModeValue[] = [GameplayMode.FreeRoam, GameplayMode.Wander, GameplayMode.FreeForAll, GameplayMode.Deathmatch,
  GameplayMode.SpellMap, GameplayMode.CreatureMap];

// A mode from its name (any case) or the short names my_web_wow's --mode takes; undefined if unknown
export function parseGameplayMode(raw: string): GameplayModeValue | undefined {
  const name = raw.trim().toLowerCase();
  switch (name) {
    case "free": return GameplayMode.FreeRoam;
    case "creature": return GameplayMode.CreatureMap;
    case "spell": return GameplayMode.SpellMap;
  }
  return Object.values(GameplayMode).find((mode) => mode.toLowerCase() === name);
}

export default GameplayMode;
