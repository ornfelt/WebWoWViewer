import gameplayApi from '../../services/gameplayApi.js'

/*
 * The wander nodes of the current map and the queries on them, as my_web_wow's NodeManager.cs (WowShared).
 * The C# reads every map's nodes from sql; the web version loads the current map's from the mpq server's
 * gameplay api, so an empty manager means no server, database or nodes for the map.
 */

// ref: AzerothCore-wotlk-with-NPCBots/src/server/game/AI/NpcBots/botwanderful.h
export const BotWpFlags = {
    None: 0x00000000,
    Spawn: 0x00000001, // wandering bots can spawn at this WP location
    AllianceOnly: 0x00000002, // only alliance bots can move here, SPAWN+A = only alliance bots can spawn at this WP location
    HordeOnly: 0x00000004, // only horde bots can move here, SPAWN+H = only horde bots can spawn at this WP location
    CanBacktrackFrom: 0x00000008, // can move back to WPs links even if other links exist
    MovementIgnoresFaction: 0x00000010, // ignore faction flags when trying to select this WP as move point
    MovementIgnoresPathing: 0x00000020, // do not generate path between 2 WPs having this flag
    BgFlagDeliverTarget: 0x00000040, // <BG only> flag carrier destination marker
    BgFlagPickupTarget: 0x00000080, // <BG only> flag pick/activate up marker
    BgBossRoom: 0x00000100, // <BG only> boss room to attack as group / defend
    BgMiscObjective1: 0x00000200, // <BG only> misc objective 1 (AV = mine, EY = intercept)
    BgMiscObjective2: 0x00000400, // <BG only> misc objective 2 (AV = captain)
    BgOptionalPickup1: 0x00000800, // <BG only> optional pickup point 1 (WS = healNW, AB = stables, EY = buffNW)
    BgOptionalPickup2: 0x00001000, // <BG only> optional pickup point 2 (WS = bersNE, AB = farm, EY = buffNE)
    BgOptionalPickup3: 0x00002000, // <BG only> optional pickup point 3 (WS = healSE, AB = mill, EY = buffSW)
    BgOptionalPickup4: 0x00004000, // <BG only> optional pickup point 4 (WS = bersSW, AB = mine, EY = buffSE)
    BgOptionalPickup5: 0x00008000, // <BG only> optional pickup point 5 (AB = blacksmith)
    MovementForceJumpBegin: 0x00010000, // movement between 2 WPs having begin and end flags is forced to be a jump (prevent casting when falling from a cliff)
    MovementForceJumpEnd: 0x00020000, // movement between 2 WPs having begin and end flags is forced to be a jump (prevent casting when falling from a cliff)
    InteractionMillRadius: 0x00040000, // if chosen as a mill point, radius is reduced to INTERACTION_DISTANCE
    End: 0x00080000
};

export const FactionTeam = {
    None: 0,
    Alliance: 1,
    Horde: 2
};

/* the names of the flags set in flags, as C#'s [Flags] enum ToString() lists them */
export function botWpFlagNames(flags) {
    var names = [];
    for (var name in BotWpFlags) {
        var value = BotWpFlags[name];
        if (value !== BotWpFlags.None && value !== BotWpFlags.End && (flags & value) !== 0)
            names.push(name);
    }
    return names.length > 0 ? names.join(', ') : 'None';
}

/* The node ids of a links string ("<id>:<...> <id>:<...> ..."); entries that are not a number are skipped */
export function parseLinkIds(links) {
    var ids = [];
    for (var link of links.split(' ')) {
        var id = link.split(':')[0];
        if (/^\d+$/.test(id)) ids.push(Number(id));
    }
    return ids;
}

class NodeManager {
    constructor(mapId) {
        this.mapId = mapId;
        this.nodes = [];
        this.nodesById = new Map();
    }

    /* loads the map's nodes from the mpq server; resolves to the node count (0 when there are none) */
    async loadNodes() {
        var nodes = await gameplayApi.loadWanderNodes(this.mapId);
        this.nodes = nodes;
        this.nodesById = new Map();
        for (var node of nodes) this.nodesById.set(node.id, node);
        console.log("[NodeManager] Loaded " + nodes.length + " nodes for map " + this.mapId);
        return nodes.length;
    }

    getNode(id) {
        return this.nodesById.get(id);
    }

    getClosestNode(x, y, z) {
        var best = null;
        var bestDist2 = Infinity;
        for (var n of this.nodes) {
            var dist2 = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y) + (n.z - z) * (n.z - z);
            if (dist2 < bestDist2) { bestDist2 = dist2; best = n; }
        }
        return best;
    }

    getRandomNode() {
        if (this.nodes.length === 0) return null;
        return this.nodes[Math.floor(Math.random() * this.nodes.length)];
    }

    getRandomLinkedNode(nodeId) {
        var node = this.nodesById.get(nodeId);
        if (!node || node.links.trim() === '') {
            console.log("[NodeManager] Node not found or no links available");
            return null;
        }

        var links = parseLinkIds(node.links);
        if (links.length === 0) {
            console.log("[NodeManager] No valid links available");
            return null;
        }

        var linkedId = links[Math.floor(Math.random() * links.length)];
        return this.nodesById.get(linkedId) || null;
    }

    getLinkedIds(nodeId) {
        var node = this.nodesById.get(nodeId);
        return node ? parseLinkIds(node.links) : [];
    }

    getSpawnNodesForTeam(team) {
        var has = (n, f) => (n.flags & f) !== 0;
        var teamOnly = team === FactionTeam.Alliance ? BotWpFlags.AllianceOnly : BotWpFlags.HordeOnly;

        // primary: SPAWN + team-only
        var primary = this.nodes.filter((n) => has(n, BotWpFlags.Spawn) && has(n, teamOnly));
        if (primary.length > 0) return primary;

        // secondary: neutral SPAWN (SPAWN present, but no team-only flags)
        var neutral = this.nodes.filter((n) => has(n, BotWpFlags.Spawn) &&
            !has(n, BotWpFlags.AllianceOnly) && !has(n, BotWpFlags.HordeOnly));
        if (neutral.length > 0) return neutral;

        // fallback: any node allowed for team (team-only is respected; neutral allowed)
        return this.nodes.filter((n) =>
            has(n, BotWpFlags.MovementIgnoresFaction) ||
            (!has(n, BotWpFlags.AllianceOnly) && !has(n, BotWpFlags.HordeOnly)) ||
            has(n, teamOnly));
    }

    getRandomSpawnForTeam(team) {
        var list = this.getSpawnNodesForTeam(team);
        return list.length === 0 ? null : list[Math.floor(Math.random() * list.length)];
    }
}

export default NodeManager;
