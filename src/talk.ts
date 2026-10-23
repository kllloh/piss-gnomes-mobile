import * as THREE from 'three';
import type { Gnome, Mod, Say } from './gnomes';

/** Everything the gnomes shout. Lines under 'what:mod' are only used while that silly mode is on. */
export const LINES: Record<string, string[]> = {
  spot: [
    'FOUND YOU, YOU DAMP LITTLE MAN!', 'Oi! Is that a gnome or a puddle?', 'I smell pee. Mostly mine.', 'Come here and be moist!',
    'Target acquired. Bladder armed.', 'You look dry. FIXING THAT.', 'My bladder has a message for you.', 'Gnome on the horizon! Hat first!',
    'HELLO FRIEND. PREPARE TO BE SPRINKLED.', 'I have been SAVING this for you.', 'A challenger! Smells like cabbage!', 'Behold! The Fountain of Doom!',
  ],
  hit: [
    'AAAH! WARM!', 'Is that... tea?!', 'My hat! MY HAT!', 'Not the beard!', 'I did NOT consent to this!', 'Squelch!', 'That was a lot of pee!',
    'Oof! Right in the moustache!', 'MY SOCKS ARE DISGUSTED.', 'Ow! Tickly!', 'I am soaked and I am furious!', 'Mamma mia, that is aromatic!',
    'You absolute splash goblin!', 'Hot hot HOT... oh. Just pee.', 'Dripping with RAGE!',
  ],
  kill: [
    'GET WRECKED, SPRINKLEBOTTOM!', 'Another one drowned in glory!', 'Hydration complete.', 'Rinse and repeat!', 'FLUSHED.', 'Take that to your grave!',
    'Puddle for a puddle!', 'I am the wettest gnome alive!', 'Bye bye, soggy boy!', 'That is what you get for being crunchy!', 'GG. Go wee.',
    'Who is next?! WHO IS DAMP?!', 'Rest in pee.', "Told you not to slip!", 'Taste the rainbow, loser!', 'That puddle is your grave!',
  ],
  death: [
    'TELL MY MUM... I WAS FLUSHED!', 'I regret NOTHING! ...okay, a bit.', 'MY BEARD! IT BURNS WITH SHAME!', 'Aaaaarrgh, not like this!', 'I should have gone before we left!',
    'Cheerio, cruel forest!', 'BLEURGH!', 'I SEE THE GREAT PORTA-LOO IN THE SKY!', 'Gnooooo!', 'Tell the mushrooms... I loved them.', 'I was only here for the snacks!',
    'Splorch!', 'It was all a dream. A WET dream.', 'I die as I lived: confused.', 'Avenge me! Or do not! Whatever!', 'The beard goes with me!', 'EEEEEEEEP!',
    'Fare thee well, ye damp world!', 'I am going to a better puddle!', 'Mum said there would be snacks!', 'That is a LOT of liquid!', 'Hat... off... to you...',
  ],
  burn: [
    'MY BUM IS ON FIRE!', 'That was CHILI?! RUDE!', 'Spicy! SPICY!!', 'Hot wee! HOT WEE!', 'Call the fire brigade! Or the wee brigade!',
    'I am a flaming gnome!', 'Who put jalapenos in the pee?!', 'Pepper spray but WORSE!',
  ],
  freeze: [
    'I cannot feel my beard!', 'Brrrrrr... frozen... wee...', 'I am a gnome-sicle!', 'Frozen solid! Tell nobody!', 'WHY IS THE PEE ICE?!', 'My bits have gone crunchy!',
  ],
  melt: [
    'I am MELTING! MELTIIIING!', 'Acid pee?! WHO RAISED YOU?!', 'My hat is dissolving!', 'Bubbling! I am bubbling!', 'Ow ow ow, sizzle sizzle!',
  ],
  lowhp: [
    'I am a bit damp and a bit dying!', 'Send snacks! And health!', 'Please stop! I will give you a hat!', 'Mummy? MUMMY?!', 'I am fine! I am FINE! (I am not fine.)',
    'One more drop and I am gone!', 'I am held together by moss!', 'Ten out of ten, would not recommend.',
  ],
  dry: [
    'Out of wee!', 'Bladder empty! Send water!', 'Running on fumes!', 'Anybody got a tinnie?!', 'Dry as a gnome biscuit!', 'I need a drink! For science!', 'The tank is dry!',
  ],
  idle: [
    'I think the mushrooms are watching me.', 'Is this a forest or a very big salad?', 'La la la, I love peeing.', 'Does anyone else hear the trees breathing?',
    'I named my hat Derek.', 'I wonder what the moon tastes like.', 'This beard is itchy and I like it.', 'My knees say hello.', 'Squelch squelch squelch.',
    'I saw a worm. It saw me. We both screamed.', 'Anyone for a game of hide and pee?', 'The mist is just spicy clouds.', 'I cannot remember why I am here.',
    'Hey! The grass is looking at me funny!', 'I would murder a sandwich.', 'Gnome sweet gnome.', 'Time for a wee. As usual.', 'Are mushrooms people?',
    'I gnu it! I GNU IT!', 'This forest is NOT up to code.', 'My bladder is a rich tapestry.',
  ],
  taunt: [
    'Taste the rainbow!', "Don't slip!", 'Pee on me, I dare you!', 'Is that all you have?!', 'My granny pees harder than that!', 'Come at me, tiny bladder!',
    'WHO WANTS SOME?!', 'I have seen moister puddles!', 'Watch your step, puddle ahead!', 'Slippery when wet!', 'Hope you brought a mop!', 'Say ahhh!',
    'Open wide!', 'Drink up, buttercup!', 'Bottoms up!', 'Gotcha, splashy pants!', 'Rainbow incoming! Yellow edition!', 'Hydrate or diedrate!',
    "Mind the puddle!", "Don't slip on my masterpiece!", 'Pee-kaboo!', 'You wee like a duck!', 'Taste the rainbow! The yellow bit!',
    'Careful, it is a bit slippy!', 'Wet floor! Wet floor!', 'Here comes the sunshine shower!',
  ],
  'taunt:disco': ['Taste the DISCO rainbow!', 'Boogie in the puddle!', "Don't slip on the dance floor!", 'Shake it, wet it!'],
  'taunt:goth': ['Taste the void.', "Don't slip into the abyss.", 'Everything is damp. Everything.', 'Embrace the puddle.'],
  'taunt:bogan': ['Taste the tinnie, mate!', "Don't slip on me thongs!", 'Chuck a wee, ya drongo!', 'Taste the rainbow, ya galah!'],
  'energy:bonus': ['WHITE MONSTER! Glug glug glug!', 'I can see through time!', 'INFINITE PEE! DOUBLE PEE!', 'My bladder has no bottom!', 'ENERGY! I AM ENERGY!', 'Is my heart supposed to do that?'],
  'speed:bonus': ['ZOOOOOM!', 'Gotta go fast!', 'My legs have opinions!', 'Nyoooom!', 'I AM THE WIND! DAMP WIND!'],
  'health:bonus': ['Ahhh, bug-fart vitamins!', 'I feel brand new! And smelly!', 'Healed by a bottom! Science!', 'Aaah, fresh!'],
  'bounce:bonus': ['BOING BOING BOING!', 'I am a gnome-ball!', 'Wheeeeee! BOUNCE!', 'My knees are springs!', 'Hop hop HOP!'],
  'gulp:bonus': ['BIG GULP! Glug glug!', 'Bladder full! Bring it ON!', 'Unlimited wee! Unlimited!', 'I am a fountain!'],
  'bug:fart': [
    'Did that bug just FART?!', 'BUG! WHAT DID YOU EAT?!', 'That is NOT a normal smell!', 'Whoever smelt it, dealt it. WAIT, THE BUG!', 'The bug did a toot!',
    'It is raining prizes from a bum!', 'Free stuff from a bottom! Forest rules!', 'I smell... opportunity. And eggs.', 'The air is green and I like it!',
  ],
  'mix:potion': [
    'COCKTAIL TIME! Shake it, don\'t stir it!', 'I am a walking chemistry set!', 'Two potions! TWO!', 'What happens if I mix them? SCIENCE!', 'This pee has LAYERS!',
    'I have mixed the pee of destiny!', 'Mixology! Wee-ology!', 'Oh no. Oh YES. Mixed wee!',
  ],
  'hi:nathaniel': ['Hi Nathaniel!', 'Hello, Nathaniel!', 'Heyyy Nathaniel!', 'Hi! Hi! Hi Nathaniel!', 'Nice glasses, Nathaniel!'],
  mist: [
    'THE MIST! IT GROWS!', 'The forest has had ENOUGH of us!', 'Magenta fog! Somebody call a wizard!', 'The mist is hungry!', 'Run! Walk! Panic!',
  ],
  // --- disco mode ---
  'idle:disco': ['Boogie fever! Wee fever!', 'Stayin\' alive! Barely!', 'Do the pee-ga!', 'Funky town, population: damp.', 'Where is the glitter ball?! I need it!', 'Shake that groove thing, gnome!'],
  'hit:disco': ['Not on the sequins!', 'My disco pants!', 'Too wet to boogie!', 'Ow! My groove!'],
  'death:disco': ['The disco is over!', 'I die dancing!', 'Turn the music... up...', 'Stayin\' dead!', 'Last dance... SPLASH!'],
  'kill:disco': ['Boogie down, buddy!', 'That was a smooth move!', 'DANCE FLOOR CLOSED!'],
  // --- upside down mode ---
  'idle:upside': ['Why is the sky down there?', 'My hat is falling UP!', 'I feel dizzy and right-side-wrong.', 'Which way is up? Is it the other way?', 'The ground is where the sky should be!'],
  'hit:upside': ['Ow! Upside down OW!', 'My blood is rushing to my beard!', 'That hit me from below! Above!'],
  'death:upside': ['I fell... up...', 'Tell them I went the wrong way!', 'Down is the new up!'],
  'kill:upside': ['Flipped you!', 'Turned that frown upside down. And dead.', 'Gravity wins again!'],
  'taunt:upside': ["Taste the upside-down rainbow!", "Don't slip, ceiling is wet!", 'Which way is the puddle? Haha!'],
  // --- moon mode ---
  'idle:moon': ['I weigh nothing! NOTHING!', 'Floaty! I am floaty!', 'One small step for a damp gnome.', 'Is that Earth? It looks wet!', 'I can see my house from here! Oh no, that is a mushroom.'],
  'hit:moon': ['Ow! In space!', 'A moon splash!', 'Houston, I am damp!'],
  'death:moon': ['I am one with the moon dust...', 'Tell Earth I said hi...', 'To infinity and... splat!'],
  'kill:moon': ['Moon-walked all over you!', 'Out of this world!', 'Lunar tinkle!'],
  'taunt:moon': ['Taste the rainbow, from orbit!', "Don't slip, there is no gravity!", 'Incoming from space!'],
  // --- slippery mode ---
  'idle:slippery': ['Wheeee! I cannot stop!', 'My feet have a mind of their own!', 'Why is everything so slidey?', 'Ice skating, gnome style!', 'Where are the brakes?!'],
  'hit:slippery': ['Ooh, I am sliding!', 'Slipped! On my own pee!', 'Wipe out!'],
  'death:slippery': ['I slipped... right out of existence!', 'My last slide!', 'Aaaaah... slooooping...'],
  'kill:slippery': ['Slip, slide, splash!', 'You slipped on my wee!', 'Told you not to slip!'],
  'taunt:slippery': ["Don't slip! Too late!", 'Taste the rainbow, ice skater!', 'Careful, it is slippery! Hehe!'],
  // --- goth mode ---
  'idle:goth': ['Nothing matters. Also, my feet are wet.', 'The darkness gets me. Also, a rash.', 'I feel things. Mostly damp.', 'Life is pain. And mildew.', 'Why do I even bother peeing?', 'My heart is a black hole. And my hat too.'],
  'hit:goth': ['It rains in my soul. And my pants.', 'Pain is just poetry.', 'Ugh. Whatever.', 'Eternal sorrow! And wetness!'],
  'death:goth': ['Finally. Sweet release.', 'Darkness takes me. Again.', 'Nobody understood me. Splash.', 'Tell my cat I was sad.', 'I was already dead inside. Now OUTSIDE.', 'Bury me in black socks.'],
  'kill:goth': ['Another soul, drowned in sorrow.', 'Cry about it.', 'Dark. Damp. Done.'],
  // --- bogan mode ---
  'idle:bogan': ['Chuck us a tinnie, mate!', 'Ya shoulda seen the one that got away.', 'Strewth, it\'s a ripper of a day!', 'She\'ll be right, mate!', 'Wanna go the Maccas run after this?', 'Yeah nah, yeah.', 'Hold my beer, I\'m peeing.', 'Bonza! BONZA!', 'Fair dinkum! A real stinker of a forest!', 'Can\'t see me mullet? That\'s cause it\'s INVISIBLE.'],
  'hit:bogan': ['Ya cheeky mongrel!', 'Strewth, mate!', 'Me thongs! Me THONGS!', 'Oi! Me tinnie!', 'Yeah nah, that stung!'],
  'death:bogan': ['Tell the missus I love her... and the ute!', 'Struth, I\'ve carked it!', 'Me mullet! Me MULLET!', 'See ya in the arvo!', 'Dead as a doornail, mate!', 'I\'m off to the great servo in the sky!', 'Not me thongs!'],
  'kill:bogan': ['GOOD ON YA, MATE! ...I mean, bad.', 'Rack off!', 'Too easy, ya drongo!', 'That\'s ya lot, mate!'],
};

