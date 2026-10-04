import {vec3, vec4, mat4} from 'gl-matrix'
import DebugDraw from './debugDraw.js'
import config from '../../services/config.js'
import WorldUnit from '../objects/worldObjects/worldUnit.js'
import { localPlayerGuid } from '../manager/worldObjectManager.js'
import { BotWpFlags, FactionTeam, parseLinkIds } from '../manager/nodeManager.js'

// ================= DIGITS / NUMBERS =================
const DigitLineSegments = {
    [-1]: [0, 0.5, 1, 0.5],
    0: [0,0, 0,1, 0,1, 1,1, 1,1, 1,0, 1,0, 0,0],
    1: [0.5,0, 0.5,1],
    2: [1,1, 0,1, 0,1, 0,0.5, 0,0.5, 1,0.5, 1,0.5, 1,0, 1,0, 0,0],
    3: [0,1, 1,1, 1,1, 1,0, 1,0, 0,0, 1,0.5, 0,0.5],
    4: [0,0.5, 0,0, 0,0.5, 1,0.5, 1,1, 1,0],
    5: [0,1, 1,1, 1,1, 1,0.5, 1,0.5, 0,0.5, 0,0.5, 0,0, 0,0, 1,0],
    6: [0,0, 0,1, 0,0.5, 1,0.5, 1,0.5, 1,1, 0,1, 1,1],
    7: [0,0, 1,0, 0,1, 1,0],
    8: [0,0.5, 1,0.5, 1,0.5, 1,1, 1,1, 0,1, 0,1, 0,0, 0,0, 1,0, 1,0, 1,0.5, 0,0, 0,0.5],
    9: [1,0.5, 0,0.5, 0,0, 1,0, 0,0, 0,0.5, 1,0, 1,1],
};

const BoldOffsets = [[0, 0], [1, 0], [0, 1], [1, 1]];
const NoOffsets = [[0, 0]];

const NUM_STACK_GAP = 26;   // vertical gap between numbers spawned in quick succession

// render space == WoW space in this viewer, so this is identity. Up is +Z.
const NODE_Z_LIFT = 5;

const ScaleOverrides = [
    ["ragnaros",        5],
    ["dragononyxia",    5],
    ["dragonnefarian",  5],
    ["illidan",         3],
];

function clamp01(v) {
    return Math.min(Math.max(v, 0), 1);
}
function pct(v, total) {
    return total <= 0 ? 0 : clamp01(v / total);
}
function sizeForValue(v, crit) {
    var s = v >= 1000 ? 42 : v >= 500 ? 34 : v >= 100 ? 28 : 22;
    return crit ? s * 1.4 : s;
}
function easeOut(t) {
    return 1 - (1 - t) * (1 - t);
}
function estimateNumberWidth(value, digitW) {
    // Includes '-' for negative numbers.
    return String(value).length * digitW;
}
function nodePos(n) {
    return vec3.fromValues(n.x, n.y, n.z + NODE_Z_LIFT);
}

/*
 * The 2D HUD (unit frames, cast bars, numbers, floating combat text) and the 3D debug drawing (wander
 * nodes, their links, wander paths, the target marker and the Blizzard circle), as my_web_wow's Hud.cs.
 * The multiplayer parts and the test feed (MakeTestState / TestSpawnDamage) are not ported.
 */
class Hud {
    constructor(scene) {
        this.scene = scene;
        this.dd = new DebugDraw(scene);
        this.numbers = [];
        this.lastNumSpawn = -Infinity;
        this.currentNodeId = -1;
        this.nodesDrawn = 0;
        this.debugPaths = [];
        this.selectedNodeId = -1;
        this.spawnSelectedEntityKey = -1;
    }

    get now() {
        return performance.now() / 1000;
    }

    drawDigit(digit, x, y, size, color, bold = false) {
        var seg = DigitLineSegments[digit];
        if (!seg) return;
        var offs = bold ? BoldOffsets : NoOffsets;
        for (var [ox, oy] of offs)
            for (var i = 0; i < seg.length; i += 4)
                this.dd.line2D(x + seg[i] * size + ox, y + seg[i + 1] * size + oy,
                               x + seg[i + 2] * size + ox, y + seg[i + 3] * size + oy, color);
    }

