//from ZamModelViewer
export interface TextureRegion {
    x: number;
    y: number;
    w: number;
    h: number;
}

/* Unused slots in the region tables are empty objects */
export type TextureRegionSlot = Partial<TextureRegion>;

export interface WowRegionTable {
    ArmUpper: number;
    ArmLower: number;
    Hand: number;
    TorsoUpper: number;
    TorsoLower: number;
    LegUpper: number;
    LegLower: number;
    Foot: number;
    Accessory: number;
    FaceUpper: number;
    FaceLower: number;
    Unused: number;
    Base: number;
    old: TextureRegionSlot[];
    "new": TextureRegionSlot[];
}

var WowRegions: WowRegionTable = {
    ArmUpper: 0,
    ArmLower: 1,
    Hand: 2, //HA?
    TorsoUpper: 3,
    TorsoLower: 4,
    LegUpper: 5,
    LegLower: 6,
    Foot: 7,
    Accessory: 8,
    FaceUpper: 9,
    FaceLower: 10,
    Unused: 11,
    Base: 12,
    old: [{
        x: 0,
        y: 0,
        w: .5,
        h: .25
    }, {
        x: 0,
        y: .25,
        w: .5,
        h: .25
    }, {
        x: 0,
        y: .5,
        w: .5,
        h: .125
    }, {
        x: .5,
        y: 0,
        w: .5,
        h: .25
    }, {
        x: .5,
        y: .25,
        w: .5,
        h: .125
    }, {
        x: .5,
        y: .375,
        w: .5,
        h: .25
    }, {
        x: .5,
        y: .625,
        w: .5,
        h: .25
    }, {
        x: .5,
        y: .875,
        w: .5,
        h: .125
    }, {}, {
        x: 0,
        y: .625,
        w: .5,
        h: .125
    }, {
        x: 0,
        y: .75,
        w: .5,
        h: .25
    }, {}, {
        x: 0,
        y: 0,
        w: 1,
        h: 1
    }],
    "new": [{
        x: 0,
        y: 0,
        w: .25,
        h: .25
    }, {
        x: 0,
        y: .25,
        w: .25,
        h: .25
    }, {
        x: 0,
        y: .5,
        w: .25,
        h: .125
    }, {
        x: .25,
        y: 0,
        w: .25,
        h: .25
    }, {
        x: .25,
        y: .25,
        w: .25,
        h: .125
    }, {
        x: .25,
        y: .375,
        w: .25,
        h: .25
    }, {
        x: .25,
        y: .625,
        w: .25,
        h: .25
    }, {
        x: .25,
        y: .875,
        w: .25,
        h: .125
    }, {
        x: .75,
        y: .75,
        w: .25,
        h: .25
    }, {
        x: .5,
        y: 0,
        w: .5,
        h: 1
    }, {
        x: .5,
        y: 0,
        w: .5,
        h: 1
    }, {}, {
        x: 0,
        y: 0,
        w: .5,
        h: 1
    }]
};

export default WowRegions;
