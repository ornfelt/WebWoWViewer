import type { vec3 } from 'gl-matrix';

class WorldObject {
    /* set by setPosition() / setRotation() / setScale() */
    pos!: vec3;
    f!: number;
    /* undefined until setScale(); the `> 0.0001` tests rely on undefined comparing false */
    scale: number | undefined;

    constructor(){
    }

    setPosition(pos: vec3) {
        this.pos = pos;
    }
    getPosition() {
        return this.pos;
    }
    setRotation(f: number) {
        this.f = f;
    }
    setScale(scale: number) {
        this.scale = scale;
    }

}

export default WorldObject;
