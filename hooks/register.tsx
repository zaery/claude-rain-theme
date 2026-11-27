import type { Register, ThemeSetArgs, ThemeSound } from 'claude-code'

import { makeColors } from './make-colors.js'

// Slate and rain-cloud blues: a grey afternoon by day, a wet street at night.
// The surfaces drift slowly through three storm tints (slate, indigo, steel
// teal) while the text colors stay fixed, so the panels pulse but stay readable.
type Surfaces = readonly [string, string, string, string]

const STORM_LIGHT: Surfaces[] = [
  ['#dde4ea', '#e6ecf1', '#eff3f6', '#eff3f6'], // slate
  ['#d9dcec', '#e3e5f2', '#eceef7', '#eceef7'], // indigo
  ['#d7e5e6', '#e1edee', '#ebf4f4', '#ebf4f4'], // steel teal
]
const STORM_DARK: Surfaces[] = [
  ['#10171f', '#151e28', '#1a2530', '#1f2b37'], // slate
  ['#131629', '#191d33', '#1e233c', '#232944'], // indigo
  ['#0d1a1d', '#122226', '#17292e', '#1c3036'], // steel teal
]

// One full cycle through the three tints, in this many steps, one step per tick.
const STEPS = 24
const TICK_MS = 2000

const hexMix = (a: string, b: string, t: number) => {
  const ch = (s: string, i: number) => parseInt(s.slice(1 + i * 2, 3 + i * 2), 16)
  let out = '#'
  for (let i = 0; i < 3; i++) {
    out += Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t).toString(16).padStart(2, '0')
  }
  return out
}

// Where step `i` sits in the cycle: between which two tints, eased so it breathes.
const surfacesAt = (set: Surfaces[], i: number): Surfaces => {
  const pos = (i / STEPS) * set.length
  const from = Math.floor(pos) % set.length
  const to = (from + 1) % set.length
  const t = (1 - Math.cos((pos - Math.floor(pos)) * Math.PI)) / 2
  const a = set[from]!
  const b = set[to]!
  return [hexMix(a[0], b[0], t), hexMix(a[1], b[1], t), hexMix(a[2], b[2], t), hexMix(a[3], b[3], t)]
}

const paletteAt = (i: number) => {
  const l = surfacesAt(STORM_LIGHT, i)
  const d = surfacesAt(STORM_DARK, i)
  return makeColors({
    label: 'Rain',
    roles: { accent: '#3f7cac', danger: '#b4473f', success: '#3f8a6a', warning: '#b07d2a', pro: '#6e64a8' },
    light: {
      gray: {
        anchors: {
          'surface-0': l[0],
          'surface-1': l[1],
          'surface-2': l[2],
          'text-primary': '#16212c',
          'text-secondary': '#3a4a5a',
          'text-muted': '#4f6072',
        },
      },
    },
    dark: {
      gray: {
        anchors: {
          'surface-0': d[0],
          'surface-1': d[1],
          'surface-2': d[2],
          'surface-3': d[3],
          'text-primary': '#e3ebf2',
          'text-secondary': '#bac8d5',
          'text-muted': '#93a4b5',
        },
      },
    },
  })
}

// Worked out once at load; a step the desktop app would refuse to paint is dropped.
const PALETTES = Array.from({ length: STEPS }, (_, i) => paletteAt(i))
const UNPAINTED = PALETTES.flatMap(p => p.problems.filter(line => line.startsWith("Desktop won't paint")))
const CYCLE = PALETTES.filter(p => !p.problems.some(line => line.startsWith("Desktop won't paint"))).map(p => p.theme)

// A small seeded random, so the rain falls the same way every load.
let seed = 7
const rand = () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}

const W = 1600
const H = 1000

// One layer of rain is one square tile of streaks, repeated over the window.
// Each streak is drawn twice, a tile apart, so the tile wraps without a seam.
// The filled rect slides down exactly one tile and loops. Tile sizes are
// primes so the three layers never line up into a visible grid.
type Layer = { name: string; tile: number; count: number; length: number; speed: number }

