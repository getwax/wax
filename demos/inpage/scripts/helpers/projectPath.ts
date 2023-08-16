import path from 'path';

const currentFile = new URL(import.meta.url).pathname;
const projectDir = path.dirname(path.dirname(path.dirname(currentFile)));

export default function projectPath(extraPath: string) {
  return path.join(projectDir, ...extraPath.split('/'));
}
