import Expansion from '../Expansion.js';
import GameplayMode from '../GameplayMode.js';

//var urlToLoadWoWFile = '/get/';
var urlToLoadWoWFile = 'http://127.0.0.1:3002/files/';
var readFileMethod = 'http';
var archiveUrl = 'http://deamon87.github.io/WoWFiles/shattrath.zip';

var archiveFile = null;

var renderAdt = true;
var renderMd2 = true;
var renderWmo = true;
var renderBSP = false;
var renderPortals = false;
var usePortalCulling = true;

var renderSky = true;
var useDebugSky = false;

var renderLiquid = true;

var renderLowresTerrain = true;

/* the wireframe views (F1 - F5) */
var renderAdtPolygons = false;
var renderLiquidPolygons = false;
var renderMd2Polygons = false;
var renderWmoPolygons = false;
var renderSkyPolygons = false;

var drawWmoBB = false;
var drawM2BB = false;
var secondCamera = false;
var doubleCameraDebug = false;

var drawDepthBuffer = false;

var drawDistance = 400;
var cycleAnimations = false;

/* random skins for the models with a registered picker (see textureHelper), for the models loaded afterwards */
var useRandomTextures = false;

var cameraM2 = null;

/* the gameplay mode (my_web_wow's GlobalSettings.CurrentGameplayMode), set from ?mode= on startup */
var gameplayMode = GameplayMode.FreeRoam;

/* the HUD, the wandering bots and the 3D debug drawing (my_web_wow's GlobalSettings) */
var useHud = true; // the 2D HUD (unit frames, cast bars, numbers, floating combat text)
var enableWandering = true; // the wandering bots walk (Wander mode)
var drawNodeBoxes = false;
var drawNodeFlagColors = false; // color the node boxes by their BotWpFlags
var drawLinkedNodes = false;
var drawAllLinkedNodes = false;
var drawAllLinkedNodesNoDepth = false;
var drawPathLines = false;
var drawPathPoints = false;
var drawTargetCircle = true;
var drawTargetDot = false;

var savedUrlForLoading;
try {
    savedUrlForLoading = localStorage.getItem('urlForLoading');
} catch(e){
    console.log(e);
}
if (savedUrlForLoading) {
    urlToLoadWoWFile = savedUrlForLoading;
}

var sceneParams = null;