const LAYERS: Layer[] = [
  { name: 'far', tile: 173, count: 46, length: 34, speed: 500 },
  { name: 'mid', tile: 241, count: 54, length: 54, speed: 770 },
  { name: 'near', tile: 317, count: 44, length: 80, speed: 1180 },
]

const pattern = ({ name, tile, count, length }: Layer) => {
  let d = ''
  for (let i = 0; i < count; i++) {
    const x = Math.round(2 + rand() * (tile - 4))
    const y = Math.round(rand() * tile)
    const len = Math.round(length * (0.6 + rand() * 0.8))
    d += `M${x} ${y}v${len}M${x} ${y - tile}v${len}`
  }
  return `<pattern id="p${name}" patternUnits="userSpaceOnUse" width="${tile}" height="${tile}"><path class="r ${name}p" d="${d}"/></pattern>`
}

const sheet = ({ name, tile }: Layer) =>
  `<rect class="${name}" fill="url(#p${name})" x="-700" y="${-tile}" width="${W + 1400}" height="${H + tile * 2}"/>`

// The app redraws the scene each time the theme is set, which would restart
// every animation. So each one starts already partway through its loop, by
// however far the clock says it should be: a redraw then carries on in place.
const into = (nowMs: number, periodS: number) => `-${((nowMs / 1000) % periodS).toFixed(3)}s`

const motion = (nowMs: number) => ({ name, tile, speed }: Layer) => {
  const d = tile / speed
  return (
    `.${name}{animation:f${name} ${d.toFixed(3)}s linear ${into(nowMs, d)} infinite}` +
    `@keyframes f${name}{from{transform:translateY(0)}to{transform:translateY(${tile}px)}}`
  )
}

// An alternating loop takes two lengths to come back to where it started.
const drift = (nowMs: number) =>
  `.drift{animation:drift 70s ease-in-out ${into(nowMs, 140)} infinite alternate}` +
  `.drift2{animation:drift 95s ease-in-out ${into(nowMs, 190)} infinite alternate-reverse}`

// Droplets beading on the glass, near the edges so the words stay clear.
const beads = () => {
  let out = ''
  for (let i = 0; i < 46; i++) {
    const left = rand() < 0.5
    const x = Math.round(left ? rand() * 260 : W - rand() * 260)
    const y = Math.round(rand() * H)
    const r = (1.2 + rand() * 3.2).toFixed(1)
    out += `<circle class="bead" cx="${x}" cy="${y}" r="${r}"/>`
  }
  return out
}

