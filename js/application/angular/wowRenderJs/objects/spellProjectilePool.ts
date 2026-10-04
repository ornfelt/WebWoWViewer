import SpellProjectile from './spellProjectile'
import type {vec3, mat4} from 'gl-matrix'
import type { SceneApi } from '../sceneApi';
import type WorldObjectManager from '../manager/worldObjectManager';

/*
 * A fixed-size pool of SpellProjectile instances for one spell type, so multiple copies can be in flight
 * simultaneously (e.g. 3 frostbolts), as my_web_wow's SpellProjectilePool.cs. fire() picks the first
 * inactive projectile; if all are in flight, the fire is silently dropped (no spam).
 */
class SpellProjectilePool {
    pool: SpellProjectile[];

    /* count identical projectiles, with the objectMap keys baseKey, baseKey+1, ..., baseKey+(count-1) */
    constructor(sceneApi: SceneApi, worldObjectManager: WorldObjectManager, modelPath: string, baseKey: number, count: number,
                speed = 60, arrivalThreshold = 3, baseRotationCorrection: mat4 | null = null) {
        this.pool = [];
        for (var i = 0; i < count; i++) {
            this.pool.push(new SpellProjectile(
                sceneApi, worldObjectManager, modelPath, baseKey + i,
                speed, arrivalThreshold, baseRotationCorrection));
        }
    }

    get poolSize(): number {
        return this.pool.length;
    }

    /* the arrival callback of every projectile in the pool */
    setOnArrive(onArrive: (targetKey: number) => void) {
        for (var proj of this.pool) proj.onArrive = onArrive;
    }

    /* Fire a projectile from origin toward the target key. Returns true if a free slot was found; false if all are in flight. */
    fire(origin: vec3, targetKey: number): boolean {
        for (var proj of this.pool) {
            if (!proj.isActive) {
                proj.fire(origin, targetKey);
                return true;
            }
        }
        return false; // pool exhausted
    }

    /* Update all projectiles in the pool. */
    update(deltaTime: number) {
        for (var proj of this.pool) proj.update(deltaTime);
    }

    /* True if any projectile in the pool is active (in flight). */
    get anyActive(): boolean {
        return this.pool.some((p) => p.isActive);
    }

    /* True if all projectiles are in flight (pool full). */
    get allActive(): boolean {
        return this.pool.every((p) => p.isActive);
    }

    /* Number of projectiles currently in flight. */
    get activeCount(): number {
        return this.pool.filter((p) => p.isActive).length;
    }

    /* Fire the next available projectile with a custom speed. */
    fireWithSpeed(origin: vec3, targetKey: number, speed: number) {
        for (var proj of this.pool) {
            if (!proj.isActive) {
                proj.fireWithSpeed(origin, targetKey, speed);
                return;
            }
        }
    }
}

export default SpellProjectilePool;
