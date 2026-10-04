import {vec3} from 'gl-matrix'
import config from '../services/config';
import { BotWpFlags, botWpFlagNames } from '../wowRenderJs/manager/nodeManager';
import type Scene from '../wowRenderJs/scene';
import type { WanderNode } from '../services/gameplayApi';

/*
 * The Node Debugger (F7) and Spawn Browser (F8) windows, as my_web_wow's ImGui windows in WowViewer.cs
 * (BuildNodeDebugUI / BuildSpawnDebugUI), as DOM windows floating over the canvas. The node debugger lists
 * the current map's nodes only (the web version loads no other map's nodes), so it has no "current map
 * only" filter.
 */

export interface GameplayPanel {
    toggle(): void;
    /* called every frame; refreshes the live parts a few times a second */
    update(): void;
}

/* how often the nearest entry and the live positions are refreshed, in ms */
const RefreshInterval = 250;

function fileNameWithoutExtension(path: string): string {
    var name = path.substring(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1);
    var dot = name.lastIndexOf('.');
    return dot > 0 ? name.substring(0, dot) : name;
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function distance(a: ArrayLike<number>, b: ArrayLike<number>): number {
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/* a draggable window over the canvas, closed by its x; content goes into .gp-body */
function createWindow(containerEl: HTMLElement, title: string, left: number, top: number, width: number, height: number): HTMLDivElement {
    var win = document.createElement('div');
    win.className = 'gp-window';
    win.style.cssText = `position: absolute; left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px;
        display: none; flex-direction: column; background: rgba(40, 40, 40, 0.92); color: #ebdbb2; border: 1px solid #665c54;
        border-radius: 3px; font: 12px monospace; resize: both; overflow: hidden; z-index: 10;`;
    win.innerHTML = `
        <div class="gp-title" style="cursor: move; padding: 3px 6px; background: #3c3836; display: flex; justify-content: space-between;">
          <span>${title}</span><span class="gp-close" style="cursor: pointer;">x</span>
        </div>
        <div class="gp-body" style="flex: 1 1 auto; display: flex; flex-direction: column; min-height: 0; padding: 4px 6px; gap: 3px;"></div>`;
    containerEl.appendChild(win);

    win.querySelector<HTMLSpanElement>('.gp-close')!.addEventListener('click', () => { win.style.display = 'none'; });

    // drag by the title bar
    var title_ = win.querySelector<HTMLDivElement>('.gp-title')!;
    title_.addEventListener('mousedown', (e) => {
        var startX = e.clientX - win.offsetLeft, startY = e.clientY - win.offsetTop;
        var move = (ev: MouseEvent) => {
            win.style.left = (ev.clientX - startX) + 'px';
            win.style.top = (ev.clientY - startY) + 'px';
        };
        var up = () => {
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', up);
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
        e.preventDefault();
    });
    // typing into the window must not move the camera (the key binds listen on the document)
    win.addEventListener('keydown', (e) => { e.stopPropagation(); });
    win.addEventListener('keyup', (e) => { e.stopPropagation(); });
    // nor may clicks reach the canvas' drag handling
    win.addEventListener('mousedown', (e) => { e.stopPropagation(); });
    return win;
}

function isOpen(win: HTMLElement): boolean {
    return win.style.display !== 'none';
}

const listStyle = 'flex: 1 1 auto; min-height: 60px; overflow-y: auto; border: 1px solid #504945; padding: 2px;';
const rowStyle = 'cursor: pointer; white-space: nowrap;';
const selectedRowBackground = '#504945';
const nearestColor = '#80ff80';

// ======================== Node Debugger ========================

export function createNodeDebugger(containerEl: HTMLElement, sceneObj: Scene): GameplayPanel {
    var win = createWindow(containerEl, 'Node Debugger', 350, 30, 420, 550);
    var body = win.querySelector<HTMLDivElement>('.gp-body')!;

    var flagNames = Object.keys(BotWpFlags).filter((name) => name !== 'None' && name !== 'End') as (keyof typeof BotWpFlags)[];
    body.innerHTML = `
        <div class="gp-empty">No nodes loaded for this map (mpq server gameplay api).</div>
        <div class="gp-content" style="display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; gap: 3px;">
          <label>Search (id/coords) <input class="gp-search" type="text" style="width: 160px;"></label>
          <label><input class="gp-require-all" type="checkbox"> Require ALL flags</label>
          <details>
            <summary style="cursor: pointer;">Flag filter</summary>
            ${flagNames.map((name) => `<label style="display: block;"><input type="checkbox" class="gp-flag" data-flag="${BotWpFlags[name]}"> ${name}</label>`).join('')}
            <button class="gp-clear-flags">Clear flags</button>
          </details>
          <div class="gp-count"></div>
          <div><span class="gp-nearest" style="color: ${nearestColor};"></span> <button class="gp-select-nearest" style="display: none;">Select</button></div>
          <div class="gp-list" style="${listStyle}"></div>
          <div class="gp-detail" style="display: none; border-top: 1px solid #665c54; padding-top: 3px;">
            <div class="gp-detail-text"></div>
            <button class="gp-tele">Teleport here</button>
            <button class="gp-tele-link">Teleport to random link</button>
          </div>
        </div>`;

    var emptyEl = body.querySelector<HTMLDivElement>('.gp-empty')!;
    var contentEl = body.querySelector<HTMLDivElement>('.gp-content')!;
    var searchEl = body.querySelector<HTMLInputElement>('.gp-search')!;
    var requireAllEl = body.querySelector<HTMLInputElement>('.gp-require-all')!;
    var flagEls = Array.from(body.querySelectorAll<HTMLInputElement>('.gp-flag'));
    var countEl = body.querySelector<HTMLDivElement>('.gp-count')!;
    var nearestEl = body.querySelector<HTMLSpanElement>('.gp-nearest')!;
    var selectNearestEl = body.querySelector<HTMLButtonElement>('.gp-select-nearest')!;
    var listEl = body.querySelector<HTMLDivElement>('.gp-list')!;
    var detailEl = body.querySelector<HTMLDivElement>('.gp-detail')!;
    var detailTextEl = body.querySelector<HTMLDivElement>('.gp-detail-text')!;

    var selectedNodeId = -1;
    var lastRefresh = 0;
    var listedNodeCount = -1;

    function filterFlags(): number {
        var flags = 0;
        for (var el of flagEls) if (el.checked) flags |= Number(el.dataset.flag);
        return flags;
    }

    function filteredNodes(): WanderNode[] {
        var nm = sceneObj.nodeManager;
        if (!nm) return [];
        var filtered = nm.nodes;

        var flags = filterFlags();
        if (flags !== 0) {
            filtered = requireAllEl.checked
                ? filtered.filter((n) => (n.flags & flags) === flags)
                : filtered.filter((n) => (n.flags & flags) !== 0);
        }

        var q = searchEl.value.trim();
        if (q !== '') {
            filtered = filtered.filter((n) =>
                String(n.id).indexOf(q) >= 0 ||
                `${n.x.toFixed(0)},${n.y.toFixed(0)},${n.z.toFixed(0)}`.indexOf(q) >= 0);
        }
        return filtered;
    }

    function rebuildList() {
        var nm = sceneObj.nodeManager;
        listedNodeCount = nm ? nm.nodes.length : 0;
        emptyEl.style.display = listedNodeCount === 0 ? '' : 'none';
        contentEl.style.display = listedNodeCount === 0 ? 'none' : 'flex';

        var nodes = filteredNodes();
        countEl.textContent = nodes.length + ' nodes shown';

        var html: string[] = [];
        for (var node of nodes) {
            var label = `[${node.id}] (${node.x.toFixed(0)}, ${node.y.toFixed(0)}, ${node.z.toFixed(0)})`;
            if (node.flags !== BotWpFlags.None)
                label += '  ' + botWpFlagNames(node.flags);
            var background = node.id === selectedNodeId ? `background: ${selectedRowBackground};` : '';
            html.push(`<div class="gp-row" data-id="${node.id}" style="${rowStyle} ${background}">${escapeHtml(label)}</div>`);
        }
        listEl.innerHTML = html.join('');
        updateDetail();
    }

    function updateDetail() {
        var sel = selectedNodeId >= 0 && sceneObj.nodeManager ? sceneObj.nodeManager.getNode(selectedNodeId) : undefined;
        if (!sel) {
            selectedNodeId = -1;
            detailEl.style.display = 'none';
            return;
        }
        detailEl.style.display = '';
        detailTextEl.innerHTML = escapeHtml(`Node ${sel.id}  (map ${sel.mapId})`) + '<br/>' +
            escapeHtml(`Pos: ${sel.x.toFixed(2)}, ${sel.y.toFixed(2)}, ${sel.z.toFixed(2)}`) + '<br/>' +
            escapeHtml(`Flags: ${botWpFlagNames(sel.flags)}`) + '<br/>' +
            `<span style="white-space: normal;">${escapeHtml('Links: ' + (sel.links === '' ? '(none)' : sel.links))}</span>`;
    }

    function select(id: number) {
        selectedNodeId = id;
        rebuildList();
    }

    function teleportTo(node: WanderNode) {
        sceneObj.setCameraPos(node.x, node.y, node.z + 5);
        sceneObj.hud.currentNodeId = node.id;
    }

    searchEl.addEventListener('input', rebuildList);
    requireAllEl.addEventListener('change', rebuildList);
    for (var el of flagEls) el.addEventListener('change', rebuildList);
    body.querySelector<HTMLButtonElement>('.gp-clear-flags')!.addEventListener('click', () => {
        for (var el of flagEls) el.checked = false;
        rebuildList();
    });
    listEl.addEventListener('click', (e) => {
        var row = (e.target as HTMLElement).closest<HTMLElement>('.gp-row');
        if (row) select(Number(row.dataset.id));
    });
    selectNearestEl.addEventListener('click', () => {
        if (sceneObj.hud.currentNodeId >= 0) select(sceneObj.hud.currentNodeId);
    });
    body.querySelector<HTMLButtonElement>('.gp-tele')!.addEventListener('click', () => {
        var sel = sceneObj.nodeManager ? sceneObj.nodeManager.getNode(selectedNodeId) : undefined;
        if (!sel) return;
        teleportTo(sel);
        console.log("[NodeDebug] teleported to node " + sel.id);
    });
    body.querySelector<HTMLButtonElement>('.gp-tele-link')!.addEventListener('click', () => {
        var linked = sceneObj.nodeManager ? sceneObj.nodeManager.getRandomLinkedNode(selectedNodeId) : null;
        if (!linked) return;
        teleportTo(linked);
        console.log("[NodeDebug] -> linked node " + linked.id);
        select(linked.id);
    });

    return {
        toggle() {
            win.style.display = isOpen(win) ? 'none' : 'flex';
            if (isOpen(win)) rebuildList();
        },
        update() {
            sceneObj.hud.selectedNodeId = isOpen(win) ? selectedNodeId : -1;
            if (!isOpen(win)) return;

            var now = performance.now();
            if (now - lastRefresh < RefreshInterval) return;
            lastRefresh = now;

            // the nodes arrive after the window may have opened
            var nm = sceneObj.nodeManager;
            if ((nm ? nm.nodes.length : 0) !== listedNodeCount) rebuildList();

            // Show closest node to camera
            var closest = nm && sceneObj.hud.currentNodeId >= 0 ? nm.getNode(sceneObj.hud.currentNodeId) : undefined;
            if (closest) {
                nearestEl.textContent = `Nearest to camera: [${closest.id}] (${distance([closest.x, closest.y, closest.z], sceneObj.mainCamera).toFixed(0)}m)`;
                selectNearestEl.style.display = '';
            } else {
                nearestEl.textContent = '';
                selectNearestEl.style.display = 'none';
            }
        }
    };
}

// ======================== Spawn Browser ========================

export function createSpawnBrowser(containerEl: HTMLElement, sceneObj: Scene): GameplayPanel {
    var win = createWindow(containerEl, 'Spawn Browser', 350, 30, 480, 550);
    var body = win.querySelector<HTMLDivElement>('.gp-body')!;

    body.innerHTML = `
        <div class="gp-empty">No spawned entities.<br/>Use ?mode=CreatureMap or ?mode=SpellMap</div>
        <div class="gp-content" style="display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; gap: 3px;">
          <div class="gp-header"></div>
          <div><span class="gp-nearest" style="color: ${nearestColor};"></span> <button class="gp-select-nearest" style="display: none;">Select</button></div>
          <label>Search (path/key) <input class="gp-search" type="text" style="width: 200px;"></label>
          <div class="gp-count"></div>
          <div class="gp-list" style="${listStyle}"></div>
          <div class="gp-detail" style="display: none; border-top: 1px solid #665c54; padding-top: 3px;">
            <div class="gp-detail-text"></div>
            <button class="gp-tele">Teleport to entity</button>
            <button class="gp-target">Set as target</button>
          </div>
        </div>`;

    var emptyEl = body.querySelector<HTMLDivElement>('.gp-empty')!;
    var contentEl = body.querySelector<HTMLDivElement>('.gp-content')!;
    var headerEl = body.querySelector<HTMLDivElement>('.gp-header')!;
    var nearestEl = body.querySelector<HTMLSpanElement>('.gp-nearest')!;
    var selectNearestEl = body.querySelector<HTMLButtonElement>('.gp-select-nearest')!;
    var searchEl = body.querySelector<HTMLInputElement>('.gp-search')!;
    var countEl = body.querySelector<HTMLDivElement>('.gp-count')!;
    var listEl = body.querySelector<HTMLDivElement>('.gp-list')!;
    var detailEl = body.querySelector<HTMLDivElement>('.gp-detail')!;
    var detailTextEl = body.querySelector<HTMLDivElement>('.gp-detail-text')!;

    var selectedSpawnKey = -1;
    var nearestKey = -1;
    var lastRefresh = 0;
    var listedSpawnCount = -1;

    function rebuildList() {
        var sm = sceneObj.spawnManagerMap;
        listedSpawnCount = sm ? sm.spawnCount : 0;
        emptyEl.style.display = listedSpawnCount === 0 ? '' : 'none';
        contentEl.style.display = listedSpawnCount === 0 ? 'none' : 'flex';
        if (!sm) return;

        headerEl.textContent = `Mode: ${config.getGameplayMode()} | ${sm.spawnCount} entities`;

        var entities = sm.spawnedEntities;
        var q = searchEl.value.trim().toLowerCase();
        if (q !== '') {
            entities = entities.filter((e) =>
                e.modelPath.toLowerCase().indexOf(q) >= 0 ||
                String(e.objectMapKey).indexOf(q) >= 0);
        }
        countEl.textContent = entities.length + ' shown';

        var html: string[] = [];
        for (var e of entities) {
            var pos = e.unit.getPosition();
            var label = `[${e.objectMapKey}] ${fileNameWithoutExtension(e.modelPath)} (${pos[0].toFixed(0)},${pos[1].toFixed(0)},${pos[2].toFixed(0)})`;
            var background = e.objectMapKey === selectedSpawnKey ? `background: ${selectedRowBackground};` : '';
            html.push(`<div class="gp-row" data-key="${e.objectMapKey}" style="${rowStyle} ${background}">${escapeHtml(label)}</div>`);
        }
        listEl.innerHTML = html.join('');
        updateDetail();
    }

    function updateDetail() {
        var sel = selectedSpawnKey >= 0 && sceneObj.spawnManagerMap ? sceneObj.spawnManagerMap.getByKey(selectedSpawnKey) : undefined;
        if (!sel) {
            selectedSpawnKey = -1;
            detailEl.style.display = 'none';
            return;
        }
        detailEl.style.display = '';
        var livePos = sel.unit.getPosition();
        detailTextEl.innerHTML = escapeHtml(`Key: ${sel.objectMapKey}`) + '<br/>' +
            `<span style="white-space: normal;">${escapeHtml('Model: ' + sel.modelPath)}</span><br/>` +
            escapeHtml(`Spawn: ${sel.spawnPosition[0].toFixed(1)}, ${sel.spawnPosition[1].toFixed(1)}, ${sel.spawnPosition[2].toFixed(1)}`) + '<br/>' +
            escapeHtml(`Live:  ${livePos[0].toFixed(1)}, ${livePos[1].toFixed(1)}, ${livePos[2].toFixed(1)}`) + '<br/>' +
            escapeHtml(`Type: ${sel.isSpellModel ? 'Spell' : 'Creature'}`);
    }

    function select(key: number) {
        selectedSpawnKey = key;
        rebuildList();
    }

    searchEl.addEventListener('input', rebuildList);
    listEl.addEventListener('click', (e) => {
        var row = (e.target as HTMLElement).closest<HTMLElement>('.gp-row');
        if (row) select(Number(row.dataset.key));
    });
    selectNearestEl.addEventListener('click', () => {
        if (nearestKey >= 0) select(nearestKey);
    });
    body.querySelector<HTMLButtonElement>('.gp-tele')!.addEventListener('click', () => {
        var sel = sceneObj.spawnManagerMap ? sceneObj.spawnManagerMap.getByKey(selectedSpawnKey) : undefined;
        if (!sel) return;
        var livePos = sel.unit.getPosition();
        sceneObj.setCameraPos(livePos[0], livePos[1], livePos[2] + 5);
        console.log("[SpawnBrowser] Teleported to " + sel.objectMapKey);
    });
    body.querySelector<HTMLButtonElement>('.gp-target')!.addEventListener('click', () => {
        var sel = sceneObj.spawnManagerMap ? sceneObj.spawnManagerMap.getByKey(selectedSpawnKey) : undefined;
        if (!sel) return;
        // the C# only logs here; the web version also makes it the spell target when there is a player character
        if (sceneObj.spellManager) sceneObj.spellManager.setTargetByKey(sel.objectMapKey);
        console.log("[SpawnBrowser] Selected " + sel.objectMapKey + " (" + sel.modelPath + ")");
    });

    return {
        toggle() {
            win.style.display = isOpen(win) ? 'none' : 'flex';
            if (isOpen(win)) rebuildList();
        },
        update() {
            // Pass selected key to HUD for world-space marker
            sceneObj.hud.spawnSelectedEntityKey = isOpen(win) ? selectedSpawnKey : -1;
            if (!isOpen(win)) return;

            var now = performance.now();
            if (now - lastRefresh < RefreshInterval) return;
            lastRefresh = now;

            // the spawns arrive after the window may have opened
            var sm = sceneObj.spawnManagerMap;
            if ((sm ? sm.spawnCount : 0) !== listedSpawnCount) rebuildList();
            else updateDetail();

            // Show closest entity to camera
            var cam = sceneObj.mainCamera;
            var closest = sm ? sm.findClosestEntityWithDist(vec3.fromValues(cam[0], cam[1], cam[2])) : null;
            if (closest !== null) {
                nearestKey = closest.entity.objectMapKey;
                nearestEl.textContent = `Nearest to camera: ${fileNameWithoutExtension(closest.entity.modelPath)} [${nearestKey}] (${closest.distance.toFixed(0)}m)`;
                selectNearestEl.style.display = '';
            } else {
                nearestKey = -1;
                nearestEl.textContent = '';
                selectNearestEl.style.display = 'none';
            }
        }
    };
}
