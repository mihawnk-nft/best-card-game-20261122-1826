// Emberfall Duel — every tuning number, colour and card in one place.
// The table is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** A hero's starting life. */
export const HERO_LIFE = 30;
/** Mana crystals on turn N are min(N, MAX_MANA); they refill every turn. */
export const MAX_MANA = 10;
/** Cards drawn at the start, and cards drawn when a turn begins. */
export const START_HAND = 3;
export const DRAW_PER_TURN = 1;
/** Cards a hand can hold; drawing past it burns the card. */
export const HAND_LIMIT = 10;
/** Damage taken when forced to draw from an empty deck; it grows each time. */
export const FATIGUE_START = 1;
/** A creature that entered play this turn cannot attack yet. */
export const SUMMONING_SICKNESS = true;

/**
 * The affinity triangle. An attacker whose affinity beats the defender's
 * gains +1 attack for that strike: Ember burns Thorn, Thorn drinks Tide,
 * Tide drowns Ember.
 */
export const AFFINITY = {
  ember: { name: 'Ember', beats: 'thorn', color: '#e8590c', soft: '#ffd8a8', glyph: 'flame' },
  thorn: { name: 'Thorn', beats: 'tide', color: '#2f9e44', soft: '#b2f2bb', glyph: 'leaf' },
  tide: { name: 'Tide', beats: 'ember', color: '#1971c2', soft: '#a5d8ff', glyph: 'wave' },
};

export const AFFINITY_ORDER = ['ember', 'thorn', 'tide'];

/** +1 attack when the attacker's affinity beats the defender's. */
export const AFFINITY_BONUS = 1;

export const PALETTE = {
  backdrop: '#14100c',
  table: '#241a12',
  tableEdge: '#3d2c1c',
  felt: '#2c2115',
  panel: '#1d150e',
  panelEdge: '#4a3520',
  text: '#f5ead6',
  muted: '#b39b78',
  gold: '#f2c94c',
  player: '#e8590c',
  enemy: '#7048e8',
  mana: '#339af0',
  life: '#e03131',
  guard: '#adb5bd',
};

export const FONT = 'Georgia, "Times New Roman", serif';
export const UI_FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best result is kept between visits (this browser only). */
export const BEST_KEY = 'emberfall-duel.best';

/**
 * The card pool: every card in the game, defined once here. `kind` is
 * 'creature' or 'spell'. Creatures carry cost/attack/health and may carry
 * Guard. Spells carry one effect: damage, heal or draw (or both damage and
 * draw), aimed at `target`: 'enemy' (a creature or the hero), 'any' (either
 * hero), or 'all-enemy-creatures'.
 */
export const CARD_POOL = [
  // ---- Ember creatures: fast, hungry attackers. ----
  { id: 'cinder-pup', name: 'Cinder Pup', kind: 'creature', affinity: 'ember', cost: 1, attack: 2, health: 1, text: 'A spark that learned to bite.' },
  { id: 'ember-whelp', name: 'Ember Whelp', kind: 'creature', affinity: 'ember', cost: 2, attack: 3, health: 2, text: 'It sneezes and the grass catches fire.' },
  { id: 'cinder-hawk', name: 'Cinder Hawk', kind: 'creature', affinity: 'ember', cost: 3, attack: 4, health: 3, text: 'Its wings leave a trail of ash.' },
  { id: 'pyre-drake', name: 'Pyre Drake', kind: 'creature', affinity: 'ember', cost: 5, attack: 6, health: 5, text: 'Old enough to remember the first fire.' },
  { id: 'magma-golem', name: 'Magma Golem', kind: 'creature', affinity: 'ember', cost: 6, attack: 5, health: 8, guard: true, text: 'Guard. A walking furnace that stands in the way.' },
  // ---- Thorn creatures: tough, stubborn defenders. ----
  { id: 'bramble-sprout', name: 'Bramble Sprout', kind: 'creature', affinity: 'thorn', cost: 1, attack: 1, health: 3, guard: true, text: 'Guard. Small, sharp, and in the way.' },
  { id: 'thorn-wolf', name: 'Thorn Wolf', kind: 'creature', affinity: 'thorn', cost: 2, attack: 3, health: 2, text: 'It hunts in the hedges, never alone.' },
  { id: 'vine-stalker', name: 'Vine Stalker', kind: 'creature', affinity: 'thorn', cost: 3, attack: 2, health: 5, guard: true, text: 'Guard. It trips whatever walks past.' },
  { id: 'grove-warden', name: 'Grove Warden', kind: 'creature', affinity: 'thorn', cost: 4, attack: 4, health: 5, guard: true, text: 'Guard. The grove answers when it calls.' },
  { id: 'thorn-colossus', name: 'Thorn Colossus', kind: 'creature', affinity: 'thorn', cost: 6, attack: 7, health: 6, text: 'A hill that decided to walk.' },
  // ---- Tide creatures: steady, deep-water fighters. ----
  { id: 'tide-minnow', name: 'Tide Minnow', kind: 'creature', affinity: 'tide', cost: 1, attack: 2, health: 2, text: 'Small now. The sea is patient.' },
  { id: 'coral-serpent', name: 'Coral Serpent', kind: 'creature', affinity: 'tide', cost: 2, attack: 3, health: 3, text: 'It wears the reef like armour.' },
  { id: 'wave-rider', name: 'Wave Rider', kind: 'creature', affinity: 'tide', cost: 3, attack: 4, health: 3, text: 'It never touches the ground.' },
  { id: 'tidal-siren', name: 'Tidal Siren', kind: 'creature', affinity: 'tide', cost: 4, attack: 3, health: 5, text: 'Her song pulls ships — and luck — under.' },
  { id: 'deep-leviathan', name: 'Deep Leviathan', kind: 'creature', affinity: 'tide', cost: 6, attack: 6, health: 7, text: 'The tide itself, given teeth.' },
  // ---- Spells: one-shot tricks, each with a single clear job. ----
  { id: 'ember-burst', name: 'Ember Burst', kind: 'spell', affinity: 'ember', cost: 2, damage: 3, target: 'enemy', text: 'Deal 3 damage.' },
  { id: 'wildfire', name: 'Wildfire', kind: 'spell', affinity: 'ember', cost: 4, damage: 2, target: 'all-enemy-creatures', text: 'Deal 2 damage to all enemy creatures.' },
  { id: 'thorn-snare', name: 'Thorn Snare', kind: 'spell', affinity: 'thorn', cost: 2, damage: 2, draw: 1, target: 'enemy', text: 'Deal 2 damage. Draw a card.' },
  { id: 'tide-mend', name: 'Tide Mend', kind: 'spell', affinity: 'tide', cost: 2, heal: 6, target: 'any-hero', text: 'Restore 6 life to a hero.' },
  { id: 'deep-current', name: 'Deep Current', kind: 'spell', affinity: 'tide', cost: 3, draw: 2, target: 'none', text: 'Draw 2 cards.' },
];

/** How many copies of each pool card go into a 30-card deck. */
export const DECK_COPIES = 2;
