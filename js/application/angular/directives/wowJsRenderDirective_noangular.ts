import Scene from './../wowRenderJs/scene';
import config from './../services/config';
import WorldUnit from '../wowRenderJs/objects/worldObjects/worldUnit';
import WorldPlayer from '../wowRenderJs/objects/worldObjects/worldPlayer';
import {vec3} from 'gl-matrix'
import type firstPersonCamera from '../wowRenderJs/camera/firstPersonCamera';
import MathHelper from '../wowRenderJs/math/mathHelper';
import Expansion from '../Expansion';
import mapParamsRepository, { MapKey, mapKeyGroups } from '../mapParamsRepository';
import type { MapKeyValue, MapParams } from '../mapParamsRepository';

/* Vendor-prefixed pointer-lock members the code falls back to; the DOM lib does not declare them */
interface PrefixedMouseEvent extends MouseEvent {
  mozMovementX?: number;
  mozMovementY?: number;
  webkitMovementX?: number;
  webkitMovementY?: number;
}
interface PrefixedCanvas extends HTMLCanvasElement {
  mozRequestPointerLock?: HTMLCanvasElement['requestPointerLock'];
  webkitRequestPointerLock?: HTMLCanvasElement['requestPointerLock'];
}
interface PrefixedDocument extends Document {
  mozPointerLockElement?: Element | null;
  webkitPointerLockElement?: Element | null;
}

/* textContent stringifies what it is given; the render loop assigns numbers to the group / BSP node spans */
interface NumberTextElement {
  textContent: string | number | null;
}

/* The settings panel and the checkboxes the render key binds toggle */
interface KeyBindTargets {
  settingsPanel: HTMLElement;
  chkDrawM2: HTMLInputElement;
  chkDrawAdt: HTMLInputElement;
  chkDrawWMO: HTMLInputElement;
  chkDrawWmoBB: HTMLInputElement;
  chkDrawDepth: HTMLInputElement;
  chkRenderLiquid: HTMLInputElement;
  chkRenderLowresTerrain: HTMLInputElement;
  chkRenderAdtPolygons: HTMLInputElement;
  chkRenderLiquidPolygons: HTMLInputElement;
  chkRenderMd2Polygons: HTMLInputElement;
  chkRenderWmoPolygons: HTMLInputElement;
  chkRenderSkyPolygons: HTMLInputElement;
  chkRenderSky: HTMLInputElement;
  chkCycleAnimations: HTMLInputElement;
  sliderDrawDistance: HTMLInputElement;
}

/**
 * Attach pointer-lock, mouse, keyboard, touch events to the canvas/camera.
 */