    // spacingFactor lets callers widen gaps between digits (default matches the old 1.5)
    drawNumber(number, x, y, size, color, bold = false, spacingFactor = 1.5) {
        var s = String(number);
        var spacing = size * spacingFactor;
        if (number < 0) { this.drawDigit(-1, x, y, size, color, bold); x += spacing; s = s.substring(1); }
        for (var i = 0; i < s.length; i++)
            this.drawDigit(s.charCodeAt(i) - 48, x + i * spacing, y, size, color, bold);
    }

    drawNumbersWithLinks(number, x, y, size, color, linkedNodeIds) {
        var s = String(number);
        var spacing = size * 1.5;
        if (number < 0) { this.drawDigit(-1, x, y, size, color); x += spacing; s = s.substring(1); }
        for (var ch of s) { this.drawDigit(ch.charCodeAt(0) - 48, x, y, size, color); x += spacing; }
        if (linkedNodeIds !== null)
            for (var id of linkedNodeIds) {
                this.drawDigit(-1, x, y, size, color); x += spacing;                 // separator
                for (var ch of String(id)) { this.drawDigit(ch.charCodeAt(0) - 48, x, y, size, color); x += spacing; }
            }
    }

    // ================= FRAMES / BARS / CAST BARS =================
    drawUnitFrame(x, y, w, h, team, hpPct, manaPct) {
        var barH = 10;
        var hpY = y + h - 2 * barH - 4;
        var manaY = y + h - barH - 2;
        hpPct = clamp01(hpPct);
        manaPct = clamp01(manaPct);

        // backgrounds
        this.dd.rectFill2D(x + 2, hpY, w - 4, barH, [0.15, 0.05, 0.05, 0.7]);
        this.dd.rectFill2D(x + 2, manaY, w - 4, barH, [0.05, 0.05, 0.15, 0.7]);
        // fills
        this.dd.rectFill2D(x + 2, hpY, (w - 4) * hpPct, barH, [1, 0, 0, 1]);
        this.dd.rectFill2D(x + 2, manaY, (w - 4) * manaPct, barH, [0, 0, 1, 1]);
        // outline
        var outline = team === FactionTeam.Alliance ? [0.2, 0.5, 1, 1]
            : team === FactionTeam.Horde ? [1, 0.25, 0.25, 1]
            : [0, 0, 0, 1];
        this.dd.rectOutline2D(x, y, w, h, outline);
    }

    drawCastBar(x, y, width, thickness, progress, color) {
        progress = clamp01(progress);
        var top = y - thickness * 0.5;
        this.dd.rectFill2D(x, top, width, thickness, [0, 0, 0, 0.5]); // track
        this.dd.rectFill2D(x, top, width * progress, thickness, color); // fill
    }

    addDamageNumber(value, x, y, color, crit = false, life = 1.4) {
        // If another number spawned very recently, offset this one upward so they don't overlap.
        var now = this.now;
        if (now - this.lastNumSpawn < 0.25)
            y -= NUM_STACK_GAP;
        this.lastNumSpawn = now;

        this.numbers.push({ value: value, x: x, y: y, color: color, spawn: now, life: life, crit: crit });
    }

    /*
     * Web addition: a damage number over a unit (local damage on hit, see SpellManager), at the unit's
     * screen position, in the colours of the C#'s test feed (crit orange, else yellow).
     */
    addDamageNumberAtUnit(unit, value, crit) {
        var p = unit.getPosition();
        var clip = vec4.fromValues(p[0], p[1], p[2], 1);
        var viewProj = mat4.multiply(mat4.create(), this.scene.perspectiveMatrix, this.scene.lookAtMat4);
        vec4.transformMat4(clip, clip, viewProj);
        if (clip[3] <= 0) return; // behind the camera

        var x = (clip[0] / clip[3] * 0.5 + 0.5) * this.scene.canvas.width;
        var y = (1 - (clip[1] / clip[3] * 0.5 + 0.5)) * this.scene.canvas.height;
        this.addDamageNumber(value, x, y, crit ? [1, 0.4, 0] : [1, 1, 0.3], crit);
    }

