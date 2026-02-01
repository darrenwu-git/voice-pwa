// Pippi Voice - Main Controller v1.2.4 (State Machine Edition)
import { EventBus, Events } from './events.js';
import { SpeechManager } from './speech.js';
import { AIManager } from './ai.js';
import { AppState, StateMachine } from './state.js';
import { ErrorMessages } from './errors.js';

class AppController {
    constructor() {
        this.bus = new EventBus();
        this.speech = new SpeechManager(this.bus);
        this.ai = new AIManager(this.bus);
        this.fsm = new StateMachine((state, data) => this.handleStateChange(state, data));
        
        this.setupDOM();
        this.bindEvents();
        this.loadSettings();
        
        console.log('Pippi Voice State Machine Initialized v1.2.4');
    }

    setupDOM() {
        this.el = {
            micBtn: document.getElementById('mic-btn'),
            formatBtn: document.getElementById('format-btn'),
            copyBtn: document.getElementById('copy-btn'),
            output: document.getElementById('final-output'),
            statusText: document.getElementById('status-text'),
            statusDot: document.querySelector('.status-dot'),
            settingsBtn: document.getElementById('settings-btn'),
            settingsModal: document.getElementById('settings-modal'),
            saveSettings: document.getElementById('save-settings'),
            apiKey: document.getElementById('api-key'),
            sttSelect: document.getElementById('stt-select'),
            modelSelect: document.getElementById('model-select'),
            customDict: document.getElementById('custom-dict'),
            checkUpdateBtn: document.getElementById('check-update-btn')
        };
    }

    bindEvents() {
        // UI Interaction
        this.el.micBtn.onclick = () => this.handleMicClick();
        this.el.formatBtn.onclick = () => this.fsm.transition(AppState.FORMATTING);
        this.el.copyBtn.onclick = () => this.handleCopy();
        this.el.settingsBtn.onclick = () => this.el.settingsModal.classList.remove('hidden');
        this.el.saveSettings.onclick = () => this.saveSettings();
        
        if (this.el.checkUpdateBtn) {
            this.el.checkUpdateBtn.onclick = () => window.location.reload();
        }

        // Domain Events
        this.bus.on(Events.STT_RESULT, ({ final, interim }) => {
            this.el.output.innerText = (final + interim).trim();
            this.el.output.scrollTop = this.el.output.scrollHeight;
        });

        this.bus.on(Events.STT_STATUS, (txt) => {
            if (this.fsm.is(AppState.RECORDING)) {
                this.el.statusText.innerText = txt;
            }
        });

        this.bus.on(Events.STT_ERROR, (err) => {
            this.fsm.transition(AppState.ERROR, { message: ErrorMessages[err.code] || err.message });
        });

        this.bus.on(Events.AI_SUCCESS, (res) => {
            this.el.output.innerText = res;
            this.fsm.transition(AppState.SUCCESS);
        });

        this.bus.on(Events.AI_ERROR, (err) => {
            this.fsm.transition(AppState.ERROR, { message: 'AI 錯誤: ' + err.message });
        });
    }

    handleStateChange(state, data) {
        // Reset UI Elements
        this.el.micBtn.disabled = false;
        this.el.formatBtn.disabled = false;
        this.el.copyBtn.disabled = false;
        this.el.micBtn.classList.remove('recording');
        this.el.statusDot.style.background = '#ccc';

        switch (state) {
            case AppState.IDLE:
                this.el.micBtn.innerText = '🎤 開始錄音';
                this.el.statusText.innerText = '準備就緒';
                break;

            case AppState.RECORDING:
                this.el.micBtn.innerText = '🛑 停止錄音';
                this.el.micBtn.classList.add('recording');
                this.el.statusDot.style.background = '#4CAF50';
                this.speech.start(this.el.sttSelect.value, this.el.apiKey.value.trim());
                break;

            case AppState.FORMATTING:
                this.el.micBtn.disabled = true;
                this.el.formatBtn.disabled = true;
                this.el.statusText.innerText = '正在智慧整理中...';
                this.speech.stop();
                this.triggerAIFormat();
                break;

            case AppState.SUCCESS:
                this.el.statusText.innerText = '✅ 整理完成並已自動複製';
                this.handleCopy(true);
                setTimeout(() => this.fsm.transition(AppState.IDLE), 3000);
                break;

            case AppState.ERROR:
                this.el.micBtn.innerText = '🎤 重新錄音';
                this.el.statusText.innerText = data.message || '發生錯誤';
                this.el.statusDot.style.background = '#f44336';
                this.speech.stop();
                break;
        }
    }

    handleMicClick() {
        if (this.fsm.is(AppState.IDLE) || this.fsm.is(AppState.ERROR) || this.fsm.is(AppState.SUCCESS)) {
            this.fsm.transition(AppState.RECORDING);
        } else if (this.fsm.is(AppState.RECORDING)) {
            // 按下停止錄音，進入自動化流程
            this.fsm.transition(AppState.FORMATTING);
        }
    }

    async triggerAIFormat() {
        const text = this.el.output.innerText.trim();
        if (!text) {
            this.fsm.transition(AppState.IDLE);
            return;
        }
        
        try {
            await this.ai.formatText(text, {
                apiKey: this.el.apiKey.value.trim(),
                model: this.el.modelSelect.value,
                customDict: this.el.customDict.value.trim()
            });
        } catch (e) {
            // Error already handled by event bus
        }
    }

    handleCopy(silent = false) {
        const text = this.el.output.innerText;
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            if (!silent) alert('已複製到剪貼簿');
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

window.app = new AppController();