export default {
    getUrlToLoadWoWFile: function (){
        return urlToLoadWoWFile;
    },
    setUrlToLoadWoWFile : function (url){
        urlToLoadWoWFile = url;
        try {
            localStorage.setItem('urlForLoading', url);
        } catch(e) {
            console.log(e);
        }
    },
    /* the mpq server's collision api, next to its files/ route (http://127.0.0.1:3002/files/ -> http://127.0.0.1:3002/collision/) */
    getUrlToLoadCollision : function (){
        return new URL('../collision/', new URL(urlToLoadWoWFile, window.location.href)).toString();
    },
    /* the mpq server's gameplay api (wander nodes, navigation, model lists), next to its files/ route */
    getUrlToLoadGameplay : function (){
        return new URL('../gameplay/', new URL(urlToLoadWoWFile, window.location.href)).toString();
    },
    getFileReadMethod : function(){
        return readFileMethod;
    },
    setFileReadMethod : function(value){
        readFileMethod = value;
    },
    getArchiveUrl : function (){
        return archiveUrl;
    },
    setArchiveUrl : function (value) {
        archiveUrl = value;
    },

    getArchiveFile : function (){
        return archiveFile;
    },
    setArchiveFile : function(archive) {
        archiveFile = archive;
    },
    getRenderM2 : function () {
        return renderMd2;
    },
    setRenderM2 : function (value) {
        renderMd2 = value;
    },
    getRenderAdt : function () {
        return renderAdt;
    },
    setRenderAdt : function (value) {
        renderAdt = value;
    },
    getRenderWMO : function () {
        return renderWmo;
    },
    setRenderWMO : function (value) {
        renderWmo = value;
    },
    getRenderBSP : function () {
        return renderBSP;
    },
    setRenderBSP : function (value) {
        renderBSP = value;
    },
    getRenderPortals : function () {
        return renderPortals;
    },
    setRenderPortals : function (value) {
        renderPortals = value;
    },
    getUsePortalCulling : function () {
        return usePortalCulling;
    },
    setUsePortalCulling : function (value) {
        usePortalCulling = value;
    },
    getRenderSky : function () {
        return renderSky;
    },
    setRenderSky : function (value) {
        renderSky = value;
    },
    getUseDebugSky : function () {
        // TODO: fix sky/lit files for WOTLK. Maybe only use debug_sky if sky
        // file is missing?
        if (window.selectedExpansion === Expansion.WOTLK) return true;
        return useDebugSky;
    },
    setUseDebugSky : function (value) {
        useDebugSky = value;
    },
    getRenderLiquid : function () {
        return renderLiquid;
    },
    setRenderLiquid : function (value) {
        renderLiquid = value;
    },
    getRenderLowresTerrain : function () {
        return renderLowresTerrain;
    },
    setRenderLowresTerrain : function (value) {
        renderLowresTerrain = value;
    },
    getRenderAdtPolygons : function () {
        return renderAdtPolygons;
    },
    setRenderAdtPolygons : function (value) {
        renderAdtPolygons = value;
    },
    getRenderLiquidPolygons : function () {
        return renderLiquidPolygons;
    },
    setRenderLiquidPolygons : function (value) {
        renderLiquidPolygons = value;
    },
    getRenderMd2Polygons : function () {
        return renderMd2Polygons;
    },
    setRenderMd2Polygons : function (value) {
        renderMd2Polygons = value;
    },
    getRenderWmoPolygons : function () {
        return renderWmoPolygons;
    },
    setRenderWmoPolygons : function (value) {
        renderWmoPolygons = value;
    },
    getRenderSkyPolygons : function () {
        return renderSkyPolygons;
    },
    setRenderSkyPolygons : function (value) {
        renderSkyPolygons = value;
    },
    getSceneParams : function () {
        return sceneParams;
    },
    setSceneParams: function (value) {
        sceneParams = value;
    },
    getDrawWmoBB : function (){
        return drawWmoBB;
    },
    setDrawWmoBB : function (value) {
        drawWmoBB = value;
    },
    getDrawM2BB : function (){
        return drawM2BB;
    },
    setDrawM2BB: function (value) {
        drawM2BB = value;
    },
    getUseSecondCamera : function() {
        return secondCamera;
    },
    setUseSecondCamera : function(value) {
        secondCamera = value;
    },
    getDoubleCameraDebug : function () {
        return doubleCameraDebug;
    },
    setDoubleCameraDebug : function (value) {
        doubleCameraDebug = value;
    },
    getDrawDepthBuffer : function () {
        return drawDepthBuffer;
    },
    setDrawDepthBuffer : function (value) {
        drawDepthBuffer = value;
    },
    getDrawDistance : function () {
        return drawDistance;
    },
    setDrawDistance : function (value) {
        drawDistance = value;
    },
    getCycleAnimations : function () {
        return cycleAnimations;
    },
    setCycleAnimations : function (value) {
        cycleAnimations = value;
    },
    getUseRandomTextures : function () {
        return useRandomTextures;
    },
    setUseRandomTextures : function (value) {
        useRandomTextures = value;
    },
    getCameraM2 : function () {
        return cameraM2;
    },
    setCameraM2 : function (value) {
        cameraM2 = value;
    },
    getUseHud : function () {
        return useHud;
    },
    setUseHud : function (value) {
        useHud = value;
    },
    getEnableWandering : function () {
        return enableWandering;
    },
    setEnableWandering : function (value) {
        enableWandering = value;
    },
    getDrawNodeBoxes : function () {
        return drawNodeBoxes;
    },
    setDrawNodeBoxes : function (value) {
        drawNodeBoxes = value;
    },
    getDrawNodeFlagColors : function () {
        return drawNodeFlagColors;
    },
    setDrawNodeFlagColors : function (value) {
        drawNodeFlagColors = value;
    },
    getDrawLinkedNodes : function () {
        return drawLinkedNodes;
    },
    setDrawLinkedNodes : function (value) {
        drawLinkedNodes = value;
    },
    getDrawAllLinkedNodes : function () {
        return drawAllLinkedNodes;
    },
    setDrawAllLinkedNodes : function (value) {
        drawAllLinkedNodes = value;
    },
    getDrawAllLinkedNodesNoDepth : function () {
        return drawAllLinkedNodesNoDepth;
    },
    setDrawAllLinkedNodesNoDepth : function (value) {
        drawAllLinkedNodesNoDepth = value;
    },
    getDrawPathLines : function () {
        return drawPathLines;
    },
    setDrawPathLines : function (value) {
        drawPathLines = value;
    },
    getDrawPathPoints : function () {
        return drawPathPoints;
    },
    setDrawPathPoints : function (value) {
        drawPathPoints = value;
    },
    getDrawTargetCircle : function () {
        return drawTargetCircle;
    },
    setDrawTargetCircle : function (value) {
        drawTargetCircle = value;
    },
    getDrawTargetDot : function () {
        return drawTargetDot;
    },
    setDrawTargetDot : function (value) {
        drawTargetDot = value;
    },
    getGameplayMode : function () {
        return gameplayMode;
    },
    setGameplayMode : function (value) {
        gameplayMode = value;
    }
}
