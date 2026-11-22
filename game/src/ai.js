// The opponent: Vex, the Cinder Witch. The planner works on a throwaway
// clone of the duel (copies of both sides, same cards, same order), tries
// its moves there with the real rules, and hands back the list of actions
// that worked. The main loop then plays those actions out one at a time so
// the player can watch Vex think. The same planner steers both sides in the
// screenshot scenes, where there is no human to wait for.
import { strikeAttack } from './cards.js';
import {
  attack,
  BOARD_LIMIT,
  canAttackWith,
  canPlayCard,
  endTurn,
  guardsOf,
  otherSide,
  playCard,
  sideOf,
} from './state.js';

const MAX_PLANNED_ACTIONS = 60;

/** A plain copy of the duel, safe to play moves on without touching the real one. */
function cloneState(state) {
  const clone = { ...state, log: [...state.log] };
  for (const key of ['player', 'enemy']) {
    const side = state[key];
    clone[key] = {
      ...side,
      deck: side.deck.map((card) => ({ ...card })),
      hand: side.hand.map((card) => ({ ...card })),
      board: side.board.map((card) => ({ ...card })),
    };
  }
  return clone;
}

/** The best card to play from this hand right now, or null when holding is better. */
function chooseCardToPlay(shadow, sideName) {
  const me = sideOf(shadow, sideName);
  const foe = sideOf(shadow, otherSide(sideName));
  let best = null;
  let bestScore = 0;
  for (const card of me.hand) {
    if (!canPlayCard(shadow, sideName, card)) continue;
    let score = -1;
    let target = null;
    if (card.kind === 'creature') {
      if (me.board.length >= BOARD_LIMIT) continue;
      score = card.cost * 2 + card.attack + (card.guard ? 2 : 0);
    } else if (card.target === 'all-enemy-creatures') {
      const hurt = foe.board.filter((c) => c.health <= card.damage).length;
      if (foe.board.length >= 2 || hurt > 0) score = 6 + hurt * 2;
    } else if (card.target === 'enemy') {
      if (card.damage >= foe.life) {
        score = 100;
        target = 'hero';
      } else {
        const killable = foe.board
          .filter((c) => c.health <= card.damage)
          .sort((a, b) => b.attack - a.attack)[0];
        if (killable) {
          score = 8 + killable.attack;
          target = killable.uid;
        } else if (foe.board.length === 0) {
          score = 3;
          target = 'hero';
        }
      }
    } else if (card.target === 'any-hero') {
      if (me.life <= me.maxLife - card.heal) {
        score = 9;
        target = 'own-hero';
      }
    } else if (card.target === 'none') {
      if (me.hand.length <= 4) score = 7;
    }
    if (score > bestScore) {
      bestScore = score;
      best = { card, target };
    }
  }
  return best;
}

/** The best target for this attacker right now, or null when it should wait. */
function chooseAttackTarget(shadow, sideName, attacker) {
  const foe = sideOf(shadow, otherSide(sideName));
  const guards = guardsOf(shadow, otherSide(sideName));
  const power = strikeAttack(attacker, null);
  if (guards.length === 0 && power >= foe.life) return 'hero';
  if (guards.length > 0) {
    const killable = guards
      .filter((g) => g.health <= strikeAttack(attacker, g.affinity))
      .sort((a, b) => a.health - b.health)[0];
    const target = killable ?? [...guards].sort((a, b) => a.health - b.health)[0];
    return target.uid;
  }
  const killable = foe.board
    .filter((c) => c.health <= strikeAttack(attacker, c.affinity))
    .sort((a, b) => b.attack - a.attack)[0];
  if (killable) return killable.uid;
  return 'hero';
}

/**
 * Plan one whole turn for `sideName` and return its actions, in order:
 * { type: 'play', cardUid, targetUid } and { type: 'attack', attackerUid, targetUid },
 * ending with { type: 'end' }. Every action was already proven legal on the
 * clone, so replaying it on the real duel just works.
 */
export function planTurn(state, sideName) {
  const shadow = cloneState(state);
  const actions = [];
  let guard = 0;
  while (guard < MAX_PLANNED_ACTIONS) {
    guard += 1;
    const pick = chooseCardToPlay(shadow, sideName);
    if (!pick) break;
    if (!playCard(shadow, sideName, pick.card.uid, pick.target)) break;
    actions.push({ type: 'play', cardUid: pick.card.uid, targetUid: pick.target });
    if (shadow.phase !== 'play') break;
  }
  if (shadow.phase === 'play') {
    // Re-find each attacker on the live board: a creature may have died in
    // an earlier strike, and damage replaces the board array.
    for (const snapshot of [...sideOf(shadow, sideName).board]) {
      if (shadow.phase !== 'play') break;
      const attacker = sideOf(shadow, sideName).board.find((c) => c.uid === snapshot.uid);
      if (!attacker) continue;
      if (!canAttackWith(shadow, sideName, attacker)) continue;
      const target = chooseAttackTarget(shadow, sideName, attacker);
      if (!target) continue;
      if (!attack(shadow, sideName, attacker.uid, target)) continue;
      actions.push({ type: 'attack', attackerUid: attacker.uid, targetUid: target });
    }
  }
  actions.push({ type: 'end' });
  return actions;
}

/** Apply one planned action to the real duel. Returns false when it no longer fits. */
export function applyPlannedAction(state, sideName, action) {
  if (action.type === 'play') return playCard(state, sideName, action.cardUid, action.targetUid);
  if (action.type === 'attack') return attack(state, sideName, action.attackerUid, action.targetUid);
  if (action.type === 'end') {
    endTurn(state);
    return true;
  }
  return false;
}

/** Play a whole turn for `sideName` at once, no waiting: the screenshot scenes use this. */
export function playTurnAuto(state, sideName) {
  for (const action of planTurn(state, sideName)) {
    if (state.phase !== 'play') break;
    applyPlannedAction(state, sideName, action);
  }
  if (state.phase === 'play' && state.active === sideName) endTurn(state);
}
