import {vec3} from 'gl-matrix'
import { parseLinkIds } from '../manager/nodeManager.js'
import { NetBotClass, NetSpellType, NetAnimationType, NetBotState } from './netProtocol.js'
import CombatManager from './combatManager.js'

/* how long a bot waits before asking for a path that is still being calculated, in seconds */
const PathPendingRetry = 0.1;

// Melee special attack types (chosen at random with cooldowns)
const MeleeSpecialAnims = [
    NetAnimationType.Attack2,
    NetAnimationType.Attack3,
    NetAnimationType.Attack4,
    NetAnimationType.Attack5,
    NetAnimationType.Attack6,
    NetAnimationType.AttackSpecial, // kick
];

// Caster spell rotation (chosen at random)
const CasterOffenseSpells = [
    NetSpellType.Frostbolt,
    NetSpellType.IceLance,
    NetSpellType.Pyroblast,
    NetSpellType.IceMissile,
    NetSpellType.LightningBolt,
];

/*
 * Drives bot behavior: wandering between nodes, detecting enemies, chasing, attacking (melee or spells),
 * and defensive abilities, as my_web_wow's WowServer/BotAI.cs.
 */
class BotAI {
    constructor(cfg, combat, nodeManager) {
        this.cfg = cfg;
        this.combat = combat;
        this.nodeManager = nodeManager;
    }

    /* Main AI tick for a single bot entity. */
    update(bot, dt, allEntities, pathfinder) {
        if (bot.isDead) return;

        // (status effect timers are ticked by ServerWorld.tick for every entity)

        // If polymorphed or frozen, just wait
        if (bot.isPolymorphed) {
            bot.botState = NetBotState.Polymorphed;
            return;
        }
        if (bot.isFrozenByNova) {
            bot.botState = NetBotState.Frozen;
            // Can still cast while frozen (if caster)
            if (bot.botClass === NetBotClass.Caster && bot.canCast)
                this.tryCasterAction(bot, dt, allEntities);
            return;
        }
        if (bot.isIceBlocked) {
            bot.botState = NetBotState.IceBlocked;
            return;
        }

        // Update active cast/channel
        this.combat.updateCasting(bot, dt, allEntities);
        if (bot.isCasting || bot.isChanneling) {
            // Face target while casting/channeling
            var castTarget = this.getTarget(bot, allEntities);
            if (castTarget !== null) bot.lookAt(castTarget.position);
            return;
        }

        // Decision timer
        bot.retargetTimer -= dt;
        bot.castDecisionTimer -= dt;

        // Should we consider ice block? Higher chance at low HP
        if (this.considerIceBlock(bot))
            return;

        // Find or validate target
        if (bot.retargetTimer <= 0) {
            bot.retargetTimer = this.cfg.botRetargetInterval;
            this.findTarget(bot, allEntities);
        }

        var target = this.getTarget(bot, allEntities);

        if (target === null || target.isDead) {
            // No target -> wander
            bot.targetId = null;
            bot.isAutoAttacking = false;
            this.updateWander(bot, dt, pathfinder);
            return;
        }

        var dist = bot.distanceTo(target);

        // Give up on targets that are too far
        if (dist > this.cfg.leashRange) {
            bot.giveUpAccumulator += dt;
            var giveUpChance = this.cfg.botGiveUpChanceBase * (dist / this.cfg.leashRange);
            if (Math.random() < giveUpChance * dt * 10) {
                this.logVerbose("bot " + bot.id + " giving up on " + target.id + " (dist=" + dist.toFixed(1) + ")");
                bot.targetId = null;
                bot.isAutoAttacking = false;
                bot.giveUpAccumulator = 0;
                return;
            }
        } else {
            bot.giveUpAccumulator = 0;
        }

        // Face target
        bot.lookAt(target.position);

        // Combat behavior based on class
        if (bot.botClass === NetBotClass.Melee)
            this.updateMelee(bot, target, dt, allEntities);
        else
            this.updateCaster(bot, target, dt, allEntities);
    }

    // ========================= Targeting =========================

