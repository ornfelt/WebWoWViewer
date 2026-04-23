import { initViewer } from './directives/wowJsRenderDirective_noangular';
import Expansion from './Expansion';

// Example usage:
// npm run start
// npm run server
// or:
// npm run build
// or:
// npm run build:prod
// Note: Also start wow mpq file server...

// Extend the Window interface to include the custom property.
declare global {
  interface Window {
    //selectedExpansion: typeof Expansion.WOTLK;
    selectedExpansion: typeof Expansion[keyof typeof Expansion];
  }
}

// Set a default expansion value.
window.selectedExpansion = Expansion.WOTLK;
let expansionLoaded: boolean = false;

// Determine the expansion first.
(async () => {
  try {
    const url: string = "http://localhost:3002/files/exp.txt";
    const response: Response = await fetch(url);
    if (response.ok) {
      const text: string = (await response.text()).trim().toLowerCase();
      if (text === "classic") {
        window.selectedExpansion = Expansion.CLASSIC;
      } else if (text === "tbc") {
        window.selectedExpansion = Expansion.TBC;
      } else {
        window.selectedExpansion = Expansion.WOTLK;
      }
    } else {
      console.error("Error fetching exp.txt:", response.statusText);
    }
  } catch (error: unknown) {
    console.error("Error during fetch:", error);
  } finally {
    console.log("selectedExpansion:", window.selectedExpansion);
    expansionLoaded = true;
  }
})();

// Returns a Promise that resolves once the expansion is loaded.
function waitForExpansion(): Promise<void> {
  return new Promise(resolve => {
    const check = () => {
      if (expansionLoaded) {
        resolve();
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  });
}

// Entry point.
window.onload = async () => {
  await waitForExpansion(); // Wait until the expansion has been set

  const container: HTMLElement | null = document.getElementById('viewer-container');
  if (!container) {
    console.error("Viewer container not found!");
    return;
  }
  initViewer(container);
};

