// Pippi Voice App Logic - v1.1.6 (Refactored)
import { Utils } from './utils.js';

class SpeechManager {
    constructor(onResult, onStatus) {
        this.onResult = onResult;
        this.onStatus = onStatus;
        this.isRecording = false;
        this.engine = 'web-speech';
        this.finalTranscript = '';
        this.processedFinalIndex = 0;
        this.lastFinalHash = '';
        this.initWebSpeech();
    }

    initWebSpeech() {
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'zh-TW';

        this.recognition.onresult = (event) => {
            if (this.engine !== 'web-speech') return;
            let interim = '';
            let newSegments = [];
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const res = event.results[i];
                if (res.isFinal) {
                    if (i >= this.processedFinalIndex) {
                        newSegments.push(res[0].transcript);
                    }
                } else {
                    interim += res[0].transcript;
                }
            }
            if (newSegments.length > 0) {
                const newText = newSegments.join('');
                const hash = Utils.simpleHash(newText);
                if (hash !== this.lastFinalHash) {
                    this.finalTranscript += newText;
                    this.lastFinalHash = hash;
                }
                this.processedFinalIndex = event.results.length;
            }
            this.onResult(this.finalTranscript, interim);
        };

        this.recognition.onstart = () => this.onStatus('正在聆聽中... (原生)');
        this.recognition.onerror = (e) => this.onStatus('辨識錯誤: ' + e.error);
        this.recognition.onend = () => {
            if (this.isRecording && this.engine === 'web-speech') {
                try { this.recognition.start(); } catch(err) {}
            }
        };
    }

    start(engine, apiKey) {
        this.isRecording = true;
        this.engine = engine;
        this.finalTranscript = '';
        this.processedFinalIndex = 0;
        this.lastFinalHash = '';
        if (engine === 'web-speech') {
            this.recognition.start();
        } else {
            this.startGeminiLive(apiKey);
        }
    }

    async startGeminiLive(apiKey) {
        this.onStatus('正在連線 Gemini Live...');
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenericService.BidiGenerateContent?key=${apiKey}`;
            this.socket = new WebSocket(url);
            this.socket.onopen = () => {
                this.onStatus('Gemini 連線成功');
                this.socket.send(JSON.stringify({
                    setup: { 
                        model: "models/gemini-2.0-flash-exp",
                        generation_config: { response_modalities: ["TEXT"] }
                    }
                }));
                this.setupAudioProcessor();
            };
            this.socket.onmessage = (e) => {
                const data = JSON.parse(e.data);
                if (data.serverContent?.modelTurn?.parts) {
                    const text = data.serverContent.modelTurn.parts.map(p => p.text).join('');
                    this.finalTranscript += text;
                    this.onResult(this.finalTranscript, '');
                }
            };
            this.socket.onerror = () => {
                alert('Gemini Live 連線失敗，請檢查 Key 權限');
                this.stop();
            };
        } catch (err) {
            alert('錄音啟動失敗：' + err.message);
            this.stop();
        }
    }

    setupAudioProcessor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        const source = this.audioContext.createMediaStreamSource(this.stream);
        this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
        source.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
        this.processor.onaudioprocess = (e) => {
            if (!this.isRecording || !this.socket || this.socket.readyState !== WebSocket.OPEN) return;
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmData = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
                const s = Math.max(-1, Math.min(1, inputData[i]));
                pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            const uint8Array = new Uint8Array(pcmData.buffer);
            let binary = '';
            for (let i = 0; i < uint8Array.length; i++) binary += String.fromCharCode(uint8Array[i]);
            this.socket.send(JSON.stringify({
                realtimeInput: { mediaChunks: [{ mimeType: "audio/pcm;rate=16000", data: btoa(binary) }] }
            }));
        };
    }

    stop() {
        this.isRecording = false;
        if (this.recognition) this.recognition.stop();
        if (this.processor) { this.processor.disconnect(); this.processor = null; }
        if (this.audioContext) { this.audioContext.close(); this.audioContext = null; }
        if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
        if (this.socket) { if (this.socket.readyState === WebSocket.OPEN) this.socket.close(); this.socket = null; }
        this.onStatus('已停止');
    }
}

// --- App Controller ---
const micBtn = document.getElementById('mic-btn');
const statusText = document.getElementById('status-text');
const finalOutput = document.getElementById('final-output');
const apiKeyInput = document.getElementById('api-key');
const customDictInput = document.getElementById('custom-dict');
const modelSelect = document.getElementById('model-select');
const sttSelect = document.getElementById('stt-select');

const speech = new SpeechManager(
    (final, interim) => {
        finalOutput.innerText = (final + interim).trim();
        finalOutput.scrollTop = finalOutput.scrollHeight;
    },
    (status) => { statusText.innerText = status; }
);

micBtn.onclick = () => {
    if (!speech.isRecording) {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey && sttSelect.value === 'gemini-live') {
            alert('請先設定 API Key');
            return;
        }
        speech.start(sttSelect.value, apiKey);
        micBtn.classList.add('recording');
    } else {
        speech.stop();
        micBtn.classList.remove('recording');
    }
};

// ... 其他 UI 邏輯 ...
document.getElementById('save-settings').onclick = () => {
    localStorage.setItem('pippi_gemini_api_key', apiKeyInput.value.trim());
    localStorage.setItem('pippi_custom_dict', customDictInput.value.trim());
    localStorage.setItem('pippi_selected_model', modelSelect.value);
    localStorage.setItem('pippi_selected_stt', sttSelect.value);
    document.getElementById('settings-modal').classList.add('hidden');
};

document.getElementById('format-btn').onclick = async () => {
    const text = finalOutput.innerText.trim();
    if (!text) return;
    const apiKey = apiKeyInput.value.trim();
    statusText.innerText = '正在智慧整理中...';
    try {
        const prompt = `你是一位專業的文字編輯。請將以下語音逐字稿進行修復與格式化。
⚠️ **極重要規則**：請「直接輸出」格式化後的結果。禁止包含任何解釋。
1. 自動識別並執行「更正」、「說錯了」、「不對」等口語指令。
2. 修正錯別字並保持繁體中文。
內容：\n${text}`;

        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelSelect.value}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await resp.json();
        finalOutput.innerText = data.candidates[0].content.parts[0].text;
        statusText.innerText = '整理完成';
    } catch (e) {
        statusText.innerText = '整理失敗';
        alert('錯誤: ' + e.message);
    }
};

document.getElementById('settings-btn').onclick = () => document.getElementById('settings-modal').classList.remove('hidden');
document.getElementById('copy-btn').onclick = () => {
    navigator.clipboard.writeText(finalOutput.innerText);
    alert('已複製到剪貼簿');
};
document.getElementById('check-update-btn').onclick = () => window.location.reload();
