const { loadAndValidateEnvironment } = require('../config/env');

try {
  loadAndValidateEnvironment();
} catch (err) {
  console.error(`Erro de configuração: ${err.message}`);
  process.exit(1);
}

const bcrypt = require('bcryptjs');
const readline = require('readline');
const { upsertAdmin } = require('../models/adminsModel');

function askVisible(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Lê a senha sem mostrar os caracteres digitados no terminal.
function askHidden(question) {
  return new Promise((resolve, reject) => {
    process.stdout.write(question);
    let password = '';
    const { stdin } = process;

    if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
      process.stdout.write('\n');
      reject(new Error('Execute este comando em um terminal interativo para proteger a senha.'));
      return;
    }

    function finish() {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      process.stdout.write('\n');
      resolve(password);
    }

    function onData(chunk) {
      for (const char of chunk.toString()) {
        if (char === '\n' || char === '\r' || char === '\u0004') {
          finish();
          return;
        }
        if (char === '\u0003') {
          stdin.setRawMode(false);
          process.stdout.write('\n');
          process.exit(1);
        }
        if (char === '\u007f' || char === '\b') {
          password = password.slice(0, -1);
        } else {
          password += char;
        }
      }
    }

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.on('data', onData);
  });
}

async function main() {
  console.log('Criar/atualizar administrador do painel Ella Sorriu\n');

  const email = (await askVisible('E-mail do administrador: ')).trim().toLowerCase();
  if (!email || email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('\nE-mail inválido.');
    process.exit(1);
  }

  const password = await askHidden('Senha (mínimo 12 caracteres): ');
  if (!password || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    console.error('\nA senha precisa ter entre 12 caracteres e 72 bytes.');
    process.exit(1);
  }

  const confirmPassword = await askHidden('Confirme a senha: ');
  if (password !== confirmPassword) {
    console.error('\nAs senhas não coincidem.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  upsertAdmin(email, hash);

  console.log(`\nPronto! Administrador "${email}" está pronto para uso em /admin/login.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Erro ao criar administrador:', err.message);
  process.exit(1);
});
