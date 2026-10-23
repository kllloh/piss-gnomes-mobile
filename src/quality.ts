/**
 * Picks how hard to push this device. Phones, tablets and computers differ a lot, so the game starts at a level that
 * suits the hardware and then adjusts itself while you play (see the frame-time governor in main.ts).
 */
export type Tier = 'low' | 'mid' | 'high';

export interface Quality {
  tier: Tier;
  /** Highest and lowest render scale the governor may use (1 = one pixel per CSS pixel). */
  ratioMax: number;
  ratioMin: number;
  /** Render through the post pass (outlines and colour effects). Off on weak devices. */
  post: boolean;
  /** MSAA samples inside the post pass. */
  samples: number;
  /** The lens flare overlay. */
  flare: boolean;
  /** Floating spores in the low-health trip. */
  spores: number;
  /** How far away things are drawn (and where the fog ends). */
  drawDist: number;
  /** Why this tier was chosen, for the console. */
  why: string;
}

function gpuName(): string {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl') || c.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch {
    return '';
  }
}

export function detectQuality(): Quality {
  const forced = new URLSearchParams(location.search).get('quality');
  const dpr = window.devicePixelRatio || 1;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
  const gpu = gpuName();
  const ua = navigator.userAgent;
  const apple = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  let score = 0;
  const notes: string[] = [];
  if (cores >= 8) { score += 2; notes.push('8+ cores'); } else if (cores >= 6) { score += 1; notes.push('6 cores'); } else if (cores <= 4) { score -= 1; notes.push('few cores'); }
  if (mem >= 6) score += 1; else if (mem <= 2) { score -= 2; notes.push('little memory'); }
  if (/Mali-[4T]|Adreno \(TM\) [2-5]\d\d|PowerVR|SwiftShader|llvmpipe|Software|Microsoft Basic/i.test(gpu)) { score -= 3; notes.push('weak GPU'); }
  if (/NVIDIA|GeForce|Radeon|Apple M\d|Adreno \(TM\) [67]\d\d|Mali-G[7-9]/i.test(gpu)) { score += 1; notes.push('strong GPU'); }
  if (apple && cores >= 6) { score += 1; notes.push('recent Apple chip'); }
  // enormous screens cost more to fill
  const pixels = window.screen.width * window.screen.height * dpr * dpr;
  if (pixels > 5.5e6 && score < 3) { score -= 1; notes.push('very large screen'); }

  let tier: Tier = score >= 2 ? 'high' : score >= 0 ? 'mid' : 'low';
  if (forced === 'low' || forced === 'mid' || forced === 'high') tier = forced;

  const q: Record<Tier, Omit<Quality, 'tier' | 'why'>> = {
    high: { ratioMax: Math.min(dpr, 2), ratioMin: 0.8, post: true, samples: 4, flare: true, spores: 240, drawDist: 115 },
    mid: { ratioMax: Math.min(dpr, 1.5), ratioMin: 0.7, post: true, samples: 2, flare: true, spores: 140, drawDist: 95 },
    low: { ratioMax: Math.min(dpr, 1), ratioMin: 0.6, post: false, samples: 0, flare: false, spores: 60, drawDist: 75 },
  };
  return { tier, ...q[tier], why: `${gpu || 'unknown GPU'}, ${cores} cores, ${mem}GB, dpr ${dpr}: ${notes.join(', ') || 'average'}` };
}
