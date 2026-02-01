// Pippi Voice App Logic - v1.1.5 (Consulted with Thinking Model)
let isRecording = false;
let apiKey = localStorage.getItem('pippi_gemini_api_key') || '';
let customDict = localStorage.getItem('pippi_custom_dict') || '';
let selectedModel = localStorage.getItem('pippi_selected_model') || 'gemini-2.5-flash';
let selectedSTT = localStorage.getItem('pippi_selected_stt') || 'web-speech';

let recognition = null;
let socket = null;
let audioContext = null;
let processor = null;
let stream = null;

// Deduplication State
let finalTranscript = '';
let processedFinalIndex = 0;
let lastFinalHash = '';

// DOM Elements
const micBtn = document.getElementById('mic-btn');
const statusDot = document.querySelector('.status-dot');
const statusText = document.getElementById('status-text');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const saveSettingsBtn = document.getElementById('save-settings');
const apiKeyInput = document.getElementById('api-key');
const customDictInput = document.getElementById('custom-dict');
const modelSelect = document.getElementById('model-select');
const sttSelect = document.getElementById('stt-select');
const formatBtn = document.getElementById('format-btn');
const copyBtn = document.getElementById('copy-btn');
const finalOutput = document.getElementById('final-output');
const checkUpdateBtn = document.getElementById('check-update-btn');
const realtimeBuffer = document.getElementById('realtime-buffer');

// Initialize UI
if (apiKey) apiKeyInput.value = apiKey;
if (customDict) customDictInput.value = customDict;
if (selectedModel) modelSelect.value = selectedModel;
if (selectedSTT) sttSelect.value = selectedSTT;