const SCENE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
<style>
.s0{stop-color:#c3ced8}.s1{stop-color:#dfe6ec}
.f0{stop-color:#ffffff;stop-opacity:.4}.f1{stop-color:#ffffff;stop-opacity:0}
.r{fill:none;stroke-linecap:round;stroke:#5a7086}
.farp{stroke-width:1.3;opacity:.08}.midp{stroke-width:1.8;opacity:.1}.nearp{stroke-width:2.4;opacity:.12}
.bead{fill:#ffffff;opacity:.45;stroke:#7d93a8;stroke-width:.6;stroke-opacity:.35}
MOTION_RULES
@keyframes drift{from{transform:translateX(-120px)}to{transform:translateX(120px)}}
@media (prefers-color-scheme: dark){
.s0{stop-color:#0b1118}.s1{stop-color:#172331}
.f0{stop-color:#2a3b4e;stop-opacity:.5}.f1{stop-color:#2a3b4e;stop-opacity:0}
.r{stroke:#4d6278}
.farp{opacity:.1}.midp{opacity:.13}.nearp{opacity:.16}
.bead{fill:#2c3c4d;opacity:.4;stroke:#4d6278;stroke-opacity:.35}
}
</style>
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="s0"/><stop offset="1" class="s1"/></linearGradient>
${LAYERS.map(pattern).join('\n')}
<radialGradient id="fog"><stop offset="0" class="f0"/><stop offset="1" class="f1"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
<ellipse class="drift" fill="url(#fog)" cx="400" cy="760" rx="700" ry="160"/>
<ellipse class="drift2" fill="url(#fog)" cx="1250" cy="300" rx="650" ry="140"/>
<g transform="rotate(8 ${W / 2} ${H / 2})">
${LAYERS.map(sheet).join('\n')}
</g>
${beads()}
</svg>`

const SOUND: ThemeSound = {
  ambience: {
    layers: [
      // the steady hush of rain
      { wave: 'pink', drone: true, gain: 0.22, filter: { type: 'lowpass', hz: 2400, to: 1600 } },
      // a low wash under it
      { wave: 'brown', drone: true, gain: 0.14, filter: { type: 'lowpass', hz: 400 } },
      // drops ticking on the window
      { wave: 'crackle', scatter: 4, gain: 0.12, attack: 0.002, release: 0.08, filter: { type: 'highpass', hz: 1800 } },
      // the odd far-off roll of thunder
      { wave: 'brown', scatter: 0.02, gain: 0.18, attack: 0.8, release: 3, filter: { type: 'lowpass', hz: 160 } },
    ],
    reverb: 0.25,
  },
  cues: {
    send: { layers: [{ wave: 'sine', notes: ['A5'], glide: -7, gain: 0.25, attack: 0.003, release: 0.18 }] },
    tool: { layers: [{ wave: 'crackle', gain: 0.12, attack: 0.002, release: 0.05, filter: { type: 'highpass', hz: 2500 } }] },
    done: {
      layers: [{ wave: 'bell', notes: ['E5', 'B5', 'G#5'], step: 0.16, gain: 0.22, release: 0.9 }],
      reverb: 0.3,
    },
    ask: { layers: [{ wave: 'bell', notes: ['C#6', 'E6'], step: 0.12, gain: 0.2, release: 0.6 }] },
    error: { layers: [{ wave: 'triangle', notes: ['D4', 'A3'], step: 0.14, gain: 0.2, release: 0.35 }] },
    click: { layers: [{ wave: 'sine', notes: ['E5', 'G5', 'A5', 'B5', 'D6', 'E6'], glide: -5, gain: 0.2, release: 0.25 }] },
  },
}

const lookAt = (step: number, withSound: boolean): ThemeSetArgs => ({
  colors: CYCLE[step % CYCLE.length],
  backdrop: { scene: 'rain', glass: { blur: 0, opacity: 0.22 } },
  ...(withSound ? { sound: SOUND } : {}),
})

let pulse: { cancel: () => void } | undefined

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    if (UNPAINTED[0] !== undefined) {
      $.ui.toast(`${UNPAINTED.length} pulse steps dropped: ${UNPAINTED[0]}`)
    }

    // Sound is unchanged from one step to the next, so it keeps playing through.
    let withSound = true
    let set
    try {
      set = await $.theme.set(lookAt(0, true))
    } catch (error) {
      $.ui.log(String(error))
      withSound = false
      set = await $.theme.set(lookAt(0, false))
    }
    if (!set.isDrawn) {
      $.ui.status(set.reason)
    }

    // The panels breathe: one step along the storm cycle per tick.
    pulse?.cancel()
    let step = 0
    if (CYCLE.length > 1) {
      pulse = $.clock.every(TICK_MS, () => {
        step = (step + 1) % CYCLE.length
        $.theme.set(lookAt(step, withSound)).catch(error => $.ui.log(String(error)))
      })
    }

    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') {
      return next(e)
    }
    const { Svg } = $.ui.resolve(e)
    const now = await $.clock.now()
    const source = SCENE.replace('MOTION_RULES', LAYERS.map(motion(now)).join('\n') + '\n' + drift(now))
    return <Svg source={source} alt="Rain falling past a misty window" />
  })
}
