// Pippi Voice - Main Controller v1.4.0 (Robust Undo/Redo)
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
        
        // --- 核心歷史引擎 ---
        this.undoStack = [];
        this.redoStack = [];
        this.currentValue = ''; 

        this.setupDOM();
        this.bindEvents();
        this.loadSettings();
        
        console.log(`Pippi Voice v${VERSION} - Robust Mode Initialized`);
    }

    setupDOM() {
        this.el = {
            micBtn: document.getElementById('mic-btn'),
            formatBtn: document.getElementById('format-btn'),
            undoBtn: document.getElementById('undo-btn'),
            redoBtn: document.getElementById('redo-btn'),
            copyBtn: document.getElementById('copy-btn'),
            cancelBtn: document.getElementById('cancel-btn'),
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
    }

    // --- 歷史紀錄核心方法 ---
    saveState(newVal) {
        newVal = newVal.trim();
        if (newVal === this.currentValue) return;
        
        console.log('Saving State:', newVal);
        this.undoStack.push(this.currentValue);
        this.currentValue = newVal;
        this.redoStack = []; // 有新動作，清空重做
        
        if (this.undoStack.length > 50) this.undoStack.shift();
        this.updateUI();
    }

    handleUndo() {
        if (this.undoStack.length > 0) {
            this.redoStack.push(this.currentValue);
            this.currentValue = this.undoStack.pop();
            this.el.output.innerText = this.currentValue;
            this.el.statusText.innerText = '↩ 已恢復上一步';
            this.updateUI();
        }
    }

    handleRedo() {
        if (this.redoStack.length > 0) {
            this.undoStack.push(this.currentValue);
            this.currentValue = this.redoStack.pop();
            this.el.output.innerText = this.currentValue;
            this.el.statusText.innerText = '↪ 已重做下一步';
            this.updateUI();
        }
    }

    updateUI() {
        this.el.undoBtn.disabled = this.undoStack.length === 0;
        this.el.undoBtn.style.opacity = this.undoStack.length === 0 ? '0.3' : '1';
        this.el.redoBtn.disabled = this.redoStack.length === 0;
        this.el.redoBtn.style.opacity = this.redoStack.length === 0 ? '0.3' : '1';
    }

    bindEvents() {
        this.el.micBtn.onclick = () => this.handleMicClick();
        this.el.formatBtn.onclick = () => this.fsm.transition(AppState.FORMATTING);
        this.el.undoBtn.onclick = () => this.handleUndo();
        this.el.redoBtn.onclick = () => this.handleRedo();
        this.el.copyBtn.onclick = () => this.handleCopy();
        this.el.cancelBtn.onclick = () => {
            this.saveState(""); // 存入空狀態以實現清空後的 Undo
            this.el.output.innerText = "";
            this.fsm.transition(AppState.IDLE);
        };
        
        this.el.settingsBtn.onclick = () => this.el.settingsModal.classList.remove('hidden');
        this.el.saveSettings.onclick = () => this.saveSettings();
        if (this.el.checkUpdateBtn) this.el.checkUpdateBtn.onclick = () => window.location.reload();

        // 監聽手動編輯
        this.el.output.onblur = () => {
            this.saveState(this.el.output.innerText);
        };

        this.bus.on(Events.STT_RESULT, ({ final, interim }) => {
            const fullText = (this.currentValue + " " + final + interim).trim();
            this.el.output.innerText = fullText;
            this.el.output.scrollTop = this.el.output.scrollHeight;
        });

        this.bus.on(Events.STT_ERROR, (err) => {
            this.fsm.transition(AppState.ERROR, { message: ErrorMessages[err.code] || err.message });
        });

        this.bus.on(Events.AI_SUCCESS, (res) => {
            if (res) {
                this.saveState(res); // 整理完成後存檔
                this.el.output.innerText = res;
                this.fsm.transition(AppState.SUCCESS);
            }
        });

        this.bus.on(Events.AI_ERROR, (err) => {
            this.fsm.transition(AppState.ERROR, { message: 'AI 錯誤: ' + err.message });
        });
    }

    async handleStateChange(state, data) {
        this.el.micBtn.disabled = false;
        this.el.micBtn.classList.remove('recording');
        this.el.statusDot.style.background = '#ccc';
        this.updateUI();

        switch (state) {
            case AppState.IDLE:
                this.el.micBtn.innerText = '🎤 開始錄音';
                this.el.statusText.innerText = '準備就緒';
                break;

            case AppState.RECORDING:
                this.saveState(this.el.output.innerText); // 錄音前存檔
                this.el.micBtn.innerText = '🛑 停止錄音';
                this.el.micBtn.classList.add('recording');
                this.el.statusDot.style.background = '#4CAF50';
                this.el.output.innerText = '';
                this.currentValue = ''; // 錄音開始，主動清空當前基準
                this.speech.start(this.el.sttSelect.value, { apiKey: this.el.apiKey.value.trim() });
                break;

            case AppState.STT_PROCESSING:
                this.el.statusText.innerText = '正在處理音訊...';
                this.el.micBtn.disabled = true;
                try {
                    const transcript = await this.ai.transcribeAudio(data.blob, {
                        apiKey: this.el.apiKey.value.trim(),
                        model: this.el.sttModelSelect.value
                    });
                    if (transcript) {
                        this.el.output.innerText = transcript;
                        this.currentValue = transcript; // 辨識完的結果設為當前基準
                        this.fsm.transition(AppState.FORMATTING);
                    } else {
                        this.fsm.transition(AppState.IDLE);
                    }
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
                this.el.statusText.innerText = '✅ 整理完成並已自動複製';
                this.handleCopy(true);
                setTimeout(() => { if (this.fsm.is(AppState.SUCCESS)) this.fsm.transition(AppState.IDLE); }, 3000);
                break;

            case AppState.ERROR:
                this.el.micBtn.innerText = '🎤 重新錄音';
                this.el.statusText.innerText = data.message || '發生錯誤';
                this.el.statusDot.style.background = '#f44336';
                this.speech.stop();
                break;
        }
    }

    async handleMicClick() {
        if (!this.fsm.is(AppState.RECORDING)) {
            const apiKey = this.el.apiKey.value.trim();
            if (!apiKey && this.el.sttSelect.value !== 'web-speech') {
                alert('請先設定 API Key');
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
    }

    loadSettings() {
        this.el.apiKey.value = localStorage.getItem('pippi_gemini_api_key') || '';
        this.el.sttSelect.value = localStorage.getItem('pippi_selected_stt') || 'web-speech';
        this.el.sttModelSelect.value = localStorage.getItem('pippi_selected_stt_model') || 'gemini-2.5-flash';
        this.el.formatModelSelect.value = localStorage.getItem('pippi_selected_format_model') || 'gemini-2.5-flash';
        this.el.customDict.value = localStorage.getItem('pippi_custom_dict') || '';
        this.currentValue = this.el.output.innerText.trim();
        this.updateUI();
    }
}

window.app = new AppController();
