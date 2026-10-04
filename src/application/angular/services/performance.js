import config from './config.js';

/*
 * The frame-stage timings (my_web_wow's Performance.cs) and the load timing logs (my_web_wow's
 * GlobalSettings.Timing). The C# compiles them in with WITH_PERFORMANCE / WITH_DEBUG_TIMING; here they
 * are switched by config.getPerformanceOverlay() / config.getLogTiming(), and do nothing while off.
 * Times come from performance.now() (milliseconds, with microsecond resolution where the browser allows).
 */

export const PerformanceCategory = {
    CHECK_CULLING: 0,
    SORT_GEOMETRY: 1,
    WORLD_OBJECT_UPDATE: 2,
    GRAPH_UPDATE: 3,
    GRAPH_DRAW: 4,
    M2_RENDER: 5,
    WMO_RENDER: 6
};

/* the category names, in PerformanceCategory order */
const categoryNames = Object.keys(PerformanceCategory);

var reports = categoryNames.map(() => ({ min: Infinity, max: 0, sum: 0, samples: 0 }));

/* the start of a measured stage (0 while the performance overlay is off) */
export function performanceBegin() {
    return config.getPerformanceOverlay() ? performance.now() : 0;
}

/* the end of a measured stage, started by performanceBegin() */
export function performanceEnd(category, startTime) {
    if (!config.getPerformanceOverlay()) return;
    var time = (performance.now() - startTime) * 1000; // microseconds
    var report = reports[category];
    report.samples++;
    report.sum += time;
    if (time < report.min) report.min = time;
    if (time > report.max) report.max = time;
}

export function performanceReset() {
    for (var report of reports) {
        report.samples = 0;
        report.sum = 0;
        report.min = Infinity;
        report.max = 0;
    }
}

function pad(value, width) {
    var text = String(value);
    return text.length >= width ? text : ' '.repeat(width - text.length) + text;
}

/* the report table, as my_web_wow's Performance.Dump prints it */
export function performanceTable() {
    var lines = [
        pad("category", 21) + " | " + pad("samples", 7) + " | " + pad("min µs", 7) + " | " + pad("max µs", 7) + " | " + pad("avg µs", 8) + " | " + pad("total µs", 9),
        "----------------------+---------+---------+---------+----------+-----------"
    ];
    for (var i = 0; i < reports.length; i++) {
        var samples = reports[i].samples;
        var min = samples !== 0 ? Math.floor(reports[i].min) : 0;
        var max = samples !== 0 ? Math.floor(reports[i].max) : 0;
        var avg = reports[i].sum / (samples !== 0 ? samples : 1);
        var sum = samples !== 0 ? Math.floor(reports[i].sum) : 0;
        lines.push(pad(categoryNames[i], 21) + " | " + pad(samples, 7) + " | " + pad(min, 7) + " | " + pad(max, 7) + " | " + pad(avg.toFixed(2), 8) + " | " + pad(sum, 9));
    }
    return lines.join('\n');
}

/* prints the report table (my_web_wow's Performance.Dump) */
export function performanceDump() {
    console.log(performanceTable() + '\n');
}

// ========================= Load timing logs =========================

/* logs a load timing line when the load timing logs are on (my_web_wow's GlobalSettings.Timing) */
export function timing(message) {
    if (!config.getLogTiming()) return;
    console.log(message);
}

/* the start time and file of a loaded (parsed) file, for its later phases */
var loadStarts = new WeakMap();

/* times a file's parse (a cache's load function): "[TIMING] <kind> parse <file>: <ms> ms" */
export function timeParse(kind, fileName, load) {
    if (!config.getLogTiming()) return load;
    var t0 = performance.now();
    return load.then(function (loaded) {
        timing("[TIMING] " + kind + " parse " + fileName + ": " + (performance.now() - t0).toFixed(1) + " ms");
        loadStarts.set(loaded, { fileName: fileName, t0: t0 });
        return loaded;
    });
}

/* times the GPU setup of a parsed file (a cache's process function): "[TIMING] <kind> GPU upload <file>: <ms> ms" */
export function timeUpload(kind, loaded, process) {
    var start = loadStarts.get(loaded);
    if (!config.getLogTiming() || !start) return process();
    var t1 = performance.now();
    var result = process();
    timing("[TIMING] " + kind + " GPU upload " + start.fileName + ": " + (performance.now() - t1).toFixed(1) + " ms");
    return result;
}

/* times a parsed file's texture loads, and logs its total from the start of the parse */
export function timeTextures(kind, loaded, textures) {
    var start = loadStarts.get(loaded);
    if (!config.getLogTiming() || !start) return;
    var t1 = performance.now();
    var fileName = start.fileName, t0 = start.t0;
    textures.then(function () {
        timing("[TIMING] " + kind + " textures " + fileName + ": " + (performance.now() - t1).toFixed(1) + " ms");
        timing("[TIMING] " + kind + " total " + fileName + ": " + (performance.now() - t0).toFixed(1) + " ms");
    });
}