    updateAndDrawNumbers() {
        // tuning: how high they start and how far they rise, plus digit gap width
        var spawnLift = 130;   // start higher on screen
        var riseDist = 150;    // travel farther up
        var numSpacing = 1.5;  // wider gaps between digits

        var now = this.now;
        for (var i = this.numbers.length - 1; i >= 0; i--) {
            var n = this.numbers[i];
            var t = (now - n.spawn) / n.life;
            if (t >= 1) { this.numbers.splice(i, 1); continue; }

            var alpha = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;      // hold then fade
            alpha = clamp01(alpha);
            var yy = n.y - spawnLift - riseDist * easeOut(t);       // rise upward (+y is down)
            var pop = 1 + 0.6 * Math.exp(-t * 12.0);                // spawn punch
            var size = sizeForValue(n.value, n.crit) * pop;
            var bold = n.value >= 500 || n.crit;
            var col = [n.color[0], n.color[1], n.color[2], alpha];

            var spacing = size * numSpacing;
            var digits = String(Math.abs(n.value)).length + (n.value < 0 ? 1 : 0);
            this.drawNumber(n.value, n.x - digits * spacing * 0.5, yy, size, col, bold);
        }
    }

    setDebugPaths(paths) {
        this.debugPaths = [];
        for (var path of paths) {
            if (path.length < 2) continue;
            this.debugPaths.push(path.map((p) => vec3.fromValues(p[0], p[1], p[2] + NODE_Z_LIFT)));
        }
    }

    /* Closest node to the camera -> currentNodeId (the old playermodel.currentNodeId). */
    updateNodeTracking() {
        var nm = this.scene.nodeManager;
        if (!nm || nm.nodes.length === 0) return;
        var cam = this.scene.mainCamera;
        var node = nm.getClosestNode(cam[0], cam[1], cam[2]);
        if (node !== null) this.currentNodeId = node.id;
    }

    // Color a node box by its BotWpFlags. Team => base color, Spawn blends toward green.
    static flagColor(f) {
        var ally = (f & BotWpFlags.AllianceOnly) !== 0;
        var horde = (f & BotWpFlags.HordeOnly) !== 0;
        var spawn = (f & BotWpFlags.Spawn) !== 0;

        var c;
        if (ally && horde) c = vec3.fromValues(1, 0, 1);         // both (shouldn't happen) -> magenta
        else if (ally) c = vec3.fromValues(0.2, 0.5, 1);         // alliance -> blue
        else if (horde) c = vec3.fromValues(1, 0.25, 0.25);      // horde -> red
        else c = vec3.fromValues(1, 1, 0);                       // neutral -> yellow

        if (spawn) vec3.lerp(c, c, vec3.fromValues(0, 1, 0), 0.5); // spawn -> tint green
        return [c[0], c[1], c[2], 1];
    }

    distanceToCamera(p) {
        var cam = this.scene.mainCamera;
        return Math.hypot(p[0] - cam[0], p[1] - cam[1], p[2] - cam[2]);
    }

    drawNodeBoxes(useFlagColors, viewDistance = 300, halfSize = 0.75) {
        // Hard-coded fill toggle. Set to false for wireframe boxes.
        var fill = true;

        var nm = this.scene.nodeManager;
        if (!nm) return;
        var blue = [0, 0, 1, 1];
        for (var n of nm.nodes) {
            var p = nodePos(n);
            if (this.distanceToCamera(p) > viewDistance) continue;
            var col = useFlagColors ? Hud.flagColor(n.flags) : blue;
            if (fill) this.dd.boxFill3D(p, halfSize, col);
            else this.dd.box3D(p, halfSize, col);
        }
    }

    // Links of the current node only (blue) - replicates old DrawLinkedNodes.
    drawLinkedNodes(currentNodeId) {
        var nm = this.scene.nodeManager;
        var cur = nm ? nm.getNode(currentNodeId) : undefined;
        if (!nm || !cur) return;
        var a = nodePos(cur);
        var blue = [0, 0, 1, 1];
        for (var lid of parseLinkIds(cur.links)) {
            var ln = nm.getNode(lid);
            if (!ln) continue;
            this.dd.line3D(a, nodePos(ln), blue);
        }
    }

    // Every linked pair on the map (red) - replicates old DrawAllLinkedNodes.
    drawAllLinkedNodes(limitDistance, viewDistance = 1500) {
        var nm = this.scene.nodeManager;
        var red = [1, 0, 0, 1];
        this.nodesDrawn = 0;
        if (!nm) return;

        for (var n of nm.nodes) {
            if (n.links.trim() === '') continue;
            var a = nodePos(n);
            if (limitDistance && this.distanceToCamera(a) > viewDistance) continue;

            for (var lid of parseLinkIds(n.links)) {
                var ln = nm.getNode(lid);
                if (ln) {
                    this.dd.line3D(a, nodePos(ln), red);
                    this.nodesDrawn++;
                }
            }
        }
    }

