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

var drawWmoBB: boolean = false;
var drawM2BB: boolean = false;
var secondCamera: boolean = false;
var doubleCameraDebug: boolean = false;

var drawDepthBuffer: boolean = false;

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
    getCameraM2 : function () {
        return cameraM2;
    },
    setCameraM2 : function (value: M2Object | null) {
        cameraM2 = value;
    }
}
