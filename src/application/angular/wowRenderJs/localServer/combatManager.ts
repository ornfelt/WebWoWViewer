import {vec3} from 'gl-matrix'
import { FactionTeam } from '../manager/nodeManager'
import { NetSpellType, NetSpellSchool, NetBotClass, NetAnimationType, NetBotState, NetSpellVisualPhase, NetSoundType } from './netProtocol'
import { PolymorphDisplayId, PolymorphModelPath } from './serverConfig'
import type ServerConfig from './serverConfig';
import type ServerEntity from './serverEntity';
import type { NetSpellTypeValue, NetSpellSchoolValue, NetSpellVisualPhaseValue, NetSoundTypeValue, NetDamageEvent, NetSpellVisualEvent, NetEntityDied, NetSoundStub, NetVec3 } from './netProtocol';

/* the entities by id */
export type EntityMap = Map<number, ServerEntity>;

/* a random integer in [min, max] (C#'s Random.Next(min, max + 1)) */
export function randomInt(min: number, max: number): number {
    return min + Math.floor(Math.random() * (max - min + 1));
}

function toNetVec3(v: vec3 | null): NetVec3 | null {
    return v !== null ? [v[0], v[1], v[2]] : null;
}

/*
 * All combat logic: spell casting, damage resolution, cooldowns, interrupts, and status effects, as
 * my_web_wow's WowServer/CombatManager.cs. The events of a tick are queued for the clients.
 */
class CombatManager {
    cfg: ServerConfig;

    // Events queued each tick for client broadcast
    pendingDamage: NetDamageEvent[];
    pendingVisuals: NetSpellVisualEvent[];
    pendingDeaths: NetEntityDied[];
    pendingSounds: NetSoundStub[];

    constructor(cfg: ServerConfig) {
        this.cfg = cfg;
        this.pendingDamage = [];
        this.pendingVisuals = [];
        this.pendingDeaths = [];
        this.pendingSounds = [];
    }

    /* Clear per-tick event queues. Call at the start of each tick. */
    clearEvents() {
        this.pendingDamage = [];
        this.pendingVisuals = [];
        this.pendingDeaths = [];
        this.pendingSounds = [];
    }

    // ========================= Spell School Mapping =========================

    static getSchool(spell: NetSpellTypeValue): NetSpellSchoolValue {
        switch (spell) {
            case NetSpellType.Frostbolt: return NetSpellSchool.Frost;
            case NetSpellType.IceLance: return NetSpellSchool.Frost;
            case NetSpellType.IceMissile: return NetSpellSchool.Frost;
            case NetSpellType.FrostNova: return NetSpellSchool.Frost;
            case NetSpellType.Blizzard: return NetSpellSchool.Frost;
            case NetSpellType.Pyroblast: return NetSpellSchool.Fire;
            case NetSpellType.LightningBolt: return NetSpellSchool.Lightning;
            case NetSpellType.Polymorph: return NetSpellSchool.Arcane;
            case NetSpellType.Counterspell: return NetSpellSchool.Arcane;
            case NetSpellType.IceBlock: return NetSpellSchool.Frost;
            default: return NetSpellSchool.Arcane;
        }
    }

    // ========================= Cast Time Lookup =========================

    getCastTime(spell: NetSpellTypeValue): number {
        switch (spell) {
            case NetSpellType.Frostbolt: return 1.2;
            case NetSpellType.IceLance: return 0;      // instant
            case NetSpellType.Pyroblast: return 3.5;
            case NetSpellType.IceMissile: return 1.5;
            case NetSpellType.LightningBolt: return 1.2;
            case NetSpellType.Blizzard: return 0;      // channeled, not "cast"
            case NetSpellType.FrostNova: return 0;     // instant
            case NetSpellType.IceBlock: return 0;      // instant
            case NetSpellType.Polymorph: return 1.2;
            case NetSpellType.Counterspell: return 0;  // instant
            case NetSpellType.Kick: return 0;          // instant
            default: return 0;
        }
    }

