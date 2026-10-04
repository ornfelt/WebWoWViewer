import {vec3} from 'gl-matrix'
import WorldPlayer from '../objects/worldObjects/worldPlayer'
import gameplayApi from '../../services/gameplayApi'
import type { SceneApi } from '../sceneApi';
import type WorldObjectManager from './worldObjectManager';
import type { WanderNode } from '../../services/gameplayApi';

/*
 * The CreatureMap / SpellMap gameplay modes: random creature or spell models spawned at the map's wander
 * nodes, picked far apart. Based on my_web_wow's SpawnManager.cs. The C# takes its spawn points from the
 * navigation path cache first and the nodes only as a fallback; the web version has no path cache, so it
 * always uses the nodes.
 */

export interface SpawnedEntityInfo {
    objectMapKey: number;
    modelPath: string;
    spawnPosition: vec3;
    unit: WorldPlayer;
    isSpellModel: boolean;
}

/* the objectMap keys of the spawned models, apart from the packet GUIDs */
const SPAWN_KEY_BASE = 50000000;

class SpawnManager {
    sceneApi: SceneApi;
    worldObjectManager: WorldObjectManager;
    mapId: number;
    spawnedEntities: SpawnedEntityInfo[];
    nextSpawnKey: number;

    constructor(sceneApi: SceneApi, worldObjectManager: WorldObjectManager, mapId: number) {
        this.sceneApi = sceneApi;
        this.worldObjectManager = worldObjectManager;
        this.mapId = mapId;
        this.spawnedEntities = [];
        this.nextSpawnKey = SPAWN_KEY_BASE;
    }

    get spawnCount(): number {
        return this.spawnedEntities.length;
    }

    /* loads the map's nodes and the model list from the mpq server and spawns; resolves to the spawn count */
    async initializeAndSpawn(isSpellMap: boolean): Promise<number> {
        var nodes = await gameplayApi.loadWanderNodes(this.mapId);
        if (nodes.length === 0) {
            console.log("[SpawnManager] Map " + this.mapId + " has no nodes, spawning unavailable.");
            return 0;
        }

        var models = await gameplayApi.loadModelList(isSpellMap ? 'spells' : 'creatures');
        if (models.length === 0) {
            console.log("[SpawnManager] No " + (isSpellMap ? "spell" : "creature") + " models available, spawning unavailable.");
            return 0;
        }

        this.spawnAll(isSpellMap, nodes, models);
        return this.spawnCount;
    }

    spawnAll(isSpellMap: boolean, nodes: WanderNode[], models: string[]) {
        var minSpawnDistance = 20;
        var maxSpawns: number | null = null;

        switch (this.mapId) {
            case 0: case 1: case 530: case 571:
                minSpawnDistance = 80;
                maxSpawns = 1000;
                break;
        }

        var spawnPoints = this.getNodePositionsAsSpawnPoints(nodes, minSpawnDistance, maxSpawns);
        console.log("[SpawnManager] Nodes yielded " + spawnPoints.length + " spawn points");

        if (spawnPoints.length === 0) {
            console.log("[SpawnManager] No spawn points available at all.");
            return;
        }

        var successCount = 0;
        for (var p of spawnPoints) {
            // the server has left out the blacklisted models already
            var modelPath = models[Math.floor(Math.random() * models.length)];

            var wp = new WorldPlayer(this.sceneApi);
            wp.setDisplayId(-1);
            wp.setNativeDisplayId(-1);
            wp.modelPathInput = modelPath;
            wp.setScale(1.0);
            wp.setRotation(0);
            var position = vec3.clone(p);
            wp.setPosition(position);
            wp.complete();

            var key = this.nextSpawnKey++;
            this.worldObjectManager.objectMap[key] = wp;

            this.spawnedEntities.push({
                objectMapKey: key,
                modelPath: modelPath,
                spawnPosition: vec3.clone(position),
                unit: wp,
                isSpellModel: isSpellMap
            });
            successCount++;
        }

        console.log("[SpawnManager] Spawned " + successCount + " " + (isSpellMap ? "spell" : "creature") + " models");
    }

    /*
     * The node positions as spawn points: shuffled, then picked greedily so that every point is at least
     * minDistance from the ones picked before, up to maxCount.
     */
    getNodePositionsAsSpawnPoints(nodes: WanderNode[], minDistance: number, maxCount: number | null): vec3[] {
        var candidates: vec3[] = nodes
            .filter((n) => n.mapId === this.mapId)
            .map((n) => vec3.fromValues(n.x, n.y, n.z));

        // Shuffle
        for (var i = candidates.length - 1; i > 0; --i) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = candidates[i];
            candidates[i] = candidates[j];
            candidates[j] = tmp;
        }

        // Greedy far-apart selection
        var minDist2 = minDistance * minDistance;
        var chosen: vec3[] = [];
        for (var p of candidates) {
            var ok = true;
            for (var c of chosen) {
                if (vec3.squaredDistance(p, c) < minDist2) { ok = false; break; }
            }
            if (!ok) continue;
            chosen.push(p);
            if (maxCount !== null && chosen.length >= maxCount) break;
        }
        return chosen;
    }

    // ==================== Query helpers ====================

    getByKey(key: number): SpawnedEntityInfo | undefined {
        return this.spawnedEntities.find((e) => e.objectMapKey === key);
    }

    /* the closest spawned entity to a world position; null if there are none */
    findClosestEntity(position: vec3): SpawnedEntityInfo | null {
        var best: SpawnedEntityInfo | null = null;
        var bestDist2 = Infinity;

        for (var e of this.spawnedEntities) {
            var dist2 = vec3.squaredDistance(e.unit.getPosition(), position);
            if (dist2 < bestDist2) { bestDist2 = dist2; best = e; }
        }
        return best;
    }

    /* the closest spawned entity and its distance; null if there are none */
    findClosestEntityWithDist(position: vec3): { entity: SpawnedEntityInfo, distance: number } | null {
        var e = this.findClosestEntity(position);
        if (e === null) return null;
        return { entity: e, distance: vec3.distance(e.unit.getPosition(), position) };
    }
}

export default SpawnManager;
