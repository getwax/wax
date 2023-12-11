/**
 * Ideally we could just use 'fs/promises' here
 * but that doesn't work with vite polyfill.
 * 
 * https://github.com/davidmyersdev/vite-plugin-node-polyfills/issues/16
 */
import fs from "fs";

export async function readFile(path: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        try {
            fs.readFile(path, undefined, (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(data);
            });
        } catch (err) {
            reject(err);
        }
    });
}