    getChannelDuration(spell: NetSpellTypeValue): number {
        return spell === NetSpellType.Blizzard ? 5 : 0;
    }

    getCooldown(spell: NetSpellTypeValue): number {
        switch (spell) {
            case NetSpellType.FrostNova: return this.cfg.frostNovaCooldown;
            case NetSpellType.IceBlock: return this.cfg.iceBlockCooldown;
            case NetSpellType.Polymorph: return this.cfg.polymorphCooldown;
            case NetSpellType.Counterspell: return this.cfg.counterspellCooldown;
            case NetSpellType.Kick: return this.cfg.kickCooldown;
            case NetSpellType.Blizzard: return this.cfg.blizzardCooldown;
            default: return 0;
        }
    }

    getProjectileSpeed(spell: NetSpellTypeValue): number {
        return this.isProjectile(spell) ? 70 : 0;
    }

    isProjectile(spell: NetSpellTypeValue): boolean {
        return spell === NetSpellType.Frostbolt || spell === NetSpellType.IceLance || spell === NetSpellType.Pyroblast
            || spell === NetSpellType.IceMissile || spell === NetSpellType.LightningBolt;
    }

    // ========================= Attempt to Cast =========================

    /* Attempt to start a spell cast. Returns true if the cast/instant was initiated. */
    tryCast(caster: ServerEntity, spell: NetSpellTypeValue, target: ServerEntity | null,
            allEntities: EntityMap, groundTarget: vec3 | null = null): boolean {
        if (!caster.canCast) return false;
        if (caster.isOnCooldown(spell)) return false;

        var school = CombatManager.getSchool(spell);
        if (caster.isSchoolLocked(school)) return false;

        // Self-targeted spells
        if (spell === NetSpellType.IceBlock) {
            if (caster.botClass === NetBotClass.Melee) return false;
            return this.castIceBlock(caster);
        }
        if (spell === NetSpellType.FrostNova) {
            if (caster.botClass === NetBotClass.Melee) return false;
            return this.castFrostNova(caster, allEntities);
        }

        // Target required
        if (target === null || target.isDead) return false;

        // Range check for melee
        if (spell === NetSpellType.Kick || spell === NetSpellType.MeleeAttack || spell === NetSpellType.MeleeSpecial) {
            if (caster.distanceTo(target) > this.cfg.meleeRange) return false;
        } else {
            if (caster.distanceTo(target) > this.cfg.spellRange) return false;
        }

        // Interrupt spells
        if (spell === NetSpellType.Counterspell || spell === NetSpellType.Kick)
            return this.castInterrupt(caster, target, spell);

        // Polymorph
        if (spell === NetSpellType.Polymorph) {
            var castTime = this.getCastTime(spell);
            if (castTime > 0) {
                this.startCast(caster, spell, target.id, castTime);
                return true;
            }
        }

        // Blizzard (channeled)
        if (spell === NetSpellType.Blizzard) {
            var pos = groundTarget !== null ? groundTarget : target.position;
            this.startChannel(caster, spell, pos);
            return true;
        }

        // Direct / instant damage spells
        var ct = this.getCastTime(spell);
        if (ct > 0) {
            // Cast-time spell
            this.startCast(caster, spell, target.id, ct);
            return true;
        } else {
            // Instant
            caster.currentAnimation = NetAnimationType.SpellCast;

            if (this.isProjectile(spell)) {
                var dist = caster.distanceTo(target);
                var travelTime = this.computeTravelTime(spell, dist);

                this.emitVisual(caster.id, target.id, spell, NetSpellVisualPhase.ProjectileFire,
                    target.position, caster.position, travelTime);
                this.resolveSpellHit(caster, target, spell, travelTime);
            } else {
                this.resolveSpellHit(caster, target, spell);
            }

            this.emitVisual(caster.id, target.id, spell, NetSpellVisualPhase.CastComplete,
                target.position, caster.position);

            var cd = this.getCooldown(spell);
            if (cd > 0) caster.setCooldown(spell, cd);
            return true;
        }
    }

