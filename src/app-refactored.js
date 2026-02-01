// Pippi Voice - Core Classes v1.1.6

// --- 1. Utilities ---
const Utils = {
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return hash.toString();
    },
    maskKey(key) {
        if (!key) return '無';
        return `${key.substring(0, 4)}...${key.substring(key.length - 3)}`;
    }
};

// --- 2. Speech Recognition Manager ---
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

        this.recognition.onstart = () => this.onStatus('正在聆聽中...');
        this.recognition.onerror = (e) => this.onStatus('辨識錯誤: ' + e.error);
        this.recognition.onend = () => {
            if (this.isRecording && this.engine === 'web-speech') this.recognition.start();
        };
    }

    start(engine, apiKey) {
        this.isRecording = true;
        this.engine = engine;
        this.finalTranscript = '';
        this.processedFinalIndex = 0;
        this.lastFinalHash = '';
        if (engine === 'web-speech') this.recognition.start();
        else this.onStatus('Gemini Live 尚未實作類別化');
    }

    stop() {
        this.isRecording = false;
        if (this.recognition) this.recognition.stop();
        this.onStatus('已停止');
    }
}

// --- 3. UI Manager ---
class UIManager {
    constructor() {
        this.elements = {
            micBtn: document.getElementById('mic-btn'),
            statusText: document.getElementById('status-text'),
            output: document.getElementById('final-output'),
            version: document.getElementById('version-tag')
        };
    }

    updateText(final, interim) {
        this.elements.output.innerText = (final + interim).trim();
        this.elements.output.scrollTop = this.elements.output.scrollHeight;
    }

    setStatus(txt) {
        this.elements.statusText.innerText = txt;
    }
    
    toggleMic(isRec) {
        this.elements.micBtn.classList.toggle('recording', isRec);
    }
}

// --- Initialize App ---
const ui = new UIManager();
const speech = new SpeechManager(
    (final, interim) => ui.updateText(final, interim),
    (status) => ui.setStatus(status)
);

// (此處保留原有的 Settings 與 AI 邏輯暫不變動，待下一階段移入 AIManager)
// ... 原有代碼 ...
