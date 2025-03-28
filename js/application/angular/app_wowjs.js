//import angular from 'angular';
//import angularDropdown from 'angular-ui-bootstrap/src/dropdown';import configService from './services/config.js';
//import './directives/wowJsRenderDirective.js';
//import 'bootstrap/dist/css/bootstrap.min.css';
//
//var main = angular.module('main.app',
//    [
//        'main.directives.wowJsRender',
//        angularDropdown
//    ]);
//
//main.controller("UrlChooserCtrl",[ '$scope', function($scope) {
//    console.log("Hello world");
//    $scope.isReadyForStart = false;
//
//    $scope.params = {};
//    $scope.params.urlForLoading = configService.getUrlToLoadWoWFile();
//    $scope.params.zipFile = null;
//
//    $scope.selectedModeName = "Please select mode";
//
//    var parameters = {
//            predefined: [{
//                name: 'Shattrath city (WotLK)',
//                source: 'zip',
//                url: 'http://deamon87.github.io/WoWFiles/shattrath.zip',
//                sceneType: 'map',
//                mapId: 530,
//                mapName: 'Expansion01',
//                x: -1663,
//                y: 5098,
//                z: 27
//            },
//            {
//                name: 'Ironforge (WotLK)',
//                source: 'zip',
//                url: 'http://deamon87.github.io/WoWFiles/ironforge.zip',
//                sceneType: 'wmo',
//                fileName: 'World/wmo/KhazModan/Cities/Ironforge/ironforge.wmo'
//            }
//        ],
//        custom: [
//            {
//                name: 'Raw coordinates',
//                source: 'http',
//                sceneType: 'customMap'
//            },
//            {
//                name: 'Shattrath city (WotLK)',
//                source: 'http',
//                sceneType: 'map',
//                mapId: 530,
//                mapName: 'Expansion01',
//                x: -1663,
//                y: 5098,
//                z: 27
//            },
//			{
//                name: 'Nagrand (WotLK)',
//                source: 'http',
//                sceneType: 'map',
//                mapId: 530,
//                mapName: 'Expansion01',
//                x: -743,
//                y: 8385,
//                z: 33
//            },
//
//        ]
//    };
//
//    $scope.selectionOptions = parameters;
//    $scope.status = {};
//    $scope.status.isopen = false;
//
//    $scope.selectMode = function (value) {
//        $scope.selectedValue = value;
//        $scope.selectedSource = value.source;
//        $scope.selectedModeName = value.name;
//
//        configService.setArchiveUrl(value.url);
//        configService.setFileReadMethod(value.source);
//    };
//
//    // Preselect some option
//    var firstOption = $scope.selectionOptions.custom[1]; // Shattrath
//    $scope.selectMode(firstOption);
//
//    $scope.startApplication = function () {
//        console.log("startApplication called");
//        configService.setUrlToLoadWoWFile($scope.params.urlForLoading);
//        console.log("url set: " + $scope.params.urlForLoading);
//        $scope.params.zipUrl = configService.getArchiveUrl();
//
//        configService.setSceneParams($scope.selectedValue);
//        console.log("selected value: " + $scope.selectedValue.name + ", source: " + $scope.selectedValue.source);
//
//        $scope.isReadyForStart = configService.getFileReadMethod() == "http" ;
//    };
//
//}]);
//
//main.config(['$provide', '$httpProvider', function ($provide, $httpProvider) {
//
//    /* 1. Interception of http ajax requests */
//    $provide.factory('myHttpInterceptor', ['$window', '$q', '$templateCache', function ($window, $q, $templateCache) {
//        return {
//
//            'request': function (config) {
//                if (config.url) {
//                    var index = config.url.indexOf('.glsl'),
//                        isRequestToShader = index > -1;
//
//                    if (!isRequestToShader) {
//                        if (!config.params) {
//                            config.params = {};
//                        }
//                        //config.params.t = new Date().getTime();
//                    } else {
//                        config.cache = $templateCache;
//                    }
//                }
//
//                return config;
//            }
//        };
//    }]);
//
//    $httpProvider.interceptors.push('myHttpInterceptor');
//}]);
//
//main.run(['$log', function( $log ) {
//}]);


