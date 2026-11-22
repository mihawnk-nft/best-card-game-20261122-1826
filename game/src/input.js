// Mouse and keyboard, translated into plain actions for main.js. Clicks are
// read by delegation from data-* attributes the renderer paints; keys are
// 1-9 to pick a hand card, Enter to confirm or end the turn, Escape to put a
// card back down, and M to mute. Nothing here knows the rules.
export const ACTION = {
  START: 'start',
  RESTART: 'restart',
  HAND_CARD: 'hand-card',
  BOARD_CARD: 'board-card',
  HERO: 'hero',
  END_TURN: 'end-turn',
  MUTE: 'mute',
  CANCEL: 'cancel',
};

export function createInput(root, onAction) {
  root.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === ACTION.HAND_CARD || action === ACTION.BOARD_CARD) {
      onAction({ type: action, uid: target.dataset.uid });
    } else if (target.dataset.side) {
      onAction({ type: action, side: target.dataset.side });
    } else {
      onAction({ type: action });
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const key = event.key;
    if (key >= '1' && key <= '9') {
      onAction({ type: 'hand-index', index: Number(key) - 1 });
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      onAction({ type: ACTION.START });
    } else if (key === 'Escape') {
      onAction({ type: ACTION.CANCEL });
    } else if (key === 'm' || key === 'M') {
      onAction({ type: ACTION.MUTE });
    }
  });
}
