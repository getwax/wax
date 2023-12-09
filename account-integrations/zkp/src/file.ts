/**
 * Ideally we could just use 'fs/promises' here
 * but that doesn't work with vite polyfill.
 * 
 * https://github.com/davidmyersdev/vite-plugin-node-polyfills/issues/16
 */
import fs from "fs";
import util from "util";

const readFileAsync = util.promisify(fs.readFile);

export async function readFile(path: string): Promise<Buffer> {
    return readFileAsync(path);
}