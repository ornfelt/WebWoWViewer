// Random skin variants for a few creature models, as in my_web_wow's RandomTexture.cs

const kOgreSkins = [
    "OgreSkinYellow","OgreSkinRed","OgreSkinBlack","OgreSkinBlue","OgreSkinGray",
];

const kSheepSkins = [
    "sheep","sheepblack","sheepbrown","sheeprobo",
];

const kWolfSkins = [
    "WolfSkinArctic", "WolfSkinBlack", "WolfSkinCoyote",
    "WolfSkinDiseased", "WolfSkinTimber", "WolfSkin_Ghost",
];

const kTigerSkins = [
    "TigerSkinBlack", "TigerSkinBrown", "TigerSkinDark",
    "TigerSkinGreen", "TigerSkinIce", "TigerSkinRed",
    "TigerSkinSnow", "TigerSkinWhite", "TigerSkinYellow",
];

const kBearSkins = [
    "BearSkinBlack", "BearSkinBlue", "BearSkinBrown",
    "BearSkinDrkBrown", "BearSkinWhite",
];

const kSkeletonSkins = [
    "SkeletonNakedSkin_White", "SkeletonNakedSkin_Yellow",
    "SkeletonNakedSkin_Blue", "SkeletonNakedSkin_Green",
    "SkeletonNakedSkin_Red", "SkeletonNakedSkin_Black",
];

function pick(skins) {
    return skins[Math.floor(Math.random() * skins.length)];
}

export default {
    pickRandomSheepSkin: function () { return pick(kSheepSkins); },
    pickRandomOgreSkin: function () { return pick(kOgreSkins); },
    pickRandomWolfSkin: function () { return pick(kWolfSkins); },
    pickRandomTigerSkin: function () { return pick(kTigerSkins); },
    pickRandomBearSkin: function () { return pick(kBearSkins); },
    pickRandomSkeletonSkin: function () { return pick(kSkeletonSkins); },
}
