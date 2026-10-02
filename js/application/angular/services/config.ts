import Expansion from '../Expansion';
import type { M2Object } from '../wowRenderJs/objects/M2Object';

//var urlToLoadWoWFile = '/get/';
var urlToLoadWoWFile: string = 'http://127.0.0.1:3002/files/';
var readFileMethod: string = 'http';
var archiveUrl: string = 'http://deamon87.github.io/WoWFiles/shattrath.zip';

var archiveFile: unknown = null;

var renderAdt: boolean = true;
var renderMd2: boolean = true;
var renderWmo: boolean = true;
var renderBSP: boolean = false;
var renderPortals: boolean = false;
var usePortalCulling: boolean = true;

var renderSky: boolean = true;
var useDebugSky: boolean = false;

var renderLiquid: boolean = true;

var renderLowresTerrain: boolean = true;

/* the wireframe views (F1 - F5) */
var renderAdtPolygons: boolean = false;
var renderLiquidPolygons: boolean = false;
var renderMd2Polygons: boolean = false;
var renderWmoPolygons: boolean = false;
var renderSkyPolygons: boolean = false;

var drawWmoBB: boolean = false;
var drawM2BB: boolean = false;
var secondCamera: boolean = false;
var doubleCameraDebug: boolean = false;

var drawDepthBuffer: boolean = false;

var drawDistance: number = 400;
var cycleAnimations: boolean = false;

/* random skins for the models with a registered picker (see textureHelper), for the models loaded afterwards */
var useRandomTextures: boolean = false;

var cameraM2: M2Object | null = null;

var savedUrlForLoading: string | null | undefined;
try {
    savedUrlForLoading = localStorage.getItem('urlForLoading');
} catch(e){
    console.log(e);
}
if (savedUrlForLoading) {
    urlToLoadWoWFile = savedUrlForLoading;
}

var sceneParams: unknown = null;

export default {
    getUrlToLoadWoWFile: function (){
        return urlToLoadWoWFile;
    },
    setUrlToLoadWoWFile : function (url: string){
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
    getFileReadMethod : function(){
        return readFileMethod;
    },
    setFileReadMethod : function(value: string){
        readFileMethod = value;
    },
    getArchiveUrl : function (){
        return archiveUrl;
    },
    setArchiveUrl : function (value: string) {
        archiveUrl = value;
    },

    getArchiveFile : function (){
        return archiveFile;
    },
    setArchiveFile : function(archive: unknown) {
        archiveFile = archive;
    },
    getRenderM2 : function () {
        return renderMd2;
    },
    setRenderM2 : function (value: boolean) {
        renderMd2 = value;
    },
    getRenderAdt : function () {
        return renderAdt;
    },
    setRenderAdt : function (value: boolean) {
        renderAdt = value;
    },
    getRenderWMO : function () {
        return renderWmo;
    },
    setRenderWMO : function (value: boolean) {
        renderWmo = value;
    },
    getRenderBSP : function () {
        return renderBSP;
    },
    setRenderBSP : function (value: boolean) {
        renderBSP = value;
    },
    getRenderPortals : function () {
        return renderPortals;
    },
    setRenderPortals : function (value: boolean) {
        renderPortals = value;
    },
    getUsePortalCulling : function () {
        return usePortalCulling;
    },
    setUsePortalCulling : function (value: boolean) {
        usePortalCulling = value;
    },
    getRenderSky : function () {
        return renderSky;
    },
    setRenderSky : function (value: boolean) {
        renderSky = value;
    },
    getUseDebugSky : function () {
        // TODO: fix sky/lit files for WOTLK. Maybe only use debug_sky if sky
        // file is missing?
        if (window.selectedExpansion === Expansion.WOTLK) return true;
        return useDebugSky;
    },
    setUseDebugSky : function (value: boolean) {
        useDebugSky = value;
    },
    getRenderLiquid : function () {
        return renderLiquid;
    },
    setRenderLiquid : function (value: boolean) {
        renderLiquid = value;
    },
    getRenderLowresTerrain : function () {
        return renderLowresTerrain;
    },
    setRenderLowresTerrain : function (value: boolean) {
        renderLowresTerrain = value;
    },
    getRenderAdtPolygons : function () {
        return renderAdtPolygons;
    },
    setRenderAdtPolygons : function (value: boolean) {
        renderAdtPolygons = value;
    },
    getRenderLiquidPolygons : function () {
        return renderLiquidPolygons;
    },
    setRenderLiquidPolygons : function (value: boolean) {
        renderLiquidPolygons = value;
    },
    getRenderMd2Polygons : function () {
        return renderMd2Polygons;
    },
    setRenderMd2Polygons : function (value: boolean) {
        renderMd2Polygons = value;
    },
    getRenderWmoPolygons : function () {
        return renderWmoPolygons;
    },
    setRenderWmoPolygons : function (value: boolean) {
        renderWmoPolygons = value;
    },
    getRenderSkyPolygons : function () {
        return renderSkyPolygons;
    },
    setRenderSkyPolygons : function (value: boolean) {
        renderSkyPolygons = value;
    },
    getSceneParams : function () {
        return sceneParams;
    },
    setSceneParams: function (value: unknown) {
        sceneParams = value;
    },
    getDrawWmoBB : function (){
        return drawWmoBB;
    },
    setDrawWmoBB : function (value: boolean) {
        drawWmoBB = value;
    },
    getDrawM2BB : function (){
        return drawM2BB;
    },
    setDrawM2BB: function (value: boolean) {
        drawM2BB = value;
    },
    getUseSecondCamera : function() {
        return secondCamera;
    },
    setUseSecondCamera : function(value: boolean) {
        secondCamera = value;
    },
    getDoubleCameraDebug : function () {
        return doubleCameraDebug;
    },
    setDoubleCameraDebug : function (value: boolean) {
        doubleCameraDebug = value;
    },
    getDrawDepthBuffer : function () {
        return drawDepthBuffer;
    },
    setDrawDepthBuffer : function (value: boolean) {
        drawDepthBuffer = value;
    },
    getDrawDistance : function () {
        return drawDistance;
    },
    setDrawDistance : function (value: number) {
        drawDistance = value;
    },
    getCycleAnimations : function () {
        return cycleAnimations;
    },
    setCycleAnimations : function (value: boolean) {
        cycleAnimations = value;
    },
    getUseRandomTextures : function () {
        return useRandomTextures;
    },
    setUseRandomTextures : function (value: boolean) {
        useRandomTextures = value;
    },
    getCameraM2 : function () {
        return cameraM2;
    },
    setCameraM2 : function (value: M2Object | null) {
        cameraM2 = value;
    }
}
