// Pippi Voice App Logic - Web Speech API Version
let isRecording = false;
let apiKey = localStorage.getItem('pippi_gemini_api_key') || '';
let customDict = localStorage.getItem('pippi_custom_dict') || '';
let selectedModel = localStorage.getItem('pippi_selected_model') || 'gemini-2.5-flash';
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
const finalOutput = document.getElementById('final-output');
const checkUpdateBtn = document.getElementById('check-update-btn');
const realtimeBuffer = document.getElementById('realtime-buffer');

// Initialize UI
if (apiKey) apiKeyInput.value = apiKey;
if (customDict) customDictInput.value = customDict;
if (selectedModel) modelSelect.value = selectedModel;

checkUpdateBtn.onclick = () => {
    if ('serviceWorker' in navigator) {
        statusText.innerText = '正在檢查更新...';
        navigator.serviceWorker.getRegistration().then(reg => {
            if (reg) {
                reg.update().then(() => {
                    alert('檢查完成！如果有新版本，它會在背景下載並在下次開啟時生效，或者現在重新整理。');
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
            let transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                if (finalTranscript.length > 0 && !finalTranscript.endsWith(' ')) {
                    finalTranscript += ' ';
                }
                finalTranscript += transcript.trim();
            } else {
                interimTranscript += transcript;
            }
        }
        if (realtimeBuffer) realtimeBuffer.innerText = interimTranscript;
        finalOutput.innerText = (finalTranscript + interimTranscript).trim();
        // 自動捲動到底部
        finalOutput.scrollTop = finalOutput.scrollHeight;
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
        const maskedKey = apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 3)}` : '無';
        alert(`AI 整理失敗。
使用的 Key: ${maskedKey} (長度: ${apiKey.length})
使用的模型: ${modelSelect.value}
錯誤資訊: ${e.message}`);
    }
};

function startRecording() {
    finalTranscript = '';
    finalOutput.innerText = '';
    if (realtimeBuffer) realtimeBuffer.innerText = '';
    
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
        const msg = errData.error?.message || JSON.stringify(errData);
        throw new Error(`API 錯誤 (${response.status}): ${msg}`);
    }

    const data = await response.json();
    if (data.candidates && data.candidates[0].content.parts[0].text) {
        return data.candidates[0].content.parts[0].text;
    } else {
        throw new Error('AI 回傳資料格式不正確');
    }
}
