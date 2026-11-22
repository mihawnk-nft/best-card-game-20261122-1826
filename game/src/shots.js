// The screenshot scenes behind ?shot=start|play|win|loss. Each one plays the
// real rules forward from a fresh duel for a fixed number of turns, steered
// by the same planner that plays Vex, so the frame is what a short game
// really looks like and the same seed always gives the same frame. The win
// and loss scenes let the duel run until it ends; if the wrong side is
// winning, the loser is left at the edge and the winner lands the real final
// blow, so the end screen is a genuine game-over state.
import { CARD_BY_ID } from './cards.js';
import { canPlayCard, checkEnd, createGame, otherSide, sideOf, startGame, attack, SIDE_ENEMY, SIDE_PLAYER } from './state.js';
import { legalTargets } from './state.js';
import { playTurnAuto } from './ai.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const PLAY_TURNS = 6;
const END_LIMIT_TURNS = 80;

/** Leave the loser at 1 life and land the real final blow with a ready attacker. */
function forceEnding(state, playerWins) {
  const winnerSide = playerWins ? SIDE_PLAYER : SIDE_ENEMY;
  const loserSide = otherSide(winnerSide);
  const winner = sideOf(state, winnerSide);
  const loser = sideOf(state, loserSide);
  state.phase = 'play';
  loser.life = 1;
  if (winner.life <= 0) winner.life = 5;
  loser.board = loser.board.filter((card) => !card.guard);
  let attacker = winner.board.find((card) => card.canAttack && !card.justSummoned && card.attack > 0);
  if (!attacker) {
    const creature = winner.hand.find((card) => card.kind === 'creature') ?? winner.deck.find((card) => card.kind === 'creature');
    if (creature) {
      attacker = { ...creature, justSummoned: false, canAttack: true };
      winner.board.push(attacker);
    }
  }
  if (attacker) attack(state, winnerSide, attacker.uid, 'hero');
  if (state.phase === 'play') {
    loser.life = 0;
    checkEnd(state);
  }
}

/**
 * Set `state` to the named scene (start, play, win or loss; any other name
 * is start) and return the screen to draw over it, the best result to show,
 * and the selection to highlight.
 */
export function stageShot(name, state) {
  const fresh = createGame(state.random);
  Object.assign(state, fresh);
  if (name !== 'play' && name !== 'win' && name !== 'loss') {
    return { screen: SCREEN_TITLE, best: 0, selectedUid: null, targets: [] };
  }
  startGame(state);
  const limit = name === 'play' ? PLAY_TURNS : END_LIMIT_TURNS;
  while (state.phase === 'play' && state.turnCount < limit) {
    playTurnAuto(state, state.active);
  }
  if (name === 'play') {
    if (state.phase === 'play' && state.active === SIDE_ENEMY) playTurnAuto(state, SIDE_ENEMY);
    const playable = state.player.hand.find((card) => canPlayCard(state, SIDE_PLAYER, card));
    if (playable) {
      const targets = playable.kind === 'spell' ? legalTargets(state, SIDE_PLAYER, playable.target) : [];
      return { screen: SCREEN_PLAY, best: 0, selectedUid: playable.uid, targets };
    }
    return { screen: SCREEN_PLAY, best: 0, selectedUid: null, targets: [] };
  }
  const playerWon = state.phase === 'over' && state.winner === SIDE_PLAYER;
  const wantPlayerWin = name === 'win';
  if (state.phase !== 'over' || playerWon !== wantPlayerWin) forceEnding(state, wantPlayerWin);
  return { screen: SCREEN_OVER, best: 0, selectedUid: null, targets: [] };
}
