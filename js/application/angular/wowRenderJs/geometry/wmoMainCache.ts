import cacheTemplate from './../cache';
import type { Cache } from './../cache';

import {wmoLoader} from './../../services/map/wmoLoader'
import type { WmoFile } from './../../services/map/wmoLoader';
import type { SceneApi } from './../sceneApi';

class WmoMainCache {
    cache: Cache<WmoFile, WmoFile>;

    constructor(sceneApi: SceneApi) {
        var self = this;

        this.cache = cacheTemplate(function loadGroupWmo(fileName: string) {
            /* Must return promise */
            return wmoLoader(fileName);
        }, function (a: WmoFile) {
            return a;
        });
    }
    loadWmoMain (fileName: string) {
        return this.cache.get(fileName);
    };

    unLoadWmoMain (fileName: string) {
        this.cache.remove(fileName)
    }
}

export default WmoMainCache;

