import configService from './config.js';
const worker = new Worker(new URL('./fileSystem/fileLoader-worker.js', import.meta.url), { type: 'module' });

var messageId = 0;
var messageTable = {};

worker.onmessage = function(e) {
    //debugger;

    var opcode = e.data.opcode;
    var message = e.data.message;
    var recv_messageId = e.data.messageId;

    if (opcode == 'fileLoaded') {
        //Imply message is Uint8Array
        var defer = messageTable[recv_messageId].defer;
        var fileName = messageTable[recv_messageId].fileName;

        if (message) {
            defer.onResolve(message);
        } else {
            defer.onResolve(message);
        }
        delete messageTable[recv_messageId];
    }
};
var inited = false;

export default function (fileName) {
    if (!inited) {
        worker.postMessage({opcode: 'init', message: {
            archiveFile : configService.getArchiveFile(),
            fileReadMethod : configService.getFileReadMethod(),
            urlToLoadWoWFile : configService.getUrlToLoadWoWFile()
        }});

        inited = true;
    }

    var defer = {};
    var promise = new Promise(function(resolve, reject) {
        defer.onResolve = function (value) {
            "use strict";
            //if (typeof value != 'object' || !(value instanceof ArrayBuffer)) {
            if (!value) {
                console.log("Failed to load file = " + fileName);
                reject()
            } else {
                resolve(value)
            }
        }
    });
    worker.postMessage({opcode: 'loadFile', messageId: messageId, message: fileName});
    messageTable[messageId] = {defer: defer, fileName : fileName};
    messageId++;

    return promise;
}

