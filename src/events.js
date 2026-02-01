// Pippi Voice - Event Bus v1.1.7
export class EventBus {
    constructor() {
        this.listeners = {};
    }
    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }
    emit(event, data) {
        if (!this.listeners[event]) return;
        this.listeners[event].forEach(cb => cb(data));
    }
}

export const Events = {
    STT_RESULT: 'stt:result',
    STT_STATUS: 'stt:status',
    STT_ERROR: 'stt:error',
    AI_START: 'ai:start',
    AI_SUCCESS: 'ai:success',
    AI_ERROR: 'ai:error',
    SETTINGS_CHANGED: 'settings:changed'
};