    findTarget(bot, allEntities) {
        var best = null;
        var bestDist = Infinity;

        for (var ent of allEntities.values()) {
            if (ent.id === bot.id) continue;
            if (ent.isDead) continue;
            if (!this.combat.isHostile(bot, ent)) continue;

            // In devmode, don't target players (unless player is in bot mode)
            if (this.cfg.devMode && ent.isPlayer && !ent.isBotMode) continue;

            var d = bot.distanceTo(ent);
            if (d > this.cfg.aggroRange) continue;
            if (d < bestDist) {
                bestDist = d;
                best = ent;
            }
        }

        if (best !== null) {
            if (bot.targetId !== best.id)
                this.logVerbose("bot " + bot.id + " targets " + best.id + " (dist=" + bestDist.toFixed(1) + ")");
            bot.targetId = best.id;
        }
    }

    getTarget(bot, allEntities) {
        if (bot.targetId === null) return null;
        return allEntities.get(bot.targetId) || null;
    }

    // ========================= Melee Behavior =========================

    updateMelee(bot, target, dt, allEntities) {
        var dist = bot.distanceTo(target);

        // Chase if too far
        if (dist > this.cfg.meleeRange) {
            this.chaseTarget(bot, target, dt);
            return;
        }

        bot.botState = NetBotState.Attacking;
        bot.isAutoAttacking = true;

        // Auto-attack swing timer
        bot.autoAttackTimer += dt;
        if (bot.autoAttackTimer >= this.cfg.meleeSwingTime) {
            bot.autoAttackTimer -= this.cfg.meleeSwingTime;
            bot.currentAnimation = NetAnimationType.Attack;
            this.combat.resolveMeleeHit(bot, target, false);
            this.logVerbose("bot " + bot.id + " auto-attacks " + target.id);
        }

        // Special attack decision
        if (bot.castDecisionTimer <= 0) {
            bot.castDecisionTimer = this.cfg.botCastDecisionInterval;

            // Try interrupt (kick) if target is casting
            if (target.isCasting || target.isChanneling) {
                if (!bot.isOnCooldown(NetSpellType.Kick)) {
                    this.combat.tryCast(bot, NetSpellType.Kick, target, allEntities);
                    bot.currentAnimation = NetAnimationType.AttackSpecial;
                    this.logVerbose("bot " + bot.id + " kicks " + target.id);
                    return;
                }
            }

            // Frost nova if surrounded or low HP
            if (this.shouldFrostNova(bot, allEntities)) {
                this.combat.tryCast(bot, NetSpellType.FrostNova, null, allEntities);
                return;
            }

            // Random special attack
            if (Math.random() < 0.3) { // 30% chance per decision
                if (!bot.isOnCooldown(NetSpellType.MeleeSpecial)) {
                    bot.setCooldown(NetSpellType.MeleeSpecial, 4 + Math.random() * 4);

                    // Pick random special animation
                    var anim = MeleeSpecialAnims[Math.floor(Math.random() * MeleeSpecialAnims.length)];
                    bot.currentAnimation = anim;
                    this.combat.resolveMeleeHit(bot, target, true);
                    this.logVerbose("bot " + bot.id + " special attack on " + target.id + " (anim=" + anim + ")");
                }
            }
        }
    }

    // ========================= Caster Behavior =========================

    updateCaster(bot, target, dt, allEntities) {
        var dist = bot.distanceTo(target);

        // If too close to melee, try to keep distance
        if (dist < this.cfg.meleeRange * 0.8 && bot.canMove) {
            // Consider frost nova to root them, then back up
            if (this.shouldFrostNova(bot, allEntities)) {
                this.combat.tryCast(bot, NetSpellType.FrostNova, null, allEntities);
                return;
            }
        }

        // If out of spell range, chase
        if (dist > this.cfg.spellRange) {
            this.chaseTarget(bot, target, dt);
            return;
        }

        bot.botState = NetBotState.Attacking;

        // Spell decision
        if (bot.castDecisionTimer <= 0) {
            bot.castDecisionTimer = this.cfg.botCastDecisionInterval;
            this.tryCasterAction(bot, dt, allEntities);
        }
    }

