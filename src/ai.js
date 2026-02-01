// Pippi Voice - AI Manager v1.3.0
import { Events } from './events.js';
import { PippiError, ErrorCodes } from './errors.js';

export class AIManager {
    constructor(eventBus) {
        this.bus = eventBus;
    }

    async transcribeAudio(audioBlob, config) {
        const { apiKey, model } = config;
        if (!apiKey) throw new PippiError(ErrorCodes.AI_API_KEY_INVALID);

        const base64 = await this.blobToBase64(audioBlob);
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: "請將這段語音轉為逐字稿，保持繁體中文，不需要任何額外解釋。" },
                        { inline_data: { mime_type: "audio/webm", data: base64 } }
                    ]
                }]
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new PippiError(ErrorCodes.AI_NETWORK_ERROR, errData.error?.message);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }

    async formatText(text, config) {
        const { apiKey, model, customDict } = config;
        if (!apiKey) throw new PippiError(ErrorCodes.AI_API_KEY_INVALID);

        this.bus.emit(Events.AI_START);
        
        try {
            const prompt = `你是一位專業的文字編輯。請將以下語音逐字稿進行修復與格式化。
⚠️ **極重要規則**：請「直接輸出」格式化後的結果即可。禁止包含任何解釋。
1. 自動執行「更正」、「說錯了」指令。
2. 修正錯別字，保持繁體中文。
${customDict ? `- 注意專有名詞：\n${customDict}` : ''}

內容：\n${text}`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new PippiError(ErrorCodes.AI_NETWORK_ERROR, errData.error?.message);
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

    blobToBase64(blob) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result.split(',')[1];
                resolve(base64String);
            };
            reader.readAsDataURL(blob);
        });
    }
}
