import config from './config.js';

/*
 * The mpq server's gameplay api (GET gameplay/...): the wander nodes from sql (my_web_wow's NodeManager),
 * the creature / spell model lists (CreatureDataLoader) and navigation through the expansion's navigation
 * library (NavigationWrapper). The server turns off whatever it does not have, so every call here resolves
 * to an empty result (or null) instead of failing, and the caller turns the feature off.
 */

async function getJson(route, what) {
    var url = config.getUrlToLoadGameplay() + route;
    try {
        var response = await fetch(url);
        if (!response.ok) {
            console.log("[Gameplay] " + url + " returned " + response.status + ", no " + what);
            return null;
        }
        return await response.json();
    } catch (e) {
        console.log("[Gameplay] " + what + " load error: " + e.message);
        return null;
    }
}

export default {
    /* the map's wander nodes; empty when there are none, or no server / database */
    loadWanderNodes: async function (mapId) {
        return (await getJson('nodes/' + mapId, 'wander nodes')) || [];
    },
    /* the creature or spell model paths (".mdx"); empty when the server has no list */
    loadModelList: async function (kind) {
        return (await getJson('models/' + kind, kind + ' model list')) || [];
    },
    /* a path from start to end; null when navigation is off */
    calculatePath: async function (mapId, start, end) {
        var params = new URLSearchParams({
            mapId: String(mapId),
            startX: String(start[0]), startY: String(start[1]), startZ: String(start[2]),
            endX: String(end[0]), endY: String(end[1]), endZ: String(end[2])
        });
        return getJson('navigation/path?' + params.toString(), 'navigation path');
    }
}
