'use strict';

const path = require('path');
const { spawn } = require('child_process');

function scrape() {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(
      __dirname,
      'linkedin.py'
    );

    const pythonCommand =
      process.platform === 'win32'
        ? 'python'
        : 'python3';

    console.log(
      '[LinkedIn] Starting JobSpy scraper...'
    );

    const child = spawn(
      pythonCommand,
      [scriptPath],
      {
        cwd: path.join(
          __dirname,
          '..',
          '..'
        ),
        windowsHide: true,
      }
    );

    let stdout = '';
    let stderr = '';

    child.stdout.on(
      'data',
      (data) => {
        stdout += data.toString();
      }
    );

    child.stderr.on(
      'data',
      (data) => {
        const text =
          data.toString();

        stderr += text;

        process.stderr.write(text);
      }
    );

    child.on(
      'error',
      (error) => {
        reject(
          new Error(
            `LinkedIn Python scraper could not start: ${error.message}`
          )
        );
      }
    );

    child.on(
      'close',
      (code) => {
        if (code !== 0) {
          reject(
            new Error(
              `LinkedIn scraper exited with code ${code}`
            )
          );

          return;
        }

        try {
          const jobs =
            JSON.parse(
              stdout.trim() || '[]'
            );

          if (!Array.isArray(jobs)) {
            reject(
              new Error(
                'LinkedIn scraper returned invalid JSON'
              )
            );

            return;
          }

          console.log(
            `[LinkedIn] Final unique jobs: ${jobs.length}`
          );

          resolve(jobs);
        } catch (error) {
          reject(
            new Error(
              `Could not parse LinkedIn scraper output: ${error.message}`
            )
          );
        }
      }
    );
  });
}

module.exports = {
  scrape,
};