const BANNER_SUB: Record<Mod, string[]> = {
  upside: ['EVERYTHING IS UPSIDE DOWN! Even the pee!', 'The world flipped! Controls too!', 'Hold on to your hat, gravity has opinions!'],
  moon: ['Low gravity! Streams fly three times as far!', 'One small step for gnomes!', 'Moon mode! Jump high, pee far!'],
  slippery: ['Slip and slide! Everybody skids!', 'Wet floor! Very wet floor!', 'Ice everywhere! Steer carefully!'],
  disco: ['Everybody boogie! Pee faster, groove harder.', 'The glitter ball has arrived!', 'Disco inferno! Fast feet, fast flow!'],
  goth: ['Nothing matters. Health does not creep back.', 'Darkness descends. Hope is for the damp.', 'Eternal gloom. No healing allowed.'],
  bogan: ['Chuck us a tinnie! Bladder lasts longer, aim goes wonky.', 'Cheers, mate! Drunk aim, big bladder!', 'Bogan hour! Ripper bladder, wobbly stream!'],
};
export function modTagline(m: Mod): string {
  const l = BANNER_SUB[m];
  return l[Math.floor(Math.random() * l.length)];
}

interface Bubble {
  g: Gnome | null;
  pos: THREE.Vector3;
  y: number;
  el: HTMLElement;
  t: number;
}