checkUpdateBtn.onclick = () => {
    if ('serviceWorker' in navigator) {
        statusText.innerText = '正在檢查更新...';
        navigator.serviceWorker.getRegistration().then(reg => {
            if (reg) {
                reg.update().then(() => {
                    alert('檢查完成！如果有新版本，它會在背景下載並在下次開啟時生效。');
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

const togglePasswordBtn = document.createElement('button');
togglePasswordBtn.innerText = '👁️';
togglePasswordBtn.className = 'toggle-btn';
apiKeyInput.parentNode.appendChild(togglePasswordBtn);

togglePasswordBtn.onclick = () => {
    const type = apiKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
    apiKeyInput.setAttribute('type', type);
    togglePasswordBtn.innerText = type === 'password' ? '👁️' : '🙈';
};

if (!apiKey) settingsModal.classList.remove('hidden');

// --- Simple Hash for Content Matching ---
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return hash.toString();
}

// --- Web Speech API Setup ---
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-TW';

    recognition.onresult = (event) => {
        if (selectedSTT !== 'web-speech') return;
        
        let interimTranscript = '';
        let newFinalSegments = [];
        
        for (let i = 0; i < event.results.length; i++) {
            const result = event.results[i];
            const transcript = result[0].transcript;
            
            if (result.isFinal) {
                // 關鍵：只處理索引 >= processedFinalIndex 的新 final 結果
                if (i >= processedFinalIndex) {
                    newFinalSegments.push(transcript);
                }
            } else {
                interimTranscript = transcript;
            }
        }
        
        if (newFinalSegments.length > 0) {
            const newText = newFinalSegments.join('');
            const newHash = simpleHash(newText);
            
            // 二次防護：指紋比對
            if (newHash !== lastFinalHash) {
                finalTranscript += newText;
                lastFinalHash = newHash;
            }
            processedFinalIndex = event.results.length;
        }

        if (realtimeBuffer) realtimeBuffer.innerText = interimTranscript;
        finalOutput.innerText = (finalTranscript + interimTranscript).trim();
        finalOutput.scrollTop = finalOutput.scrollHeight;
    };

    recognition.onend = () => {
        if (isRecording && selectedSTT === 'web-speech') {
            try { recognition.start(); } catch (e) {}
        }
    };
}

// UI Handlers
settingsBtn.onclick = () => settingsModal.classList.remove('hidden');
saveSettingsBtn.onclick = () => {
    apiKey = apiKeyInput.value.trim();
    customDict = customDictInput.value.trim();
    selectedModel = modelSelect.value;
    selectedSTT = sttSelect.value;
    localStorage.setItem('pippi_gemini_api_key', apiKey);
    localStorage.setItem('pippi_custom_dict', customDict);
    localStorage.setItem('pippi_selected_model', selectedModel);
    localStorage.setItem('pippi_selected_stt', selectedSTT);
    settingsModal.classList.add('hidden');
};

copyBtn.onclick = () => {
    navigator.clipboard.writeText(finalOutput.innerText);
    const originalText = copyBtn.innerText;
    copyBtn.innerText = '✅ 已複製';
    setTimeout(() => copyBtn.innerText = originalText, 2000);
};

micBtn.onclick = () => {
    if (!apiKey && selectedSTT === 'gemini-live') {
        alert('使用 Gemini Live 必須先設定 API Key');
        settingsModal.classList.remove('hidden');
        return;
    }
    if (!isRecording) startRecording();
    else stopRecording();
};

formatBtn.onclick = async () => {
    const text = finalOutput.innerText.trim();
    if (!text) return;
    if (!apiKey) {
        alert('請先在設定中輸入 Gemini API Key');
        settingsModal.classList.remove('hidden');
        return;
    }
    statusText.innerText = '正在智慧整理中...';
    try {
        const formatted = await formatTextWithAI(text);
        if (formatted) {
            finalOutput.innerText = formatted;
            finalTranscript = formatted;
            statusText.innerText = '整理完成';
        }
    } catch (e) {
        statusText.innerText = '整理失敗';
        alert(`AI 整理失敗。\n使用的模型: ${modelSelect.value}\n錯誤資訊: ${e.message}`);
    }
};

async function startRecording() {
    finalTranscript = '';
    processedFinalIndex = 0;
    lastFinalHash = '';
    finalOutput.innerText = '';
    if (realtimeBuffer) realtimeBuffer.innerText = '';
    
    isRecording = true;
    micBtn.classList.add('recording');
    statusDot.classList.add('active');

    if (selectedSTT === 'web-speech') {
        statusText.innerText = '正在聆聽中... (原生引擎)';
        recognition.start();
    } else {
        await startGeminiLive();
    }
}

async function stopRecording() {
    isRecording = false;
    micBtn.classList.remove('recording');
    statusDot.classList.remove('active');
    statusText.innerText = '已停止';

    if (selectedSTT === 'web-speech') {
        recognition.stop();
    } else {
        stopGeminiLive();
    }
}

// --- Gemini Live WebSocket Logic (Enhanced with Robustness) ---
async function startGeminiLive() {
    try {
        statusText.innerText = '正在連線 Gemini Live...';
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // 正確的 WebSocket URL 格式
        const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenericService.BidiGenerateContent?key=${apiKey}`;
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            statusText.innerText = '連線成功，發送初始化...';
            const setup = {
                setup: { 
                    model: "models/gemini-2.0-flash-exp",
                    generation_config: { 
                        response_modalities: ["TEXT"],
                        temperature: 0.7
                    },
                    system_instruction: {
                        parts: [{ text: "你是 Pippi Voice 的助理，請將語音轉為繁體中文文字。" }]
                    }
                }
            };
            socket.send(JSON.stringify(setup));
        };

        socket.onmessage = async (event) => {
            const response = JSON.parse(event.data);
            if (response.setupComplete) {
                statusText.innerText = '準備就緒 (Gemini Live)';
                setupAudioProcessor();
            }
            if (response.serverContent?.modelTurn?.parts) {
                const text = response.serverContent.modelTurn.parts.map(p => p.text).join('');
                if (text) {
                    finalOutput.innerText += text;
                    finalOutput.scrollTop = finalOutput.scrollHeight;
                }
            }
        };

        socket.onerror = (e) => {
            console.error('WebSocket Error:', e);
            statusText.innerText = '連線出錯，請檢查 Key 權限';
            alert('Gemini Live 連線失敗。您的 API Key 可能不支援即時 WebSocket 權限。建議改用「瀏覽器原生」引擎。');
            stopRecording();
        };

        socket.onclose = (e) => {
            if (isRecording) {
                console.log('WebSocket Closed:', e);
                stopRecording();
            }
        };

    } catch (err) {
        alert('無法啟動 Gemini Live：' + err.message);
        stopRecording();
    }
}

function stopGeminiLive() {
    if (processor) { processor.disconnect(); processor = null; }
    if (audioContext) { audioContext.close(); audioContext = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    if (socket) { if (socket.readyState === WebSocket.OPEN) socket.close(); socket = null; }
}

function setupAudioProcessor() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(stream);
    processor = audioContext.createScriptProcessor(4096, 1, 1);
    source.connect(processor);
    processor.connect(audioContext.destination);

    processor.onaudioprocess = (e) => {
        if (!isRecording || !socket || socket.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        const uint8Array = new Uint8Array(pcmData.buffer);
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) binary += String.fromCharCode(uint8Array[i]);
        socket.send(JSON.stringify({
            realtimeInput: { mediaChunks: [{ mimeType: "audio/pcm;rate=16000", data: btoa(binary) }] }
        }));
    };
}

async function formatTextWithAI(text) {
    const model = document.getElementById('model-select').value;
    const prompt = `你是一位專業的文字編輯。請將以下語音逐字稿進行修復與格式化。

⚠️ **極重要規則**：
1. 請「直接輸出」格式化後的結果即可。禁止包含任何開場白、分析、說明文字。
2. 使用清晰的格式：如果內容適合條列，請使用標準符號（如 • 或 1. 2. 3.）。

任務清單：
1. 自動識別並執行「更正」、「說錯了」、「不對」等口語指令。
2. 修正錯別字並保持繁體中文。
3. 保持中英文混用的自然度。
${customDict ? `4. 特別注意以下專有名詞或常用詞的正確拼法：\n${customDict}` : ''}

待處理內容如下：
${text}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(`API 錯誤 (${response.status}): ${errData.error?.message || '未知錯誤'}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}
