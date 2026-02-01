// Pippi Voice - Speech Manager v1.2.2
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
        
        this.socket = null;
        this.audioContext = null;
        this.processor = null;
        this.stream = null;

        this.initWebSpeech();
    }

    initWebSpeech() {
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            console.warn('Web Speech API not supported');
            return;
        }
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'zh-TW';

        this.recognition.onresult = (event) => {
            if (this.engine !== 'web-speech' || !this.isRecording) return;
            
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

        this.recognition.onstart = () => this.bus.emit(Events.STT_STATUS, '正在聆聽 (原生引擎)...');
        this.recognition.onerror = (e) => {
            if (e.error === 'no-speech') return;
            this.bus.emit(Events.STT_ERROR, new PippiError(ErrorCodes.STT_NETWORK_ERROR, e.error));
        };
        this.recognition.onend = () => {
            if (this.isRecording && this.engine === 'web-speech') {
                try { this.recognition.start(); } catch(err) {}
            }
        };
    }

    async start(engine, apiKey) {
        this.isRecording = true;
        this.engine = engine;
        this.finalTranscript = '';
        this.processedFinalIndex = 0;
        this.lastFinalHash = '';

        if (engine === 'web-speech') {
            if (!this.recognition) {
                this.bus.emit(Events.STT_ERROR, new PippiError(ErrorCodes.STT_NOT_SUPPORTED));
                return;
            }
            this.recognition.start();
        } else {
            await this.startGeminiLive(apiKey);
        }
    }

    async startGeminiLive(apiKey) {
        this.bus.emit(Events.STT_STATUS, '正在連線 Gemini Live...');
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenericService.BidiGenerateContent?key=${apiKey}`;
            this.socket = new WebSocket(url);

            this.socket.onopen = () => {
                this.bus.emit(Events.STT_STATUS, '連線成功，發送初始化...');
                this.socket.send(JSON.stringify({
                    setup: { 
                        model: "models/gemini-2.0-flash-exp",
                        generation_config: { response_modalities: ["TEXT"], temperature: 0.7 },
                        system_instruction: { parts: [{ text: "你是 Pippi Voice 的助理，請將語音轉為繁體中文文字。" }] }
                    }
                }));
            };

            this.socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.setupComplete) {
                    this.bus.emit(Events.STT_STATUS, '準備就緒 (Gemini Live)');
                    this.setupAudioProcessor();
                }
                if (data.serverContent?.modelTurn?.parts) {
                    const text = data.serverContent.modelTurn.parts.map(p => p.text).join('');
                    if (text) {
                        this.finalTranscript += text;
                        this.bus.emit(Events.STT_RESULT, { final: this.finalTranscript, interim: '' });
                    }
                }
            };

            this.socket.onerror = (e) => {
                this.bus.emit(Events.STT_ERROR, new PippiError(ErrorCodes.WS_CONNECTION_FAILED, 'WebSocket 連線出錯'));
                this.stop();
            };

            this.socket.onclose = () => {
                if (this.isRecording) this.stop();
            };

        } catch (err) {
            this.bus.emit(Events.STT_ERROR, new PippiError(ErrorCodes.STT_PERMISSION_DENIED, err.message));
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
        if (this.recognition) {
            try { this.recognition.stop(); } catch(e) {}
        }
        if (this.processor) { this.processor.disconnect(); this.processor = null; }
        if (this.audioContext) { this.audioContext.close(); this.audioContext = null; }
        if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
        if (this.socket) {
            if (this.socket.readyState === WebSocket.OPEN) this.socket.close();
            this.socket = null;
        }
        this.bus.emit(Events.STT_STATUS, '已停止');
    }
}
