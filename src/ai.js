// Pippi Voice - AI Manager v1.1.7
import { Events } from './events.js';
import { PippiError, ErrorCodes } from './errors.js';

export class AIManager {
    constructor(eventBus) {
        this.bus = eventBus;
    }

    async formatText(text, config) {
        const { apiKey, model, customDict } = config;
        if (!apiKey) throw new PippiError(ErrorCodes.AI_API_KEY_INVALID);

        this.bus.emit(Events.AI_START);
        
        try {
            const prompt = `你是一位專業的文字編輯。請將以下語音逐字稿進行修復與格式化。
⚠️ **極重要規則**：
1. 請「直接輸出」格式化後的結果即可。禁止包含任何分析說明。
2. 使用清晰的格式：如果內容適合條列，請使用標準符號（如 • 或 1. 2. 3.）。

任務：
- 自動執行「更正」、「說錯了」指令。
- 修正錯別字，保持繁體中文。
${customDict ? `- 注意專有名詞：\n${customDict}` : ''}

內容：\n${text}`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new PippiError(ErrorCodes.AI_NETWORK_ERROR, errData.error?.message, errData);
            }

            const data = await response.json();
            const result = data.candidates[0].content.parts[0].text;
            this.bus.emit(Events.AI_SUCCESS, result);
            return result;
        } catch (e) {
            this.bus.emit(Events.AI_ERROR, e);
            throw e;
        }
    }
}
