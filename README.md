# Piss Gnomes: Last Gnome Standing (mobile/tablet)

A first-person spin-off of Piss Gnomes, styled like a PS2 Katamari game (candy colours, chunky low-poly, pastel UI) made for phones and tablets. Ten gnomes, one small enchanted forest,
pee is the only weapon, and a closing mist forces a finish. Last gnome standing wins. Swirling sky, warping colours that
get wilder as you take damage, and a generative trance soundtrack.

## Play

Open `piss-gnomes-mobile.html` in a browser (self-contained, no install). On iPad/iPhone, use Share > Add to Home Screen.

- **Touch:** left thumb walks (JUMP button bottom-left), drag the right side to look, hold the PEE button to pee (a light auto-aim helps). Look up to throw your stream further; the glowing ring on the ground is where it lands. Portrait and landscape both work.
- **Computer:** WASD to walk, mouse to look (click to capture it), hold click or F to pee, Space to jump.
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
- **Nathaniel:** a tall, dorky metalhead (glasses, skull band T-shirt, blue jeans) three gnomes high who wanders the forest
  shouting his own name. Walk up to him (he shows as a gold diamond on the minimap) and he gives you **Wizard Mode**: 20
  seconds of being unhurtable, with rainbow pee. He cannot be hurt and only blesses you every 40 seconds.
- **Bugs:** six big beetles wander the forest, stop, shudder and fart out a glowing bonus (it blinks and vanishes after 16 s):
  **Speed** (10 s of running much faster), **Health** (+50), **Bounce** (12 s of hopping, which also makes you harder to hit) or
  **Big Gulp** (bladder refilled and free for 8 s). Anybody can grab them, bots included.
- **3D sound:** the other gnomes' streams, hits, deaths, footsteps, Nathaniel's big boots and the bug farts are all placed in
  space around the camera (HRTF panning with distance fade), so headphones tell you where things are. Speech voices cannot be
  panned by the browser, so those just fade with distance.
- **Looks:** a bright, chunky, Katamari-on-PS2 world (candy trees, pastel sky and clouds, fat rounded UI, soft low-res picture). It only
  goes psychedelic when you are badly hurt. Nathaniel only speaks when you touch him, and the bugs are blocky voxel beetles.
- **Taunts:** bots yell things like "Taste the rainbow!" and "Don't slip!" as they open fire, and when they win a fight.
- **Mushroom forest:** the trees are now giant candy mushrooms (stems block movement and pee; caps are overhead).
- **Thumb-friendly controls:** JUMP and PEE sit lifted off the bottom corners and are size-capped on tablets. You can slide your
  thumb on the PEE button to aim while you pee. The start screen now has a full How To Play section.
- **Mixing potions:** you can hold chili, ice and acid at once (each has its own 25 s timer; a kind you already hold is left
  alone). Mixes change the stream: **Thermal Shock** (chili + ice: burning-and-chilled victims take double), **Napalm**
  (chili + acid: longer burn that jumps to anyone close), **Cryo-Acid** (ice + acid: frozen victims take 60% more and the
  acid bites twice as hard) and the **Rainbow Cocktail** (all three: rainbow pee that leaves victims dizzy).
- **Speech bubbles** fade with distance, and the beetles are smaller.
