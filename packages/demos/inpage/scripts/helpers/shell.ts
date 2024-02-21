import { spawn } from 'child_process';

export default async function shell(command: string, args: string[] = []) {
  const child = spawn(command, args, { stdio: 'inherit' });

  await new Promise<void>((resolve, reject) => {
    child.on('exit', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `Command ${JSON.stringify(
              command,
            )} exited with non-zero exit code ${String(code)}`,
          ),
        );
      } else {
        resolve();
      }
    });
  });
}
