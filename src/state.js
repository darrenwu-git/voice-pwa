// Pippi Voice - State Definitions v1.3.0
export const AppState = {
    IDLE: 'IDLE',
    RECORDING: 'RECORDING',
    STT_PROCESSING: 'STT_PROCESSING', // 新增：音訊檔案辨識中
    FORMATTING: 'FORMATTING',       // 智慧整理中
    SUCCESS: 'SUCCESS',
    ERROR: 'ERROR'
};

export class StateMachine {
    constructor(onStateChange) {
        this.currentState = AppState.IDLE;
        this.onStateChange = onStateChange;
    }

    transition(newState, data = {}) {
        console.log(`[FSM] Transition: ${this.currentState} -> ${newState}`, data);
        this.currentState = newState;
        this.onStateChange(newState, data);
    }

    is(state) {
        return this.currentState === state;
    }
}
