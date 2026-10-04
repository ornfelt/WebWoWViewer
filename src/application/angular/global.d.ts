import type { ExpansionValue } from './Expansion';

// Extend the Window interface to include the custom properties.
declare global {
  interface Window {
    //selectedExpansion: typeof Expansion.WOTLK;
    selectedExpansion: ExpansionValue;
    // Debug hook, set from the browser console: texture indices of the M2 meshes to draw
    meshestoBeRendered: { [texUnit1TexIndex: number]: boolean } | undefined;
  }
}

export {};