const _v = new THREE.Vector3();

/** Speech bubbles over heads, the player's own lines at the bottom of the screen, and silly voices. */
export class Banter {
  private bubbles: Bubble[] = [];
  private last = new Map<number, number>();
  private now = 0;
  private lastAny = -9;
  private chatterTimer = 0;
  voices = true;

  constructor(private layer: HTMLElement, private chatter: HTMLElement, private player: Gnome) {}

  /** A gnome says something, if it has not just spoken. `force` skips the per-gnome pause (deaths, kills). */
  say(g: Gnome, what: Say, mod: Mod | null, force = false) {
    const gap = this.now - (this.last.get(g.id) ?? -9);
    if (!force && gap < 3.2) return;
    if (!force && this.now - this.lastAny < 0.35) return;
    let key: string = what;
    if (mod && LINES[`${what}:${mod}`] && Math.random() < 0.55) key = `${what}:${mod}`;
    const pool = LINES[key] ?? LINES[what];
    if (!pool) return;
    this.speak(g, pool[Math.floor(Math.random() * pool.length)], force || what === 'death' || what === 'kill');
  }

  /** Say a particular line (potion pickups and so on). */
  sayLine(g: Gnome, key: string) {
    const pool = LINES[key];
    if (pool) this.speak(g, pool[Math.floor(Math.random() * pool.length)], true);
  }

