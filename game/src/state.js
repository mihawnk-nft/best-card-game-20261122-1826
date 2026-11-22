// The duel itself: state, turn flow, playing cards and combat. Nothing here
// touches the screen; render.js reads this state, input.js and ai.js call
// these functions, and main.js drives the turns.
//
// A duel: two heroes at 30 life, mana crystals that grow 1 -> 10 across a
// side's turns, one card drawn each turn. Creatures fight on the table;
// spells strike once and go. A creature with Guard must be attacked before
// anything behind it, and a strike gains +1 attack on the affinity triangle
// (Ember > Thorn > Tide > Ember). The first hero to 0 life loses.
import {
  DRAW_PER_TURN,
  FATIGUE_START,
  HAND_LIMIT,
  HERO_LIFE,
  MAX_MANA,
  START_HAND,
  SUMMONING_SICKNESS,
} from './config.js';
import { buildDeck, resetUidCounter, strikeAttack } from './cards.js';

/** Creatures a side can hold on the table at once. */
export const BOARD_LIMIT = 7;

export const SIDE_PLAYER = 'player';
export const SIDE_ENEMY = 'enemy';

function makeSide(name, title, random) {
  return {
    name,
    title,
    life: HERO_LIFE,
    maxLife: HERO_LIFE,
    mana: 0,
    maxMana: 0,
    turns: 0,
    fatigue: FATIGUE_START,
    deck: buildDeck(random),
    hand: [],
    board: [],
  };
}

export function createGame(random) {
  resetUidCounter();
  const state = {
    random,
    phase: 'title',
    active: SIDE_PLAYER,
    winner: null,
    turnCount: 0,
    log: [],
    player: makeSide(SIDE_PLAYER, 'You', random),
    enemy: makeSide(SIDE_ENEMY, 'Vex, the Cinder Witch', random),
  };
  for (let i = 0; i < START_HAND; i += 1) {
    drawCard(state, state.player, true);
    drawCard(state, state.enemy, true);
  }
  // Vex moves second, so she opens with one extra card — the price of tempo.
  drawCard(state, state.enemy, true);
  ensureOpener(state.player);
  ensureOpener(state.enemy);
  return state;
}

/**
 * A hand with nothing playable on turn 1 is a dead first turn, so make sure
 * each opening hand holds at least one 1-cost card: swap its most expensive
 * card for the cheapest 1-cost card still in the deck.
 */
function ensureOpener(side) {
  if (side.hand.some((card) => card.cost <= 1)) return;
  const deckIndex = side.deck.findIndex((card) => card.cost <= 1);
  if (deckIndex === -1) return;
  let expensive = 0;
  for (let i = 1; i < side.hand.length; i += 1) {
    if (side.hand[i].cost > side.hand[expensive].cost) expensive = i;
  }
  const opener = side.deck.splice(deckIndex, 1)[0];
  side.deck.push(side.hand[expensive]);
  side.hand[expensive] = opener;
}

export function otherSide(side) {
  return side === SIDE_PLAYER ? SIDE_ENEMY : SIDE_PLAYER;
}

export function sideOf(state, side) {
  return state[side];
}

export function log(state, message) {
  state.log.push(message);
  if (state.log.length > 40) state.log.splice(0, state.log.length - 40);
}

/** Draw the top card of `side`'s deck; an empty deck deals growing fatigue. */
export function drawCard(state, side, quiet = false) {
  if (side.deck.length === 0) {
    side.life = Math.max(0, side.life - side.fatigue);
    log(state, `${side.title} takes ${side.fatigue} fatigue damage — the deck is empty.`);
    side.fatigue += 1;
    checkEnd(state);
    return null;
  }
  const card = side.deck.shift();
  if (side.hand.length >= HAND_LIMIT) {
    if (!quiet) log(state, `${side.title}'s hand is full — ${card.name} burns.`);
    return null;
  }
  side.hand.push(card);
  return card;
}

