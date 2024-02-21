import fs from 'fs/promises';
import projectPath from './projectPath.ts';

export default async function fileExists(projectPathParam: string) {
  const filePath = projectPath(projectPathParam);

  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}
