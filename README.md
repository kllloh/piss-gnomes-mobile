# Piss Gnomes: Last Gnome Standing (mobile/tablet)

A first-person spin-off of Piss Gnomes, styled like a PS2 Katamari game (candy colours, chunky low-poly, pastel UI) made for phones and tablets. Fifty gnomes, one huge enchanted forest,
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
  shouting his own name. Say hi by walking up close to him (he shows as a gold diamond on the minimap) and he gives you **Wizard Mode**: 20
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
- **Start screen:** a swipeable How To Play slider (arrows, dots and swipe).
- **Speech bubbles** fade with distance, and the beetles are smaller.
- **Say hi to Nathaniel:** get within a few steps and your gnome says hi; he answers "Nathaniel!" and hands out Wizard Mode.
- **Smoother, softer picture:** filtered grass, higher render resolution, anti-aliasing, a subtle ink outline around every shape
  (found from the depth buffer, so it also catches the farting beetles and the gnomes), and a lens flare from the sun that is hidden
  when a mushroom cap is in the way.
- **Tuned to your device:** at start the game picks a quality level from the hardware (`?quality=low|mid|high` to force one;
  see the console for why). While you play a frame-time governor lowers the render resolution, then turns the post pass off, if frames run slow,
  and brings the sharpness back when there is headroom. 120 Hz screens are held to about 60 fps, and the screen is kept awake during a match.
- **50 players, big map:** the forest is about five times the area (180 x 180) with roughly 480 mushrooms, 30 potions and 18 beetles. 49 bots
  spawn on three rings; some hunt for a fight, others wander and grab pickups. The mist now starts after 45 s and takes 5 minutes to close.
  Far-away gnomes are not drawn, models and bug/bottle meshes are shared and merged, and droplet hits use a neighbour grid, so 50 gnomes stay cheap.
- **Six modes:** the three new ones are **Upside Down** (the whole picture flips 180 degrees, and left/right and up/down on your controls swap
  so they still feel right on screen), **Moon** (low gravity: jumps are about 7 units high and streams fly about three times as far, under a star sky with the Earth
  hanging in it) and **Slippery** (everyone skids as if on ice, under a frosty aurora sky). Each has its own sky, lighting, colour grade, music and banter.
- **A Fortnite-style island:** the map is now an island with hills, lakes, a river and the sea around it, and twelve named places:
  Pee-nacle Peak (a pavilion on the summit), Soggy Bottom (a lake with a hut island), Stonehedge, Tinkle Town (a village round a fountain),
  Gnome Depot (a warehouse and crates), Chili Fields (a barn and crops), Puddle Pond, Dribble Falls, Sunbathing Shores (beach umbrellas),
  Ice Wee Glacier, Acid Swamp (green pools) and Wee Woods (a thick mushroom forest). Names float over each place and pop up when you
  arrive; tap the minimap (or press M) for the big map. Wading slows you and refills your bladder, and the deep sea is off limits.
  Heights are one function in `src/map.ts`, used by the terrain mesh, the colliders, droplets, bots and the minimap.