  private speak(g: Gnome, text: string, loud: boolean) {
    this.last.set(g.id, this.now);
    this.lastAny = this.now;
    if (g.isPlayer) {
      this.chatter.textContent = text;
      this.chatter.style.opacity = '1';
      clearTimeout(this.chatterTimer);
      this.chatterTimer = window.setTimeout(() => (this.chatter.style.opacity = '0'), 2400);
    } else {
      // one bubble per gnome, at most six on screen
      const old = this.bubbles.find((b) => b.g === g);
      if (old) { old.el.remove(); this.bubbles.splice(this.bubbles.indexOf(old), 1); }
      if (this.bubbles.length >= 6) { this.bubbles[0].el.remove(); this.bubbles.shift(); }
      const el = document.createElement('div');
      el.className = 'bubble';
      el.textContent = text;
      el.style.borderColor = '#' + g.color.toString(16).padStart(6, '0');
      this.layer.appendChild(el);
      this.bubbles.push({ g, pos: g.pos, y: 4.4, el, t: 2.8 });
    }
    // voices: deaths and the player's own lines, and only things near enough to hear
    if (this.voices && loud && 'speechSynthesis' in window) {
      const d = Math.hypot(g.pos.x - this.player.pos.x, g.pos.z - this.player.pos.z);
      if (g.isPlayer || d < 38) this.voice(g, text);
    }
  }