    // ========================= Cast Management =========================

    startCast(caster: ServerEntity, spell: NetSpellTypeValue, targetId: number, castTime: number) {
        caster.isCasting = true;
        caster.castingSpell = spell;
        caster.castTimeTotal = castTime;
        caster.castTimeElapsed = 0;
        caster.castTargetId = targetId;
        caster.currentAnimation = NetAnimationType.SpellCast;
        caster.botState = NetBotState.Casting;

        this.emitVisual(caster.id, targetId, spell, NetSpellVisualPhase.CastStart, null, caster.position);
    }

    startChannel(caster: ServerEntity, spell: NetSpellTypeValue, targetPos: vec3) {
        caster.isChanneling = true;
        caster.channelingSpell = spell;
        caster.channelDurationTotal = this.getChannelDuration(spell);
        caster.channelElapsed = 0;
        caster.channelTargetPos = vec3.clone(targetPos);
        caster.channelTickTimer = 0;
        caster.currentAnimation = NetAnimationType.SpellCast2;
        caster.botState = NetBotState.Channeling;

        var cd = this.getCooldown(spell);
        if (cd > 0) caster.setCooldown(spell, cd);

        this.emitVisual(caster.id, null, spell, NetSpellVisualPhase.ChannelStart, targetPos, caster.position);
    }

    /* Update active casts/channels. Called each tick for each entity. */
    updateCasting(entity: ServerEntity, dt: number, allEntities: EntityMap) {
        // Update cast
        if (entity.isCasting) {
            // Movement cancels cast (handled by caller for players; here for bots)
            entity.castTimeElapsed += dt;
            if (entity.castTimeElapsed >= entity.castTimeTotal) {
                // Cast complete
                this.completeCast(entity, allEntities);
            }
        }

        // Update channel
        if (entity.isChanneling) {
            entity.channelElapsed += dt;
            entity.channelTickTimer += dt;

            // Blizzard damage ticks
            if (entity.channelingSpell === NetSpellType.Blizzard &&
                entity.channelTickTimer >= this.cfg.blizzardTickInterval) {
                entity.channelTickTimer -= this.cfg.blizzardTickInterval;
                this.applyBlizzardTick(entity, allEntities);
            }

            if (entity.channelElapsed >= entity.channelDurationTotal) {
                this.emitVisual(entity.id, null, entity.channelingSpell ?? NetSpellType.Blizzard,
                    NetSpellVisualPhase.ChannelEnd, null, null);
                entity.cancelChannel();
                entity.currentAnimation = NetAnimationType.Idle;
                entity.botState = NetBotState.Idle;
            }
        }
    }

    completeCast(caster: ServerEntity, allEntities: EntityMap) {
        var spell = caster.castingSpell ?? NetSpellType.Frostbolt;
        var targetId = caster.castTargetId;

        caster.cancelCast();
        caster.currentAnimation = NetAnimationType.SpellCasted;

        var cd = this.getCooldown(spell);
        if (cd > 0) caster.setCooldown(spell, cd);

        var target = targetId !== null ? allEntities.get(targetId) : undefined;

        if (!target || target.isDead) {
            caster.botState = NetBotState.Idle;
            return;
        }

        // Polymorph
        if (spell === NetSpellType.Polymorph) {
            this.applyPolymorph(target);
            this.emitVisual(caster.id, target.id, spell, NetSpellVisualPhase.CastComplete, null, caster.position);
            this.emitSound(NetSoundType.Polymorph, target.id);
            return;
        }

        // Compute travel time from authoritative positions
        var travelTime = 0;
        if (this.isProjectile(spell)) {
            var dist = caster.distanceTo(target);
            travelTime = this.computeTravelTime(spell, dist);

            this.emitVisual(caster.id, target.id, spell, NetSpellVisualPhase.ProjectileFire,
                target.position, caster.position, travelTime);
        }

        // Apply damage (travel time included in event so client can sync)
        this.resolveSpellHit(caster, target, spell, travelTime);

        this.emitVisual(caster.id, target.id, spell, NetSpellVisualPhase.CastComplete, null, caster.position);

        caster.botState = NetBotState.Idle;
    }

