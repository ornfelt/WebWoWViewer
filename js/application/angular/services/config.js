import Expansion from '../Expansion.js';

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

var cameraM2 = null;

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
    getCameraM2 : function () {
        return cameraM2;
    },
    setCameraM2 : function (value) {
        cameraM2 = value;
    }
}
