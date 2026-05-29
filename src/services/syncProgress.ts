import { reactive, readonly } from "vue";

export type SyncProgressDirection = "sync" | "upload" | "download";

type SyncProgressState = {
  active: boolean;
  direction: SyncProgressDirection;
  percent: number;
  messageKey: string;
};

const state = reactive<SyncProgressState>({
  active: false,
  direction: "sync",
  percent: 0,
  messageKey: "",
});

let nextToken = 1;
let activeToken = 0;

const clampPercent = (value: unknown): number => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(numericValue)));
};

export const syncProgressState = readonly(state);

export const beginSyncProgress = (
  direction: SyncProgressDirection,
  messageKey: string,
  percent = 0,
): number => {
  const token = nextToken++;
  activeToken = token;
  state.active = true;
  state.direction = direction;
  state.percent = clampPercent(percent);
  state.messageKey = messageKey;
  return token;
};

export const updateSyncProgress = (
  token: number,
  nextState: Partial<Omit<SyncProgressState, "active">>,
): void => {
  if (token !== activeToken) {
    return;
  }

  if (nextState.direction) {
    state.direction = nextState.direction;
  }
  if (typeof nextState.percent !== "undefined") {
    state.percent = clampPercent(nextState.percent);
  }
  if (typeof nextState.messageKey === "string") {
    state.messageKey = nextState.messageKey;
  }
};

export const finishSyncProgress = (
  token: number,
  messageKey = "sync.progress_complete",
): void => {
  if (token !== activeToken) {
    return;
  }

  state.percent = 100;
  state.messageKey = messageKey;
  state.active = false;
};

export const clearSyncProgress = (token?: number): void => {
  if (typeof token === "number" && token !== activeToken) {
    return;
  }

  if (typeof token === "number") {
    activeToken = 0;
  }
  state.active = false;
  state.direction = "sync";
  state.percent = 0;
  state.messageKey = "";
};
