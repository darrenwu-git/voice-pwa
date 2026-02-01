// Pippi Voice - Speech Manager v1.1.7
import { Utils } from './utils.js';
import { Events } from './events.js';
import { PippiError, ErrorCodes } from './errors.js';

export class SpeechManager {
    constructor(eventBus) {
        this.bus = eventBus;
        this.isRecording = false;
        this.engine = 'web-speech';
        this.finalTranscript = '';
        this.processedFinalIndex = 0;
        this.lastFinalHash = '';
        this.initWebSpeech();
    }

    initWebSpeech() {
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            this.bus.emit(Events.STT_ERROR, new PippiError(ErrorCodes.STT_NOT_SUPPORTED));
            return;
        }
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
            this.bus.emit(Events.STT_RESULT, { final: this.finalTranscript, interim });
        };

        this.recognition.onstart = () => this.bus.emit(Events.STT_STATUS, '正在聆聽 (原生)...');
        this.recognition.onerror = (e) => this.bus.emit(Events.STT_ERROR, new PippiError(ErrorCodes.STT_NETWORK_ERROR, e.error));
        this.recognition.onend = () => {
            if (this.isRecording && this.engine === 'web-speech') this.recognition.start();
        };
    }

    start(engine) {
        this.isRecording = true;
        this.engine = engine;
        this.finalTranscript = '';
        this.processedFinalIndex = 0;
        this.lastFinalHash = '';
        if (engine === 'web-speech') this.recognition.start();
    }

    stop() {
        this.isRecording = false;
        if (this.recognition) this.recognition.stop();
        this.bus.emit(Events.STT_STATUS, '已停止');
    }
}
