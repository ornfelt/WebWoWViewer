import {vec3} from 'gl-matrix'
import config from '../../services/config'
import gameplayApi from '../../services/gameplayApi'
import WanderController from '../objects/wanderController'
import type WorldUnit from '../objects/worldObjects/worldUnit';
import type NodeManager from './nodeManager';
import type Hud from '../hud/hud';
import type { AnimationTypeValue } from './playerAnimationState';

/* the path cache: start and end within this distance of a cached path's reuse it (NavigationPathCache.PositionTolerance) */
const PositionTolerance = 3.0;

interface PathEntry {
    start: vec3;
    end: vec3;
    points: vec3[];
}

/*
 * The wandering bots: one WanderController per registered unit, with the paths from the mpq server's
 * navigation (the expansion's navigation library), as my_web_wow's WanderManager.cs. The C# keeps its
 * NavigationPathCache on disk and prewarms it from the node links; the web version keeps it in memory for
 * the session and fills it on demand.
 */
class WanderManager {
    mapId: number;
    nodeManager: NodeManager;
    hud: Hud | null;
    setUnitAnimation: (unit: WorldUnit, animType: AnimationTypeValue) => void;
    controllers: Map<number, WanderController>;

    useNavCache: boolean;
    pathCache: PathEntry[];
    // logged once when navigation is off and the bots walk straight lines
    straightLineLogged: boolean;

    constructor(mapId: number, nodeManager: NodeManager, hud: Hud | null,
                setUnitAnimation: (unit: WorldUnit, animType: AnimationTypeValue) => void) {
        this.mapId = mapId;
        this.nodeManager = nodeManager;
        this.hud = hud;
        this.setUnitAnimation = setUnitAnimation;
        this.controllers = new Map();
        this.useNavCache = true;
        this.pathCache = [];
        this.straightLineLogged = false;
    }

    /* Register a WorldUnit to wander. It will be placed at a random node. */
    registerWanderer(objectMapKey: number, unit: WorldUnit, moveSpeed = 7) {
        var spawnNode = this.nodeManager.getRandomNode();
        if (spawnNode === null) {
            console.log("[WanderManager] No nodes for map " + this.mapId + ", cannot register wanderer " + objectMapKey);
            return;
        }

        var controller = new WanderController(unit, this.nodeManager, spawnNode,
            (start, end) => this.calculatePath(start, end), this.setUnitAnimation, moveSpeed);
        controller.setEnabled(config.getEnableWandering());
        this.controllers.set(objectMapKey, controller);
        console.log("[WanderManager] Registered wanderer " + objectMapKey + " at node " + spawnNode.id +
            " (" + spawnNode.x.toFixed(0) + "," + spawnNode.y.toFixed(0) + "," + spawnNode.z.toFixed(0) + ")");
    }

    isWanderer(objectMapKey: number): boolean {
        return this.controllers.has(objectMapKey);
    }

    /* Toggle wandering on/off for a specific unit. */
    setWandering(objectMapKey: number, enabled: boolean) {
        var ctrl = this.controllers.get(objectMapKey);
        if (ctrl) ctrl.setEnabled(enabled);
    }

    /* Toggle all wandering on/off. */
    setAllWandering(enabled: boolean) {
        for (var ctrl of this.controllers.values())
            ctrl.setEnabled(enabled);
    }

    /* Called from the scene each frame. */
    update(deltaTime: number) {
        for (var ctrl of this.controllers.values())
            ctrl.update(deltaTime);

        // Feed every wanderer's current path to the debug HUD (only when the overlay is on,
        // so we don't allocate the path lists every frame for nothing).
        if (this.hud && (config.getDrawPathLines() || config.getDrawPathPoints()))
            this.hud.setDebugPaths(this.getAllPaths());
    }

    // --- Navigation helpers ---

    /* All current wander paths (one per registered controller). */
    getAllPaths(): vec3[][] {
        var result: vec3[][] = [];
        for (var ctrl of this.controllers.values()) {
            var p = ctrl.currentPath;
            if (p !== null && p.length >= 2) result.push(p);
        }
        return result;
    }

    calculatePath(start: vec3, end: vec3): Promise<vec3[]> {
        if (this.useNavCache) {
            var cached = this.findCachedPath(start, end);
            if (cached !== null) return Promise.resolve(cached.points.map((p) => vec3.clone(p)));

            return this.calculatePathRaw(start, end).then((path) => {
                // Avoid storing degenerate paths
                if (path.length >= 2)
                    this.pathCache.push({ start: vec3.clone(start), end: vec3.clone(end), points: path.map((p) => vec3.clone(p)) });
                return path;
            });
        }
        return this.calculatePathRaw(start, end);
    }

    findCachedPath(start: vec3, end: vec3): PathEntry | null {
        for (var e of this.pathCache) {
            if (vec3.distance(e.start, start) <= PositionTolerance && vec3.distance(e.end, end) <= PositionTolerance)
                return e;
        }
        return null;
    }

    async calculatePathRaw(start: vec3, end: vec3): Promise<vec3[]> {
        var result = await gameplayApi.calculatePath(this.mapId, start, end);

        if (result === null) {
            // navigation not available - return straight line
            if (!this.straightLineLogged) {
                console.log("[WanderManager] CalculatePath failed. Returning straight lines...");
                this.straightLineLogged = true;
            }
            return [vec3.clone(start), vec3.clone(end)];
        }

        if (result.path.length < 2)
            return [vec3.clone(start), vec3.clone(end)];

        return result.path.map((p) => vec3.fromValues(p.x, p.y, p.z));
    }
}

export default WanderManager;
