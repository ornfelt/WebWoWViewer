import configService from './config';
import type { FileLoaderReply } from './fileSystem/fileLoader-worker';

export interface FileLoaderInitParams {
    archiveFile: unknown;
    fileReadMethod: string;
    urlToLoadWoWFile: string;
}

/* Requests posted to the worker in services/fileSystem/fileLoader-worker */
export type FileLoaderRequest =
    | { opcode: 'init'; messageId?: undefined; message: FileLoaderInitParams }
    | { opcode: 'loadFile'; messageId: number; message: string };

interface FileLoaderDefer {
    onResolve(value: ArrayBuffer | null): void;
}

interface FileLoaderPending {
    defer: FileLoaderDefer;
    fileName: string;
}

const worker = new Worker(new URL('./fileSystem/fileLoader-worker.ts', import.meta.url), { type: 'module' });

var messageId: number = 0;
var messageTable: { [messageId: number]: FileLoaderPending } = {};

worker.onmessage = function(e: MessageEvent<FileLoaderReply>) {
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
var inited: boolean = false;

export default function (fileName: string): Promise<ArrayBuffer> {
    if (!inited) {
        worker.postMessage({opcode: 'init', message: {
            archiveFile : configService.getArchiveFile(),
            fileReadMethod : configService.getFileReadMethod(),
            urlToLoadWoWFile : configService.getUrlToLoadWoWFile()
        }} satisfies FileLoaderRequest);

        inited = true;
    }

    var defer = {} as FileLoaderDefer;
    var promise = new Promise<ArrayBuffer>(function(resolve, reject) {
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
    worker.postMessage({opcode: 'loadFile', messageId: messageId, message: fileName} satisfies FileLoaderRequest);
    messageTable[messageId] = {defer: defer, fileName : fileName};
    messageId++;

    return promise;
}

