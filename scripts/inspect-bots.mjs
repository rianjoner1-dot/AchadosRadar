import fs from 'node:fs';
import path from 'node:path';

const bots = [
  { name: 'associados', file: 'c:/Users/joner/Documents/associados/robo-seguir-instagram/data/edge-profile/DevToolsActivePort' },
  { name: 'qualificar', file: 'c:/Users/joner/Documents/Portal Qualificar/robo-seguir-instagram/data/edge-profile/DevToolsActivePort' },
  { name: 'rozi', file: 'c:/Users/joner/Documents/rozisemijoias/robo-seguir-instagram/data/edge-profile/DevToolsActivePort' }
];

for (const bot of bots) {
  console.log(`\n=== INSPECIONANDO ${bot.name.toUpperCase()} ===`);
  if (!fs.existsSync(bot.file)) {
    console.log(`Arquivo de porta não existe: ${bot.file}`);
    continue;
  }
  const port = fs.readFileSync(bot.file, 'utf8').trim().split(/\r?\n/)[0];
  console.log(`Porta DevTools: ${port}`);
  try {
    const list = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
    console.log(`Total tabs/targets: ${list.length}`);
    for (const t of list) {
      console.log(` - [${t.type}] "${t.title}" -> ${t.url}`);
    }

    const igTab = list.find(t => t.url.includes('instagram.com') && t.type === 'page');
    if (!igTab || !igTab.webSocketDebuggerUrl) {
      console.log('Nenhuma aba do Instagram encontrada.');
      continue;
    }

    const ws = new WebSocket(igTab.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });

    let cmdId = 1;
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = cmdId++;
      const timer = setTimeout(() => reject(new Error(`Timeout na chamada ${method}`)), 5000);
      const onMsg = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id === id) {
          clearTimeout(timer);
          ws.removeEventListener('message', onMsg);
          resolve(msg.result);
        }
      };
      ws.addEventListener('message', onMsg);
      ws.send(JSON.stringify({ id, method, params }));
    });

    const evalRes = await send('Runtime.evaluate', {
      expression: '({ title: document.title, url: window.location.href, text: document.body ? document.body.innerText.slice(0, 400) : "NO_BODY" })',
      returnByValue: true
    }).catch(err => ({ error: err.message }));
    
    console.log('Estado da página:', evalRes);

    const shot = await send('Page.captureScreenshot', { format: 'png' }).catch(err => null);
    if (shot?.data) {
      const outPath = `screenshot_${bot.name}.png`;
      fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
      console.log(`📸 Screenshot salvo em ${outPath}`);
    }
    ws.close();
  } catch (err) {
    console.log(`Erro ao inspecionar ${bot.name}: ${err.message}`);
  }
}