    drawSelectedNodeMarker(zLift = 8, radius = 0.3) {
        if (this.selectedNodeId < 0 || !this.scene.nodeManager) return;
        var node = this.scene.nodeManager.getNode(this.selectedNodeId);
        if (!node) return;

        this.dd.boxFill3D([node.x, node.y, node.z + zLift], radius, [0, 1, 0, 1]);
    }

    /* A colored marker above a spawned entity selected in the spawn browser (orange, distinct from the target and node markers). */
    drawSpawnEntityMarker(halfSize = 0.4, zLift = 6, maxDist = 500) {
        if (this.spawnSelectedEntityKey < 0) return;
        var unit = this.scene.worldObjectManager.objectMap[this.spawnSelectedEntityKey];
        if (!unit) return;

        var pos = unit.getPosition();
        if (this.distanceToCamera(pos) > maxDist) return;

        this.dd.boxFill3D([pos[0], pos[1], pos[2] + zLift], halfSize, [1, 0.6, 0.1, 0.9]);
    }

    /* Light-blue translucent disc on the ground where Blizzard is being channeled. */
    drawBlizzardCircle(position, radius = 3, zLift = 0.5, maxDist = 300) {
        if (this.distanceToCamera(position) > maxDist) return;

        // Light blue, translucent
        this.dd.disc3D(position, radius, [0.4, 0.7, 1, 0.30], 48, zLift);

        // Optional: thin outline ring for visibility
        this.dd.circle3D(position, radius, [0.5, 0.8, 1, 0.55], 48, zLift);
    }

    // World-space target marker (Z-up ground ring) - replicates DrawTargetCircle.
    drawTargetCircle(targetPos, team, radius = 0.6, zLift = 3, maxDist = 150) {
        // false = translucent (0.35), true = opaque
        var solid = true;
        var fill = true;

        if (this.distanceToCamera(targetPos) > maxDist) return;
        var col = team === FactionTeam.Alliance ? [0.2, 0.5, 1, 1] : [1, 0.25, 0.25, 1];

        var a = solid ? 1 : 0.35;
        if (fill) this.dd.disc3D(targetPos, radius, [col[0], col[1], col[2], a], 32, zLift);
        else this.dd.circle3D(targetPos, radius, col, 32, zLift);
    }

    // Optional dot above the target (small box).
    drawTargetDot(targetPos, team, halfSize = 0.25, zLift = 4, maxDist = 150) {
        var fill = true;
        if (this.distanceToCamera(targetPos) > maxDist) return;
        var col = team === FactionTeam.Alliance ? [0.2, 0.5, 1, 1] : [1, 0.25, 0.25, 1];
        var p = [targetPos[0], targetPos[1], targetPos[2] + zLift];
        if (fill) this.dd.boxFill3D(p, halfSize, col);
        else this.dd.box3D(p, halfSize, col);
    }

    drawPath(pts, color) {
        for (var i = 0; i + 1 < pts.length; i++) this.dd.line3D(pts[i], pts[i + 1], color);
    }
    drawPathPoints(pts, color, halfSize = 0.25) {
        for (var p of pts) this.dd.boxFill3D(p, halfSize, color);
    }

