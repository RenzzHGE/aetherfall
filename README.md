# AETHERFALL

[![make.fun](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![Rank](https://make.fun/badge/best-game-01/RenzzHGE/aetherfall/rank.svg)](https://make.fun/bounty/best-game-01)
[![Reward](https://make.fun/badge/best-game-01/RenzzHGE/aetherfall/reward.svg)](https://make.fun/bounty/best-game-01)

A polished roguelike arena survival game, built for [make.fun's "Make the best game" bounty](https://make.fun/bounty/best-game-01) ($1,000 in USDC).

You are a lone warden in a floating arena. Waves of enemies spawn from the edges and hunt you down. Survive, collect shards from kills, spend them between waves on upgrade cards, and beat the VOIDLORD boss every 5 waves. How long can you hold the arena?

## How to play

- **WASD / arrows** — move
- **Mouse** — aim, **click / hold** — shoot (twin-stick)
- **Space** — dash (brief invulnerability, cooldown)
- **1 / 2 / 3** — switch weapons once unlocked (Pulse Blaster, Scattergun, Rail Lance)
- **P** — pause, **M** — mute, **R** — reroll upgrade cards (10 shards)

Between waves you pick 1 of 3 upgrade cards: damage, fire rate, speed, max HP, dash cooldown, multishot, piercing rounds, lifesteal, magnet, a shield that blocks one hit per wave — plus two extra weapons to unlock.

## Features

- 3 enemy types (chasers, brutes, spitters) + a boss every 5 waves with radial bursts, charges, and summons
- Kill combos with a score multiplier, floating damage numbers, particle explosions, screen shake, slow-mo on boss death
- Parallax starfield, glowing neon palette, WebAudio synth SFX (no audio files)
- Local best score and best wave, saved in your browser

## Run it

Serve `game/` statically (for example `node serve.ts`, then open http://localhost:8080) — plain JavaScript + Canvas, no build step, no network requests.

## License

MIT — see [LICENSE](LICENSE).
