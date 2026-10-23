# Piss Gnomes: Last Gnome Standing (mobile/tablet)

A first-person, psychedelic spin-off of Piss Gnomes made for phones and tablets. Ten gnomes, one small enchanted forest,
pee is the only weapon, and a closing mist forces a finish. Last gnome standing wins. Swirling sky, warping colours that
get wilder as you take damage, and a generative trance soundtrack.

## Play

Open `piss-gnomes-mobile.html` in a browser (self-contained, no install). On iPad/iPhone, use Share > Add to Home Screen.

- **Touch:** left thumb walks, drag the right side to look, hold the PEE button to pee (a light auto-aim helps). Look up to throw your stream further; the glowing ring on the ground is where it lands. Portrait and landscape both work.
- **Computer:** WASD to walk, mouse to look (click to capture it), hold click or Space to pee.
- **Bladder:** drains as you pee and refills when you stop. Run dry and you wait for it to come back.

## Develop

```bash
npm install
npm run dev     # dev server
npm run build   # single-file dist/index.html
```

Built with TypeScript, Vite and Three.js. Add `?god` to the URL to be invulnerable while testing.

## Potions, modes and banter

- **Potions:** glowing bottles lie around the forest (they come back after 25 s). Walk into one for 25 seconds of
  **Chili Wee** (sets them on fire), **Ice Wee** (slows, then freezes) or **Acid Pee** (melts, and they take 25% more
  damage from everything). Bots hunt them too.
- **Health regenerates** once you have stayed out of trouble for 4 seconds (not while burning or melting).
- **Psychedelic only when hurt:** the forest is a normal night until your health drops, then the sky swirls and the
  screen warps. Standing in the mist does it too.
- **Random modes** drop in during a match: **Disco** (faster, stronger streams, rainbow lights), **Goth** (dark, no
  health regeneration) and **Bogan** (bladder lasts longer, wobbly drunk aim, sunset haze). Each has its own music.
- **Banter:** every gnome shouts unhinged lines in speech bubbles, plus a death cry when they go down (spoken aloud with
  your device's speech voices; the sound button mutes them).
