const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const failureMarker = path.join(PROJECT_ROOT, '.ella-server-failed');
process.chdir(PROJECT_ROOT);
process.env.NODE_ENV = 'development';
process.env.PORT = '3000';
const serverPath = path.join(PROJECT_ROOT, 'back-end', 'server.js');

function removeFailureMarker() {
  try {
    fs.unlinkSync(failureMarker);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function recordFailure(reason) {
  try {
    fs.writeFileSync(failureMarker, String(reason || 'servidor encerrado'), 'utf8');
  } catch (error) {
    console.error(`Não foi possível registrar a falha do servidor: ${error.message}`);
  }
}

try {
  removeFailureMarker();
  const server = spawn(process.execPath, [serverPath], {
    cwd: PROJECT_ROOT,
    env: process.env,
    stdio: 'inherit'
  });

  server.on('error', (error) => {
    console.error(`Não foi possível iniciar o servidor: ${error.message}`);
    recordFailure(error.message);
    process.exitCode = 1;
  });

  server.on('exit', (code, signal) => {
    const reason = signal ? `sinal ${signal}` : `código ${code}`;
    recordFailure(reason);
    if (code !== 0) console.error(`O servidor foi encerrado (${reason}).`);
    process.exitCode = code || 1;
  });

  process.on('SIGINT', () => server.kill('SIGINT'));
  process.on('SIGTERM', () => server.kill('SIGTERM'));
} catch (error) {
  console.error(error.stack || error.message);
  recordFailure(error.message);
  process.exitCode = 1;
}
