import Scene from './../wowRenderJs/scene.js';
import config from './../services/config.js';
import WorldUnit from '../wowRenderJs/objects/worldObjects/worldUnit.js';
import WorldPlayer from '../wowRenderJs/objects/worldObjects/worldPlayer.js';
import {vec3} from 'gl-matrix'

/**
 * Attach pointer-lock, mouse, keyboard, touch events to the canvas/camera.
 */
function attachEvents(canvas, camera, keyBinds) {
  let mleftPressed = false;
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
    // bind F6: toggle the settings panel (instead of the browser's own F6 action)
    if (event.key === 'F6') {
      event.preventDefault();
      keyBinds.settingsPanel.style.display = keyBinds.settingsPanel.style.display === 'none' ? '' : 'none';
      return;
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

  function mouseDown(event) {
    if (event.button === 0) {
      mleftPressed = true;
      lastMouseX = event.pageX;
      lastMouseY = event.pageY;
    }
  }
  function mouseUp(event) {
    if (event.button === 0) {
      mleftPressed = false;
    }
  }
  function mouseMove(event) {
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
    <div style="width: 100%; height: 100%; position: relative; overflow: hidden;">
      <canvas id="wow-canvas" style="float:left; display:block;"></canvas>

      <div id="settings-panel" style="display:inline-block; float:left; width: 225px; margin-left:10px; color: white;">
        <div>camera = (<span id="cam-pos"></span>)</div>
        <div>lookAt = (<span id="cam-look"></span>)</div>
        <div>Group # = <span id="group-num"></span></div>
        <div>BSP Node = <span id="bsp-node"></span></div>
        <p>
          Controls: W - forward, S - backward, A - left, D - right,<br/>
          Space - up, Tab - down, Shift - faster, Mouse - move camera<br/>
          B - M2, Z - ADT, O - WMO, I - WMO BB, K - depth,<br/>
          Q - liquid, E - sky, F - draw distance, F6 - hide this panel,<br/>
          L - lowres terrain, Wheel - zoom
        </p>

        <label><input type="checkbox" id="chkDrawAdt"> Draw ADT</label><br/>
        <label><input type="checkbox" id="chkDrawM2"> Draw M2</label><br/>
        <label><input type="checkbox" id="chkDrawWMO"> Draw WMO</label><br/>
        <label><input type="checkbox" id="chkRenderSky"> Render Sky</label><br/>
        <label><input type="checkbox" id="chkRenderLiquid"> Render Liquid</label><br/>
        <label><input type="checkbox" id="chkRenderLowresTerrain"> Render Lowres Terrain</label><br/>
        <label><input type="checkbox" id="chkDrawPortals"> Draw Portals</label><br/>
        <label><input type="checkbox" id="chkDrawM2BB"> Draw M2 BB</label><br/>
        <label><input type="checkbox" id="chkDrawWmoBB"> Draw WMO BB</label><br/>
        <label><input type="checkbox" id="chkDrawBSP"> Draw BSP</label><br/>
        <label><input type="checkbox" id="chkDrawDepth"> Draw Depth</label><br/>
        <label><input type="checkbox" id="chkUsePortalCulling"> Portal Culling</label><br/>
        <label><input type="checkbox" id="chkDoubleCamera"> Double Camera Debug</label><br/>
        <label><input type="checkbox" id="chkUseSecondCamera" disabled> Use Debug Camera</label><br/>
        <label><input type="checkbox" id="chkCycleAnimations"> Cycle Anims</label><br/>
        <label>Draw Distance = <span id="draw-distance"></span><br/>
          <input type="range" id="sliderDrawDistance" min="100" max="2000" step="1"></label><br/><br/>

        <button id="btnCopyDebug">Copy main camera -> debug camera</button><br/><br/>
        <button id="btnLoadPackets">Parse packets</button><br/>
        <button id="btnLoadAllPackets">Parse all packets</button><br/>
      </div>
    </div>
  `;

  // Grab references
  const canvas = containerEl.querySelector('#wow-canvas');
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
  const chkDrawPortals      = containerEl.querySelector('#chkDrawPortals');
  const chkDrawM2BB         = containerEl.querySelector('#chkDrawM2BB');
  const chkDrawWmoBB        = containerEl.querySelector('#chkDrawWmoBB');
  const chkDrawBSP          = containerEl.querySelector('#chkDrawBSP');
  const chkDrawDepth        = containerEl.querySelector('#chkDrawDepth');
  const chkUsePortalCulling = containerEl.querySelector('#chkUsePortalCulling');
  const chkDoubleCamera     = containerEl.querySelector('#chkDoubleCamera');
  const chkUseSecondCamera  = containerEl.querySelector('#chkUseSecondCamera');
  const chkCycleAnimations  = containerEl.querySelector('#chkCycleAnimations');
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

  // Hard-code params
    //const mapParams = {
    //    name: 'Shattrath city (WotLK)',
    //    source: 'http',
    //    sceneType: 'map',
    //    mapId: 530,
    //    mapName: 'Expansion01',
    //    x: -1663,
    //    y: 5098,
    //    z: 27
    //};

    //const mapParams = {
    //    name: 'Nagrand (WotLK)',
    //    source: 'http',
    //    sceneType: 'map',
    //    mapId: 530,
    //    mapName: 'Expansion01',
    //    x: -743,
    //    y: 8385,
    //    z: 33
    //};

    //const mapParams = {
    //    name: 'Nagrand arena',
    //    source: 'http',
    //    sceneType: 'map',
    //    mapId: 559,
    //    mapName: 'PVPZone05',
    //    x: 4084.11, y:	2869.94, z:	12.1
    //};

    //const mapParams = {
    //  name: 'Eye of Storm',
    //  source: 'http',
    //  sceneType: 'map',
    //  //mapId: 566,
    //  mapName: 'NetherstormBG',
    //  x: 2110,
    //  y: 1489,
    //  z: 1474
    //}

    //const mapParams = {
    //  name: 'AV',
    //  source: 'http',
    //  sceneType: 'map',
    //  //mapId: 30,
    //  mapName: 'PVPZone01',
    //  x: -531,
    //  y: 0,
    //  z: 267
    //}

    //const mapParams = {
    //  name: 'WSG',
    //  source: 'http',
    //  sceneType: 'map',
    //  //mapId: 489,
    //  mapName: 'PVPZone03',
    //  x: 1101,
    //  y: 1313,
    //  z: 568
    //}

    //const mapParams = {
    //  name: 'AB',
    //  source: 'http',
    //  sceneType: 'map',
    //  //mapId: 529,
    //  mapName: 'PVPZone04',
    //  x: 1177,
    //  y: 841,
    //  z: 176
    //}

    //const mapParams = {
    //    name: 'Darkshire',
    //    source: 'http',
    //    sceneType: 'map',
    //    //mapId: 0,
    //    mapName: 'Azeroth',
    //    x: -10559.7,
    //    y: -1189.02,
    //    z: 29.0698
    //}

    //const mapParams = {
    //    name: 'Northrend Dragonblight',
    //    source: 'http',
    //    sceneType: 'map',
    //    //mapId: 571,
    //    mapName: 'Northrend',
    //    x: 4134.04,
    //    y: 1029.00,
    //    z: 148.33
    //}

    //const mapParams = {
    //    name: 'Northrend Sholazar',
    //    source: 'http',
    //    sceneType: 'map',
    //    //mapId: 571,
    //    mapName: 'Northrend',
    //    x: 5307.26,
    //    y: 5606.34,
    //    z: -77.70
    //}

    //const mapParams = {
    //    name: 'stv',
    //    source: 'http',
    //    sceneType: 'map',
    //    //mapId: 0,
    //    mapName: 'Azeroth',
    //    x: -13325.42,
    //    y: 110.50,
    //    z: 54.79
    //}

    //const mapParams = {
    //    name: 'Forsaken start',
    //    source: 'http',
    //    sceneType: 'map',
    //    //mapId: 0,
    //    mapName: 'Azeroth',
    //    x: 2000,
    //    y: 1600,
    //    z: 137
    //}

    //const mapParams = {
    //    name: 'elwyn forest tree',
    //    source: 'http',
    //    sceneType: 'm2',
    //    modelName: 'world\\azeroth\\elwynn\\passivedoodads\\trees\\elwynntreecanopy03.m2'
    //}

    //const mapParams = {
    //    name: 'Vanilla Opening screen',
    //    source: 'http',
    //    sceneType: 'm2',
    //    modelName: 'Interface\\GLUES\\MODELS\\UI_MAINMENU\\UI_MainMenu.m2',
    //    cameraIndex: 0,
    //    fogStart : 0,
    //    fogEnd : 1200,
    //    fogColor : [0.25, 0.06, 0.015]
    //}

    //const mapParams = {
    //    name: 'Caverns of Time',
    //    source: 'http',
    //    sceneType: 'map',
    //    mapId: 1,
    //    mapName: 'Kalimdor',
    //    x: -8181.35,
    //    y: -4596.92,
    //    z: -125.34
    //}

    const mapParams = {
        name: 'Orgrimmar',
        source: 'http',
        sceneType: 'map',
        mapId: 1,
        mapName: 'Kalimdor',
        x: 1096.1,
        y: -4549.0,
        z: 135.0
    }

    //const mapParams = {
    //    name: 'Darkshire blacksmith',
    //    source: 'http',
    //    sceneType: 'wmo',
    //    fileName: 'WORLD\\WMO\\AZEROTH\\BUILDINGS\\DUSKWOOD_BLACKSMITH\\DUSKWOOD_BLACKSMITH.WMO'
    //}

    //const mapParams = {
    //    name: 'arena wmo',
    //    source: 'http',
    //    sceneType: 'wmo',
    //    useDebugSky: true,
    //    fileName: 'world\\wmo\\pvp\\buildings\\lordaeron\\pvp_lordaeron_arena.wmo'
    //    //fileName: 'world\\wmo\\pvp\\buildings\\dalaran\\dalaran_sewer_arena.wmo'
    //    //fileName: 'world\\wmo\\pvp\\buildings\\dalaran\\dalaran_sewer_arena.wmo'
    //    //fileName: 'world\\wmo\\pvp\\buildings\\ancientorcarena\\ancorc_pvpstadium.wmo' // Nagrand arena!
    //    //fileName: 'world\\wmo\\dungeon\\ol_ogrehuts\\pvp_ogre_arena01.wmo'
    //    //fileName: 'world\\wmo\\azeroth\\collidable doodads\\stranglethorn\\stranglethornarena\\stranglegladiatorarena.wmo'
    //    // This one failed
    //    //fileName: 'world\\wmo\\pvp\\buildings\\orgrimmar\\orgrimmararena.wmo'
    //}

    //const mapParams = {
    //    name: 'Penguin',
    //    source: 'http',
    //    sceneType: 'm2',
    //    modelName: 'creature/northrendpenguin/northrendpenguin.m2',
    //    //cameraIndex: 0
    //}

    //const mapParams = {
    //    name: 'ragnaros',
    //    source: 'http',
    //    sceneType: 'm2',
    //    modelName: 'creature\\ragnaros\\ragnaros.m2',
    //}

    //const mapParams = {
    //    name: 'drake',
    //    source: 'http',
    //    sceneType: 'm2',
    //    modelName: 'creature\\drake\\drake.mdx',
    //}

    //const mapParams = {
    //    name: 'wintertree02',
    //    source: 'http',
    //    sceneType: 'm2',
    //    modelName: 'world\\khazmodan\\ironforge\\passivedoodads\\trees\\wintertree02.m2',
    //}

    //const mapParams = {
    //    name: 'Test fireball',
    //    source: 'http',
    //    sceneType: 'm2',
    //    modelName: 'spells\\fireball_missile_low.m2'
    //}

    // TODO: test individual adt, more WMOs and models...

  const useDebugSky = mapParams.useDebugSky === true;
  if (useDebugSky) {
    config.setRenderSky(true);
    config.setUseDebugSky(true);
  }

  // Create Scene
  const sceneObj = new Scene(canvas);

  // Disable lowres terrain and sky rendering if not running map mode
  if (mapParams.sceneType != 'map') {
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

    if (mapParams.sceneType == 'map') {
        sceneObj.loadMap(mapParams.mapName, adt_x, adt_y);
        sceneObj.setCameraPos(mapParams.x, mapParams.y, mapParams.z);
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

        // TODO: should look up DisplayId via name instead...
        const normalizedModelName = mapParams.modelName.toLowerCase().replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(".mdx", ".m2");

        // Penguin
        if (normalizedModelName === "creature/northrendpenguin/northrendpenguin.m2") {
          newWorldUnit.setDisplayId(24978);
          newWorldUnit.setNativeDisplayId(24978);
        } else if (normalizedModelName === "creature/drake/drake.m2") {
          newWorldUnit.setDisplayId(5645);
          newWorldUnit.setNativeDisplayId(5645);
        } else {
          // Default to ragnaros
          newWorldUnit.setDisplayId(11121);
          newWorldUnit.setNativeDisplayId(11121);
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
    settingsPanel: containerEl.querySelector('#settings-panel'),
    chkDrawM2,
    chkDrawAdt,
    chkDrawWMO,
    chkDrawWmoBB,
    chkDrawDepth,
    chkRenderLiquid,
    chkRenderLowresTerrain,
    chkRenderSky,
    sliderDrawDistance,
  });

  // Link checkboxes => config
  chkDrawAdt.addEventListener('change', () => { config.setRenderAdt(chkDrawAdt.checked); });
  chkDrawM2.addEventListener('change', () => { config.setRenderM2(chkDrawM2.checked); });
  chkDrawWMO.addEventListener('change', () => { config.setRenderWMO(chkDrawWMO.checked); });
  chkRenderSky.addEventListener('change', () => { config.setRenderSky(chkRenderSky.checked); });
  chkRenderLiquid.addEventListener('change', () => { config.setRenderLiquid(chkRenderLiquid.checked); });
  chkRenderLowresTerrain.addEventListener('change', () => { config.setRenderLowresTerrain(chkRenderLowresTerrain.checked); });
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
  let lastTimeStamp = undefined;

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
      camLookEl.textContent = cameraVecs.lookAtVec3.map(n => n.toFixed(2)).join(', ');
      groupNumEl.textContent = updateResult.interiorGroupNum || 0;
      bspNodeEl.textContent  = updateResult.nodeId || 0;
    }
    requestAnimationFrame(renderLoop);
  }
  requestAnimationFrame(renderLoop);
}
