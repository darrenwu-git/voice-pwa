// Pippi Voice App Logic
let isRecording = false;
let apiKey = localStorage.getItem('pippi_gemini_api_key') || '';
let customDict = localStorage.getItem('pippi_custom_dict') || '';
let socket = null;
let audioContext = null;
let processor = null;
let stream = null;

// DOM Elements
const micBtn = document.getElementById('mic-btn');
const statusDot = document.querySelector('.status-dot');
const statusText = document.getElementById('status-text');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const saveSettingsBtn = document.getElementById('save-settings');
const apiKeyInput = document.getElementById('api-key');
const customDictInput = document.getElementById('custom-dict');
const formatBtn = document.getElementById('format-btn');
const copyBtn = document.getElementById('copy-btn');
const realtimeBuffer = document.getElementById('realtime-buffer');
const finalOutput = document.getElementById('final-output');

// Initialize
if (apiKey) apiKeyInput.value = apiKey;
if (customDict) customDictInput.value = customDict;

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

// UI Handlers
settingsBtn.onclick = () => settingsModal.classList.remove('hidden');
saveSettingsBtn.onclick = () => {
    apiKey = apiKeyInput.value;
    customDict = customDictInput.value;
    localStorage.setItem('pippi_gemini_api_key', apiKey);
    localStorage.setItem('pippi_custom_dict', customDict);
    settingsModal.classList.add('hidden');
};

copyBtn.onclick = () => {
    navigator.clipboard.writeText(finalOutput.innerText);
    const originalText = copyBtn.innerText;
    copyBtn.innerText = '✅ 已複製';
    setTimeout(() => copyBtn.innerText = originalText, 2000);
};

micBtn.onclick = () => {
    if (!apiKey) {
        alert('請先設定 API Key');
        settingsModal.classList.remove('hidden');
        return;
    }
    if (!isRecording) startRecording();
    else stopRecording();
};

formatBtn.onclick = async () => {
    const text = finalOutput.innerText;
    if (!text) return;
    statusText.innerText = '正在智慧整理中...';
    try {
        const formatted = await formatTextWithAI(text);
        finalOutput.innerText = formatted;
        statusText.innerText = '整理完成';
    } catch (e) {
        statusText.innerText = '整理失敗';
        console.error(e);
    }
};

async function startRecording() {
    try {
        statusText.innerText = '正在請求麥克風權限...';
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        isRecording = true;
        micBtn.classList.add('recording');
        statusDot.classList.add('active');
        statusText.innerText = '正在連線至 Gemini Live...';

        const model = "gemini-2.0-flash-exp";
        const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenericService.BidiGenerateContent?key=${apiKey}`;
        
        socket = new WebSocket(url);

        socket.onopen = () => {
            statusText.innerText = '連線成功，發送初始化設定...';
            const setup = {
                setup: { 
                    model: `models/${model}`,
                    generation_config: { response_modalities: ["TEXT"] }
                }
            };
            socket.send(JSON.stringify(setup));
            setupAudioProcessor();
        };

        socket.onmessage = async (event) => {
            const response = JSON.parse(event.data);
            
            // 處理即時回傳的文字
            if (response.serverContent?.modelTurn?.parts) {
                const parts = response.serverContent.modelTurn.parts;
                const text = parts.map(p => p.text).filter(t => t).join('');
                if (text) {
                    realtimeBuffer.innerText = text;
                    finalOutput.innerText += text;
                }
            }
            
            // 如果連線剛建立成功
            if (response.setupComplete) {
                statusText.innerText = '準備就緒，請開始說話';
            }
        };

        socket.onerror = (e) => {
            console.error('WebSocket Error:', e);
            alert('WebSocket 連線失敗，請檢查 API Key 是否正確。');
            stopRecording();
        };

        socket.onclose = (e) => {
            if (isRecording) {
                console.log('WebSocket Closed:', e);
                if (e.code === 1006) {
                    alert('連線被異常關閉。可能是 API Key 不支援 Gemini 2.0 Live，或網路受阻。');
                }
                stopRecording();
            }
        };

    } catch (err) {
        console.error('錄音失敗:', err);
        alert('錄音失敗：' + err.message);
        stopRecording();
    }
}

function setupAudioProcessor() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(stream);
    
    // 使用 ScriptProcessor (雖然已棄用但相容性最高)
    processor = audioContext.createScriptProcessor(4096, 1, 1);

    source.connect(processor);
    processor.connect(audioContext.destination);

    processor.onaudioprocess = (e) => {
        if (!isRecording || !socket || socket.readyState !== WebSocket.OPEN) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
            // 將浮點數轉為 16-bit PCM
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // 轉為 Base64
        const uint8Array = new Uint8Array(pcmData.buffer);
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
            binary += String.fromCharCode(uint8Array[i]);
        }
        const base64Data = btoa(binary);

        socket.send(JSON.stringify({
            realtimeInput: {
                mediaChunks: [{
                    mimeType: "audio/pcm;rate=16000",
                    data: base64Data
                }]
            }
        }));
    };
}

function stopRecording() {
    isRecording = false;
    micBtn.classList.remove('recording');
    statusDot.classList.remove('active');
    statusText.innerText = '已停止';

    if (processor) {
        processor.disconnect();
        processor = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    if (socket) {
        if (socket.readyState === WebSocket.OPEN) {
            socket.close();
        }
        socket = null;
    }
}

async function formatTextWithAI(text) {
    const prompt = `你是一位專業的文字編輯。請將以下語音逐字稿進行修復與格式化：
1. 自動識別並執行「更正」、「說錯了」等指令。
2. 將內容轉化為結構化的條列式（Bullet points）。
3. 修正錯別字並保持繁體中文。
4. 保持中英文混用的自然度。
${customDict ? `5. 特別注意以下專有名詞或常用詞的正確拼法：\n${customDict}` : ''}

內容如下：
${text}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: prompt
                }]
            }]
        })
    });
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}