    /*
     * The 3D pass - node boxes, node links, the all-linked graph, wander paths and the target circle/box,
     * in world space through the scene's camera so it lines up with terrain and units and respects depth.
     * Call it inside the world framebuffer, after graphManager.draw.
     */
    renderWorldDebug(lookAt, proj) {
        // depth-tested batch
        var any = false;
        if (config.getDrawNodeBoxes()) { this.drawNodeBoxes(config.getDrawNodeFlagColors()); any = true; }
        if (config.getDrawLinkedNodes()) { this.drawLinkedNodes(this.currentNodeId); any = true; }
        if (config.getDrawAllLinkedNodes() && !config.getDrawAllLinkedNodesNoDepth()) { this.drawAllLinkedNodes(false); any = true; }

        if (config.getDrawPathLines())
            for (var path of this.debugPaths) { this.drawPath(path, [0, 1, 1, 1]); any = true; }
        if (config.getDrawPathPoints())
            for (var path of this.debugPaths) { this.drawPathPoints(path, [1, 0, 1, 1]); any = true; }

        // target marker (uses real player target if present)
        var target = this.getPlayerTarget();
        if (target !== null) {
            // the C# divides by 3 outside multiplayer, where the scale is probably not saved correctly
            var tScale = target.scale / 3.0;
            if (config.getDrawTargetCircle()) { this.drawTargetCircle(target.pos, target.team, 0.3 * tScale, 3 * tScale); any = true; }
            if (config.getDrawTargetDot()) { this.drawTargetDot(target.pos, target.team, 0.25 * tScale, 4 * tScale); any = true; }
        }

        // Blizzard channeling ground circle
        var blizzPos = this.scene.spellManager ? this.scene.spellManager.blizzardTargetPosition : null;
        if (blizzPos !== null) {
            this.drawBlizzardCircle(blizzPos);
            any = true;
        }

        if (this.selectedNodeId >= 0) { this.drawSelectedNodeMarker(); any = true; }
        // Spawn browser entity marker for creaturemap/spellmap
        if (this.spawnSelectedEntityKey >= 0) { this.drawSpawnEntityMarker(); any = true; }

        if (any) { this.dd.begin3D(true); this.dd.flush3D(lookAt, proj); this.dd.end3D(); }

        // see-through batch (no depth test) for all-linked-nodes
        if (config.getDrawAllLinkedNodes() && config.getDrawAllLinkedNodesNoDepth()) {
            this.drawAllLinkedNodes(false);
            this.dd.begin3D(false); this.dd.flush3D(lookAt, proj); this.dd.end3D();
        }
    }

    getPlayerTarget() {
        var tgt = this.scene.spellManager ? this.scene.spellManager.getCurrentTarget() : null;
        if (tgt === null) return null;

        var scale = tgt.modelScale !== undefined ? tgt.modelScale : 1;
        var name = tgt.objectModel ? tgt.objectModel.modelName : undefined;
        if (name) {
            var lower = name.toLowerCase();
            for (var [pattern, mult] of ScaleOverrides) {
                if (lower.indexOf(pattern) >= 0) {
                    scale *= mult;
                    break;
                }
            }
        }

        return { pos: tgt.getPosition(), team: tgt.myFactionTeam, scale: scale };
    }

    // ================= REAL 2D HUD STATE =================

    /* the live data: the camera position, the fps, the closest-node tracking, the player and its target (via the spell manager) */
    buildHudState() {
        var s = {
            wowPos: this.scene.mainCamera,
            fps: this.scene.fps,
            showAiHud: true,
            targetIndex: 0,
            useAdvancedHud: true,
            currentNodeId: this.currentNodeId,
            linkedNodeIds: this.scene.nodeManager ? this.scene.nodeManager.getLinkedIds(this.currentNodeId) : [],
            drawAllLinkedNodes: config.getDrawAllLinkedNodes(),
            nodesDrawn: this.nodesDrawn,
            player: { hpPct: 1, manaPct: 1, team: FactionTeam.None },
            hasTarget: false,
            target: { hpPct: 1, manaPct: 1, team: FactionTeam.None },

            // player cast bar: thin + low, matching the target bar style.
            playerCasting: false,
            playerCastProgress: 0,
            playerCastColor: [0.5, 0.7, 1, 1],
            playerCastX: this.scene.canvas.width * 0.5 - 96,   // centered, 192 wide
            playerCastY: this.scene.canvas.height - 70,        // low on screen
            playerCastWidth: 192,

            targetCasting: false,
            targetCastProgress: 0,
            targetCastColor: [1, 0.5, 0, 1]
        };

        var om = this.scene.worldObjectManager.objectMap;
        var pl = om[localPlayerGuid];
        if (pl instanceof WorldUnit) {
            s.player = {
                hpPct: pct(pl.healthPoints, pl.healthPointsTotal),
                manaPct: pct(pl.manaPoints, pl.manaPointsTotal),
                team: pl.myFactionTeam
            };
            s.targetIndex = pl.targetIndex;

            // Resolve the current target through the spell manager (key into objectMap).
            var sm = this.scene.spellManager;
            var tkey = sm ? sm.getCurrentTargetKey() : null;
            var tgt = tkey !== null && tkey !== 0 ? om[tkey] : undefined;
            if (tgt instanceof WorldUnit) {
                s.hasTarget = true;
                s.targetIndex = tkey;
                s.target = {
                    hpPct: pct(tgt.healthPoints, tgt.healthPointsTotal),
                    manaPct: pct(tgt.manaPoints, tgt.manaPointsTotal),
                    team: tgt.myFactionTeam
                };
            }

            // Cast bar from spell manager
            if (sm) {
                var cast = sm.getCastBarState();
                s.playerCasting = cast.active;
                s.playerCastProgress = cast.progress;
                s.playerCastColor = cast.color;
            }
        }
        return s;
    }

