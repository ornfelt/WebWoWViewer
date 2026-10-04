//const Expansion = {
//  CLASSIC: "classic",
//  TBC: "tbc",
//  WOTLK: "wotlk"
//};
//
//export default Expansion;

// Expansion.ts
const Expansion = {
  CLASSIC: "classic",
  TBC: "tbc",
  WOTLK: "wotlk"
} as const;

export type ExpansionValue = typeof Expansion[keyof typeof Expansion];

export default Expansion;

// Expansion.ts (using enum)
//export enum Expansion {
//  CLASSIC = "classic",
//  TBC = "tbc",
//  WOTLK = "wotlk"
//}