    // ========================= Spell Effects =========================

    castIceBlock(caster: ServerEntity): boolean {
        if (caster.isOnCooldown(NetSpellType.IceBlock)) return false;

        caster.cancelCast();
        caster.cancelChannel();
        caster.isIceBlocked = true;
        caster.iceBlockTimer = this.cfg.iceBlockDuration;
        caster.currentAnimation = NetAnimationType.Stunned;
        caster.botState = NetBotState.IceBlocked;
        caster.setCooldown(NetSpellType.IceBlock, this.cfg.iceBlockCooldown);

        this.emitVisual(caster.id, caster.id, NetSpellType.IceBlock, NetSpellVisualPhase.AreaEffect,
            caster.position, null);
        this.emitSound(NetSoundType.IceBlock, caster.id);

        return true;
    }

    castFrostNova(caster: ServerEntity, allEntities: EntityMap): boolean {
        if (caster.isOnCooldown(NetSpellType.FrostNova)) return false;

        caster.setCooldown(NetSpellType.FrostNova, this.cfg.frostNovaCooldown);
        caster.currentAnimation = NetAnimationType.SpellCast;

        var frozenCount = 0;
        for (var ent of allEntities.values()) {
            if (ent.id === caster.id) continue;
            if (ent.isDead || ent.isIceBlocked) continue;
            if (!this.isHostile(caster, ent)) continue;
            if (caster.distanceTo(ent) <= this.cfg.frostNovaRange) {
                ent.isFrozenByNova = true;
                ent.frostNovaTimer = this.cfg.frostNovaDuration;
                if (ent.isCasting) { ent.cancelCast(); }
                if (ent.isChanneling) { ent.cancelChannel(); }
                frozenCount++;
            }
        }

        this.emitVisual(caster.id, null, NetSpellType.FrostNova, NetSpellVisualPhase.AreaEffect,
            caster.position, null);
        this.emitSound(NetSoundType.FrostNova, caster.id);

        if (this.cfg.verboseBotLog) console.log("[combat] " + caster.id + " cast Frost Nova, froze " + frozenCount + " targets");
        return true;
    }

    applyPolymorph(target: ServerEntity) {
        // Already a sheep: only refresh the duration. Saving the model again would save the sheep
        // as the original, and the target would stay a sheep after the polymorph.
        if (target.isPolymorphed) {
            target.polymorphTimer = this.cfg.polymorphDuration;
            return;
        }

        target.cancelCast();
        target.cancelChannel();
        target.isPolymorphed = true;
        target.polymorphTimer = this.cfg.polymorphDuration;
        target.saveOriginalModel();
        target.displayId = PolymorphDisplayId;
        target.modelPath = PolymorphModelPath;
        target.currentAnimation = NetAnimationType.Run; // sheep waddle
        target.botState = NetBotState.Polymorphed;
    }

    castInterrupt(caster: ServerEntity, target: ServerEntity, interruptSpell: NetSpellTypeValue): boolean {
        if (caster.isOnCooldown(interruptSpell)) return false;

        var cd = this.getCooldown(interruptSpell);
        caster.setCooldown(interruptSpell, cd);

        if (interruptSpell === NetSpellType.Kick)
            caster.currentAnimation = NetAnimationType.AttackSpecial;
        else
            caster.currentAnimation = NetAnimationType.SpellCast3;

        // Only interrupt if target is casting/channeling
        if (target.isCasting) {
            var school = CombatManager.getSchool(target.castingSpell ?? NetSpellType.Frostbolt);
            target.cancelCast();
            target.lockSchool(school, this.cfg.schoolLockoutDuration);
            target.currentAnimation = NetAnimationType.GettingHit;
            if (this.cfg.verboseBotLog) console.log("[combat] " + caster.id + " interrupted " + target.id + "'s cast, locked " + school + " school");
            return true;
        }
        if (target.isChanneling) {
            var channelSchool = CombatManager.getSchool(target.channelingSpell ?? NetSpellType.Blizzard);
            target.cancelChannel();
            target.lockSchool(channelSchool, this.cfg.schoolLockoutDuration);
            target.currentAnimation = NetAnimationType.GettingHit;
            return true;
        }

        // Didn't interrupt anything, but still goes on cooldown
        return true;
    }

