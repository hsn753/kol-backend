import dotenv from 'dotenv';
dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const BASE_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

export async function sendTelegramDM(telegramUsername: string, message: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const chatRes = await fetch(`${BASE_URL}/getUpdates`);
    const chatData = await chatRes.json() as { ok: boolean; result: Array<{ message?: { from?: { username?: string; id: number } } }> };
    
    let chatId: number | null = null;
    if (chatData.ok) {
      for (const update of chatData.result) {
        if (update.message?.from?.username?.toLowerCase() === telegramUsername.toLowerCase()) {
          chatId = update.message.from.id;
          break;
        }
      }
    }

    if (!chatId) {
      return { ok: false, error: `User @${telegramUsername} not found in bot updates. They must message the bot first.` };
    }

    const sendRes = await fetch(`${BASE_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' }),
    });
    const sendData = await sendRes.json() as { ok: boolean; description?: string };
    return sendData.ok ? { ok: true } : { ok: false, error: sendData.description };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export function buildScript(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}
