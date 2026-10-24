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
- **Modes** change the rules, and a new one starts **every 20 seconds** (see Six modes below, now seven): **Disco** (faster, stronger streams, rainbow lights), **Goth** (dark, no
  health regeneration), **Turbo** (everybody runs 1.5x and pees faster, wide-angle zoom blur) and **Inferno** (every stream is chilli pee, so everybody burns). Each has its own music.
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
- **Choose your spawn:** tap PLAY and you get the island map: tap a named place (or anywhere on land) and DEPLOY. You appear there with a
  3-second grace period; the other 49 gnomes are spread around the island's spawn points (never on top of you). There is no plane any more.
- **A bigger island (1.5x):** about 2.25 times the area (270 x 270), roughly 800 big mushrooms, 60 potions and 30 beetles. The mist starts after
  50 s and takes 5.5 minutes to close.
- **Tenchu: Stealth Assassins look:** the game is now a moonlit, foggy, 1998-console world. It renders at about 450 lines and is scaled up with hard
  pixels, vertex positions snap to a coarse grid so edges shimmer, colour is quantised to 15-bit with an ordered dither, and textures are nearest-filtered.
  The island is dark moss, mud and grey rock under a night sky with a pale moon; mushrooms have dull earthy caps; the buildings are
  weathered wood with black roofs, and warm stone lanterns glow around the places. The interface is ink, parchment and blood red (rice-paper speech bubbles,
  a red-sun title screen with the character for shinobi, serif type). The lens flare and outline are off in this look.
- **A fifth psychedelic, a tenth cyberpunk:** the swirling sky, drifting spores and gentle colour warp are always on at 20% (low health turns them up),
  and the post pass adds a 10% cyberpunk grade: teal shadows, magenta highlights, a little glow, scanlines on the low-res pixel rows and a hint of chromatic
  split. Some lanterns glow cyan or magenta, the place names are neon signs, and the depot, the fountain, the Peak pavilion and the standing stones have neon strips.
  It all happens in the low-res picture, so the pixel look stays.
- **Full cyberpunk interface:** every menu, control and HUD element is now neon-on-black: Monoton and Audiowide type, a menu with a magenta sun over a dark
  skyline and a neon grid, glass panels with cyan/magenta/yellow corner brackets, chamfered yellow and cyan buttons, a cyan joystick with a dashed magenta inner ring and a
  glowing knob, octagonal PEE and JUMP buttons, a reticle crosshair, segmented health and bladder bars, a minimap with a radar sweep, terminal-style
  speech bubbles and kill feed (`> ...`), a glitching banner, a faint scan-line sheet, and tactical-grid maps with neon labels and a targeting reticle for your spawn.
- **Auto-pee:** your gnome starts peeing by itself when an enemy is within range, roughly in front of you and not hidden behind a hill or a mushroom, and the stream drifts onto the target while it does.
  The **AUTO** button beside the sound button switches it off (it then says MAN) and the choice is remembered.
- **White Monster:** a rare white energy drink can (about one pickup in six, with a green slash design of its own) gives **an endless bladder and a double stream for 20 seconds**. Bots go for them too.
- **An icon for every power-up:** flame (Chili Wee), snowflake (Ice Wee), flask (Acid Pee), lightning bolt (Speed), medical cross (Health), spring (Bounce), cup (Big Gulp), wizard hat (Wizard Mode) and the white can (White Monster).
  The icons show in the pickup banners, on the active-effect pills, on the how-to chips and floating over every pickup in the world.

## Chaos update
- **Bogan mode is gone**, replaced by **Turbo** and **Inferno**. Modes now rotate every 20 seconds (the old one fades out, the next fades in), with the countdown in the chip under the mist timer.
- **More White Monsters:** about a third of all pickups are cans, there are 100 pickups (was 60) that respawn after 10 s, and every ~24 s a **White Monster Drop** turns seven pickups into cans (half of them near you).
- **More chaos:** 48 beetles that fart more often, the mist starts sooner and closes faster, 88% of bots hunt (was 60%) and hit a little harder, and bots chatter twice as often.
- **Costumes:** every gnome gets its own mix: ten hat styles (cone, stub, wizard, top hat, beanie, mohawk, party hat, crown, traffic cone, miner's helmet), ten beard colours, trousers, boots, skin tones, shades / eyepatch / goggles, capes / backpacks / wings, scarves and tutus, plus a different height and width.
- **No flicker:** removed the CSS scan-line sheet, the post-pass scan-lines, the beat strobes, the star twinkle and time-stepped sky glitter, the wobble in some modes, the glitch animation on titles, and the PlayStation vertex crawl (the snap grid is much finer now).
- **Clearer picture:** more lines on stronger devices (640 high / 540 mid / 450 low, was 450), lighter fog, finer colour steps, less glow, less chromatic fringing and a lighter vignette.
- **Start screen fits any phone:** the title, PLAY and how-to cards always fit one screen (cards scroll inside their box), in portrait and landscape, with safe-area padding and dynamic viewport height.

## Teams update
- **Smaller map, 20 gnomes:** the island is back to its original size (about two-thirds of the width it had), with object counts scaled to match; 19 bots plus you.
- **Soak a gnome and they join your team**, up to 5 per team. Teammates show cyan on the minimap and in the world, your streams (and fire) pass through them, bots never target them, and your bot teammates stick near you. Get soaked yourself and you join your attacker's team instead (a full team of five eliminates you). Only the mist eliminates for good. The last team standing wins.
- **Super crisp:** the picture now renders at the screen's full native resolution (up to 2x), with 4x (high) or 2x (mid) anti-aliasing, no colour dither, no sky banding, no vertex snapping and less lens wobble. The frame-time governor still backs off on slow devices.

## Gulag update
- **The first time you are soaked you go to the gulag:** a neon arena floating 70 units above the island. You wait for a 1v1 against the next gnome to be soaked, or against the **Gulag Guard** if nobody else is waiting (you always go next, ahead of the bots). The camera shows the current fight while you wait.
- **Win** and you drop back onto the island at a random spot with full health. **Lose** and whoever soaked you takes you onto their team (if it has room), otherwise you are out. A drawn fight is decided on health after 25 s. Soaked a second time, or caught by the mist, there is no gulag.
- Gulag fighters are on separate sides even if they are teammates, cannot pick anything up, and are not hurt by the mist. Fighters in the gulag count as still in the match, so the game only ends when the gulag is empty.
