// Pippi Voice - Main Controller v1.3.2
import { VERSION } from './config.js';
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
        
        console.log(`🐈 Pippi Voice v${VERSION} Initialized`);
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
            sttModelSelect: document.getElementById('stt-model-select'),
            formatModelSelect: document.getElementById('format-model-select'),
            customDict: document.getElementById('custom-dict'),
            checkUpdateBtn: document.getElementById('check-update-btn')
        };
        // 嚴格檢查 DOM 是否漏掉
        Object.entries(this.el).forEach(([key, val]) => {
            if (!val) console.error(`❌ Missing DOM element: ${key}`);
        });
    }

    bindEvents() {
        this.el.micBtn.onclick = () => this.handleMicClick();
        this.el.formatBtn.onclick = () => this.fsm.transition(AppState.FORMATTING);
        this.el.copyBtn.onclick = () => this.handleCopy();
        this.el.settingsBtn.onclick = () => this.el.settingsModal.classList.remove('hidden');
        this.el.saveSettings.onclick = () => this.saveSettings();
        
        // 確保更新按鈕在每次初始化時都被正確綁定
        if (this.el.checkUpdateBtn) {
            this.el.checkUpdateBtn.onclick = () => {
                console.log('Update Check Triggered');
                this.el.statusText.innerText = '正在檢查更新...';
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistration().then(reg => {
                        if (reg) {
                            reg.update().then(() => {
                                alert(`檢查完成！目前版本為 v${VERSION}。若有新版將在下次開啟時生效。`);
                                window.location.reload();
                            });
                        } else {
                            window.location.reload();
                        }
                    });
                } else {
                    window.location.reload();
                }
            };
        }

        // Domain Events
        this.bus.on(Events.STT_RESULT, ({ final, interim }) => {
            this.el.output.innerText = (final + interim).trim();
            this.el.output.scrollTop = this.el.output.scrollHeight;
        });

        this.bus.on(Events.STT_STATUS, (txt) => {
            if (this.fsm.is(AppState.RECORDING)) this.el.statusText.innerText = txt;
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

    async handleStateChange(state, data) {
        this.el.micBtn.disabled = false;
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
                // 新增：開始錄音時清空舊文字
                this.el.output.innerText = '';
                this.speech.start(this.el.sttSelect.value, { apiKey: this.el.apiKey.value.trim() });
                break;
            case AppState.STT_PROCESSING:
                this.el.statusText.innerText = '正在轉寫語音檔案...';
                this.el.micBtn.disabled = true;
                try {
                    const transcript = await this.ai.transcribeAudio(data.blob, {
                        apiKey: this.el.apiKey.value.trim(),
                        model: this.el.sttModelSelect.value
                    });
                    this.el.output.innerText = transcript;
                    this.fsm.transition(AppState.FORMATTING);
                } catch (e) {
                    this.fsm.transition(AppState.ERROR, { message: '辨識失敗: ' + e.message });
                }
                break;
            case AppState.FORMATTING:
                this.el.statusText.innerText = '正在智慧整理中...';
                this.el.micBtn.disabled = true;
                this.triggerAIFormat();
                break;
            case AppState.SUCCESS:
                this.el.statusText.innerText = '✅ 已自動完成複製';
                this.handleCopy(true);
                setTimeout(() => this.fsm.transition(AppState.IDLE), 3000);
                break;
            case AppState.ERROR:
                this.el.micBtn.innerText = '🎤 重新錄音';
                this.el.statusText.innerText = data.message || '發生錯誤';
                this.el.statusDot.style.background = '#f44336';
                break;
        }
    }

    async handleMicClick() {
        if (!this.fsm.is(AppState.RECORDING)) {
            const apiKey = this.el.apiKey.value.trim();
            if (!apiKey && this.el.sttSelect.value !== 'web-speech') {
                alert('請先在設定中提供 API Key');
                this.el.settingsModal.classList.remove('hidden');
                return;
            }
            this.fsm.transition(AppState.RECORDING);
        } else {
            const audioBlob = await this.speech.stop();
            if (this.el.sttSelect.value === 'gemini-file' && audioBlob) {
                this.fsm.transition(AppState.STT_PROCESSING, { blob: audioBlob });
            } else {
                this.fsm.transition(AppState.FORMATTING);
            }
        }
    }

    async triggerAIFormat() {
        const text = this.el.output.innerText.trim();
        if (!text) return this.fsm.transition(AppState.IDLE);
        await this.ai.formatText(text, {
            apiKey: this.el.apiKey.value.trim(),
            model: this.el.formatModelSelect.value,
            customDict: this.el.customDict.value.trim()
        });
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
        localStorage.setItem('pippi_selected_stt_model', this.el.sttModelSelect.value);
        localStorage.setItem('pippi_selected_format_model', this.el.formatModelSelect.value);
        localStorage.setItem('pippi_custom_dict', this.el.customDict.value.trim());
        this.el.settingsModal.classList.add('hidden');
        this.bus.emit(Events.SETTINGS_CHANGED);
    }

    loadSettings() {
        this.el.apiKey.value = localStorage.getItem('pippi_gemini_api_key') || '';
        this.el.sttSelect.value = localStorage.getItem('pippi_selected_stt') || 'web-speech';
        this.el.sttModelSelect.value = localStorage.getItem('pippi_selected_stt_model') || 'gemini-2.5-flash';
        this.el.formatModelSelect.value = localStorage.getItem('pippi_selected_format_model') || 'gemini-2.5-flash';
        this.el.customDict.value = localStorage.getItem('pippi_custom_dict') || '';
    }
}

window.app = new AppController();
