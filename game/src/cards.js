// The card pool as live cards: definitions, lookups and deck building.
// A definition (from config.js) is static data; a card instance is one copy
// of it in a hand, on the table, or in a deck, with its own uid and its own
// attack/health that combat can change.
import { AFFINITY, CARD_POOL, DECK_COPIES } from './config.js';
import { shuffle } from './random.js';

export const CARD_BY_ID = new Map(CARD_POOL.map((def) => [def.id, def]));

/** True when the attacker's affinity beats the defender's (Ember > Thorn > Tide > Ember). */
export function affinityBeats(attackerAffinity, defenderAffinity) {
  return AFFINITY[attackerAffinity].beats === defenderAffinity;
}

/** The attack value a creature strikes with against this defender: +1 on the triangle. */
export function strikeAttack(attacker, defenderAffinity) {
  if (defenderAffinity && affinityBeats(attacker.affinity, defenderAffinity)) return attacker.attack + 1;
  return attacker.attack;
}

let nextUid = 1;

/** Make one playable copy of a definition. */
export function makeCard(defId) {
  const def = CARD_BY_ID.get(defId);
  return {
    uid: `c${nextUid++}`,
    defId,
    name: def.name,
    kind: def.kind,
    affinity: def.affinity,
    cost: def.cost,
    attack: def.attack ?? 0,
    health: def.health ?? 0,
    maxHealth: def.health ?? 0,
    guard: Boolean(def.guard),
    damage: def.damage ?? 0,
    heal: def.heal ?? 0,
    draw: def.draw ?? 0,
    target: def.target ?? 'none',
    text: def.text,
    /** A creature that entered play this turn cannot attack yet. */
    justSummoned: false,
    /** A creature attacks once per turn. */
    canAttack: false,
  };
}

export function resetUidCounter() {
  nextUid = 1;
}

/**
 * A 30-card deck: two copies of every pool card, shuffled with the game's
 * seeded generator. Both duelists draw from the same pool, so no side owns
 * a card the other could never see.
 */
export function buildDeck(random) {
  const ids = [];
  for (const def of CARD_POOL) {
    for (let i = 0; i < DECK_COPIES; i += 1) ids.push(def.id);
  }
  shuffle(ids, random);
  return ids.map((id) => makeCard(id));
}