/** Begin a side's turn: more mana, a fresh crystal count, one card drawn. */
export function startTurn(state, sideName) {
  const side = sideOf(state, sideName);
  state.active = sideName;
  state.turnCount += 1;
  side.turns += 1;
  side.maxMana = Math.min(MAX_MANA, side.turns);
  side.mana = side.maxMana;
  for (const creature of side.board) {
    creature.canAttack = true;
    creature.justSummoned = false;
  }
  drawCard(state, side);
  log(state, `${side.title}'s turn ${side.turns} — ${side.mana} mana.`);
}

/** Start the duel: the player takes the first turn. */
export function startGame(state) {
  state.phase = 'play';
  state.winner = null;
  state.log = [];
  log(state, 'The duel begins. Ember, Thorn and Tide — pick your strikes well.');
  startTurn(state, SIDE_PLAYER);
}

function findCard(list, uid) {
  return list.find((card) => card.uid === uid) ?? null;
}

export function findOnBoard(state, sideName, uid) {
  return findCard(sideOf(state, sideName).board, uid);
}

/** The Guard creatures of `sideName` that must be attacked first. */
export function guardsOf(state, sideName) {
  return sideOf(state, sideName).board.filter((c) => c.guard && c.health > 0);
}

/** Can this hand card be played right now (mana only; targets checked later)? */
export function canPlayCard(state, sideName, card) {
  return state.phase === 'play' && state.active === sideName && card.cost <= sideOf(state, sideName).mana;
}

/** Can this creature on the table attack right now? */
export function canAttackWith(state, sideName, creature) {
  return (
    state.phase === 'play' &&
    state.active === sideName &&
    creature.canAttack &&
    !creature.justSummoned &&
    creature.attack > 0
  );
}

/**
 * The targets a spell or an attack may legally pick, as uids: a creature uid,
 * or 'hero' for the enemy hero ('own-hero' for your own hero, for heals).
 * Guard narrows *attacks* to the guards; spells ignore Guard, so `isAttack`
 * decides whether the hero stays a target behind a wall of Guards.
 */
export function legalTargets(state, sideName, targetKind, isAttack = false) {
  const foe = sideOf(state, otherSide(sideName));
  const me = sideOf(state, sideName);
  if (targetKind === 'none') return [];
  if (targetKind === 'all-enemy-creatures') return foe.board.map((c) => c.uid);
  if (targetKind === 'any-hero') return ['hero', 'own-hero'];
  if (targetKind === 'enemy') {
    const guards = guardsOf(state, otherSide(sideName));
    const creatures = guards.length > 0 ? guards : foe.board;
    const targets = creatures.map((c) => c.uid);
    if (!isAttack || guards.length === 0) targets.push('hero');
    return targets;
  }
  return [];
}

/** Resolve one spell's effect. `targetUid` is 'hero', 'enemy-hero', or a creature uid. */
function resolveSpell(state, sideName, card, targetUid) {
  const me = sideOf(state, sideName);
  const foe = sideOf(state, otherSide(sideName));
  if (card.damage > 0) {
    if (card.target === 'all-enemy-creatures') {
      for (const creature of [...foe.board]) damageCreature(state, foe, creature, card.damage);
      log(state, `${card.name} scorches every enemy creature for ${card.damage}.`);
    } else if (targetUid === 'hero') {
      damageHero(state, foe, card.damage);
      log(state, `${card.name} hits ${foe.title} for ${card.damage}.`);
    } else if (targetUid === 'own-hero') {
      damageHero(state, me, card.damage);
      log(state, `${card.name} hits ${me.title} for ${card.damage}.`);
    } else {
      const target = findOnBoard(state, otherSide(sideName), targetUid);
      if (target) {
        damageCreature(state, foe, target, card.damage);
        log(state, `${card.name} hits ${target.name} for ${card.damage}.`);
      }
    }
  }
  if (card.heal > 0) {
    const who = targetUid === 'own-hero' ? me : foe;
    const healed = Math.min(card.heal, who.maxLife - who.life);
    who.life += healed;
    log(state, `${card.name} restores ${healed} life to ${who.title}.`);
  }
  if (card.draw > 0) {
    for (let i = 0; i < card.draw; i += 1) drawCard(state, me);
    log(state, `${me.title} draws ${card.draw} card${card.draw > 1 ? 's' : ''}.`);
  }
}

