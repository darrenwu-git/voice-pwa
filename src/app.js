// Pippi Voice App Logic - Web Speech API Version
let isRecording = false;
let apiKey = localStorage.getItem('pippi_gemini_api_key') || '';
let customDict = localStorage.getItem('pippi_custom_dict') || '';
let selectedModel = localStorage.getItem('pippi_selected_model') || 'gemini-1.5-flash';
let recognition = null;
let finalTranscript = '';

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
const formatBtn = document.getElementById('format-btn');
const copyBtn = document.getElementById('copy-btn');
const realtimeBuffer = document.getElementById('realtime-buffer');
const finalOutput = document.getElementById('final-output');

// Initialize UI
if (apiKey) apiKeyInput.value = apiKey;
if (customDict) customDictInput.value = customDict;
if (selectedModel) modelSelect.value = selectedModel;

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

// Initialize Web Speech API
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-TW';

    recognition.onstart = () => {
        statusText.innerText = '正在聆聽中... (請說話)';
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript + ' ';
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        realtimeBuffer.innerText = interimTranscript;
        finalOutput.innerText = finalTranscript + interimTranscript;
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        statusText.innerText = '辨識發生錯誤: ' + event.error;
        stopRecording();
    };

    recognition.onend = () => {
        if (isRecording) {
            try {
                recognition.start();
            } catch (e) {
                console.log('Recognition restart attempt failed:', e);
            }
        } else {
            statusText.innerText = '已停止';
        }
    };
} else {
    alert('很抱歉，您的瀏覽器不支援語音辨識功能。');
}

// UI Handlers
settingsBtn.onclick = () => settingsModal.classList.remove('hidden');
saveSettingsBtn.onclick = () => {
    apiKey = apiKeyInput.value.trim();
    customDict = customDictInput.value.trim();
    selectedModel = modelSelect.value;
    localStorage.setItem('pippi_gemini_api_key', apiKey);
    localStorage.setItem('pippi_custom_dict', customDict);
    localStorage.setItem('pippi_selected_model', selectedModel);
    settingsModal.classList.add('hidden');
    console.log('Settings saved. Key length:', apiKey.length, 'Model:', selectedModel);
};

copyBtn.onclick = () => {
    navigator.clipboard.writeText(finalOutput.innerText);
    const originalText = copyBtn.innerText;
    copyBtn.innerText = '✅ 已複製';
    setTimeout(() => copyBtn.innerText = originalText, 2000);
};

micBtn.onclick = () => {
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
        alert('AI 整理失敗，請檢查網路或 API Key。\n錯誤資訊: ' + e.message);
    }
};

function startRecording() {
    // 開始新錄音時，清除舊資料
    finalTranscript = '';
    realtimeBuffer.innerText = '';
    finalOutput.innerText = '';
    
    isRecording = true;
    micBtn.classList.add('recording');
    statusDot.classList.add('active');
    
    try {
        recognition.start();
    } catch (e) {
        console.error('Recognition start failed:', e);
    }
}

function stopRecording() {
    isRecording = false;
    micBtn.classList.remove('recording');
    statusDot.classList.remove('active');
    recognition.stop();
}

async function formatTextWithAI(text) {
    const model = document.getElementById('model-select').value;
    const prompt = `你是一位專業的文字編輯。請將以下語音逐字稿進行修復與格式化：
1. 自動識別並執行「更正」、「說錯了」、「不對」等口語指令。
2. 將內容轉化為結構化的條列式（Bullet points）。
3. 修正錯別字並保持繁體中文。
4. 保持中英文混用的自然度。
${customDict ? `5. 特別注意以下專有名詞或常用詞的正確拼法：\n${customDict}` : ''}

內容如下：
${text}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
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

    if (!response.ok) {
        const errData = await response.json();
        const msg = errData.error?.message || '未知錯誤';
        throw new Error(`API 錯誤 (${response.status}): ${msg}`);
    }

    const data = await response.json();
    if (data.candidates && data.candidates[0].content.parts[0].text) {
        return data.candidates[0].content.parts[0].text;
    } else {
        throw new Error('AI 回傳資料格式不正確');
    }
}
