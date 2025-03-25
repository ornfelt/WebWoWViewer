import fileLoaderStub from './fileLoaderStub.js';

self.addEventListener('message', function(e) {
  const opcode = e.data.opcode;
  const message = e.data.message;
  const messageId = e.data.messageId;

  if (opcode === 'init') {
    const configService = {
      getArchiveFile: () => message.archiveFile,
      getFileReadMethod: () => message.fileReadMethod,
      getUrlToLoadWoWFile: () => message.urlToLoadWoWFile,
    };
    // Initialize fileLoader without Q
    self.fileLoader = fileLoaderStub(configService);
  } else if (opcode === 'loadFile') {
    const filePath = message;
    self.fileLoader(filePath)
      .then((a) => {
        if (a) {
          self.postMessage(
            { opcode: 'fileLoaded', messageId: messageId, message: a.buffer },
            [a.buffer]
          );
        }
      })
      .catch(() => {
        console.log("Unable to load file \"" + filePath + "\"");
        self.postMessage({ opcode: 'fileLoaded', messageId: messageId, message: null });
      });
  }
}, false);
