import Vec3D from "./vec3d.js";

class BinaryParser {

	constructor( buffer ) {
		this.view = new DataView( buffer );

		this.offset = 0;
		this.chunkOffset = 0;

		this._savedOffsets = [];
	}

	moveTo( offset ) {
		this.offset = offset + this.chunkOffset;
	}

	readFloat32() {
		const float = this.view.getFloat32( this.offset, true );
		this.offset += 4;

		return float;
	}

	readInt8() {
		return this.view.getInt8( this.offset ++ );
	}

	readInt16() {
		const int = this.view.getInt16( this.offset, true );
		this.offset += 2;

		return int;
	}

	readInt32() {
		const int = this.view.getInt32( this.offset, true );
		this.offset += 4;

		return int;
	}

	readString( bytes ) {
		let string = '';

		for ( let i = 0; i < bytes; i ++ ) {
			string += String.fromCharCode( this.readUInt8() );
		}

		return string;
	}

	readUInt8() {
		return this.view.getUint8( this.offset ++ );
	}

	readUInt16() {
		const int = this.view.getUint16( this.offset, true );
		this.offset += 2;
		return int;
	}

	readUInt32() {
		const int = this.view.getUint32( this.offset, true );
		this.offset += 4;
		return int;
	}

    readM2Range() {
        const minimum = this.readUInt32();
        const maximum = this.readUInt32();
        return { minimum, maximum };
    }

    readVec3D() {
        const x = this.readFloat32();
        const y = this.readFloat32();
        const z = this.readFloat32();
        return new Vec3D(x, y, z);
    }

	saveState() {
		this._savedOffsets.push( this.offset );
	}

	restoreState() {
		this.offset = this._savedOffsets.pop();
	}
}

export default BinaryParser;