    tryCasterAction(bot, dt, allEntities) {
        var target = this.getTarget(bot, allEntities);
        if (target === null || target.isDead) return;

        // Try interrupt (counterspell) if target is casting
        if ((target.isCasting || target.isChanneling) && !bot.isOnCooldown(NetSpellType.Counterspell)) {
            if (Math.random() < 0.6) { // 60% chance to interrupt
                this.combat.tryCast(bot, NetSpellType.Counterspell, target, allEntities);
                this.logVerbose("bot " + bot.id + " counterspells " + target.id);
                return;
            }
        }

        // Polymorph a different target if multiple enemies nearby
        if (!bot.isOnCooldown(NetSpellType.Polymorph) && Math.random() < 0.15) {
            var polyTarget = this.findPolyTarget(bot, allEntities);
            if (polyTarget !== null) {
                this.combat.tryCast(bot, NetSpellType.Polymorph, polyTarget, allEntities);
                this.logVerbose("bot " + bot.id + " polymorphs " + polyTarget.id);
                return;
            }
        }

        // Blizzard if multiple enemies clumped
        if (!bot.isOnCooldown(NetSpellType.Blizzard) && Math.random() < 0.1) {
            var clumpPos = this.findEnemyClump(bot, allEntities);
            if (clumpPos !== null) {
                this.combat.tryCast(bot, NetSpellType.Blizzard, target, allEntities, clumpPos);
                this.logVerbose("bot " + bot.id + " blizzards at " + clumpPos);
                return;
            }
        }

        // Pick a random offense spell
        var spell = this.pickCasterSpell(bot);
        if (spell !== null) {
            this.combat.tryCast(bot, spell, target, allEntities);
            this.logVerbose("bot " + bot.id + " casts " + spell + " on " + target.id);
        }
    }

    pickCasterSpell(bot) {
        // Shuffle and pick first available
        var shuffled = CasterOffenseSpells.slice();
        for (var i = shuffled.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = shuffled[i];
            shuffled[i] = shuffled[j];
            shuffled[j] = tmp;
        }
        for (var spell of shuffled) {
            if (bot.isOnCooldown(spell)) continue;
            var school = CombatManager.getSchool(spell);
            if (bot.isSchoolLocked(school)) continue;
            return spell;
        }
        return null;
    }

    findPolyTarget(bot, allEntities) {
        var currentTarget = bot.targetId;
        for (var ent of allEntities.values()) {
            if (ent.id === bot.id || ent.id === currentTarget) continue;
            if (ent.isDead || ent.isPolymorphed || ent.isIceBlocked) continue;
            if (!this.combat.isHostile(bot, ent)) continue;
            if (bot.distanceTo(ent) <= this.cfg.spellRange)
                return ent;
        }
        return null;
    }

    findEnemyClump(bot, allEntities) {
        // Find a position with 2+ enemies within blizzard radius
        var enemies = Array.from(allEntities.values())
            .filter((e) => e.id !== bot.id && !e.isDead && this.combat.isHostile(bot, e) &&
                           bot.distanceTo(e) <= this.cfg.spellRange);

        if (enemies.length < 2) return null;

        // Use centroid of closest enemies
        var closest = enemies.sort((a, b) => bot.distanceTo(a) - bot.distanceTo(b)).slice(0, 3);
        var center = vec3.create();
        for (var e of closest) vec3.add(center, center, e.position);
        return vec3.scale(center, center, 1 / closest.length);
    }

    // ========================= Defense =========================

    considerIceBlock(bot) {
        if (bot.isOnCooldown(NetSpellType.IceBlock)) return false;
        var hpPct = bot.health / bot.healthMax;

        // Higher chance to ice block at lower HP
        // At 20% HP -> 40% chance, at 10% HP -> 70% chance
        var chance = hpPct < 0.1 ? 0.7 : hpPct < 0.2 ? 0.4 : hpPct < 0.3 ? 0.1 : 0;
        if (Math.random() < chance) {
            this.combat.tryCast(bot, NetSpellType.IceBlock, null, new Map());
            this.logVerbose("bot " + bot.id + " ice blocks at " + Math.round(hpPct * 100) + "% HP");
            return true;
        }
        return false;
    }

    shouldFrostNova(bot, allEntities) {
        if (bot.isOnCooldown(NetSpellType.FrostNova)) return false;

        var nearbyEnemies = 0;
        for (var ent of allEntities.values()) {
            if (ent.id === bot.id || ent.isDead) continue;
            if (!this.combat.isHostile(bot, ent)) continue;
            if (bot.distanceTo(ent) <= this.cfg.frostNovaRange)
                nearbyEnemies++;
        }

        // Nova if there are enemies in range (higher chance with more)
        return nearbyEnemies > 0 && Math.random() < 0.08 * nearbyEnemies;
    }

    // ========================= Movement =========================

