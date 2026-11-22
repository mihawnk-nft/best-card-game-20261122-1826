# Emberfall Duel

[![make.fun](https://make.fun/badge/best-card-game-20261122-1826.svg)](https://make.fun/c/best-card-game-20261122-1826)
[![make.fun rank](https://make.fun/badge/best-card-game-20261122-1826/mihawnk-nft/best-card-game-20261122-1826/rank.svg)](https://make.fun/c/best-card-game-20261122-1826)
[![make.fun reward](https://make.fun/badge/best-card-game-20261122-1826/mihawnk-nft/best-card-game-20261122-1826/reward.svg)](https://make.fun/c/best-card-game-20261122-1826)

An original turn-based card duel for the make.fun competition
**best-card-game-20261122-1826** ("Make the best card game"). You are the
Ember Keeper, dueling **Vex, the Cinder Witch**, for the Emberfall: thirty
life each, mana that grows 1 → 10 across your turns, one card drawn each
turn, and a table full of creatures that do the fighting for you.

## How to play

- **Summon creatures** — click a creature card in your hand, then click your
  side of the table. A creature cannot attack the turn it is summoned.
- **Attack** — click one of your ready creatures, then click an enemy creature
  or Vex herself. The defender strikes back when it is a creature.
- **Cast spells** — click a spell, then click a glowing target. Spells burn,
  heal, or draw cards.
- **Guard** — a creature with Guard must be attacked before anything behind
  it. Break the wall, then go for the hero.
- **Affinity triangle** — Ember beats Thorn, Thorn beats Tide, Tide beats
  Ember. A strike on the triangle hits **+1** harder.
- **End Turn** — button, or Enter. First hero to 0 life loses; an empty deck
  deals growing fatigue damage.

**Controls:** mouse (click a card, then click its target) and keyboard —
`1–9` pick a hand card, `Enter` confirms / ends the turn, `Esc` puts a card
down, `M` mutes the WebAudio sound effects.

## The cards

20 original cards in one shared pool, two copies each in a 30-card deck:

- **Ember** (fast attackers): Cinder Pup, Ember Whelp, Cinder Hawk,
  Pyre Drake, Magma Golem (Guard).
- **Thorn** (stubborn defenders): Bramble Sprout, Thorn Wolf, Vine Stalker,
  Grove Warden, Thorn Colossus (most with Guard).
- **Tide** (steady fighters): Tide Minnow, Coral Serpent, Wave Rider,
  Tidal Siren, Deep Leviathan.
- **Spells**: Ember Burst (3 damage), Wildfire (2 to all enemy creatures),
  Thorn Snare (2 damage, draw 1), Tide Mend (restore 6), Deep Current
  (draw 2).

All art is drawn in the page itself (inline SVG flame / leaf / wave emblems
and CSS) — no external images, fonts, or sounds. Sound effects are
synthesized live with WebAudio.

## Play it

```sh
node serve.ts            # serves game/ on http://localhost:8080
```

Open `game/index.html` in desktop Chrome. No build step, no network
request: every file the game loads lives under `game/`.

Screenshot scenes (deterministic, `seed=1`): `?shot=start`, `?shot=play`,
`?shot=win`, `?shot=loss` — each stages a real game state and sets
`window.__shotReady` when painted. See `shots.json`.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to the output directory and writes `dossier.json` with the vendored
`vendor/makefun-game.ts`.

## Layout

- `game/index.html` — the page and all CSS.
- `game/src/config.js` — tuning numbers, colours, affinity triangle, card pool.
- `game/src/cards.js` — card definitions, affinity bonus, deck building.
- `game/src/state.js` — duel state, turns, playing cards, combat, Guard.
- `game/src/ai.js` — Vex's planner (plays on a clone of the duel) and autopilot.
- `game/src/input.js` — mouse and keyboard → plain actions.
- `game/src/render.js` — the DOM table: heroes, boards, hands, cards, log.
- `game/src/audio.js` — WebAudio sound effects, no sound files.
- `game/src/random.js` — seeded RNG (mulberry32) for repeatable games.
- `game/src/shots.js` — the `?shot=` scenes.
- `game/src/main.js` — boot, screens, and the loop.

## License

MIT — see `LICENSE`.
