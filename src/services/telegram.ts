import dotenv from 'dotenv';
import https from 'https';
dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const BASE_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'kol-backend/1.0' } }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function httpsPost(url: string, body: object): Promise<string> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const opts = new URL(url);
    const req = https.request({
      hostname: opts.hostname,
      path: opts.pathname + opts.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

export async function sendTelegramDM(telegramUsername: string, message: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const raw = await httpsGet(`${BASE_URL}/getUpdates?limit=100`);
    const chatData = JSON.parse(raw) as { ok: boolean; result: Array<{ message?: { from?: { username?: string; id: number } } }> };

    let chatId: number | null = null;
    if (chatData.ok) {
      for (const update of chatData.result) {
        if (update.message?.from?.username?.toLowerCase() === telegramUsername.replace('@', '').toLowerCase()) {
          chatId = update.message.from.id;
          break;
        }
      }
    }

    if (!chatId) {
      return { ok: false, error: `User @${telegramUsername} not found in bot updates. They must message the bot first.` };
    }

    const sendRaw = await httpsPost(`${BASE_URL}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown',
    });
    const sendData = JSON.parse(sendRaw) as { ok: boolean; description?: string };
    return sendData.ok ? { ok: true } : { ok: false, error: sendData.description };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export function buildScript(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}
