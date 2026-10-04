import Scene from './../wowRenderJs/scene.js';
import config from './../services/config.js';
import WorldUnit from '../wowRenderJs/objects/worldObjects/worldUnit.js';
import WorldPlayer from '../wowRenderJs/objects/worldObjects/worldPlayer.js';
import {vec3} from 'gl-matrix'
import MathHelper from '../wowRenderJs/math/mathHelper.js';
import CollisionWorld from '../wowRenderJs/collision/collisionWorld.js';
import Expansion from '../Expansion.js';
import GameplayMode, { implementedGameplayModes, parseGameplayMode } from '../GameplayMode.js';
import { SpellType } from '../wowRenderJs/objects/spellDefinitions.js';
import { createNodeDebugger, createSpawnBrowser } from './gameplayPanels.js';
import mapParamsRepository, { MapKey, mapKeyGroups } from '../mapParamsRepository.js';

/**
 * Attach pointer-lock, mouse, keyboard, touch events to the canvas/camera.
 */
function attachEvents(canvas, camera, keyBinds) {
  let mleftPressed = false;
  // right drag (player mode only): orbit + the character turns with the camera
  let mrightPressed = false;
  let lastMouseX = 0, lastMouseY = 0;
  let pointerIsLocked = false;

  // toggle a settings checkbox as if it was clicked, so the config follows it through its change handler
  function toggle(chk, name) {
    chk.click();
    console.log(`${name} = ${chk.checked}`);
  }

  function keyDown(event) {
    if (event.key === 'Shift') {
      camera.setShiftHeld(true);
      return;
    }
    // gameplay / debug keys: spells, targeting, wandering, the node debug drawing and the F7 / F8 windows
    if (keyBinds.gameplayKey(event)) {
      event.preventDefault();
      return;
    }
    // bind F6: toggle the settings panel (instead of the browser's own F6 action)
    if (event.key === 'F6') {
      event.preventDefault();
      keyBinds.settingsPanel.style.display = keyBinds.settingsPanel.style.display === 'none' ? '' : 'none';
      return;
    }
    // bind F1 - F5: toggle the wireframe views (instead of the browser's own F1 - F5 actions)
    switch (event.key) {
      case 'F1': event.preventDefault(); toggle(keyBinds.chkRenderAdtPolygons, 'RenderAdtPolygons'); return;
      case 'F2': event.preventDefault(); toggle(keyBinds.chkRenderLiquidPolygons, 'RenderLiquidPolygons'); return;
      case 'F3': event.preventDefault(); toggle(keyBinds.chkRenderMd2Polygons, 'RenderMd2Polygons'); return;
      case 'F4': event.preventDefault(); toggle(keyBinds.chkRenderWmoPolygons, 'RenderWmoPolygons'); return;
      case 'F5': event.preventDefault(); toggle(keyBinds.chkRenderSkyPolygons, 'RenderSkyPolygons'); return;
    }
    const key = String.fromCharCode(event.keyCode || event.charCode);
    // Space and Tab move the camera, so keep them from scrolling the page / moving the focus
    if (key === ' ' || key === '\t') {
      event.preventDefault();
    }
    switch (key) {
      case 'W': camera.startMovingForward();   break;
      case 'S': camera.startMovingBackwards(); break;
      case 'A': camera.startStrafingLeft();    break;
      case 'D': camera.startStrafingRight();   break;
      //case 'Q':
      // bind space: jump (player mode) or fly up (free roam)
      case ' ':
        if (camera.collisionActive)
          camera.requestJump();
        else
          camera.startMovingUp();
        break;
      //case 'E':
      case '\t': camera.startMovingDown();     break;

      // Rendering toggles
      case 'B': toggle(keyBinds.chkDrawM2, 'RenderM2');           break;
      case 'Z': toggle(keyBinds.chkDrawAdt, 'RenderAdt');         break;
      case 'O': toggle(keyBinds.chkDrawWMO, 'RenderWmo');         break;
      case 'I': toggle(keyBinds.chkDrawWmoBB, 'DrawWmoBB');       break;
      case 'K': toggle(keyBinds.chkDrawDepth, 'DrawDepthBuffer'); break;

      // Experimental
      // bind f: cycle draw distance, through the slider so it shows the new value
      case 'F':
        keyBinds.sliderDrawDistance.value = config.getDrawDistance() === 400 ? '850' : '400';
        keyBinds.sliderDrawDistance.dispatchEvent(new Event('input'));
        break;

      // bind l: toggle RenderLowresTerrain
      case 'L': toggle(keyBinds.chkRenderLowresTerrain, 'RenderLowresTerrain'); break;

      case 'Q': toggle(keyBinds.chkRenderLiquid, 'RenderLiquid'); break;
      case 'E': toggle(keyBinds.chkRenderSky, 'RenderSky');       break;

      // bind c: toggle CycleAnimations
      case 'C': toggle(keyBinds.chkCycleAnimations, 'CycleAnimations'); break;
    }
  }
  function keyUp(event) {
    if (event.key === 'Shift') {
      camera.setShiftHeld(false);
      return;
    }
    const key = String.fromCharCode(event.keyCode || event.charCode);
    switch (key) {
      case 'W': camera.stopMovingForward();   break;
      case 'S': camera.stopMovingBackwards(); break;
      case 'A': camera.stopStrafingLeft();    break;
      case 'D': camera.stopStrafingRight();   break;
      //case 'Q':
      case ' ': camera.stopMovingUp();        break;
      //case 'E':
      case '\t': camera.stopMovingDown();     break;
    }
  }
  // stop all movement, for when the key releases can no longer reach keyUp
  function releaseKeys() {
    camera.stopMovingForward();
    camera.stopMovingBackwards();
    camera.stopStrafingLeft();
    camera.stopStrafingRight();
    camera.stopMovingUp();
    camera.stopMovingDown();
    camera.setShiftHeld(false);
  }

  // left drag: orbit the camera (player mode: around the character, which keeps its facing);
  // right drag (player mode): orbit + the character turns with the camera, as in my_web_wow
  function mouseDown(event) {
    if (event.button === 0) {
      mleftPressed = true;
      camera.freeLook = true; // orbit only, don't turn character
    } else if (event.button === 2 && camera.collisionActive) {
      mrightPressed = true;
      camera.turnWithCamera = true; // character follows camera
    }
    if (mleftPressed || mrightPressed) {
      lastMouseX = event.pageX;
      lastMouseY = event.pageY;
    }
  }
  function mouseUp(event) {
    if (event.button === 0) {
      mleftPressed = false;
      camera.freeLook = false;
    } else if (event.button === 2) {
      mrightPressed = false;
      camera.turnWithCamera = false;
    }
  }
  function mouseMove(event) {
    if (!pointerIsLocked) {
      if (mleftPressed || mrightPressed) {
        camera.addHorizontalViewDir((event.pageX - lastMouseX) / 4.0);
        camera.addVerticalViewDir((event.pageY - lastMouseY) / 4.0);
        lastMouseX = event.pageX;
        lastMouseY = event.pageY;
      }
    } else {
      const deltaX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
      const deltaY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
      camera.addHorizontalViewDir(deltaX / 4.0);
      camera.addVerticalViewDir(deltaY / 4.0);
    }
  }
  function mouseOut() {
    mleftPressed = false;
    mrightPressed = false;
    camera.freeLook = false;
    camera.turnWithCamera = false;
  }

  // pointer lock
  const havePointerLock = (
       'pointerLockElement' in document
    || 'mozPointerLockElement' in document
    || 'webkitPointerLockElement' in document
  );
  if (havePointerLock) {
    canvas.addEventListener('click', () => {
      // the player mode rotates only while dragging, as in my_web_wow
      if (camera.collisionActive) return;
      canvas.requestPointerLock =
        canvas.requestPointerLock ||
        canvas.mozRequestPointerLock ||
        canvas.webkitRequestPointerLock;
      canvas.requestPointerLock();
    });
    const pointerLockCallback = () => {
      pointerIsLocked = (
           document.pointerLockElement === canvas
        || document.mozPointerLockElement === canvas
        || document.webkitPointerLockElement === canvas
      );
    };
    document.addEventListener('pointerlockchange', pointerLockCallback, false);
    document.addEventListener('mozpointerlockchange', pointerLockCallback, false);
    document.addEventListener('webkitpointerlockchange', pointerLockCallback, false);
  }

  // attach mouse
  canvas.addEventListener('mousemove', mouseMove, false);
  canvas.addEventListener('mousedown', mouseDown, false);
  canvas.addEventListener('mouseup', mouseUp, false);
  canvas.addEventListener('mouseout', mouseOut, false);
  // right drag turns the character in player mode, instead of opening the context menu
  canvas.addEventListener('contextmenu', (e) => {
    if (camera.collisionActive) e.preventDefault();
  });

  // bind mouse wheel: zoom, one step per wheel event (scroll up -> zoom in)
  function mouseWheel(event) {
    event.preventDefault();
    camera.zoom(-Math.sign(event.deltaY));
  }
  canvas.addEventListener('wheel', mouseWheel, {passive: false});

  // only move camera if lastDownTarget = canvas
  let lastDownTarget = null;
  document.addEventListener('mousedown', (e) => {
    // the keys held so far are not released through keyUp once the canvas is left
    if (lastDownTarget === canvas && e.target !== canvas) {
      releaseKeys();
    }
    lastDownTarget = e.target;
  });
  document.addEventListener('keydown', (e) => {
    if (lastDownTarget === canvas) {
      keyDown(e);
    }
  });
  document.addEventListener('keyup', (e) => {
    if (lastDownTarget === canvas) {
      keyUp(e);
    }
  });
  // the key releases do not reach the page while the window is not focused
  window.addEventListener('blur', releaseKeys);

  // touch
  let isPitchGoingOn = false;
  function touchStart(e) {
    if (isPitchGoingOn) return;
    mleftPressed = true;
    lastMouseX = e.touches[0].pageX;
    lastMouseY = e.touches[0].pageY;
  }
  function touchMove(e) {
    if (isPitchGoingOn) return;
    const x = e.touches[0].pageX;
    const y = e.touches[0].pageY;
    if (mleftPressed) {
      camera.addHorizontalViewDir((x - lastMouseX) / 4.0);
      camera.addVerticalViewDir((y - lastMouseY) / 4.0);
      lastMouseX = x;
      lastMouseY = y;
    }
  }
  function touchEnd() {
    mleftPressed = false;
  }

  canvas.addEventListener('touchstart', touchStart, false);
  canvas.addEventListener('touchmove', touchMove, false);
  canvas.addEventListener('touchend', touchEnd, false);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a canvas + UI in containerEl, loads Shattrath automatically,
 * attaches events, and starts rendering.
 */
export async function initViewer(containerEl) {
  // Create HTML structure (canvas + simple debug panel)
  containerEl.innerHTML = `
    <div style="width: 100%; height: 100%; position: relative; overflow: hidden; display: flex;">
      <canvas id="wow-canvas" style="flex: none; display:block;"></canvas>

      <div id="settings-panel" style="flex: 1 1 auto; min-width: 0; height: 100%; overflow-y: auto; box-sizing: border-box; padding: 0 10px; color: white;">
        <style>
          #selMap, #selMap optgroup, #selMap option, #selGameplayMode, #selGameplayMode option { background: #222; color: white; }
          #selMap option:disabled, #selGameplayMode option:disabled { color: #777; }
          #settings-panel .settings-section { margin-top: 8px; }
          #settings-panel .settings-section > summary { cursor: pointer; font-weight: bold; margin-bottom: 2px; }
          #settings-panel button { margin-top: 6px; }
        </style>
        <div style="display: flex; align-items: center; gap: 4px;">
          <span style="white-space: nowrap;">map =</span>
          <select id="selMap" style="flex: 1 1 auto; min-width: 0; border: 1px solid #888; border-radius: 2px; padding: 1px 2px;"></select>
        </div>
        <div>expansion = <span id="expansion"></span> | build = <span id="build"></span></div>
        <div style="margin-bottom: 1em;">fps = <span id="fps"></span></div>
        <div>camera (wow) = (<span id="cam-pos"></span>)</div>
        <div>camera (world) = (<span id="cam-pos-world"></span>)</div>
        <div>camera (wc) = (<span id="cam-pos-wc"></span>)</div>
        <div>lookAt = (<span id="cam-look"></span>)</div>
        <div>Group # = <span id="group-num"></span></div>
        <div>BSP Node = <span id="bsp-node"></span></div>

        <details id="secControls" class="settings-section">
          <summary>Controls</summary>
          W - forward, S - backward, A - left, D - right,<br/>
          Space - up (jump in player mode), Tab - down, Shift - faster, Mouse - move camera<br/>
          Player mode: A / D - turn, left drag - orbit, right drag - orbit + turn character<br/>
          B - M2, Z - ADT, O - WMO, I - WMO BB, K - depth,<br/>
          Q - liquid, E - sky, F - draw distance, F6 - hide this panel,<br/>
          L - lowres terrain, C - cycle anims, Wheel - zoom,<br/>
          F1-F5 - wireframe ADT, liquid, M2, WMO, sky<br/>
          Spells (player mode): 1 - Frostbolt, 2 - Ice Lance, 3 - Pyroblast, 4 - Ice Missile,<br/>
          5 - Lightning Bolt, 6 - Blizzard, V - Frost Nova, X - Ice Block, T - cycle target,<br/>
          0 - teleport to target, N - wandering, G - target marker, J - node flag colors,<br/>
          , - wander paths, . - linked nodes / node boxes, Ctrl+. - all node links,<br/>
          F7 - node debugger, F8 - spawn browser
        </details>

        <details id="secRendering" class="settings-section" open>
          <summary>Rendering</summary>
          <label><input type="checkbox" id="chkDrawAdt"> Draw ADT</label><br/>
          <label><input type="checkbox" id="chkDrawM2"> Draw M2</label><br/>
          <label><input type="checkbox" id="chkDrawWMO"> Draw WMO</label><br/>
          <label><input type="checkbox" id="chkRenderSky"> Render Sky</label><br/>
          <label><input type="checkbox" id="chkRenderLiquid"> Render Liquid</label><br/>
          <label><input type="checkbox" id="chkRenderLowresTerrain"> Render Lowres Terrain</label><br/>
          <label><input type="checkbox" id="chkUsePortalCulling"> Portal Culling</label><br/>
          <label title="Random skins for sheep, ogres, wolves, tigers, bears and naked skeletons loaded by model path, for the models loaded afterwards"><input type="checkbox" id="chkUseRandomTextures"> Random Textures</label>
        </details>

        <details id="secWireframe" class="settings-section" open>
          <summary>Wireframe polygons</summary>
          <label><input type="checkbox" id="chkRenderAdtPolygons"> ADT Polygons</label><br/>
          <label><input type="checkbox" id="chkRenderLiquidPolygons"> Liquid Polygons</label><br/>
          <label><input type="checkbox" id="chkRenderMd2Polygons"> M2 Polygons</label><br/>
          <label><input type="checkbox" id="chkRenderWmoPolygons"> WMO Polygons</label><br/>
          <label><input type="checkbox" id="chkRenderSkyPolygons"> Sky Polygons</label>
        </details>

        <details id="secDebug" class="settings-section" open>
          <summary>Bounding boxes / debug</summary>
          <label><input type="checkbox" id="chkDrawPortals"> Draw Portals</label><br/>
          <label><input type="checkbox" id="chkDrawM2BB"> Draw M2 BB</label><br/>
          <label><input type="checkbox" id="chkDrawWmoBB"> Draw WMO BB</label><br/>
          <label><input type="checkbox" id="chkDrawBSP"> Draw BSP</label><br/>
          <label><input type="checkbox" id="chkDrawDepth"> Draw Depth</label>
        </details>

        <details id="secCamera" class="settings-section" open>
          <summary>Camera / animations</summary>
          <label>Draw Distance = <span id="draw-distance"></span><br/>
            <input type="range" id="sliderDrawDistance" min="100" max="2000" step="1"></label><br/>
          <label><input type="radio" name="cameraMode" id="radFreeRoam"> Free roam camera</label><br/>
          <label title="Third-person camera following a character that runs on the map's collision triangles (mpq server collision api)"><input type="radio" name="cameraMode" id="radPlayerCharacter" disabled> Player character</label>
            (collision: <span id="collision-status">loading</span>)<br/>
          <label><input type="checkbox" id="chkCycleAnimations"> Cycle Anims</label><br/>
          <label><input type="checkbox" id="chkDoubleCamera"> Double Camera Debug</label><br/>
          <label><input type="checkbox" id="chkUseSecondCamera" disabled> Use Debug Camera</label><br/>
          <button id="btnCopyDebug">Copy main camera -> debug camera</button>
        </details>

        <details id="secGameplay" class="settings-section" open>
          <summary>Gameplay</summary>
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="white-space: nowrap;">mode =</span>
            <select id="selGameplayMode" title="SpellMap / CreatureMap: spell or creature models at the map's wander nodes (mpq server gameplay api)" style="flex: 1 1 auto; min-width: 0; border: 1px solid #888; border-radius: 2px; padding: 1px 2px;"></select>
          </div>
          <div>spawns = <span id="gameplay-status">-</span></div>
          <div>nodes = <span id="gameplay-nodes">-</span></div>
          <label title="Unit frames, cast bars, numbers and floating combat text"><input type="checkbox" id="chkUseHud"> HUD</label><br/>
          <label title="The Wander mode's bots walk from node to node (N)"><input type="checkbox" id="chkEnableWandering"> Wandering</label><br/>
          <button id="btnNodeDebugger">Node debugger (F7)</button>
          <button id="btnSpawnBrowser">Spawn browser (F8)</button>
        </details>

        <details id="secDebugDraw" class="settings-section" open>
          <summary>Debug drawing</summary>
          <label><input type="checkbox" id="chkDrawNodeBoxes"> Node boxes</label><br/>
          <label><input type="checkbox" id="chkDrawNodeFlagColors"> Node flag colors</label><br/>
          <label><input type="checkbox" id="chkDrawLinkedNodes"> Linked nodes (nearest node)</label><br/>
          <label><input type="checkbox" id="chkDrawAllLinkedNodes"> All linked nodes</label><br/>
          <label><input type="checkbox" id="chkDrawAllLinkedNodesNoDepth"> All linked nodes see-through</label><br/>
          <label><input type="checkbox" id="chkDrawPathLines"> Wander path lines</label><br/>
          <label><input type="checkbox" id="chkDrawPathPoints"> Wander path points</label><br/>
          <label><input type="checkbox" id="chkDrawTargetCircle"> Target circle</label><br/>
          <label><input type="checkbox" id="chkDrawTargetDot"> Target dot</label>
        </details>

        <details id="secPackets" class="settings-section" open>
          <summary>Packets</summary>
          <button id="btnLoadPackets">Parse packets</button><br/>
          <button id="btnLoadAllPackets">Parse all packets</button>
        </details>
      </div>
    </div>
  `;

  // Grab references
  const canvas = containerEl.querySelector('#wow-canvas');
  const selMap = containerEl.querySelector('#selMap');
  const expansionEl = containerEl.querySelector('#expansion');
  const buildEl = containerEl.querySelector('#build');
  const fpsEl = containerEl.querySelector('#fps');
  const camPosWorldEl = containerEl.querySelector('#cam-pos-world');
  const camPosWcEl = containerEl.querySelector('#cam-pos-wc');
  const camPosEl = containerEl.querySelector('#cam-pos');
  const camLookEl = containerEl.querySelector('#cam-look');
  const groupNumEl = containerEl.querySelector('#group-num');
  const bspNodeEl = containerEl.querySelector('#bsp-node');

  const chkDrawAdt          = containerEl.querySelector('#chkDrawAdt');
  const chkDrawM2           = containerEl.querySelector('#chkDrawM2');
  const chkDrawWMO           = containerEl.querySelector('#chkDrawWMO');
  const chkRenderSky        = containerEl.querySelector('#chkRenderSky');
  const chkRenderLiquid     = containerEl.querySelector('#chkRenderLiquid');
  const chkRenderLowresTerrain = containerEl.querySelector('#chkRenderLowresTerrain');
  const chkRenderAdtPolygons = containerEl.querySelector('#chkRenderAdtPolygons');
  const chkRenderLiquidPolygons = containerEl.querySelector('#chkRenderLiquidPolygons');
  const chkRenderMd2Polygons = containerEl.querySelector('#chkRenderMd2Polygons');
  const chkRenderWmoPolygons = containerEl.querySelector('#chkRenderWmoPolygons');
  const chkRenderSkyPolygons = containerEl.querySelector('#chkRenderSkyPolygons');
  const chkDrawPortals      = containerEl.querySelector('#chkDrawPortals');
  const chkDrawM2BB         = containerEl.querySelector('#chkDrawM2BB');
  const chkDrawWmoBB        = containerEl.querySelector('#chkDrawWmoBB');
  const chkDrawBSP          = containerEl.querySelector('#chkDrawBSP');
  const chkDrawDepth        = containerEl.querySelector('#chkDrawDepth');
  const chkUsePortalCulling = containerEl.querySelector('#chkUsePortalCulling');
  const chkDoubleCamera     = containerEl.querySelector('#chkDoubleCamera');
  const chkUseSecondCamera  = containerEl.querySelector('#chkUseSecondCamera');
  const chkCycleAnimations  = containerEl.querySelector('#chkCycleAnimations');
  const radFreeRoam         = containerEl.querySelector('#radFreeRoam');
  const radPlayerCharacter  = containerEl.querySelector('#radPlayerCharacter');
  const collisionStatusEl   = containerEl.querySelector('#collision-status');
  const chkUseRandomTextures = containerEl.querySelector('#chkUseRandomTextures');
  const selGameplayMode     = containerEl.querySelector('#selGameplayMode');
  const gameplayStatusEl    = containerEl.querySelector('#gameplay-status');
  const gameplayNodesEl     = containerEl.querySelector('#gameplay-nodes');
  const chkUseHud           = containerEl.querySelector('#chkUseHud');
  const chkEnableWandering  = containerEl.querySelector('#chkEnableWandering');
  const chkDrawNodeBoxes    = containerEl.querySelector('#chkDrawNodeBoxes');
  const chkDrawNodeFlagColors = containerEl.querySelector('#chkDrawNodeFlagColors');
  const chkDrawLinkedNodes  = containerEl.querySelector('#chkDrawLinkedNodes');
  const chkDrawAllLinkedNodes = containerEl.querySelector('#chkDrawAllLinkedNodes');
  const chkDrawAllLinkedNodesNoDepth = containerEl.querySelector('#chkDrawAllLinkedNodesNoDepth');
  const chkDrawPathLines    = containerEl.querySelector('#chkDrawPathLines');
  const chkDrawPathPoints   = containerEl.querySelector('#chkDrawPathPoints');
  const chkDrawTargetCircle = containerEl.querySelector('#chkDrawTargetCircle');
  const chkDrawTargetDot    = containerEl.querySelector('#chkDrawTargetDot');
  const btnNodeDebugger     = containerEl.querySelector('#btnNodeDebugger');
  const btnSpawnBrowser     = containerEl.querySelector('#btnSpawnBrowser');
  const sliderDrawDistance  = containerEl.querySelector('#sliderDrawDistance');
  const drawDistanceEl      = containerEl.querySelector('#draw-distance');

  const btnCopyDebug      = containerEl.querySelector('#btnCopyDebug');
  const btnLoadPackets    = containerEl.querySelector('#btnLoadPackets');
  const btnLoadAllPackets = containerEl.querySelector('#btnLoadAllPackets');

  // Size the canvas
  const containerW = containerEl.clientWidth;
  const containerH = containerEl.clientHeight;
  canvas.width  = Math.floor(containerW * 0.79);
  canvas.height = containerH;

  // Hard-coded startup params

  // Azeroth (Eastern Kingdoms)
  //const defaultMapKey = MapKey.DarkshireMap;
  //const defaultMapKey = MapKey.StvMap;
  //const defaultMapKey = MapKey.ForsakenStartMap;

  // Kalimdor
  //const defaultMapKey = MapKey.CavernsOfTimeMap;
  //const defaultMapKey = MapKey.OrgrimmarMap;
  //const defaultMapKey = MapKey.DarnassusMap;

  // TBC
  //const defaultMapKey = MapKey.ShattrathMap;
  //const defaultMapKey = MapKey.NagrandMap;
  //const defaultMapKey = MapKey.BelfMap;
  //const defaultMapKey = MapKey.DraeneiMap;

  // WOTLK
  //const defaultMapKey = MapKey.DragonblightMap;
  //const defaultMapKey = MapKey.SholazarMap;

  // PVP
  //const defaultMapKey = MapKey.AlteracValleyMap;
  //const defaultMapKey = MapKey.WarsongGulchMap;
  const defaultMapKey = MapKey.ArathiBasinMap; // has collision triangles (player mode)
  //const defaultMapKey = MapKey.EyeOfTheStormMap;
  //const defaultMapKey = MapKey.StrandOfTheAncientsMap;

  // M2
  //const defaultMapKey = MapKey.RagnarosM2;
  //const defaultMapKey = MapKey.DrakeM2;
  //const defaultMapKey = MapKey.VanillaOpeningScreenM2;
  // WOTLK
  //const defaultMapKey = MapKey.PenguinM2;
  //const defaultMapKey = MapKey.LichKingM2;

  // Static
  //const defaultMapKey = MapKey.ElwynForestTreeM2;
  //const defaultMapKey = MapKey.WintertreeM2;

  // Spells
  //const defaultMapKey = MapKey.FireballM2;

  // Arena
  //const defaultMapKey = MapKey.NagrandArena;
  //const defaultMapKey = MapKey.BladesEdgeArena;

  // Other
  //const defaultMapKey = MapKey.BlackTemple;
  //const defaultMapKey = MapKey.HillsbradPast;
  //const defaultMapKey = MapKey.ZulAman;

  // WMO
  //const defaultMapKey = MapKey.DarkshireBlacksmithWMO;
  //const defaultMapKey = MapKey.LordaeronArenaWMO;

  // TODO: test individual adt, more WMOs and models...

  // The maps that are only valid in WOTLK, or only in TBC and WOTLK
  const wotlkMaps = [MapKey.PenguinM2, MapKey.LichKingM2, MapKey.DragonblightMap, MapKey.SholazarMap, MapKey.StrandOfTheAncientsMap];
  const tbcMaps = [MapKey.HellfireMap, MapKey.ShattrathMap, MapKey.NagrandMap, MapKey.EyeOfTheStormMap, MapKey.BelfMap, MapKey.DraeneiMap, MapKey.NagrandArena, MapKey.BladesEdgeArena, MapKey.BlackTemple, MapKey.HillsbradPast, MapKey.ZulAman];
  function invalidMapReason(key) {
    if (wotlkMaps.includes(key) && window.selectedExpansion !== Expansion.WOTLK)
      return 'only valid in WOTLK';
    if (tbcMaps.includes(key) && window.selectedExpansion !== Expansion.TBC && window.selectedExpansion !== Expansion.WOTLK)
      return 'only valid in TBC or WOTLK';
    return null;
  }

  // ?map=<MapKey> overrides the default map (the map selection reloads the page with it)
  const mapArg = new URLSearchParams(window.location.search).get('map');
  let mapKey = defaultMapKey;
  let mapKeySource = 'default';
  if (mapArg !== null) {
    const overrideMapKey = mapParamsRepository.findKey(mapArg);
    if (overrideMapKey === undefined) {
      console.error(`Unknown map key: '${mapArg}', loading ${defaultMapKey}`);
    } else if (invalidMapReason(overrideMapKey) !== null) {
      console.error(`Map '${overrideMapKey}' is ${invalidMapReason(overrideMapKey)}, loading ${defaultMapKey}`);
    } else {
      mapKey = overrideMapKey;
      mapKeySource = 'URL';
    }
  }

  console.log(`map_key source : ${mapKeySource}`);
  console.log(`map_key        : ${mapKey}`);

  // ?mode=<GameplayMode> sets the gameplay mode (the mode selection reloads the page with it), as my_web_wow's --mode
  const modeArg = new URLSearchParams(window.location.search).get('mode');
  if (modeArg !== null) {
    const mode = parseGameplayMode(modeArg);
    if (mode === undefined) {
      console.error(`Unknown gameplay mode: '${modeArg}', using ${config.getGameplayMode()}`);
    } else if (!implementedGameplayModes.includes(mode)) {
      console.error(`Gameplay mode '${mode}' is not implemented yet, using ${config.getGameplayMode()}`);
    } else {
      config.setGameplayMode(mode);
    }
  }
  console.log(`gameplay mode  : ${config.getGameplayMode()}`);

  const useDebugSky = mapKey === MapKey.NagrandArena || mapKey === MapKey.LordaeronArenaWMO
    || mapKey === MapKey.BladesEdgeArena || mapKey === MapKey.BlackTemple
    || mapKey === MapKey.HillsbradPast || mapKey === MapKey.ZulAman;

  if (useDebugSky) {
    config.setRenderSky(true);
    config.setUseDebugSky(true);
  }

  // Create Scene
  const sceneObj = new Scene(canvas);

  // Camera mode: free roam, or the player character (only when the map has collision triangles)
  function updateCameraMode() {
    radPlayerCharacter.disabled = !sceneObj.camera.collisionAvailable;
    radPlayerCharacter.checked = sceneObj.camera.collisionActive;
    radFreeRoam.checked = !sceneObj.camera.collisionActive;
  }
  function setPlayerMode(enabled) {
    sceneObj.setPlayerMode(enabled);
    // the player mode rotates only while dragging
    if (sceneObj.camera.collisionActive && document.pointerLockElement === canvas) {
      document.exitPointerLock();
    }
    updateCameraMode();
  }

  // CreatureMap / SpellMap: creature or spell models at the map's wander nodes (my_web_wow's WowViewer
  // spawn setup); the mpq server's gameplay api has the nodes and the model lists
  function startGameplayMode(mapId) {
    const mode = config.getGameplayMode();
    if (mapId === undefined) {
      gameplayNodesEl.textContent = 'no map id';
      if (mode === GameplayMode.FreeRoam) return;
      console.log(`[SpawnManager] No map ID for ${mapKey}, skipping spawns.`);
      gameplayStatusEl.textContent = 'no map id';
      return;
    }

    // the map's wander nodes: the node debugger, the node debug drawing and the Wander mode
    gameplayNodesEl.textContent = 'loading';
    const nodesLoaded = sceneObj.loadGameplayNodes(mapId).then((count) => {
      gameplayNodesEl.textContent = count > 0 ? String(count) : 'none (see console)';
      return count;
    });

    // Wander: my_web_wow's two bots walking from node to node
    if (mode === GameplayMode.Wander) {
      gameplayStatusEl.textContent = 'loading';
      nodesLoaded.then(() => sceneObj.startWanderMode(mapId)).then((count) => {
        gameplayStatusEl.textContent = count > 0 ? count + ' bots' : 'none (no wander nodes, see console)';
      });
      return;
    }

    if (mode !== GameplayMode.CreatureMap && mode !== GameplayMode.SpellMap) return;
    const isSpellMap = mode === GameplayMode.SpellMap;
    gameplayStatusEl.textContent = 'loading';
    sceneObj.startSpawnMode(mapId, isSpellMap).then((count) => {
      gameplayStatusEl.textContent = count > 0
        ? count + (isSpellMap ? ' spells' : ' creatures')
        : 'none (no wander nodes or models, see console)';
    });
  }

  const mapParams = mapParamsRepository.get(mapKey);

  // Map selection: every preset, grouped as in MapKey; the ones the expansion cannot load are disabled
  for (const group of mapKeyGroups) {
    const optGroup = document.createElement('optgroup');
    optGroup.label = group.label;
    for (const key of group.keys) {
      const option = document.createElement('option');
      const reason = invalidMapReason(key);
      option.value = key;
      option.textContent = mapParamsRepository.get(key).name + (reason !== null ? ` (${reason})` : '');
      // the full name on hover, for the names the dropdown cuts off
      option.title = option.textContent;
      option.disabled = reason !== null;
      optGroup.appendChild(option);
    }
    selMap.appendChild(optGroup);
  }
  selMap.value = mapKey;
  selMap.title = mapParams.name;

  // Gameplay mode selection: every mode; the ones the web version does not have yet are disabled
  for (const mode of Object.values(GameplayMode)) {
    const option = document.createElement('option');
    option.value = mode;
    option.textContent = mode + (implementedGameplayModes.includes(mode) ? '' : ' (not implemented)');
    option.disabled = !implementedGameplayModes.includes(mode);
    selGameplayMode.appendChild(option);
  }
  selGameplayMode.value = config.getGameplayMode();
  expansionEl.textContent = window.selectedExpansion;
  // webpack replaces process.env.NODE_ENV with the build mode
  buildEl.textContent = process.env.NODE_ENV ?? '';

  // Disable lowres terrain and sky rendering if not running map mode
  if (mapParams.sceneType != 'map' || mapKey === MapKey.NagrandArena) {
    config.setRenderLowresTerrain(false);
    if (useDebugSky)
      sceneObj.initSky();
    else
      config.setRenderSky(false);
  }

  // Calculate ADT coords
  const adt_x = Math.floor((32 - (mapParams.y / 533.33333)));
  const adt_y = Math.floor((32 - (mapParams.x / 533.33333)));

  // Load

    // collision triangles (the player mode) are loaded for maps only
    if (mapParams.sceneType != 'map') {
        collisionStatusEl.textContent = 'maps only';
        gameplayNodesEl.textContent = 'maps only';
        if (config.getGameplayMode() !== GameplayMode.FreeRoam)
            gameplayStatusEl.textContent = 'maps only';
    }
    if (mapParams.sceneType == 'map') {
        sceneObj.loadMap(mapParams.mapName, adt_x, adt_y);
        sceneObj.setCameraPos(mapParams.x, mapParams.y, mapParams.z);

        // Load exported collision triangles for collision-based movement + gravity (the player mode)
        CollisionWorld.load(mapParams.mapName).then((world) => {
          sceneObj.camera.collision = world;
          updateCameraMode();
          if (!world.empty) {
            collisionStatusEl.textContent = world.triangleCount + ' triangles';
            setPlayerMode(true);
          } else {
            collisionStatusEl.textContent = 'none for this map';
          }
        });

        startGameplayMode(mapParams.mapId);
    } else if (mapParams.sceneType == 'wmo') { 
        sceneObj.loadWMOFile({
            fileName : mapParams.fileName,
            uniqueId : 0,
            pos      : {x : 0 + 17066.666666656, y : 0, z : 0 + 17066.666666656},
            rotation : {x : 0, y : 0, z : 0},
            doodadSet: 0
        });

        await sleep(3000); // wait for 3 seconds for dbc data to load

        //var newWorldUnit = new WorldUnit(sceneObj.sceneApi);

        var newWorldUnit = new WorldPlayer(sceneObj.sceneApi);
        sceneObj.worldObjectManager.objectMap[333] = newWorldUnit;

        // Movement speeds
        //newWorldUnit.setSpeedWalk(2.5);
        //newWorldUnit.setSpeedRun(7.0);
        //newWorldUnit.setSpeedRunBack(4.5);
        //newWorldUnit.setSpeedSwim(4.722222328186035);
        //newWorldUnit.setSpeedSwimBack(2.5);
        //newWorldUnit.setSpeedFly(7.0);
        //newWorldUnit.setSpeedFlyBack(4.5);
        //newWorldUnit.setSpeedTurnRate(3.1415927410125732);

        // Movement path (points)
        const vectorArray = [
          [-1663, 5098, 27],
          [-1600, 5100, 30],
          [-1650, 5150, 35]
        ];
        newWorldUnit.setMovingData(1000, 8000, 0, vectorArray); // curr_time, total_time, movementflag

        // Position and rotation
        //newWorldUnit.setCurrentTime(-207965255);
        //newWorldUnit.setPosition(vec3.fromValues(-1663, 5098, 27));
        //newWorldUnit.setRotation(0.0);

        newWorldUnit.setDisplayId(11121);
        newWorldUnit.setNativeDisplayId(11121);

        newWorldUnit.setScale(1.0);

        newWorldUnit.complete()

    } else if (mapParams.sceneType == 'm2') { 
        //var m2Object = sceneObj.loadM2File({
        //    fileName : mapParams.modelName,
        //    uniqueId : 0,
        //    //pos      : {x : 0 + 17066.666666656, y : 0, z : 0 + 17066.666666656},
        //    pos      : {x : 0, y : 0, z : 0},
        //    rotation : {x : 0, y : 0, z : 0},
        //    //scale    : 1024
        //    scale    : 1
        //});
        //window.m2Object = m2Object;

        await sleep(3000); // wait for 3 seconds for dbc data to load

        //var newWorldUnit = new WorldUnit(sceneObj.sceneApi);

        var newWorldUnit = new WorldPlayer(sceneObj.sceneApi);
        sceneObj.worldObjectManager.objectMap[333] = newWorldUnit;

        // Movement speeds
        //newWorldUnit.setSpeedWalk(2.5);
        //newWorldUnit.setSpeedRun(7.0);
        //newWorldUnit.setSpeedRunBack(4.5);
        //newWorldUnit.setSpeedSwim(4.722222328186035);
        //newWorldUnit.setSpeedSwimBack(2.5);
        //newWorldUnit.setSpeedFly(7.0);
        //newWorldUnit.setSpeedFlyBack(4.5);
        //newWorldUnit.setSpeedTurnRate(3.1415927410125732);

        // Movement path (points)
        //const vectorArray = [
        //  [-1663, 5098, 27],
        //  [-1600, 5100, 30],
        //  [-1650, 5150, 35]
        //];
        // stand at the origin, where the camera starts
        const vectorArray = [
          [0, 0, 0],
          [0, 0, 0],
          [0, 0, 0]
        ];

        newWorldUnit.setMovingData(1000, 8000, 0, vectorArray); // curr_time, total_time, movementflag

        // Position and rotation
        //newWorldUnit.setCurrentTime(-207965255);
        //newWorldUnit.setPosition(vec3.fromValues(-1663, 5098, 27));
        //newWorldUnit.setRotation(0.0);

        const normalizedModelName = mapParams.modelName.toLowerCase().replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(".mdx", ".m2");

        // the hard-coded display ids, or the display id looked up by the model path (any model, see createModelFromModelPath)
        const useHardcodedDisplayId = false;

        // Penguin
        if (useHardcodedDisplayId && normalizedModelName === "creature/northrendpenguin/northrendpenguin.m2") {
          newWorldUnit.setDisplayId(24978);
          newWorldUnit.setNativeDisplayId(24978);
        } else if (useHardcodedDisplayId && normalizedModelName === "creature/drake/drake.m2") {
          newWorldUnit.setDisplayId(5645);
          newWorldUnit.setNativeDisplayId(5645);
        } else if (useHardcodedDisplayId && normalizedModelName === "creature/ragnaros/ragnaros.m2") {
          newWorldUnit.setDisplayId(11121);
          newWorldUnit.setNativeDisplayId(11121);
        } else {
          newWorldUnit.setDisplayId(-1);
          newWorldUnit.setNativeDisplayId(-1);
          newWorldUnit.modelPathInput = mapParams.modelName;
          if (mapParams.chosenModelIndex !== undefined)
            newWorldUnit.chosenModelIndex = mapParams.chosenModelIndex;
        }

        newWorldUnit.setScale(1.0);

        newWorldUnit.complete()
        // TODO
        //newWorldUnit.objectModel.animationManager.setAnimationId(4, true);

        if (mapParams.cameraIndex !== undefined) {
            config.setCameraM2(m2Object);
        }
        if (mapParams.fogStart) {
            sceneObj.setFogStart(mapParams.fogStart)
        }
        if (mapParams.fogEnd) {
            sceneObj.setFogEnd(mapParams.fogEnd);
        }
        if (mapParams.fogColor) {
            sceneObj.setFogColor(mapParams.fogColor);
        }
    }

  // Initialize config + checkbox states
  chkDrawAdt.checked          = config.getRenderAdt();
  chkDrawM2.checked           = config.getRenderM2();
  chkDrawWMO.checked           = config.getRenderWMO();
  chkRenderSky.checked        = config.getRenderSky();
  chkRenderLiquid.checked     = config.getRenderLiquid();
  chkRenderLowresTerrain.checked = config.getRenderLowresTerrain();
  chkRenderAdtPolygons.checked = config.getRenderAdtPolygons();
  chkRenderLiquidPolygons.checked = config.getRenderLiquidPolygons();
  chkRenderMd2Polygons.checked = config.getRenderMd2Polygons();
  chkRenderWmoPolygons.checked = config.getRenderWmoPolygons();
  chkRenderSkyPolygons.checked = config.getRenderSkyPolygons();
  chkDrawPortals.checked      = config.getRenderPortals();
  chkDrawM2BB.checked         = config.getDrawM2BB();
  chkDrawWmoBB.checked        = config.getDrawWmoBB();
  chkDrawBSP.checked          = config.getRenderBSP();
  chkDrawDepth.checked        = config.getDrawDepthBuffer();
  chkUsePortalCulling.checked = config.getUsePortalCulling();
  chkDoubleCamera.checked     = config.getDoubleCameraDebug();
  chkUseSecondCamera.checked  = config.getUseSecondCamera();
  chkUseSecondCamera.disabled = !chkDoubleCamera.checked;
  chkCycleAnimations.checked  = config.getCycleAnimations();
  chkUseRandomTextures.checked = config.getUseRandomTextures();
  chkUseHud.checked           = config.getUseHud();
  chkEnableWandering.checked  = config.getEnableWandering();
  chkDrawNodeBoxes.checked    = config.getDrawNodeBoxes();
  chkDrawNodeFlagColors.checked = config.getDrawNodeFlagColors();
  chkDrawLinkedNodes.checked  = config.getDrawLinkedNodes();
  chkDrawAllLinkedNodes.checked = config.getDrawAllLinkedNodes();
  chkDrawAllLinkedNodesNoDepth.checked = config.getDrawAllLinkedNodesNoDepth();
  chkDrawPathLines.checked    = config.getDrawPathLines();
  chkDrawPathPoints.checked   = config.getDrawPathPoints();
  chkDrawTargetCircle.checked = config.getDrawTargetCircle();
  chkDrawTargetDot.checked    = config.getDrawTargetDot();
  sliderDrawDistance.value    = String(config.getDrawDistance());
  drawDistanceEl.textContent  = String(config.getDrawDistance());
  updateCameraMode();

  // The Node Debugger (F7) and Spawn Browser (F8) windows
  const nodeDebugger = createNodeDebugger(containerEl.firstElementChild, sceneObj);
  const spawnBrowser = createSpawnBrowser(containerEl.firstElementChild, sceneObj);

  // set a settings checkbox as if it was clicked, so the config follows it through its change handler
  function setChecked(chk, value) {
    if (chk.checked !== value) chk.click();
  }

  // the spell keys, as in my_web_wow's WowViewer
  const spellKeys = {
    '1': SpellType.Frostbolt,     // 1.2s cast
    '2': SpellType.IceLance,      // instant
    '3': SpellType.Pyroblast,     // 3.5s cast
    '4': SpellType.IceMissile,    // 1.5s cast
    '5': SpellType.LightningBolt, // 1.2s cast
    '6': SpellType.Blizzard,      // channeled, 5s
    'v': SpellType.FrostNova,     // area at player, instant
    'x': SpellType.IceBlock,      // area at player, 7s duration
  };

  // the gameplay / debug keys of my_web_wow's WowViewer.OnKeyDown (its devMode keys included); true when handled
  function gameplayKey(event) {
    if (event.key === 'F7') { nodeDebugger.toggle(); return true; }
    if (event.key === 'F8') { spawnBrowser.toggle(); return true; }
    if (event.altKey || event.metaKey) return false;

    const key = event.key.toLowerCase();
    // Ctrl only with '.'
    if (event.ctrlKey && key !== '.') return false;
    if (event.repeat && (key in spellKeys || 't0ngj,.'.indexOf(key) >= 0)) return true;

    if (key in spellKeys) {
      if (sceneObj.spellManager) sceneObj.spellManager.castSpell(spellKeys[key]);
      else console.log('[SpellManager] Spells need the player character (switch to the player character camera)');
      return true;
    }
    switch (key) {
      // cycle target
      case 't':
        if (sceneObj.spellManager) sceneObj.spellManager.cycleTarget();
        return true;
      // toggle wandering
      case 'n':
        chkEnableWandering.click();
        console.log(`EnableWandering = ${chkEnableWandering.checked}`);
        return true;
      // teleport (the camera) to the current target
      case '0': {
        const targetKey = sceneObj.spellManager ? sceneObj.spellManager.getCurrentTargetKey() : null;
        if (targetKey === null) { console.log('[WowViewer] No target selected'); return true; }
        const target = sceneObj.worldObjectManager.objectMap[targetKey];
        if (!target) { console.log(`[WowViewer] Target ${targetKey} not found in objectMap`); return true; }
        const targetPos = target.getPosition();
        sceneObj.setCameraPos(targetPos[0], targetPos[1], targetPos[2]);
        console.log(`[WowViewer] Teleported to target ${targetKey} at (${targetPos[0].toFixed(1)},${targetPos[1].toFixed(1)},${targetPos[2].toFixed(1)})`);
        return true;
      }
      // cycle drawPathLines / drawPathPoints
      case ',':
        if (!chkDrawPathLines.checked && !chkDrawPathPoints.checked)
          setChecked(chkDrawPathLines, true);
        else if (chkDrawPathLines.checked) {
          setChecked(chkDrawPathLines, false);
          setChecked(chkDrawPathPoints, true);
        } else if (chkDrawPathPoints.checked)
          setChecked(chkDrawPathPoints, false);
        console.log(`PathLines=${chkDrawPathLines.checked} PathPoints=${chkDrawPathPoints.checked}`);
        return true;
      // cycle drawLinkedNodes / drawNodeBoxes  |  ctrl+. : cycle all-linked / no-depth
      case '.':
        if (!event.ctrlKey) {
          let l = chkDrawLinkedNodes.checked, b = chkDrawNodeBoxes.checked;
          if (!l && !b) { l = true; b = false; }
          else if (l && b) { l = false; b = false; }
          else if (l && !b) { l = false; b = true; }
          else /* b only */ { l = true; b = true; }
          setChecked(chkDrawLinkedNodes, l);
          setChecked(chkDrawNodeBoxes, b);
          console.log(`LinkedNodes=${l} NodeBoxes=${b}`);
        } else {
          let a = chkDrawAllLinkedNodes.checked, nd = chkDrawAllLinkedNodesNoDepth.checked;
          if (!a && !nd) { a = true; nd = false; }
          else if (a && nd) { a = false; nd = false; }
          else if (a) nd = true;
          setChecked(chkDrawAllLinkedNodes, a);
          setChecked(chkDrawAllLinkedNodesNoDepth, nd);
          console.log(`AllLinked=${a} NoDepth=${nd}`);
        }
        return true;
      // toggle flag-colored node boxes
      case 'j':
        chkDrawNodeFlagColors.click();
        console.log(`DrawNodeFlagColors = ${chkDrawNodeFlagColors.checked}`);
        return true;
      // cycle target marker  off -> circle -> box -> off
      case 'g': {
        let c = chkDrawTargetCircle.checked;
        let d = chkDrawTargetDot.checked;
        if (!c && !d) { c = true; d = false; }      // off -> circle
        else if (c && !d) { c = false; d = true; }  // circle -> box
        else { c = false; d = false; }              // box -> off
        setChecked(chkDrawTargetCircle, c);
        setChecked(chkDrawTargetDot, d);
        console.log(`TargetMarker: ${c ? 'circle' : d ? 'box' : 'off'}`);
        return true;
      }
    }
    return false;
  }

  // Attach event handlers for camera
  attachEvents(canvas, sceneObj.camera, {
    settingsPanel: containerEl.querySelector('#settings-panel'),
    chkDrawM2,
    chkDrawAdt,
    chkDrawWMO,
    chkDrawWmoBB,
    chkDrawDepth,
    chkRenderLiquid,
    chkRenderLowresTerrain,
    chkRenderAdtPolygons,
    chkRenderLiquidPolygons,
    chkRenderMd2Polygons,
    chkRenderWmoPolygons,
    chkRenderSkyPolygons,
    chkRenderSky,
    chkCycleAnimations,
    sliderDrawDistance,
    gameplayKey,
  });

  // Link checkboxes => config
  chkDrawAdt.addEventListener('change', () => { config.setRenderAdt(chkDrawAdt.checked); });
  chkDrawM2.addEventListener('change', () => { config.setRenderM2(chkDrawM2.checked); });
  chkDrawWMO.addEventListener('change', () => { config.setRenderWMO(chkDrawWMO.checked); });
  chkRenderSky.addEventListener('change', () => { config.setRenderSky(chkRenderSky.checked); });
  chkRenderLiquid.addEventListener('change', () => { config.setRenderLiquid(chkRenderLiquid.checked); });
  chkRenderLowresTerrain.addEventListener('change', () => { config.setRenderLowresTerrain(chkRenderLowresTerrain.checked); });
  chkRenderAdtPolygons.addEventListener('change', () => { config.setRenderAdtPolygons(chkRenderAdtPolygons.checked); });
  chkRenderLiquidPolygons.addEventListener('change', () => { config.setRenderLiquidPolygons(chkRenderLiquidPolygons.checked); });
  chkRenderMd2Polygons.addEventListener('change', () => { config.setRenderMd2Polygons(chkRenderMd2Polygons.checked); });
  chkRenderWmoPolygons.addEventListener('change', () => { config.setRenderWmoPolygons(chkRenderWmoPolygons.checked); });
  chkRenderSkyPolygons.addEventListener('change', () => { config.setRenderSkyPolygons(chkRenderSkyPolygons.checked); });
  chkDrawPortals.addEventListener('change', () => { config.setRenderPortals(chkDrawPortals.checked); });
  chkDrawM2BB.addEventListener('change', () => { config.setDrawM2BB(chkDrawM2BB.checked); });
  chkDrawWmoBB.addEventListener('change', () => { config.setDrawWmoBB(chkDrawWmoBB.checked); });
  chkDrawBSP.addEventListener('change', () => { config.setRenderBSP(chkDrawBSP.checked); });
  chkDrawDepth.addEventListener('change', () => { config.setDrawDepthBuffer(chkDrawDepth.checked); });
  chkUsePortalCulling.addEventListener('change', () => { config.setUsePortalCulling(chkUsePortalCulling.checked); });
  chkDoubleCamera.addEventListener('change', () => {
    config.setDoubleCameraDebug(chkDoubleCamera.checked);
    if (!chkDoubleCamera.checked) {
      config.setUseSecondCamera(false);
      chkUseSecondCamera.checked = false;
      chkUseSecondCamera.disabled = true;
    } else {
      chkUseSecondCamera.disabled = false;
      config.setUseSecondCamera(chkUseSecondCamera.checked);
    }
  });
  chkCycleAnimations.addEventListener('change', () => { config.setCycleAnimations(chkCycleAnimations.checked); });
  chkUseRandomTextures.addEventListener('change', () => { config.setUseRandomTextures(chkUseRandomTextures.checked); });
  chkUseHud.addEventListener('change', () => { config.setUseHud(chkUseHud.checked); });
  chkEnableWandering.addEventListener('change', () => {
    config.setEnableWandering(chkEnableWandering.checked);
    if (sceneObj.wanderManager) sceneObj.wanderManager.setAllWandering(chkEnableWandering.checked);
  });
  chkDrawNodeBoxes.addEventListener('change', () => { config.setDrawNodeBoxes(chkDrawNodeBoxes.checked); });
  chkDrawNodeFlagColors.addEventListener('change', () => { config.setDrawNodeFlagColors(chkDrawNodeFlagColors.checked); });
  chkDrawLinkedNodes.addEventListener('change', () => { config.setDrawLinkedNodes(chkDrawLinkedNodes.checked); });
  chkDrawAllLinkedNodes.addEventListener('change', () => { config.setDrawAllLinkedNodes(chkDrawAllLinkedNodes.checked); });
  chkDrawAllLinkedNodesNoDepth.addEventListener('change', () => { config.setDrawAllLinkedNodesNoDepth(chkDrawAllLinkedNodesNoDepth.checked); });
  chkDrawPathLines.addEventListener('change', () => { config.setDrawPathLines(chkDrawPathLines.checked); });
  chkDrawPathPoints.addEventListener('change', () => { config.setDrawPathPoints(chkDrawPathPoints.checked); });
  chkDrawTargetCircle.addEventListener('change', () => { config.setDrawTargetCircle(chkDrawTargetCircle.checked); });
  chkDrawTargetDot.addEventListener('change', () => { config.setDrawTargetDot(chkDrawTargetDot.checked); });
  radFreeRoam.addEventListener('change', () => { setPlayerMode(false); });
  radPlayerCharacter.addEventListener('change', () => { setPlayerMode(true); });
  sliderDrawDistance.addEventListener('input', () => {
    config.setDrawDistance(Number(sliderDrawDistance.value));
    drawDistanceEl.textContent = sliderDrawDistance.value;
  });
  chkUseSecondCamera.addEventListener('change', () => {
    config.setUseSecondCamera(chkUseSecondCamera.checked);
  });

  // Settings sections: remember which ones are open
  for (const section of containerEl.querySelectorAll('.settings-section')) {
    const storageKey = 'settingsSection.' + section.id;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) section.open = saved === '1';
    } catch (e) {
      console.log(e);
    }
    section.addEventListener('toggle', () => {
      try {
        localStorage.setItem(storageKey, section.open ? '1' : '0');
      } catch (e) {
        console.log(e);
      }
    });
  }

  // Map selection => reload with the chosen map
  selMap.addEventListener('change', () => {
    const url = new URL(window.location.href);
    url.searchParams.set('map', selMap.value);
    window.location.href = url.toString();
  });
  // the camera keys still reach the document; keep them from changing the selection (and reloading)
  selMap.addEventListener('keydown', (e) => { e.preventDefault(); });
  selGameplayMode.addEventListener('change', () => {
    const url = new URL(window.location.href);
    url.searchParams.set('mode', selGameplayMode.value);
    window.location.href = url.toString();
  });
  selGameplayMode.addEventListener('keydown', (e) => { e.preventDefault(); });

  // Buttons
  btnNodeDebugger.addEventListener('click', () => { nodeDebugger.toggle(); });
  btnSpawnBrowser.addEventListener('click', () => { spawnBrowser.toggle(); });
  btnCopyDebug.addEventListener('click', () => {
    sceneObj.copyFirstCameraToDebugCamera();
  });
  btnLoadPackets.addEventListener('click', () => {
    sceneObj.loadPackets();
  });
  btnLoadAllPackets.addEventListener('click', () => {
    sceneObj.loadAllPackets();
  });

  // Render loop
  let lastFrameTime = 0;
  const targetFPS = 60;
  const targetFrameTime = 1000 / targetFPS;
  let lastTimeStamp = undefined;
  // the frames drawn since the fps was last shown, which it is once a second
  let fpsFrameCount = 0;
  let fpsLastTime = Date.now();

  function renderLoop(currentTime) {
    const delta = currentTime - lastFrameTime;
    if (delta >= targetFrameTime) {
      lastFrameTime = currentTime - (delta % targetFrameTime);

      const now = Date.now();
      let timeDelta = 0;
      if (lastTimeStamp !== undefined) {
        timeDelta = now - lastTimeStamp;
      }
      lastTimeStamp = now;

      // Draw
      const result = sceneObj.draw(timeDelta);
      const { cameraVecs, updateResult } = result;

      // Update text
      camPosEl.textContent  = cameraVecs.cameraVec3.map(n => n.toFixed(2)).join(', ');
      camPosWorldEl.textContent = MathHelper.toWorld(cameraVecs.cameraVec3).map(n => n.toFixed(2)).join(', ');
      camPosWcEl.textContent    = MathHelper.toWc(cameraVecs.cameraVec3).map(n => n.toFixed(2)).join(', ');
      camLookEl.textContent = cameraVecs.lookAtVec3.map(n => n.toFixed(2)).join(', ');
      groupNumEl.textContent = updateResult.interiorGroupNum || 0;
      bspNodeEl.textContent  = updateResult.nodeId || 0;

      fpsFrameCount++;
      const fpsElapsed = now - fpsLastTime;
      if (fpsElapsed >= 1000) {
        fpsEl.textContent = (fpsFrameCount / (fpsElapsed / 1000)).toFixed(2);
        sceneObj.fps = Math.round(fpsFrameCount / (fpsElapsed / 1000));
        fpsFrameCount = 0;
        fpsLastTime = now;
      }

      nodeDebugger.update();
      spawnBrowser.update();
    }
    requestAnimationFrame(renderLoop);
  }
  requestAnimationFrame(renderLoop);
}
