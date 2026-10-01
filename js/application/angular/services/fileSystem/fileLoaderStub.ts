import axios from 'axios';

/* The subset of services/config the worker passes in */
export interface FileLoaderConfig {
    getArchiveFile(): unknown;
    getFileReadMethod(): string;
    getUrlToLoadWoWFile(): string;
}

export type FileLoaderFunc = (filePath: string) => Promise<Uint8Array<ArrayBuffer>>;

/* In a Web Worker there is no window; the stub sets self.window = self */
interface StubWorkerScope {
    window: unknown;
}

export default function (configService: FileLoaderConfig): FileLoaderFunc {
    function fileLoader(filePath: string): Promise<Uint8Array<ArrayBuffer>> {
        filePath = configService.getUrlToLoadWoWFile() + filePath.toLowerCase();
        //console.log("fileLoaderStub filePath: "+filePath);
        //// Adjust the filePath if it ends with a null character
        //if (filePath[filePath.length - 1] === String.fromCharCode(0)) {
        //    filePath = filePath.substring(0, filePath.length - 1);
        //}
        //
        //// Ensure the filePath is in lowercase and replace backslashes with forward slashes
        //filePath = filePath.toLowerCase().replace(/\\/g, "/");

        // Construct the full URL to load the file
        //const fullPath = configService.getUrlToLoadWoWFile() + filePath;
        const fullPath = filePath;

        if (typeof self !== 'undefined' && !self.window) {
            (self as unknown as StubWorkerScope).window = self; // Mock window using self in Web Worker
        }

        // Use axios to fetch the file as an array buffer
        return axios.get<ArrayBuffer>(fullPath, { responseType: "arraybuffer" })
            .then(response => new Uint8Array(response.data))
            .catch(error => {
                console.error("axios error: ", error);
                throw error; // Rethrow the error to ensure it can be caught by the caller
            });
    }

    return fileLoader;
}
