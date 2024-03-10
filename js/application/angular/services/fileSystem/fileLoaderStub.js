import axios from 'axios';

export default function (configService) {
    function fileLoader(filePath) {
        filePath = "http://127.0.0.1:3002/files/" + filePath.toLowerCase();
        console.log("fileLoaderStub filePath: "+filePath);
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
        console.log("fileLoaderStub filePath: "+filePath);

        if (typeof self !== 'undefined' && !self.window) {
            self.window = self; // Mock window using self in Web Worker
        }

        // Use axios to fetch the file as an array buffer
        return axios.get(fullPath, { responseType: "arraybuffer" })
            .then(response => new Uint8Array(response.data))
            .catch(error => {
                console.error("axios error: ", error);
                throw error; // Rethrow the error to ensure it can be caught by the caller
            });
    }

    return fileLoader;
}