  /** A shout from something that is not a gnome (Nathaniel): a bubble at `pos`, and a deep voice. */
  shout(pos: THREE.Vector3, y: number, text: string, color: number, deep: boolean) {
    const el = document.createElement('div');
    el.className = 'bubble big';
    el.textContent = text;
    el.style.borderColor = '#' + color.toString(16).padStart(6, '0');
    this.layer.appendChild(el);
    this.bubbles.push({ g: null, pos, y, el, t: 2.4 });
    if (this.voices && 'speechSynthesis' in window) {
      try {
        const ss = window.speechSynthesis;
        ss.cancel(); // he is more important than the gnomes
        const u = new SpeechSynthesisUtterance(text);
        u.pitch = deep ? 0.3 : 1;
        u.rate = 0.8;
        u.volume = Math.max(0.2, 1 - Math.hypot(pos.x - this.player.pos.x, pos.z - this.player.pos.z) / 55);
        ss.speak(u);
      } catch { /* the bubble is enough */ }
    }
  }

  private voice(g: Gnome, text: string) {
    const ss = window.speechSynthesis;
    try {
      if (ss.pending || ss.speaking) return; // one at a time, or the queue falls behind the fight
      const u = new SpeechSynthesisUtterance(text);
      const v = ss.getVoices().filter((x) => x.lang.startsWith('en'));
      if (v.length) u.voice = v[g.id % v.length];
      u.pitch = 0.5 + ((g.id * 37) % 15) / 10; // 0.5 .. 1.9
      u.rate = 1.05 + ((g.id * 13) % 6) / 10;
      const d = Math.hypot(g.pos.x - this.player.pos.x, g.pos.z - this.player.pos.z);
      u.volume = g.isPlayer ? 0.9 : Math.max(0.12, 0.8 * (1 - d / 42)); // speech cannot be panned, but it can fade with distance
      ss.speak(u);
    } catch { /* some browsers refuse; the bubbles are enough */ }
  }

  setVoices(on: boolean) {
    this.voices = on;
    if (!on && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  clear() {
    for (const b of this.bubbles) b.el.remove();
    this.bubbles.length = 0;
    this.chatter.style.opacity = '0';
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  update(dt: number, camera: THREE.Camera) {
    this.now += dt;
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.t -= dt;
      if (b.t <= 0) { b.el.remove(); this.bubbles.splice(i, 1); continue; }
      _v.set(b.pos.x, b.g ? (b.g.alive ? 4.4 : 2) : b.y, b.pos.z);
      const dist = _v.distanceTo(camera.position);
      _v.project(camera);
      const vis = _v.z < 1 && Math.abs(_v.x) < 1.15 && Math.abs(_v.y) < 1.1 && dist < 34;
      // the further away somebody is, the fainter their words
      const near = Math.max(0.12, Math.min(1, 1 - (dist - 5) / 27));
      b.el.style.opacity = vis ? String(Math.min(1, b.t * 2) * near) : '0';
      const sc = Math.max(0.6, Math.min(1.1, 14 / dist + 0.35));
      b.el.style.transform = `translate(-50%, -100%) translate(${(_v.x * 0.5 + 0.5) * w}px, ${(-_v.y * 0.5 + 0.5) * h}px) scale(${sc})`;
    }
  }
}
