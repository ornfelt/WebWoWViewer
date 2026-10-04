import SpellProjectile from './spellProjectile.js'

/*
 * A fixed-size pool of SpellProjectile instances for one spell type, so multiple copies can be in flight
 * simultaneously (e.g. 3 frostbolts), as my_web_wow's SpellProjectilePool.cs. fire() picks the first
 * inactive projectile; if all are in flight, the fire is silently dropped (no spam).
 */
class SpellProjectilePool {
    /* count identical projectiles, with the objectMap keys baseKey, baseKey+1, ..., baseKey+(count-1) */
    constructor(sceneApi, worldObjectManager, modelPath, baseKey, count,
                speed = 60, arrivalThreshold = 3, baseRotationCorrection = null) {
        this.pool = [];
        for (var i = 0; i < count; i++) {
            this.pool.push(new SpellProjectile(
                sceneApi, worldObjectManager, modelPath, baseKey + i,
                speed, arrivalThreshold, baseRotationCorrection));
        }
    }

    get poolSize() {
        return this.pool.length;
    }

    /* the arrival callback of every projectile in the pool */
    setOnArrive(onArrive) {
        for (var proj of this.pool) proj.onArrive = onArrive;
    }

    /* Fire a projectile from origin toward the target key. Returns true if a free slot was found; false if all are in flight. */
    fire(origin, targetKey) {
        for (var proj of this.pool) {
            if (!proj.isActive) {
                proj.fire(origin, targetKey);
                return true;
            }
        }
        return false; // pool exhausted
    }

    /* Update all projectiles in the pool. */
    update(deltaTime) {
        for (var proj of this.pool) proj.update(deltaTime);
    }

    /* True if any projectile in the pool is active (in flight). */
    get anyActive() {
        return this.pool.some((p) => p.isActive);
    }

    /* True if all projectiles are in flight (pool full). */
    get allActive() {
        return this.pool.every((p) => p.isActive);
    }

    /* Number of projectiles currently in flight. */
    get activeCount() {
        return this.pool.filter((p) => p.isActive).length;
    }

    /* Fire the next available projectile with a custom speed. */
    fireWithSpeed(origin, targetKey, speed) {
        for (var proj of this.pool) {
            if (!proj.isActive) {
                proj.fireWithSpeed(origin, targetKey, speed);
                return;
            }
        }
    }
}

export default SpellProjectilePool;
