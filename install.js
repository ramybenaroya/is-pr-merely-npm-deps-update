const { exec } = require('child_process');
const path = require('path');

// Get the directory of the current JS file
const currentDir = path.dirname(__filename);

exec('npm ci', { cwd: currentDir }, (error, stdout, stderr) => {
    if (error) {
        console.error(`exec error: ${error}`);
        return;
    }
    console.log(`stdout: ${stdout}`);
    console.error(`stderr: ${stderr}`);
});