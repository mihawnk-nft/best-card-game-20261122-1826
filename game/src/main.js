// Boot and the one loop: the table is drawn when something changes, and
// Vex takes her turn one planned action at a time so the player can watch
// her think. The game moves between three screens: title, play and over.
//
// Click a hand card, then click where it goes: your side of the table to
// summon a creature, a glowing enemy to strike it or cast at it. Click one
// of your creatures, then click what it attacks. Keys: 1-9 pick a hand card,
// Enter confirms or ends the turn, Esc puts a card down, M mutes.
//
// ?seed=N fixes the shuffle. ?shot=start|play|win|loss (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY } from './config.js';
import { createRandom } from './random.js';
import {
  attack,
  canAttackWith,
  canPlayCard,
  createGame,
  endTurn,
  legalTargets,
  playCard,
  startGame,
  SIDE_ENEMY,
  SIDE_PLAYER,
} from './state.js';
import { applyPlannedAction, planTurn } from './ai.js';
import { ACTION, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { isMuted, sfx, toggleMute, unlockAudio } from './audio.js';

/** Milliseconds between Vex's actions, so her turn reads as a turn. */
const AI_STEP_MS = 650;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const app = document.getElementById('app');
const status = document.getElementById('status');
let state = createGame(createRandom(seed));
const renderer = createRenderer(app);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best result then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, state);
  const ui = { selectedUid: scene.selectedUid, targets: scene.targets, best: scene.best, muted: false };
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, ui);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  createInput(app, onAction);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let selected = null; // { kind: 'hand' | 'board', uid }
  let targets = [];
  let aiQueue = [];
  let lastAiStep = 0;
  let dirty = true;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function ui() {
    return { selectedUid: selected?.uid ?? null, targets, best, muted: isMuted() };
  }

  function draw() {
    renderer.draw(state, screen, ui());
    dirty = false;
  }

  function clearSelection() {
    selected = null;
    targets = [];
  }

  function selectHandCard(card) {
    if (!canPlayCard(state, SIDE_PLAYER, card)) return;
    selected = { kind: 'hand', uid: card.uid };
    if (card.kind === 'spell' && (card.target === 'none' || card.target === 'all-enemy-creatures')) {
      // No target to pick: the spell goes off at once.
      playSelectedCard(null);
      return;
    }
    targets = card.kind === 'spell' ? legalTargets(state, SIDE_PLAYER, card.target) : [];
    sfx.select();
    announce(`${card.name} chosen. ${targets.length > 0 ? 'Pick a glowing target.' : 'Click your side of the table to summon it.'}`);
    dirty = true;
  }

  function playSelectedCard(targetUid) {
    if (!selected || selected.kind !== 'hand') return;
    const card = state.player.hand.find((c) => c.uid === selected.uid);
    if (!card) {
      clearSelection();
      dirty = true;
      return;
    }
    if (playCard(state, SIDE_PLAYER, card.uid, targetUid)) {
      if (card.kind === 'spell' && card.heal > 0) sfx.heal();
      else sfx.playCard();
      announce(`${card.name} played.`);
    }
    clearSelection();
    afterPlayerMove();
  }

  function attackWithSelected(targetUid) {
    if (!selected || selected.kind !== 'board') return;
    const attacker = state.player.board.find((c) => c.uid === selected.uid);
    if (!attacker) {
      clearSelection();
      dirty = true;
      return;
    }
    if (attack(state, SIDE_PLAYER, attacker.uid, targetUid)) {
      sfx.attack();
      announce(`${attacker.name} attacks.`);
    }
    clearSelection();
    afterPlayerMove();
  }

  function afterPlayerMove() {
    dirty = true;
    if (state.phase === 'over') endGame();
  }

  function startDuel() {
    state = createGame(createRandom(Math.floor(Math.random() * 4294967296)));
    clearSelection();
    aiQueue = [];
    startGame(state);
    screen = SCREEN_PLAY;
    announce('The duel begins. Your turn.');
    dirty = true;
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (state.winner === SIDE_PLAYER) {
      best += 1;
      saveBest(best);
      sfx.win();
      announce(`Victory! You beat Vex. ${best} win${best === 1 ? '' : 's'} against her.`);
    } else {
      sfx.lose();
      announce('Defeat. Vex takes the Emberfall.');
    }
    dirty = true;
  }

  function endPlayerTurn() {
    if (state.phase !== 'play' || state.active !== SIDE_PLAYER) return;
    clearSelection();
    endTurn(state);
    sfx.turn();
    announce("Vex's turn.");
    dirty = true;
  }

  function onAction(action) {
    unlockAudio();
    if (action.type === ACTION.MUTE) {
      toggleMute();
      dirty = true;
      return;
    }
    if (screen === SCREEN_TITLE) {
      if (action.type === ACTION.START) {
        sfx.click();
        startDuel();
      }
      return;
    }
    if (screen === SCREEN_OVER) {
      if (action.type === ACTION.START) {
        sfx.click();
        startDuel();
      }
      return;
    }
    // SCREEN_PLAY from here.
    if (state.phase !== 'play') return;
    if (action.type === ACTION.CANCEL) {
      clearSelection();
      dirty = true;
      return;
    }
    if (action.type === 'hand-index') {
      const card = state.player.hand[action.index];
      if (card) selectHandCard(card);
      dirty = true;
      return;
    }
    if (action.type === ACTION.END_TURN) {
      endPlayerTurn();
      return;
    }
    if (state.active !== SIDE_PLAYER) return;
    if (action.type === ACTION.START) {
      // Enter on your turn ends it; with a card chosen it plays it where it needs no target.
      if (selected?.kind === 'hand') {
        const card = state.player.hand.find((c) => c.uid === selected.uid);
        if (card?.kind === 'creature') playSelectedCard(null);
      } else {
        endPlayerTurn();
      }
      return;
    }
    if (action.type === ACTION.HAND_CARD) {
      const card = state.player.hand.find((c) => c.uid === action.uid);
      if (!card) return;
      if (selected?.uid === card.uid) {
        clearSelection();
        dirty = true;
        return;
      }
      selectHandCard(card);
      dirty = true;
      return;
    }
    if (action.type === ACTION.BOARD_CARD) {
      const mine = state.player.board.find((c) => c.uid === action.uid);
      const foe = state.enemy.board.find((c) => c.uid === action.uid);
      if (selected?.kind === 'hand' && foe && targets.includes(action.uid)) {
        playSelectedCard(action.uid);
        return;
      }
      if (selected?.kind === 'board' && foe && targets.includes(action.uid)) {
        attackWithSelected(action.uid);
        return;
      }
      if (mine) {
        if (selected?.uid === mine.uid) {
          clearSelection();
        } else if (canAttackWith(state, SIDE_PLAYER, mine)) {
          selected = { kind: 'board', uid: mine.uid };
          targets = legalTargets(state, SIDE_PLAYER, 'enemy', true);
          sfx.select();
          announce(`${mine.name} ready to strike. Pick a glowing target.`);
        }
        dirty = true;
      }
      return;
    }
    if (action.type === ACTION.HERO) {
      const targetUid = action.side === SIDE_ENEMY ? 'hero' : 'own-hero';
      if (selected && targets.includes(targetUid)) {
        if (selected.kind === 'hand') playSelectedCard(targetUid);
        else attackWithSelected(targetUid);
      }
      return;
    }
    if (action.type === 'summon-zone') {
      if (selected?.kind === 'hand') {
        const card = state.player.hand.find((c) => c.uid === selected.uid);
        if (card?.kind === 'creature') playSelectedCard(null);
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (screen === SCREEN_PLAY && state.phase === 'play' && state.active === SIDE_ENEMY) {
      if (aiQueue.length === 0) {
        aiQueue = planTurn(state, SIDE_ENEMY);
        lastAiStep = now;
      } else if (now - lastAiStep >= AI_STEP_MS) {
        const action = aiQueue.shift();
        if (action.type === 'play') sfx.playCard();
        else if (action.type === 'attack') sfx.attack();
        applyPlannedAction(state, SIDE_ENEMY, action);
        lastAiStep = now;
        dirty = true;
        if (state.phase === 'over') endGame();
      }
    }
    if (dirty) draw();
  }

  // Leaving the tab does nothing to a turn-based duel; the table waits.
  announce('Emberfall Duel. Press Enter or click Play the duel to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