    // ========================= Damage Resolution =========================

    resolveSpellHit(caster: ServerEntity, target: ServerEntity, spell: NetSpellTypeValue, travelTime = 0) {
        if (target.isDead) return;

        if (target.isIceBlocked) {
            this.pendingDamage.push({
                sourceId: caster.id, targetId: target.id, amount: 0, isCrit: false,
                spellType: spell, isHeal: false, travelTime: travelTime
            });
            return;
        }

        var dmg = this.rollDamage(spell);
        var crit = Math.random() < this.cfg.critChance;
        if (crit) dmg = Math.trunc(dmg * this.cfg.critMultiplier);

        var actual = target.takeDamage(dmg);

        this.pendingDamage.push({
            sourceId: caster.id, targetId: target.id, amount: actual, isCrit: crit,
            spellType: spell, isHeal: false, travelTime: travelTime
        });

        this.emitSound(NetSoundType.SpellHit, target.id);

        if (target.isDead) {
            target.die();
            this.pendingDeaths.push({ entityId: target.id, killerId: caster.id });
            this.emitSound(NetSoundType.Death, target.id);
            caster.killCount++;
        } else {
            if (target.currentAnimation === NetAnimationType.Idle)
                target.currentAnimation = NetAnimationType.GettingHit;
        }
    }

    /* Resolve a melee auto-attack hit. */
    resolveMeleeHit(attacker: ServerEntity, target: ServerEntity, isSpecial: boolean) {
        if (target.isDead) return;

        var spellType = isSpecial ? NetSpellType.MeleeSpecial : NetSpellType.MeleeAttack;

        if (target.isIceBlocked) {
            this.pendingDamage.push({
                sourceId: attacker.id, targetId: target.id, amount: 0, isCrit: false,
                spellType: spellType, isHeal: false, travelTime: 0
            });
            return;
        }

        var dmg = isSpecial
            ? randomInt(this.cfg.meleeSpecialMinDmg, this.cfg.meleeSpecialMaxDmg)
            : randomInt(this.cfg.meleeAutoMinDmg, this.cfg.meleeAutoMaxDmg);

        var crit = Math.random() < this.cfg.critChance;
        if (crit) dmg = Math.trunc(dmg * this.cfg.critMultiplier);

        var actual = target.takeDamage(dmg);

        this.pendingDamage.push({
            sourceId: attacker.id, targetId: target.id, amount: actual, isCrit: crit,
            spellType: spellType, isHeal: false, travelTime: 0
        });

        this.emitSound(NetSoundType.MeleeHit, target.id);

        if (target.isDead) {
            target.die();
            this.pendingDeaths.push({ entityId: target.id, killerId: attacker.id });
            this.emitSound(NetSoundType.Death, target.id);
            attacker.killCount++;
        } else {
            if (target.currentAnimation === NetAnimationType.Idle)
                target.currentAnimation = NetAnimationType.GettingHit;
        }
    }

