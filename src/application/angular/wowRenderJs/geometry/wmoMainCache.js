import cacheTemplate from './../cache.js';
import { timeParse, timeUpload, timeTextures } from './../../services/performance.js';

import {wmoLoader} from './../../services/map/wmoLoader.js'

class WmoMainCache {
    constructor(sceneApi) {
        var self = this;

        this.cache = cacheTemplate(function loadGroupWmo(fileName) {
            /* Must return promise */
            return timeParse("WmoMain", fileName, wmoLoader(fileName));
        }, function (a) {
            return timeUpload("WmoMain", a, function () {
                return a;
            });
        });
    }
    loadWmoMain (fileName) {
        return this.cache.get(fileName);
    };

    unLoadWmoMain (fileName) {
        this.cache.remove(fileName)
    }
}

export default WmoMainCache;

