// Pippi Voice - Error Definitions v1.1.7
export class PippiError extends Error {
    constructor(code, message, details = {}) {
        super(message);
        this.name = 'PippiError';
        this.code = code;
        this.details = details;
        this.timestamp = new Date();
    }
}

export const ErrorCodes = {
    STT_NOT_SUPPORTED: 'STT_NOT_SUPPORTED',
    STT_PERMISSION_DENIED: 'STT_PERMISSION_DENIED',
    STT_NETWORK_ERROR: 'STT_NETWORK_ERROR',
    AI_API_KEY_INVALID: 'AI_API_KEY_INVALID',
    AI_MODEL_NOT_FOUND: 'AI_MODEL_NOT_FOUND',
    AI_QUOTA_EXCEEDED: 'AI_QUOTA_EXCEEDED',
    AI_NETWORK_ERROR: 'AI_NETWORK_ERROR',
    WS_CONNECTION_FAILED: 'WS_CONNECTION_FAILED'
};

export const ErrorMessages = {
    [ErrorCodes.STT_NOT_SUPPORTED]: '您的瀏覽器不支援語音辨識功能。',
    [ErrorCodes.STT_PERMISSION_DENIED]: '請允許麥克風存取權限。',
    [ErrorCodes.AI_API_KEY_INVALID]: 'API Key 無效或未設定。',
    [ErrorCodes.WS_CONNECTION_FAILED]: '無法建立 WebSocket 連線。'
};
