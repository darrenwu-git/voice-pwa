// Pippi Voice - Main Controller v1.1.8 (Automation Update)
import { EventBus, Events } from './events.js';
import { SpeechManager } from './speech.js';
import { AIManager } from './ai.js';
import { ErrorMessages } from './errors.js';

class AppController {
    constructor() {
        this.bus = new EventBus();
        this.speech = new SpeechManager(this.bus);
        this.ai = new AIManager(this.bus);
        
        this.setupDOM();
        this.bindEvents();
        this.loadSettings();
    }

    setupDOM() {
        this.el = {
            micBtn: document.getElementById('mic-btn'),
            formatBtn: document.getElementById('format-btn'),
            copyBtn: document.getElementById('copy-btn'),
            output: document.getElementById('final-output'),
            statusText: document.getElementById('status-text'),
            settingsBtn: document.getElementById('settings-btn'),
            settingsModal: document.getElementById('settings-modal'),
            saveSettings: document.getElementById('save-settings'),
            apiKey: document.getElementById('api-key'),
            sttSelect: document.getElementById('stt-select'),
            modelSelect: document.getElementById('model-select'),
            customDict: document.getElementById('custom-dict')
        };
    }

    bindEvents() {
        // UI Interactions
        this.el.micBtn.onclick = () => this.toggleRecording();
        this.el.formatBtn.onclick = () => this.handleFormat();
        this.el.copyBtn.onclick = () => this.handleCopy();
        this.el.settingsBtn.onclick = () => this.el.settingsModal.classList.remove('hidden');
        this.el.saveSettings.onclick = () => this.saveSettings();

        // App Events
        this.bus.on(Events.STT_RESULT, ({ final, interim }) => {
            this.el.output.innerText = (final + interim).trim();
            this.el.output.scrollTop = this.el.output.scrollHeight;
        });

        this.bus.on(Events.STT_STATUS, (txt) => {
            this.el.statusText.innerText = txt;
        });

        this.bus.on(Events.STT_ERROR, (err) => {
            const msg = ErrorMessages[err.code] || err.message;
            alert('語音錯誤: ' + msg);
            this.stopRecording(false); // Stop without auto-format
        });

        this.bus.on(Events.AI_START, () => this.el.statusText.innerText = '正在智慧整理中...');
        
        this.bus.on(Events.AI_SUCCESS, (res) => {
            this.el.output.innerText = res;
            this.el.statusText.innerText = '整理完成';
            // 自動複製
            this.handleCopy(true); 
        });

        this.bus.on(Events.AI_ERROR, (err) => {
            alert('AI 錯誤: ' + err.message);
            this.el.statusText.innerText = '整理失敗';
        });
    }

    toggleRecording() {
        if (!this.speech.isRecording) {
            this.speech.start(this.el.sttSelect.value);
            this.el.micBtn.classList.add('recording');
            this.el.micBtn.innerText = '🛑 停止錄音';
        } else {
            this.stopRecording(true); // Stop and trigger auto-format
        }
    }

    async stopRecording(triggerFormat = false) {
        this.speech.stop();
        this.el.micBtn.classList.remove('recording');
        this.el.micBtn.innerText = '🎤 開始錄音';
        
        if (triggerFormat && this.el.output.innerText.trim()) {
            await this.handleFormat();
        }
    }

    async handleFormat() {
        const text = this.el.output.innerText.trim();
        if (!text) return;
        
        try {
            await this.ai.formatText(text, {
                apiKey: this.el.apiKey.value.trim(),
                model: this.el.modelSelect.value,
                customDict: this.el.customDict.value.trim()
            });
        } catch (e) {
            console.error('Format failed', e);
        }
    }

    handleCopy(silent = false) {
        const text = this.el.output.innerText;
        if (!text) return;
        
        navigator.clipboard.writeText(text).then(() => {
            if (!silent) {
                alert('已複製到剪貼簿');
            } else {
                this.el.statusText.innerText = '✅ 整理完成並已自動複製';
            }
        }).catch(err => {
            console.error('Copy failed', err);
        });
    }

    saveSettings() {
        localStorage.setItem('pippi_gemini_api_key', this.el.apiKey.value.trim());
        localStorage.setItem('pippi_selected_stt', this.el.sttSelect.value);
        localStorage.setItem('pippi_selected_model', this.el.modelSelect.value);
        localStorage.setItem('pippi_custom_dict', this.el.customDict.value.trim());
        this.el.settingsModal.classList.add('hidden');
        this.bus.emit(Events.SETTINGS_CHANGED);
    }

    loadSettings() {
        this.el.apiKey.value = localStorage.getItem('pippi_gemini_api_key') || '';
        this.el.sttSelect.value = localStorage.getItem('pippi_selected_stt') || 'web-speech';
        this.el.modelSelect.value = localStorage.getItem('pippi_selected_model') || 'gemini-2.5-flash';
        this.el.customDict.value = localStorage.getItem('pippi_custom_dict') || '';
    }
}

// Start App
window.app = new AppController();