    // ================= TOP-LEVEL 2D HUD =================
    /* Call this AFTER compositing to the screen (default framebuffer bound). */
    renderHud2D(s) {
        var white = [1, 1, 1, 1];

        // Hard-coded layout toggle:
        //   true  -> frames at TOP-LEFT, debug text (pos/fps/nodes) below them
        //   false -> original layout (frames bottom, text top-left)
        var framesTopLeft = true;

        var frameW = 200, frameH = 42;

        // Frame anchors depend on the layout.
        var playerFrameX, playerFrameY, targetFrameX, targetFrameY, targetCastY;
        var textX = 10, textTop;

        if (framesTopLeft) {
            playerFrameX = 10; playerFrameY = 10;
            targetFrameX = playerFrameX + frameW + 12; // to the RIGHT of the player frame
            targetFrameY = playerFrameY;               // same row
            targetCastY = targetFrameY + frameH + 8;   // cast bar under the target frame
            textTop = playerFrameY + frameH + 8 + 16;  // text below the frame row (+ cast bar gap)
        } else {
            playerFrameX = 250; playerFrameY = 550;
            targetFrameX = 900; targetFrameY = 550;
            targetCastY = 615;
            textTop = 10;
        }

        // ---- debug text block (uses running ty so it stacks either way) ----
        var rowH = 20;
        var ty = textTop;

        // XYZ on one line, spaced by the estimated number widths
        var x = Math.trunc(s.wowPos[0]);
        var y = Math.trunc(s.wowPos[1]);
        var z = Math.trunc(s.wowPos[2]);

        var digitW = 15; // approximate width per digit at scale 10
        var gap = 14;

        var xX = textX;
        var yX = xX + estimateNumberWidth(x, digitW) + gap;
        var zX = yX + estimateNumberWidth(y, digitW) + gap;

        this.drawNumber(x, xX, ty, 10, white);
        this.drawNumber(y, yX, ty, 10, white);
        this.drawNumber(z, zX, ty, 10, white);
        ty += rowH;

        this.drawNumber(s.fps, textX, ty, 10, white); ty += rowH;

        if (s.showAiHud) {
            this.drawNumber(s.targetIndex, textX, ty, 10, white); ty += rowH;
            if (s.useAdvancedHud) this.drawNumbersWithLinks(s.currentNodeId, textX, ty, 10, white, s.linkedNodeIds);
            else this.drawNumber(s.currentNodeId, textX, ty, 10, white);
            ty += rowH;
            if (s.drawAllLinkedNodes) { this.drawNumber(s.nodesDrawn, textX, ty, 10, white); ty += rowH; }
        }

        // ---- frames ----
        this.drawUnitFrame(playerFrameX, playerFrameY, frameW, frameH, s.player.team, s.player.hpPct, s.player.manaPct);
        if (s.hasTarget) {
            this.drawUnitFrame(targetFrameX, targetFrameY, frameW, frameH, s.target.team, s.target.hpPct, s.target.manaPct);
            this.drawNumber(s.targetIndex, targetFrameX + 10, targetFrameY + 3, 10, white);  // inside the frame, like old code
        }

        // player cast bar: bottom-center via state
        if (s.playerCasting) this.drawCastBar(s.playerCastX, s.playerCastY, s.playerCastWidth, 5, s.playerCastProgress, s.playerCastColor);
        // target cast bar: follows the target frame
        if (s.targetCasting) this.drawCastBar(targetFrameX, targetCastY, frameW, 5, s.targetCastProgress, s.targetCastColor);

        this.updateAndDrawNumbers(); // floating damage text last (on top)

        this.dd.begin2D();
        this.dd.flush2D();
        this.dd.end2D();
    }
}

export default Hud;
