import config from './config';

/*
 * The mpq server's gameplay api (GET gameplay/...): the wander nodes from sql (my_web_wow's NodeManager),
 * the creature / spell model lists (CreatureDataLoader) and navigation through the expansion's navigation
 * library (NavigationWrapper). The server turns off whatever it does not have, so every call here resolves
 * to an empty result (or null) instead of failing, and the caller turns the feature off.
 */

/* one row of the npcbot wander node table */
export interface WanderNode {
    id: number;
    mapId: number;
    /* BotWpFlags */
    flags: number;
    x: number;
    y: number;
    z: number;
    /* "<id>:<...> <id>:<...> ..." */
    links: string;
}

export interface NavigationPath {
    mapId: number;
    length: number;
    /* PATHFIND_* flags */
    pathType: number;
    path: { x: number, y: number, z: number }[];
}

export type ModelListKind = 'creatures' | 'spells';

async function getJson<T>(route: string, what: string): Promise<T | null> {
    var url = config.getUrlToLoadGameplay() + route;
    try {
        var response = await fetch(url);
        if (!response.ok) {
            console.log("[Gameplay] " + url + " returned " + response.status + ", no " + what);
            return null;
        }
        return await response.json() as T;
    } catch (e) {
        console.log("[Gameplay] " + what + " load error: " + (e as Error).message);
        return null;
    }
}

export default {
    /* the map's wander nodes; empty when there are none, or no server / database */
    loadWanderNodes: async function (mapId: number): Promise<WanderNode[]> {
        return (await getJson<WanderNode[]>('nodes/' + mapId, 'wander nodes')) || [];
    },
    /* the creature or spell model paths (".mdx"); empty when the server has no list */
    loadModelList: async function (kind: ModelListKind): Promise<string[]> {
        return (await getJson<string[]>('models/' + kind, kind + ' model list')) || [];
    },
    /* a path from start to end; null when navigation is off */
    calculatePath: async function (mapId: number, start: ArrayLike<number>, end: ArrayLike<number>): Promise<NavigationPath | null> {
        var params = new URLSearchParams({
            mapId: String(mapId),
            startX: String(start[0]), startY: String(start[1]), startZ: String(start[2]),
            endX: String(end[0]), endY: String(end[1]), endZ: String(end[2])
        });
        return getJson<NavigationPath>('navigation/path?' + params.toString(), 'navigation path');
    }
}