    chaseTarget(bot, target, dt) {
        if (!bot.canMove) return;

        bot.botState = NetBotState.Chasing;
        bot.currentAnimation = NetAnimationType.Run;
        bot.currentPath = null; // clear wander path

        var dir = vec3.subtract(vec3.create(), target.position, bot.position);
        var dist = vec3.length(dir);
        if (dist < 0.1) return;

        var step = this.cfg.botMoveSpeed * dt;
        if (step > dist) step = dist;

        bot.position = vec3.scaleAndAdd(vec3.create(), bot.position, dir, step / dist);
        bot.lookAt(target.position);
    }

    /* Update wandering behavior between nodes. */
    updateWander(bot, dt, pathfinder) {
        if (!bot.canMove) return;

        bot.botState = NetBotState.Wandering;

        // Waiting at a node
        if (bot.wanderWaitTimer > 0) {
            bot.wanderWaitTimer -= dt;
            bot.currentAnimation = NetAnimationType.Idle;
            return;
        }

        // Need new path
        if (bot.currentPath === null || bot.pathIndex >= bot.currentPath.length) {
            this.pickNextWanderPath(bot, pathfinder);
            return;
        }

        // Follow path
        var targetWp = bot.currentPath[bot.pathIndex];
        var dir = vec3.subtract(vec3.create(), targetWp, bot.position);
        var dist = vec3.length(dir);
        var step = this.cfg.botMoveSpeed * dt;

        if (dist <= step || dist < 1.5) {
            bot.position = vec3.clone(targetWp);
            bot.pathIndex++;
            if (bot.pathIndex >= bot.currentPath.length) {
                // Arrived at destination
                bot.wanderWaitTimer = this.cfg.botWanderWaitMin +
                    Math.random() * (this.cfg.botWanderWaitMax - this.cfg.botWanderWaitMin);
                bot.currentPath = null;
                bot.currentAnimation = NetAnimationType.Idle;
            }
        } else {
            bot.position = vec3.scaleAndAdd(vec3.create(), bot.position, dir, step / dist);
            bot.lookAt(targetWp);
            bot.currentAnimation = NetAnimationType.Run;
        }
    }

    pickNextWanderPath(bot, pathfinder) {
        // Use the node manager to pick next node (web: the node a pending path leads to, if any)
        var nm = this.nodeManager;
        var nextNode = null;

        if (bot.pendingWanderNodeId !== null)
            nextNode = nm.getNode(bot.pendingWanderNodeId) || null;
        if (nextNode === null) {
            if (bot.currentNodeId !== null) {
                // Try linked node, avoiding previous
                nextNode = this.pickLinkedNodeAvoiding(bot.currentNodeId, bot.previousNodeId);
                if (nextNode === null)
                    nextNode = nm.getRandomNode();
            } else {
                nextNode = nm.getRandomNode();
            }
        }

        if (nextNode === null) {
            bot.wanderWaitTimer = 3; // wait before retrying
            return;
        }

        var startPos = bot.position;
        var endPos = vec3.fromValues(nextNode.x, nextNode.y, nextNode.z);

        var path = pathfinder(startPos, endPos);
        if (path === null) {
            // web: still being calculated; ask again for the same node shortly
            bot.pendingWanderNodeId = nextNode.id;
            bot.wanderWaitTimer = PathPendingRetry;
            return;
        }
        bot.pendingWanderNodeId = null;

        bot.previousNodeId = bot.currentNodeId;
        bot.currentNodeId = nextNode.id;

        if (path.length < 2) {
            // Teleport
            bot.position = endPos;
            bot.currentPath = null;
            bot.pathIndex = 0;
            bot.wanderWaitTimer = 2;
            bot.smoothedDirection = vec3.create();
            return;
        }

        bot.currentPath = path;
        bot.pathIndex = 1; // skip index 0 (current pos)
        bot.smoothedDirection = vec3.create();
    }

    pickLinkedNodeAvoiding(currentId, previousId) {
        var node = this.nodeManager.getNode(currentId);
        if (!node || node.links.trim() === '')
            return null;

        var allLinkedIds = parseLinkIds(node.links);
        if (allLinkedIds.length === 0) return null;

        var candidates = allLinkedIds.filter((id) => id !== previousId);
        if (candidates.length === 0)
            candidates = allLinkedIds;

        var chosenId = candidates[Math.floor(Math.random() * candidates.length)];
        return this.nodeManager.getNode(chosenId) || null;
    }

    // ========================= Logging =========================

    logVerbose(msg) {
        if (this.cfg.verboseBotLog)
            console.log("[botai] " + msg);
    }
}

export default BotAI;