function attachEvents(canvas: PrefixedCanvas, camera: firstPersonCamera, keyBinds: KeyBindTargets) {
  let mleftPressed = false;
  let lastMouseX = 0, lastMouseY = 0;
  let pointerIsLocked = false;

  // toggle a settings checkbox as if it was clicked, so the config follows it through its change handler
  function toggle(chk: HTMLInputElement, name: string) {
    chk.click();
    console.log(`${name} = ${chk.checked}`);
  }

  function keyDown(event: KeyboardEvent) {
    if (event.key === 'Shift') {
      camera.setShiftHeld(true);
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
      case ' ': camera.startMovingUp();        break;
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
  function keyUp(event: KeyboardEvent) {
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

  function mouseDown(event: MouseEvent) {
    if (event.button === 0) {
      mleftPressed = true;
      lastMouseX = event.pageX;
      lastMouseY = event.pageY;
    }
  }
  function mouseUp(event: MouseEvent) {
    if (event.button === 0) {
      mleftPressed = false;
    }
  }
  function mouseMove(event: PrefixedMouseEvent) {
    if (!pointerIsLocked) {
      if (mleftPressed) {
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
  }

  // pointer lock
  const havePointerLock = (
       'pointerLockElement' in document
    || 'mozPointerLockElement' in document
    || 'webkitPointerLockElement' in document
  );
  if (havePointerLock) {
    canvas.addEventListener('click', () => {
      canvas.requestPointerLock =
        canvas.requestPointerLock ||
        canvas.mozRequestPointerLock ||
        canvas.webkitRequestPointerLock;
      canvas.requestPointerLock();
    });
    const pointerLockCallback = () => {
      pointerIsLocked = (
           document.pointerLockElement === canvas
        || (document as PrefixedDocument).mozPointerLockElement === canvas
        || (document as PrefixedDocument).webkitPointerLockElement === canvas
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

  // bind mouse wheel: zoom, one step per wheel event (scroll up -> zoom in)
  function mouseWheel(event: WheelEvent) {
    event.preventDefault();
    camera.zoom(-Math.sign(event.deltaY));
  }
  canvas.addEventListener('wheel', mouseWheel, {passive: false});

  // only move camera if lastDownTarget = canvas
  let lastDownTarget: EventTarget | null = null;
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
  function touchStart(e: TouchEvent) {
    if (isPitchGoingOn) return;
    mleftPressed = true;
    lastMouseX = e.touches[0].pageX;
    lastMouseY = e.touches[0].pageY;
  }
  function touchMove(e: TouchEvent) {
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

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a canvas + UI in containerEl, loads Shattrath automatically,
 * attaches events, and starts rendering.
 */
export async function initViewer(containerEl: HTMLElement) {
  // Create HTML structure (canvas + simple debug panel)
  containerEl.innerHTML = `
    <div style="width: 100%; height: 100%; position: relative; overflow: hidden; display: flex;">
      <canvas id="wow-canvas" style="flex: none; display:block;"></canvas>

      <div id="settings-panel" style="flex: 1 1 auto; min-width: 0; height: 100%; overflow-y: auto; box-sizing: border-box; padding: 0 10px; color: white;">
        <style>
          #selMap, #selMap optgroup, #selMap option { background: #222; color: white; }
          #selMap option:disabled { color: #777; }
          #settings-panel .settings-section { margin-top: 8px; }
          #settings-panel .settings-section > summary { cursor: pointer; font-weight: bold; margin-bottom: 2px; }
        </style>
        <div style="display: flex; align-items: center; gap: 4px;">
          <span style="white-space: nowrap;">map =</span>
          <select id="selMap" style="flex: 1 1 auto; min-width: 0; border: 1px solid #888; border-radius: 2px; padding: 1px 2px;"></select>
        </div>
        <div>expansion = <span id="expansion"></span> | build = <span id="build"></span> | fps = <span id="fps"></span></div>
        <div>camera (wow) = (<span id="cam-pos"></span>)</div>
        <div>camera (world) = (<span id="cam-pos-world"></span>)</div>
        <div>camera (wc) = (<span id="cam-pos-wc"></span>)</div>
        <div>lookAt = (<span id="cam-look"></span>)</div>
        <div>Group # = <span id="group-num"></span></div>
        <div>BSP Node = <span id="bsp-node"></span></div>

        <details id="secControls" class="settings-section">
          <summary>Controls</summary>
          W - forward, S - backward, A - left, D - right,<br/>
          Space - up, Tab - down, Shift - faster, Mouse - move camera<br/>
          B - M2, Z - ADT, O - WMO, I - WMO BB, K - depth,<br/>
          Q - liquid, E - sky, F - draw distance, F6 - hide this panel,<br/>
          L - lowres terrain, C - cycle anims, Wheel - zoom,<br/>
          F1-F5 - wireframe ADT, liquid, M2, WMO, sky
        </details>

        <details id="secRendering" class="settings-section" open>
          <summary>Rendering</summary>
          <label><input type="checkbox" id="chkDrawAdt"> Draw ADT</label><br/>
          <label><input type="checkbox" id="chkDrawM2"> Draw M2</label><br/>
          <label><input type="checkbox" id="chkDrawWMO"> Draw WMO</label><br/>
          <label><input type="checkbox" id="chkRenderSky"> Render Sky</label><br/>
          <label><input type="checkbox" id="chkRenderLiquid"> Render Liquid</label><br/>
          <label><input type="checkbox" id="chkRenderLowresTerrain"> Render Lowres Terrain</label><br/>
          <label><input type="checkbox" id="chkUsePortalCulling"> Portal Culling</label>
        </details>

        <details id="secWireframe" class="settings-section">
          <summary>Wireframe polygons</summary>
          <label><input type="checkbox" id="chkRenderAdtPolygons"> ADT Polygons</label><br/>
          <label><input type="checkbox" id="chkRenderLiquidPolygons"> Liquid Polygons</label><br/>
          <label><input type="checkbox" id="chkRenderMd2Polygons"> M2 Polygons</label><br/>
          <label><input type="checkbox" id="chkRenderWmoPolygons"> WMO Polygons</label><br/>
          <label><input type="checkbox" id="chkRenderSkyPolygons"> Sky Polygons</label>
        </details>

        <details id="secDebug" class="settings-section">
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
          <label><input type="checkbox" id="chkCycleAnimations"> Cycle Anims</label><br/>
          <label><input type="checkbox" id="chkDoubleCamera"> Double Camera Debug</label><br/>
          <label><input type="checkbox" id="chkUseSecondCamera" disabled> Use Debug Camera</label><br/>
          <button id="btnCopyDebug">Copy main camera -> debug camera</button>
        </details>

        <details id="secPackets" class="settings-section">
          <summary>Packets</summary>
          <button id="btnLoadPackets">Parse packets</button><br/>
          <button id="btnLoadAllPackets">Parse all packets</button>
        </details>
      </div>
    </div>
  `;

  // Grab references
  const canvas = containerEl.querySelector<HTMLCanvasElement>('#wow-canvas')!;
  const selMap = containerEl.querySelector<HTMLSelectElement>('#selMap')!;
  const expansionEl = containerEl.querySelector<HTMLSpanElement>('#expansion')!;
  const buildEl = containerEl.querySelector<HTMLSpanElement>('#build')!;
  const fpsEl = containerEl.querySelector<HTMLSpanElement>('#fps')!;
  const camPosWorldEl = containerEl.querySelector<HTMLSpanElement>('#cam-pos-world')!;
  const camPosWcEl = containerEl.querySelector<HTMLSpanElement>('#cam-pos-wc')!;
  const camPosEl = containerEl.querySelector<HTMLSpanElement>('#cam-pos')!;
  const camLookEl = containerEl.querySelector<HTMLSpanElement>('#cam-look')!;
  const groupNumEl = containerEl.querySelector('#group-num') as NumberTextElement;
  const bspNodeEl = containerEl.querySelector('#bsp-node') as NumberTextElement;

  const chkDrawAdt          = containerEl.querySelector<HTMLInputElement>('#chkDrawAdt')!;
  const chkDrawM2           = containerEl.querySelector<HTMLInputElement>('#chkDrawM2')!;
  const chkDrawWMO           = containerEl.querySelector<HTMLInputElement>('#chkDrawWMO')!;
  const chkRenderSky        = containerEl.querySelector<HTMLInputElement>('#chkRenderSky')!;
  const chkRenderLiquid     = containerEl.querySelector<HTMLInputElement>('#chkRenderLiquid')!;
  const chkRenderLowresTerrain = containerEl.querySelector<HTMLInputElement>('#chkRenderLowresTerrain')!;
  const chkRenderAdtPolygons = containerEl.querySelector<HTMLInputElement>('#chkRenderAdtPolygons')!;
  const chkRenderLiquidPolygons = containerEl.querySelector<HTMLInputElement>('#chkRenderLiquidPolygons')!;
  const chkRenderMd2Polygons = containerEl.querySelector<HTMLInputElement>('#chkRenderMd2Polygons')!;
  const chkRenderWmoPolygons = containerEl.querySelector<HTMLInputElement>('#chkRenderWmoPolygons')!;
  const chkRenderSkyPolygons = containerEl.querySelector<HTMLInputElement>('#chkRenderSkyPolygons')!;
  const chkDrawPortals      = containerEl.querySelector<HTMLInputElement>('#chkDrawPortals')!;
  const chkDrawM2BB         = containerEl.querySelector<HTMLInputElement>('#chkDrawM2BB')!;
  const chkDrawWmoBB        = containerEl.querySelector<HTMLInputElement>('#chkDrawWmoBB')!;
  const chkDrawBSP          = containerEl.querySelector<HTMLInputElement>('#chkDrawBSP')!;
  const chkDrawDepth        = containerEl.querySelector<HTMLInputElement>('#chkDrawDepth')!;
  const chkUsePortalCulling = containerEl.querySelector<HTMLInputElement>('#chkUsePortalCulling')!;
  const chkDoubleCamera     = containerEl.querySelector<HTMLInputElement>('#chkDoubleCamera')!;
  const chkUseSecondCamera  = containerEl.querySelector<HTMLInputElement>('#chkUseSecondCamera')!;
  const chkCycleAnimations  = containerEl.querySelector<HTMLInputElement>('#chkCycleAnimations')!;
  const sliderDrawDistance  = containerEl.querySelector<HTMLInputElement>('#sliderDrawDistance')!;
  const drawDistanceEl      = containerEl.querySelector<HTMLSpanElement>('#draw-distance')!;

  const btnCopyDebug      = containerEl.querySelector<HTMLButtonElement>('#btnCopyDebug')!;
  const btnLoadPackets    = containerEl.querySelector<HTMLButtonElement>('#btnLoadPackets')!;
  const btnLoadAllPackets = containerEl.querySelector<HTMLButtonElement>('#btnLoadAllPackets')!;

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
  const defaultMapKey = MapKey.OrgrimmarMap;
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
  //const defaultMapKey = MapKey.ArathiBasinMap;
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
  const wotlkMaps: MapKeyValue[] = [MapKey.PenguinM2, MapKey.LichKingM2, MapKey.DragonblightMap, MapKey.SholazarMap, MapKey.StrandOfTheAncientsMap];
  const tbcMaps: MapKeyValue[] = [MapKey.HellfireMap, MapKey.ShattrathMap, MapKey.NagrandMap, MapKey.EyeOfTheStormMap, MapKey.BelfMap, MapKey.DraeneiMap, MapKey.NagrandArena, MapKey.BladesEdgeArena, MapKey.BlackTemple, MapKey.HillsbradPast, MapKey.ZulAman];
  function invalidMapReason(key: MapKeyValue) {
    if (wotlkMaps.includes(key) && window.selectedExpansion !== Expansion.WOTLK)
      return 'only valid in WOTLK';
    if (tbcMaps.includes(key) && window.selectedExpansion !== Expansion.TBC && window.selectedExpansion !== Expansion.WOTLK)
      return 'only valid in TBC or WOTLK';
    return null;
  }

  // ?map=<MapKey> overrides the default map (the map selection reloads the page with it)
  const mapArg = new URLSearchParams(window.location.search).get('map');
  let mapKey: MapKeyValue = defaultMapKey;
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

  const useDebugSky = mapKey === MapKey.NagrandArena || mapKey === MapKey.LordaeronArenaWMO
    || mapKey === MapKey.BladesEdgeArena || mapKey === MapKey.BlackTemple
    || mapKey === MapKey.HillsbradPast || mapKey === MapKey.ZulAman;

  if (useDebugSky) {
    config.setRenderSky(true);
    config.setUseDebugSky(true);
  }

  // Create Scene
  const sceneObj = new Scene(canvas);

  const mapParams: MapParams = mapParamsRepository.get(mapKey);

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
  const adt_x = Math.floor((32 - (mapParams.y! / 533.33333)));
  const adt_y = Math.floor((32 - (mapParams.x! / 533.33333)));

  // Load

    if (mapParams.sceneType == 'map') {
        sceneObj.loadMap(mapParams.mapName!, adt_x, adt_y);
        sceneObj.setCameraPos(mapParams.x!, mapParams.y!, mapParams.z!);
    } else if (mapParams.sceneType == 'wmo') { 
        sceneObj.loadWMOFile({
            fileName : mapParams.fileName!,
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

        const normalizedModelName = mapParams.modelName!.toLowerCase().replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(".mdx", ".m2");

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
          newWorldUnit.modelPathInput = mapParams.modelName!;
          if (mapParams.chosenModelIndex !== undefined)
            newWorldUnit.chosenModelIndex = mapParams.chosenModelIndex;
        }

        newWorldUnit.setScale(1.0);

        newWorldUnit.complete()
        // TODO
        //newWorldUnit.objectModel.animationManager.setAnimationId(4, true);

        if (mapParams.cameraIndex !== undefined) {
            // JS-BUG: m2Object is not declared (its loadM2File block above is commented out), so an M2 preset with cameraIndex throws a ReferenceError here
            // @ts-expect-error m2Object is not declared; ported as-is
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
  sliderDrawDistance.value    = String(config.getDrawDistance());
  drawDistanceEl.textContent  = String(config.getDrawDistance());

  // Attach event handlers for camera
  attachEvents(canvas, sceneObj.camera, {
    settingsPanel: containerEl.querySelector<HTMLDivElement>('#settings-panel')!,
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
  sliderDrawDistance.addEventListener('input', () => {
    config.setDrawDistance(Number(sliderDrawDistance.value));
    drawDistanceEl.textContent = sliderDrawDistance.value;
  });
  chkUseSecondCamera.addEventListener('change', () => {
    config.setUseSecondCamera(chkUseSecondCamera.checked);
  });

  // Settings sections: remember which ones are open
  for (const section of containerEl.querySelectorAll<HTMLDetailsElement>('.settings-section')) {
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

  // Buttons
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
  let lastTimeStamp: number | undefined = undefined;
  // the frames drawn since the fps was last shown, which it is once a second
  let fpsFrameCount = 0;
  let fpsLastTime = Date.now();

  function renderLoop(currentTime: number) {
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
      const result = sceneObj.draw(timeDelta)!;
      const { cameraVecs, updateResult } = result;

      // Update text
      camPosEl.textContent  = (cameraVecs.cameraVec3 as number[]).map(n => n.toFixed(2)).join(', ');
      camPosWorldEl.textContent = (MathHelper.toWorld(cameraVecs.cameraVec3) as number[]).map(n => n.toFixed(2)).join(', ');
      camPosWcEl.textContent    = (MathHelper.toWc(cameraVecs.cameraVec3) as number[]).map(n => n.toFixed(2)).join(', ');
      camLookEl.textContent = (cameraVecs.lookAtVec3 as number[]).map(n => n.toFixed(2)).join(', ');
      groupNumEl.textContent = updateResult.interiorGroupNum || 0;
      bspNodeEl.textContent  = updateResult.nodeId || 0;

      fpsFrameCount++;
      const fpsElapsed = now - fpsLastTime;
      if (fpsElapsed >= 1000) {
        fpsEl.textContent = (fpsFrameCount / (fpsElapsed / 1000)).toFixed(2);
        fpsFrameCount = 0;
        fpsLastTime = now;
      }
    }
    requestAnimationFrame(renderLoop);
  }
  requestAnimationFrame(renderLoop);
}
