// Pippi Voice - State Definitions v1.2.4
export const AppState = {
    IDLE: 'IDLE',
    RECORDING: 'RECORDING',
    FORMATTING: 'FORMATTING',
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