    applyBlizzardTick(caster: ServerEntity, allEntities: EntityMap) {
        if (caster.channelTargetPos === null) return;
        var center = caster.channelTargetPos;

        for (var ent of allEntities.values()) {
            if (ent.id === caster.id) continue;
            if (ent.isDead || ent.isIceBlocked) continue;
            if (!this.isHostile(caster, ent)) continue;
            if (ent.distanceTo(center) <= this.cfg.blizzardRadius) {
                var dmg = randomInt(this.cfg.blizzardTickMinDmg, this.cfg.blizzardTickMaxDmg);
                var crit = Math.random() < this.cfg.critChance;
                if (crit) dmg = Math.trunc(dmg * this.cfg.critMultiplier);

                var actual = ent.takeDamage(dmg);

                this.pendingDamage.push({
                    sourceId: caster.id, targetId: ent.id, amount: actual, isCrit: crit,
                    spellType: NetSpellType.Blizzard, isHeal: false, travelTime: 0
                });

                if (ent.isDead) {
                    ent.die();
                    this.pendingDeaths.push({ entityId: ent.id, killerId: caster.id });
                    caster.killCount++;
                }
            }
        }
    }

    rollDamage(spell: NetSpellTypeValue): number {
        switch (spell) {
            case NetSpellType.Frostbolt: return randomInt(this.cfg.frostboltMinDmg, this.cfg.frostboltMaxDmg);
            case NetSpellType.IceLance: return randomInt(this.cfg.iceLanceMinDmg, this.cfg.iceLanceMaxDmg);
            case NetSpellType.Pyroblast: return randomInt(this.cfg.pyroblastMinDmg, this.cfg.pyroblastMaxDmg);
            case NetSpellType.IceMissile: return randomInt(this.cfg.iceMissileMinDmg, this.cfg.iceMissileMaxDmg);
            case NetSpellType.LightningBolt: return randomInt(this.cfg.lightningBoltMinDmg, this.cfg.lightningBoltMaxDmg);
            default: return randomInt(100, 299);
        }
    }

    // ========================= Hostility =========================

    /* Are these two entities hostile to each other? */
    isHostile(a: ServerEntity, b: ServerEntity): boolean {
        if (a.id === b.id) return false;
        if (a.team === FactionTeam.None || b.team === FactionTeam.None)
            return true; // FreeForAll: everyone is hostile
        return a.team !== b.team; // Deathmatch: different teams
    }

    computeTravelTime(spell: NetSpellTypeValue, distance: number): number {
        var speed = this.getProjectileSpeed(spell);
        if (speed <= 0) return 0;
        var time = distance / speed;
        return Math.min(Math.max(time, 0.15), 4);
    }

    // ========================= Event Helpers =========================

    emitVisual(casterId: number, targetId: number | null, spell: NetSpellTypeValue, phase: NetSpellVisualPhaseValue,
               targetPos: vec3 | null, sourcePos: vec3 | null, travelTime = 0) {
        this.pendingVisuals.push({
            casterId: casterId,
            targetId: targetId,
            spellType: spell,
            phase: phase,
            targetPosition: toNetVec3(targetPos),
            sourcePosition: toNetVec3(sourcePos),
            travelTime: travelTime
        });
    }

    emitSound(sound: NetSoundTypeValue, entityId: number) {
        var desc: string;
        switch (sound) {
            case NetSoundType.Polymorph: desc = "[sound stub] Polymorph baa~ (not yet implemented)"; break;
            case NetSoundType.FrostNova: desc = "[sound stub] Frost Nova crack (not yet implemented)"; break;
            case NetSoundType.IceBlock: desc = "[sound stub] Ice Block freeze (not yet implemented)"; break;
            case NetSoundType.MeleeHit: desc = "[sound stub] Melee impact (not yet implemented)"; break;
            case NetSoundType.SpellHit: desc = "[sound stub] Spell impact (not yet implemented)"; break;
            case NetSoundType.Death: desc = "[sound stub] Death sound (not yet implemented)"; break;
            case NetSoundType.Resurrect: desc = "[sound stub] Resurrect chime (not yet implemented)"; break;
            default: desc = "[sound stub] " + sound + " (not yet implemented)"; break;
        }

        this.pendingSounds.push({ soundType: sound, entityId: entityId, description: desc });
    }
}

export default CombatManager;
