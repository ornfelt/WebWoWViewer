import fileLoaderStub from './fileLoaderStub';
import type { FileLoaderConfig, FileLoaderFunc } from './fileLoaderStub';
import type { FileLoaderInitParams, FileLoaderRequest } from '../fileLoader';

/* Reply posted back to services/fileLoader: the file contents, or null when loading failed */
export interface FileLoaderReply {
  opcode: 'fileLoaded';
  messageId: number;
  message: ArrayBuffer | null;
}

/* The worker global scope; type-checked with the DOM lib, where self is a Window */
interface WorkerScope {
  fileLoader: FileLoaderFunc;
  postMessage(message: FileLoaderReply, transfer?: Transferable[]): void;
}

self.addEventListener('message', function(e: MessageEvent<FileLoaderRequest>) {
  const opcode = e.data.opcode;
  const message = e.data.message;
  const messageId = e.data.messageId!;

  if (opcode === 'init') {
    const configService: FileLoaderConfig = {
      getArchiveFile: () => (message as FileLoaderInitParams).archiveFile,
      getFileReadMethod: () => (message as FileLoaderInitParams).fileReadMethod,
      getUrlToLoadWoWFile: () => (message as FileLoaderInitParams).urlToLoadWoWFile,
    };
    // Initialize fileLoader without Q
    (self as unknown as WorkerScope).fileLoader = fileLoaderStub(configService);
  } else if (opcode === 'loadFile') {
    const filePath = message as string;
    (self as unknown as WorkerScope).fileLoader(filePath)
      .then((a) => {
        if (a) {
          (self as unknown as WorkerScope).postMessage(
            { opcode: 'fileLoaded', messageId: messageId, message: a.buffer },
            [a.buffer]
          );
        }
      })
      .catch(() => {
        console.log("Unable to load file \"" + filePath + "\"");
        (self as unknown as WorkerScope).postMessage({ opcode: 'fileLoaded', messageId: messageId, message: null });
      });
  }
}, false);