//import configService from './services/config.js';
//import './directives/wowJsRenderDirective.js';
//import './directives/fileDownload.js';
//
//import axios from 'axios';
//
//// Set up an Axios interceptor to modify requests
//axios.interceptors.request.use(config => {
//  if (config.url) {
//    // If the URL does not end with ".glsl", add a dummy parameter (or any logic you need)
//    if (config.url.indexOf('.glsl') === -1) {
//      config.params = config.params || {};
//      // Uncomment to force non-caching (if needed)
//      // config.params.t = new Date().getTime();
//    }
//    // For shader requests, you might implement caching logic
//    // (Angular’s $templateCache is not available, so you can write your own caching if needed)
//  }
//  return config;
//}, error => {
//  return Promise.reject(error);
//});
//
//document.addEventListener('DOMContentLoaded', () => {
//  console.log("Hello world");
//
//  // Initialize application state
//  let isReadyForStart = false;
//  let isReadyForDownload = false;
//
//  const params = {
//    urlForLoading: configService.getUrlToLoadWoWFile(),
//    zipFile: null
//  };
//
//  let selectedModeName = "Please select mode";
//
//  // Define selection options (similar to your Angular controller parameters)
//  const selectionOptions = {
//    predefined: [
//      {
//        name: 'Shattrath city (WotLK)',
//        source: 'zip',
//        url: 'http://deamon87.github.io/WoWFiles/shattrath.zip',
//        sceneType: 'map',
//        mapId: 530,
//        mapName: 'Expansion01',
//        x: -1663,
//        y: 5098,
//        z: 27
//      },
//      {
//        name: 'Ironforge (WotLK)',
//        source: 'zip',
//        url: 'http://deamon87.github.io/WoWFiles/ironforge.zip',
//        sceneType: 'wmo',
//        fileName: 'World/wmo/KhazModan/Cities/Ironforge/ironforge.wmo'
//      }
//    ],
//    custom: [
//      {
//        name: 'Raw coordinates',
//        source: 'http',
//        sceneType: 'customMap'
//      },
//      {
//        name: 'Shattrath city (WotLK)',
//        source: 'http',
//        sceneType: 'map',
//        mapId: 530,
//        mapName: 'Expansion01',
//        x: -1663,
//        y: 5098,
//        z: 27
//      },
//      {
//        name: 'Nagrand (WotLK)',
//        source: 'http',
//        sceneType: 'map',
//        mapId: 530,
//        mapName: 'Expansion01',
//        x: -743,
//        y: 8385,
//        z: 33
//      }
//    ]
//  };
//
//  // Assume you have a <select id="modeSelect"></select> in your HTML.
//  const modeSelect = document.getElementById("modeSelect");
//  if (modeSelect) {
//    // Populate the dropdown with custom options
//    selectionOptions.custom.forEach((option, index) => {
//      const opt = document.createElement("option");
//      opt.value = index;
//      opt.textContent = option.name;
//      modeSelect.appendChild(opt);
//    });
//
//    // Set up a change listener
//    modeSelect.addEventListener("change", (event) => {
//      const index = event.target.value;
//      const value = selectionOptions.custom[index];
//      selectedModeName = value.name;
//      // Set values in configService
//      configService.setArchiveUrl(value.url);
//      configService.setFileReadMethod(value.source);
//    });
//
//    // Preselect the second custom option (index 1)
//    modeSelect.selectedIndex = 1;
//    const preselectedOption = selectionOptions.custom[1];
//    selectedModeName = preselectedOption.name;
//    configService.setArchiveUrl(preselectedOption.url);
//    configService.setFileReadMethod(preselectedOption.source);
//  }
//
//  // Assume you have a button with id "startButton"
//  const startButton = document.getElementById("startButton");
//  if (startButton) {
//    startButton.addEventListener("click", () => {
//      console.log("startApplication called");
//      configService.setUrlToLoadWoWFile(params.urlForLoading);
//      console.log("url set: " + params.urlForLoading);
//      params.zipUrl = configService.getArchiveUrl();
//      params.downLoadProgress = 0;
//
//      // Set scene parameters
//      configService.setSceneParams(preselectedOption);
//      console.log("selected value: " + preselectedOption.name + ", source: " + preselectedOption.source);
//
//      isReadyForDownload = configService.getFileReadMethod() === "zip";
//      isReadyForStart = configService.getFileReadMethod() === "http";
//
//      // Proceed to start your application logic here
//    });
//  }
//
//  // Assume you have a file input with id "zipFileInput"
//  const zipFileInput = document.getElementById("zipFileInput");
//  if (zipFileInput) {
//    zipFileInput.addEventListener("change", (event) => {
//      const file = event.target.files[0];
//      if (file) {
//        configService.setArchiveFile(file);
//        isReadyForDownload = false;
//        isReadyForStart = true;
//      }
//    });
//  }
//});
//
//

// src/app_wowjs_noangular.js

import { initViewer } from './directives/wowJsRenderDirective_noangular.js';
import Expansion from './Expansion.js';

window.selectedExpansion = Expansion.WOTLK; // default
let expansionLoaded = false;

// Determine expansion first
(async () => {
    try {
        const url = "http://localhost:3002/files/exp.txt";
        const response = await fetch(url);
        if (response.ok) {
            const text = (await response.text()).trim().toLowerCase();
            if (text === "classic") {
                window.selectedExpansion = Expansion.CLASSIC;
            } else if (text === "tbc") {
                window.selectedExpansion = Expansion.TBC;
            } else {
                window.selectedExpansion = Expansion.WOTLK;
            }
        } else {
            console.error("Error fetching exp.txt:", response.statusText);
        }
    } catch (error) {
        console.error("Error during fetch:", error);
    } finally {
        console.log("selectedExpansion:", window.selectedExpansion);
        expansionLoaded = true;
    }
})();

function waitForExpansion() {
    return new Promise(resolve => {
        const check = () => {
            if (expansionLoaded) {
                resolve();
            } else {
                setTimeout(check, 50);
            }
        };
        check();
    });
}

//document.addEventListener('DOMContentLoaded', () => {
//  const container = document.getElementById('viewer-container');
//  initViewer(container);
//});

//
// Entry point
//
//window.onload = () => {
window.onload = async () => {
  await waitForExpansion(); // Wait until the expansion has been set

  const container = document.getElementById('viewer-container');
  initViewer(container);
};

