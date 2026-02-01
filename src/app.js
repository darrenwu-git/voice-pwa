// Pippi Voice App Logic
let isRecording = false;
let apiKey = localStorage.getItem('pippi_gemini_api_key') || '';
let customDict = localStorage.getItem('pippi_custom_dict') || '';

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
const realtimeBuffer = document.getElementById('realtime-buffer');
const finalOutput = document.getElementById('final-output');

// Initialize
if (apiKey) {
    apiKeyInput.value = apiKey;
}
if (customDict) {
    customDictInput.value = customDict;
}

if (!apiKey) {
    settingsModal.classList.remove('hidden');
}

// UI Handlers
settingsBtn.onclick = () => settingsModal.classList.remove('hidden');
saveSettingsBtn.onclick = () => {
    apiKey = apiKeyInput.value;
    customDict = customDictInput.value;
    localStorage.setItem('pippi_gemini_api_key', apiKey);
    localStorage.setItem('pippi_custom_dict', customDict);
    settingsModal.classList.add('hidden');
};

micBtn.onclick = () => {
    if (!apiKey) {
        alert('請先設定 API Key');
        settingsModal.classList.remove('hidden');
        return;
    }
    
    if (!isRecording) {
        startRecording();
    } else {
        stopRecording();
    }
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
    isRecording = true;
    micBtn.classList.add('recording');
    statusDot.classList.add('active');
    statusText.innerText = '正在聆聽...';
    
    // TODO: Implement Web Audio API and Gemini Live WebSocket here
    console.log('Starting Gemini Live session...');
}

function stopRecording() {
    isRecording = false;
    micBtn.classList.remove('recording');
    statusDot.classList.remove('active');
    statusText.innerText = '已停止';
    
    // TODO: Close WebSocket
}

async function formatTextWithAI(text) {
    // 呼叫 Gemini API 進行第二階段格式化
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