function damageHero(state, side, amount) {
  side.life = Math.max(0, side.life - amount);
  checkEnd(state);
}

function damageCreature(state, side, creature, amount) {
  creature.health -= amount;
  if (creature.health <= 0) {
    side.board = side.board.filter((c) => c.uid !== creature.uid);
    log(state, `${creature.name} falls.`);
  }
}

/**
 * Play a card from `sideName`'s hand. Creatures need no target and enter the
 * table; spells need a target when their target field says so. Returns true
 * when the card was played.
 */
export function playCard(state, sideName, cardUid, targetUid = null) {
  const side = sideOf(state, sideName);
  const card = findCard(side.hand, cardUid);
  if (!card || !canPlayCard(state, sideName, card)) return false;
  if (card.kind === 'creature' && side.board.length >= BOARD_LIMIT) return false;
  if (card.kind === 'spell' && card.target !== 'none' && card.target !== 'all-enemy-creatures') {
    if (!targetUid || !legalTargets(state, sideName, card.target).includes(targetUid)) return false;
  }
  side.hand = side.hand.filter((c) => c.uid !== cardUid);
  side.mana -= card.cost;
  if (card.kind === 'creature') {
    card.justSummoned = SUMMONING_SICKNESS;
    card.canAttack = false;
    side.board.push(card);
    log(state, `${side.title} summons ${card.name} (${card.attack}/${card.health}).`);
  } else {
    log(state, `${side.title} casts ${card.name}.`);
    resolveSpell(state, sideName, card, targetUid);
  }
  checkEnd(state);
  return true;
}

/**
 * One creature strikes a target: 'hero' for the enemy hero, or a creature
 * uid. The defender strikes back when it is a creature. Returns true when
 * the attack happened.
 */
export function attack(state, sideName, attackerUid, targetUid) {
  const side = sideOf(state, sideName);
  const foe = sideOf(state, otherSide(sideName));
  const attacker = findOnBoard(state, sideName, attackerUid);
  if (!attacker || !canAttackWith(state, sideName, attacker)) return false;
  if (targetUid === 'hero') {
    if (guardsOf(state, otherSide(sideName)).length > 0) return false;
    const power = strikeAttack(attacker, null);
    damageHero(state, foe, power);
    attacker.canAttack = false;
    log(state, `${attacker.name} strikes ${foe.title} for ${power}.`);
  } else {
    const defender = findOnBoard(state, otherSide(sideName), targetUid);
    if (!defender) return false;
    if (guardsOf(state, otherSide(sideName)).length > 0 && !defender.guard) return false;
    const power = strikeAttack(attacker, defender.affinity);
    const bonus = power > attacker.attack ? ' (+1 affinity)' : '';
    attacker.canAttack = false;
    damageCreature(state, foe, defender, power);
    damageCreature(state, side, attacker, defender.attack);
    log(state, `${attacker.name} hits ${defender.name} for ${power}${bonus}; ${defender.name} answers for ${defender.attack}.`);
  }
  checkEnd(state);
  return true;
}

/** End the active side's turn; the other side begins. */
export function endTurn(state) {
  if (state.phase !== 'play') return;
  log(state, `${sideOf(state, state.active).title} ends the turn.`);
  startTurn(state, otherSide(state.active));
}

/** Decide whether the duel is over; exported so a staged scene can settle too. */
export function checkEnd(state) {
  if (state.phase !== 'play') return;
  if (state.player.life <= 0 && state.enemy.life <= 0) {
    state.phase = 'over';
    state.winner = SIDE_PLAYER;
    log(state, 'Both heroes fall — the duel is yours on the tie.');
  } else if (state.enemy.life <= 0) {
    state.phase = 'over';
    state.winner = SIDE_PLAYER;
    log(state, 'Vex falls. The Emberfall is yours!');
  } else if (state.player.life <= 0) {
    state.phase = 'over';
    state.winner = SIDE_ENEMY;
    log(state, 'Your hero falls. Vex takes the Emberfall.');
  }
}
