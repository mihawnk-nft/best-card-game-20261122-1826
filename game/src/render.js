// The table, painted as DOM: cards are real elements with readable numbers,
// so they stay legible even shrunk to a thumbnail. The renderer rebuilds the
// table from the state whenever main.js says something changed; clicks reach
// main.js through the data-action attributes (see input.js).
import { AFFINITY, AFFINITY_ORDER, MAX_MANA } from './config.js';
import { CARD_BY_ID } from './cards.js';
import { canAttackWith, canPlayCard, guardsOf, otherSide, SIDE_ENEMY, SIDE_PLAYER } from './state.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_OVER = 'over';

/** Inline SVG art, drawn here and nowhere else: a flame, a leaf, a wave. */
function artSVG(card) {
  const color = AFFINITY[card.affinity].color;
  const glyph = AFFINITY[card.affinity].glyph;
  const inner =
    glyph === 'flame'
      ? '<path d="M34 6c1 9 11 13 11 24 0 4-1 7-3 10 4-2 7-6 8-11 5 5 9 11 9 18a23 23 0 1 1-46 0c0-8 5-12 8-18 1 5 3 7 6 6-1-6 2-12 7-15 0-5 0-9 0-14z" fill="' + color + '"/>'
      : glyph === 'leaf'
        ? '<path d="M52 10C30 8 12 26 12 50c0 2 1 3 3 3 24 0 39-19 37-43z" fill="' + color + '"/><path d="M18 46C28 34 38 26 48 16" stroke="#0f2a12" stroke-width="3" fill="none" stroke-linecap="round"/>'
        : '<path d="M6 20c8-8 16-8 24 0s16 8 24 0M6 32c8-8 16-8 24 0s16 8 24 0M6 44c8-8 16-8 24 0s16 8 24 0" stroke="' + color + '" stroke-width="5" fill="none" stroke-linecap="round"/>';
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${inner}</svg>`;
}

function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function crystals(mana, maxMana) {
  let dots = '';
  for (let i = 0; i < MAX_MANA; i += 1) {
    const filled = i < mana;
    const unlocked = i < maxMana;
    dots += `<span class="crystal${filled ? ' on' : ''}${unlocked ? '' : ' locked'}"></span>`;
  }
  return `<span class="crystals" title="Mana ${mana}/${maxMana}">${dots}</span>`;
}

function lifeBar(life, maxLife) {
  const pct = Math.max(0, Math.min(100, (life / maxLife) * 100));
  return `<span class="lifebar"><span class="lifefill" style="width:${pct}%"></span><span class="lifenumber">${life}</span></span>`;
}

function heroPanel(state, sideName, ui) {
  const side = state[sideName];
  const isFoe = sideName === SIDE_ENEMY;
  const targetable = ui.targets.includes(isFoe ? 'hero' : 'own-hero');
  const label = isFoe ? side.title : 'You — the Ember Keeper';
  return `<div class="hero${isFoe ? ' foe' : ' mine'}${targetable ? ' is-target' : ''}" data-action="hero" data-side="${sideName}">
    <span class="portrait" style="--pc:${isFoe ? '#7048e8' : '#e8590c'}">${isFoe ? 'V' : 'K'}</span>
    <span class="hero-info">
      <span class="hero-name">${escapeHtml(label)}</span>
      <span class="hero-stats">${lifeBar(side.life, side.maxLife)} ${crystals(side.mana, side.maxMana)}</span>
    </span>
    <span class="deck-count" title="Cards left in deck">Deck ${side.deck.length}</span>
  </div>`;
}

function cardHTML(card, options) {
  const def = CARD_BY_ID.get(card.defId);
  const classes = ['card', `aff-${card.affinity}`];
  if (options.selected) classes.push('is-selected');
  if (options.playable) classes.push('is-playable');
  if (options.canAttack) classes.push('is-attacker');
  if (options.targetable) classes.push('is-target');
  if (options.dimmed) classes.push('is-dim');
  if (card.guard) classes.push('is-guard');
  const action = options.where === 'hand' ? 'hand-card' : 'board-card';
  const stats =
    card.kind === 'creature'
      ? `<span class="stat atk" title="Attack">${card.attack}</span><span class="stat hp" title="Health">${card.health}</span>`
      : `<span class="stat spell" title="Spell">✦</span>`;
  return `<div class="${classes.join(' ')}" data-action="${action}" data-uid="${card.uid}" role="button" tabindex="0" aria-label="${escapeHtml(card.name)}, cost ${card.cost}${card.kind === 'creature' ? `, ${card.attack} attack, ${card.health} health` : ''}">
    <span class="cost">${card.cost}</span>
    ${card.guard ? '<span class="guard">GUARD</span>' : ''}
    <span class="art">${artSVG(card)}</span>
    <span class="card-name">${escapeHtml(card.name)}</span>
    <span class="card-text">${escapeHtml(def.text)}</span>
    ${stats}
  </div>`;
}

function cardBackHTML() {
  return `<div class="card back" aria-hidden="true"><span class="back-mark">✦</span></div>`;
}

function boardRow(state, sideName, ui) {
  const side = state[sideName];
  const isFoe = sideName === SIDE_ENEMY;
  let html = '';
  for (const card of side.board) {
    const targetable = ui.targets.includes(card.uid);
    const canAttack = !isFoe && canAttackWith(state, SIDE_PLAYER, card);
    const selected = ui.selectedUid === card.uid;
    html += cardHTML(card, { where: 'board', targetable, canAttack, selected, dimmed: isFoe && !targetable && ui.targets.length > 0 });
  }
  if (side.board.length === 0) {
    html = `<div class="empty-board">${isFoe ? 'Vex has no creatures — strike her directly.' : 'Your side of the table is empty. Play a creature!'}</div>`;
  }
  const zone = isFoe ? '' : ' data-action="summon-zone" data-side="player"';
  return `<div class="board-row${isFoe ? ' foe-row' : ''}"${zone}>${html}</div>`;
}

function handRow(state, ui) {
  const side = state.player;
  let html = '';
  side.hand.forEach((card) => {
    const playable = canPlayCard(state, SIDE_PLAYER, card);
    const selected = ui.selectedUid === card.uid;
    const targetable = false;
    html += cardHTML(card, {
      where: 'hand',
      playable,
      selected,
      targetable,
      dimmed: state.active === SIDE_PLAYER && !playable && ui.selectedUid !== card.uid,
    });
  });
  if (side.hand.length === 0) html = '<div class="empty-board">Your hand is empty — end the turn to draw.</div>';
  return `<div class="hand-row">${html}</div>`;
}

function enemyHandRow(state) {
  let backs = '';
  for (let i = 0; i < state.enemy.hand.length; i += 1) backs += cardBackHTML();
  return `<div class="enemy-hand" title="Vex's hand — ${state.enemy.hand.length} cards">${backs}</div>`;
}

function logHTML(state) {
  const lines = state.log.slice(-4);
  return `<div class="log">${lines.map((line) => `<div>${escapeHtml(line)}</div>`).join('')}</div>`;
}

function triangleHTML() {
  const chips = AFFINITY_ORDER.map(
    (key) => `<span class="tri-chip" style="--ac:${AFFINITY[key].color}">${AFFINITY[key].name}</span>`,
  ).join('<span class="tri-beats">&gt;</span>');
  return `<div class="triangle" title="Affinity triangle: Ember beats Thorn, Thorn beats Tide, Tide beats Ember. A winning strike gains +1 attack.">${chips}<span class="tri-beats">&gt;</span><span class="tri-chip" style="--ac:${AFFINITY.ember.color}">Ember</span><span class="tri-note">+1 attack on the triangle</span></div>`;
}

function titleScreen(state, ui) {
  const samples = ['magma-golem', 'thorn-colossus', 'deep-leviathan'].map((id) => {
    const def = CARD_BY_ID.get(id);
    return cardHTML(
      { uid: `sample-${id}`, defId: id, name: def.name, kind: 'creature', affinity: def.affinity, cost: def.cost, attack: def.attack, health: def.health, guard: Boolean(def.guard) },
      { where: 'board' },
    );
  }).join('');
  return `<div class="screen title-screen">
    <div class="title-inner">
      <div class="title-kicker">A duel of Ember, Thorn &amp; Tide</div>
      <h1>EMBERFALL<br>DUEL</h1>
      <p class="tagline">Thirty life. Ten mana. One witch between you and the Emberfall.</p>
      <div class="sample-cards">${samples}</div>
      ${triangleHTML()}
      <button class="big-button" data-action="start">Play the duel</button>
      <p class="hint">Click a card, then click where it goes. Keys: 1–9 pick a card, Enter ends the turn, Esc cancels, M mutes.</p>
      <p class="howto"><strong>How it plays:</strong> summon creatures, strike with them, and break through
      Vex's Guards to reach her. Spells burn, heal, or draw. Win the affinity triangle and your strikes hit +1 harder.</p>
      ${ui.best > 0 ? `<p class="best">Best result: ${ui.best} win${ui.best === 1 ? '' : 's'} against Vex</p>` : ''}
    </div>
  </div>`;
}

function playScreen(state, ui) {
  const myTurn = state.active === SIDE_PLAYER && state.phase === 'play';
  const banner = myTurn
    ? ui.selectedUid
      ? 'A card is chosen — click a glowing target, or Esc to put it down.'
      : 'Your turn — play a card, attack, or end the turn.'
    : "Vex is thinking…";
  return `<div class="screen play-screen">
    <div class="topbar">
      ${heroPanel(state, SIDE_ENEMY, ui)}
      <div class="turn-box"><span class="turn-label">Turn ${Math.max(1, state.player.turns + state.enemy.turns)}</span><span class="banner">${escapeHtml(banner)}</span></div>
      <button class="mute-button" data-action="mute" title="Mute (M)">${ui.muted ? 'Sound off' : 'Sound on'}</button>
    </div>
    ${enemyHandRow(state)}
    ${boardRow(state, SIDE_ENEMY, ui)}
    <div class="midbar">
      ${logHTML(state)}
      <div class="mid-right">${triangleHTML()}<button class="end-button" data-action="end-turn" ${myTurn ? '' : 'disabled'}>End Turn ⏎</button></div>
    </div>
    ${boardRow(state, SIDE_PLAYER, ui)}
    ${handRow(state, ui)}
    <div class="bottombar">${heroPanel(state, SIDE_PLAYER, ui)}<span class="keys-hint">1–9 pick a card · Enter end turn · Esc cancel · M mute</span></div>
  </div>`;
}

function overScreen(state, ui) {
  const won = state.winner === SIDE_PLAYER;
  const turns = state.player.turns + state.enemy.turns;
  return `<div class="screen over-screen">
    <div class="over-inner ${won ? 'won' : 'lost'}">
      <div class="over-kicker">${won ? 'The Emberfall is yours' : 'The witch keeps the Emberfall'}</div>
      <h1>${won ? 'VICTORY' : 'DEFEAT'}</h1>
      <p class="over-score">You ${state.player.life} — ${state.enemy.life} Vex · ${turns} turns</p>
      <p class="over-line">${won ? 'Vex bows, her cinders cooling. The table is yours.' : 'Vex gathers her cinders and smiles. Deal again?'}</p>
      <button class="big-button" data-action="restart">Play again</button>
      <p class="hint">Enter plays again${ui.best > 0 ? ` · Best: ${ui.best} win${ui.best === 1 ? '' : 's'} against Vex` : ''}</p>
    </div>
  </div>`;
}

export function createRenderer(root) {
  return {
    draw(state, screen, ui) {
      if (screen === SCREEN_TITLE) root.innerHTML = titleScreen(state, ui);
      else if (screen === SCREEN_OVER) root.innerHTML = overScreen(state, ui);
      else root.innerHTML = playScreen(state, ui);
    },
  };
}
