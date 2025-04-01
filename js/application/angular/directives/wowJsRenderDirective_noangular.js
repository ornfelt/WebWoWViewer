import Scene from './../wowRenderJs/scene.js';
import config from './../services/config.js';
import WorldUnit from '../wowRenderJs/objects/worldObjects/worldUnit.js';
import WorldPlayer from '../wowRenderJs/objects/worldObjects/worldPlayer.js';
import {vec3} from 'gl-matrix'

/**
 * Attach pointer-lock, mouse, keyboard, touch events to the canvas/camera.
 */
function attachEvents(canvas, camera) {
  let mleftPressed = false;
  let lastMouseX = 0, lastMouseY = 0;
  let pointerIsLocked = false;

  function keyDown(event) {
    const key = String.fromCharCode(event.keyCode || event.charCode);
    switch (key) {
      case 'W': camera.startMovingForward();   break;
      case 'S': camera.startMovingBackwards(); break;
      case 'A': camera.startStrafingLeft();    break;
      case 'D': camera.startStrafingRight();   break;
      case 'Q': camera.startMovingUp();        break;
      case 'E': camera.startMovingDown();      break;
    }
  }
  function keyUp(event) {
    const key = String.fromCharCode(event.keyCode || event.charCode);
    switch (key) {
      case 'W': camera.stopMovingForward();   break;
      case 'S': camera.stopMovingBackwards(); break;
      case 'A': camera.stopStrafingLeft();    break;
      case 'D': camera.stopStrafingRight();   break;
      case 'Q': camera.stopMovingUp();        break;
      case 'E': camera.stopMovingDown();      break;
    }
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

  // only move camera if lastDownTarget = canvas
  let lastDownTarget = null;
  document.addEventListener('mousedown', (e) => { lastDownTarget = e.target; });
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
  // 1) Create HTML structure (canvas + simple debug panel)
  containerEl.innerHTML = `
    <div style="width: 100%; height: 100%; position: relative; overflow: hidden;">
      <canvas id="wow-canvas" style="float:left; display:block;"></canvas>

      <div style="display:inline-block; float:left; width: 225px; margin-left:10px; color: white;">
        <div>camera = (<span id="cam-pos"></span>)</div>
        <div>lookAt = (<span id="cam-look"></span>)</div>
        <div>Group # = <span id="group-num"></span></div>
        <div>BSP Node = <span id="bsp-node"></span></div>
        <p>
          Controls: W - forward, S - backward, A - left, D - right,<br/>
          Q - up, E - down, Mouse - move camera
        </p>

        <label><input type="checkbox" id="chkDrawAdt"> Draw ADT</label><br/>
        <label><input type="checkbox" id="chkDrawM2"> Draw M2</label><br/>
        <label><input type="checkbox" id="chkDrawPortals"> Draw Portals</label><br/>
        <label><input type="checkbox" id="chkDrawM2BB"> Draw M2 BB</label><br/>
        <label><input type="checkbox" id="chkDrawWmoBB"> Draw WMO BB</label><br/>
        <label><input type="checkbox" id="chkDrawBSP"> Draw BSP</label><br/>
        <label><input type="checkbox" id="chkDrawDepth"> Draw Depth</label><br/>
        <label><input type="checkbox" id="chkUsePortalCulling"> Portal Culling</label><br/>
        <label><input type="checkbox" id="chkDoubleCamera"> Double Camera Debug</label><br/>
        <label><input type="checkbox" id="chkUseSecondCamera" disabled> Use Debug Camera</label><br/><br/>

        <button id="btnCopyDebug">Copy main camera -> debug camera</button><br/><br/>
        <button id="btnLoadPackets">Parse packets</button><br/>
        <button id="btnLoadAllPackets">Parse all packets</button><br/>
      </div>
    </div>
  `;

  // 2) Grab references
  const canvas = containerEl.querySelector('#wow-canvas');
  const camPosEl = containerEl.querySelector('#cam-pos');
  const camLookEl = containerEl.querySelector('#cam-look');
  const groupNumEl = containerEl.querySelector('#group-num');
  const bspNodeEl = containerEl.querySelector('#bsp-node');

  const chkDrawAdt          = containerEl.querySelector('#chkDrawAdt');
  const chkDrawM2           = containerEl.querySelector('#chkDrawM2');
  const chkDrawPortals      = containerEl.querySelector('#chkDrawPortals');
  const chkDrawM2BB         = containerEl.querySelector('#chkDrawM2BB');
  const chkDrawWmoBB        = containerEl.querySelector('#chkDrawWmoBB');
  const chkDrawBSP          = containerEl.querySelector('#chkDrawBSP');
  const chkDrawDepth        = containerEl.querySelector('#chkDrawDepth');
  const chkUsePortalCulling = containerEl.querySelector('#chkUsePortalCulling');
  const chkDoubleCamera     = containerEl.querySelector('#chkDoubleCamera');
  const chkUseSecondCamera  = containerEl.querySelector('#chkUseSecondCamera');

  const btnCopyDebug      = containerEl.querySelector('#btnCopyDebug');
  const btnLoadPackets    = containerEl.querySelector('#btnLoadPackets');
  const btnLoadAllPackets = containerEl.querySelector('#btnLoadAllPackets');

  // 3) Size the canvas
  const containerW = containerEl.clientWidth;
  const containerH = containerEl.clientHeight;
  canvas.width  = Math.floor(containerW * 0.79);
  canvas.height = containerH;

  // 4) Create Scene
  const sceneObj = new Scene(canvas);

  // 5) Hard-code params
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
    //    name: 'Darkshire',
    //    source: 'http',
    //    sceneType: 'map',
    //    //mapId: 0,
    //    mapName: 'Azeroth',
    //    x: -10559.7,
    //    y: -1189.02,
    //    z: 29.0698
    //}

    const mapParams = {
        name: 'stv',
        source: 'http',
        sceneType: 'map',
        //mapId: 0,
        mapName: 'Azeroth',
        x: -13325.42,
        y: 110.50,
        z: 54.79
    }

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
    //    mapId: 0,
    //    mapName: 'Kalimdor',
    //    x: -8181.35,
    //    y: -4596.92,
    //    z: -125.34
    //}

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

        //newWorldUnit.setDisplayId(11121);
        //newWorldUnit.setNativeDisplayId(11121);
        // Drake
        newWorldUnit.setDisplayId(5645);
        newWorldUnit.setNativeDisplayId(5645);

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

  // 6) Initialize config + checkbox states
  chkDrawAdt.checked          = config.getRenderAdt();
  chkDrawM2.checked           = config.getRenderM2();
  chkDrawPortals.checked      = config.getRenderPortals();
  chkDrawM2BB.checked         = config.getDrawM2BB();
  chkDrawWmoBB.checked        = config.getDrawWmoBB();
  chkDrawBSP.checked          = config.getRenderBSP();
  chkDrawDepth.checked        = config.getDrawDepthBuffer();
  chkUsePortalCulling.checked = config.getUsePortalCulling();
  chkDoubleCamera.checked     = config.getDoubleCameraDebug();
  chkUseSecondCamera.checked  = config.getUseSecondCamera();
  chkUseSecondCamera.disabled = !chkDoubleCamera.checked;

  // 7) Attach event handlers for camera
  attachEvents(canvas, sceneObj.camera);

  // 8) Link checkboxes => config
  chkDrawAdt.addEventListener('change', () => { config.setRenderAdt(chkDrawAdt.checked); });
  chkDrawM2.addEventListener('change', () => { config.setRenderM2(chkDrawM2.checked); });
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
  chkUseSecondCamera.addEventListener('change', () => {
    config.setUseSecondCamera(chkUseSecondCamera.checked);
  });

  // 9) Buttons
  btnCopyDebug.addEventListener('click', () => {
    sceneObj.copyFirstCameraToDebugCamera();
  });
  btnLoadPackets.addEventListener('click', () => {
    sceneObj.loadPackets();
  });
  btnLoadAllPackets.addEventListener('click', () => {
    sceneObj.loadAllPackets();
  });

  // 10) Render loop
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
