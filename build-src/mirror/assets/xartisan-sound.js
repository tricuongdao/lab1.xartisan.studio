// Âm thanh không gian cho trang demo: mọi tiếng đều tổng hợp bằng Web Audio
// (không tải file), đặt vào không gian 3D theo vị trí phần tử trên màn hình.
// Trình duyệt chỉ cho phát sau thao tác đầu tiên (bấm/chạm/phím), nên trước đó
// nút âm thanh hiện dòng "Bật âm thanh" để mời khách bật.
{
  const STORAGE_KEY = "ximitech.sound"
  const toggle = document.querySelector(".sound-toggle")
  const AudioCtx = window.AudioContext || window.webkitAudioContext

  let wantsSound = true
  try {
    wantsSound = localStorage.getItem(STORAGE_KEY) !== "off"
  } catch (error) {
    // Không đọc được localStorage thì mặc định bật
  }

  let ctx = null
  let master = null
  let reverb = null
  let noiseBuffer = null
  let unlocked = false
  let lastPlay = 0

  const C4 = 261.63
  const hz = (semis) => C4 * Math.pow(2, semis / 12)
  // Ngũ cung Đô trưởng: các nốt nối nhau luôn nghe hài hoà
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]
  const noteHz = (step, base = 392) => base * Math.pow(2, SCALE[step % SCALE.length] / 12)
  const random = (min, max) => min + Math.random() * (max - min)

  const isRunning = () => unlocked && wantsSound && ctx?.state === "running"

  function setState() {
    if (!toggle) return
    const state = !wantsSound ? "off" : unlocked ? "on" : "locked"
    toggle.dataset.state = state
    toggle.setAttribute("aria-pressed", String(state === "on"))
  }

  function build() {
    ctx = new AudioCtx()

    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -18
    compressor.ratio.value = 4
    compressor.connect(ctx.destination)

    master = ctx.createGain()
    master.gain.value = 0.7
    master.connect(compressor)

    // Hồi âm phòng rộng: impulse là nhiễu tắt dần, tạo một lần
    const length = Math.floor(ctx.sampleRate * 2.4)
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const data = impulse.getChannelData(c)
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3.2)
      }
    }
    reverb = ctx.createConvolver()
    reverb.buffer = impulse
    const wet = ctx.createGain()
    wet.gain.value = 0.32
    reverb.connect(wet).connect(master)

    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const noise = noiseBuffer.getChannelData(0)
    for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1
  }

  // Nguồn âm 3D tại toạ độ (x, y, z) quanh người nghe; z âm là phía trước
  function spatialAt(x, y, z, bus = master) {
    const panner = ctx.createPanner()
    panner.panningModel = "HRTF"
    panner.distanceModel = "inverse"
    panner.refDistance = 1
    if (panner.positionX) {
      panner.positionX.value = x
      panner.positionY.value = y
      panner.positionZ.value = z
    } else {
      panner.setPosition(x, y, z)
    }
    panner.connect(bus)
    panner.connect(reverb)
    return panner
  }

  // Điểm phát 3D theo vị trí phần tử: trái/phải, trên/dưới, hơi lùi phía trước
  function spatial(rect) {
    const cx = rect ? (rect.left + rect.width / 2) / innerWidth : 0.5
    const cy = rect ? (rect.top + rect.height / 2) / innerHeight : 0.5
    const x = (Math.min(Math.max(cx, 0), 1) * 2 - 1) * 2.4
    const y = (1 - Math.min(Math.max(cy, 0), 1) * 2) * 1.2
    return spatialAt(x, y, -1.6)
  }

  function envelope(gain, t, peak, attack, release) {
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(peak, t + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + release)
  }

  // ---------- Bộ tiếng cơ bản ----------
  // Luồng gió: nhiễu qua bộ lọc quét tần số. Quét lên là "vào", quét xuống là "ra".
  function whoosh(out, t, { from = 300, to = 2600, dur = 0.55, peak = 0.22, attack = 0.45 } = {}) {
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer
    const filter = ctx.createBiquadFilter()
    filter.type = "bandpass"
    filter.Q.value = 0.9
    filter.frequency.setValueAtTime(from, t)
    filter.frequency.exponentialRampToValueAtTime(to, t + dur * 0.8)
    const gain = ctx.createGain()
    envelope(gain, t, peak, dur * attack, dur * (1 - attack))
    src.connect(filter).connect(gain).connect(out)
    src.start(t, random(0, 0.4))
    src.stop(t + dur + 0.05)
  }

  // Hạt "sột": một mẩu nhiễu cực ngắn, không cao độ, nên nhiều chữ cùng lúc
  // nghe như giấy/cát lướt chứ không thành một tràng nốt đàn chói tai.
  function grain(out, t, freq, peak, dur = 0.022) {
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer
    const filter = ctx.createBiquadFilter()
    filter.type = "bandpass"
    filter.frequency.value = freq
    filter.Q.value = 1.4
    const gain = ctx.createGain()
    envelope(gain, t, peak, 0.002, dur)
    src.connect(filter).connect(gain).connect(out)
    src.start(t, random(0, 0.9))
    src.stop(t + dur + 0.03)
  }

  // Tiếng chuông thuỷ tinh: sine + bồi âm, tắt dần
  function chime(out, t, freq, { peak = 0.12, dur = 1.4 } = {}) {
    ;[
      [1, 1],
      [2.01, 0.35],
      [3.98, 0.12],
    ].forEach(([ratio, level]) => {
      const osc = ctx.createOscillator()
      osc.type = "sine"
      osc.frequency.value = freq * ratio
      const gain = ctx.createGain()
      envelope(gain, t, peak * level, 0.008, dur / ratio)
      osc.connect(gain).connect(out)
      osc.start(t)
      osc.stop(t + dur + 0.05)
    })
  }

  // Tiếng marimba: nốt gốc tròn + bồi âm gõ tắt rất nhanh
  function pluck(out, t, freq, peak) {
    ;[
      [1, 1, 0.38],
      [4, 0.22, 0.05],
      [10, 0.06, 0.02],
    ].forEach(([ratio, level, release]) => {
      const osc = ctx.createOscillator()
      osc.type = "sine"
      osc.frequency.value = freq * ratio
      const gain = ctx.createGain()
      envelope(gain, t, peak * level, 0.003, release)
      osc.connect(gain).connect(out)
      osc.start(t)
      osc.stop(t + release + 0.05)
    })
  }

  function blip(out, t, freq, peak = 0.05, dur = 0.09) {
    const osc = ctx.createOscillator()
    osc.type = "sine"
    osc.frequency.setValueAtTime(freq, t)
    osc.frequency.exponentialRampToValueAtTime(freq * 1.25, t + dur)
    const gain = ctx.createGain()
    envelope(gain, t, peak, 0.004, dur)
    osc.connect(gain).connect(out)
    osc.start(t)
    osc.stop(t + dur + 0.05)
  }

  // Cú "hạ cánh" trầm của khối 3D: tần số rơi nhanh + lớp bụi sáng phía trên
  function impact(out, t) {
    const osc = ctx.createOscillator()
    osc.type = "sine"
    osc.frequency.setValueAtTime(120, t)
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.6)
    const gain = ctx.createGain()
    envelope(gain, t, 0.55, 0.01, 1.1)
    osc.connect(gain).connect(out)
    osc.start(t)
    osc.stop(t + 1.2)
    whoosh(out, t, { from: 120, to: 900, dur: 0.9, peak: 0.16 })
    ;[0, 2, 4, 7].forEach((step, i) => chime(out, t + 0.18 + i * 0.07, noteHz(step, 784), { peak: 0.05, dur: 2 }))
  }

  // Lá bài được chia: tiếng quét ngắn + tiếng gõ mặt bàn
  function deal(out, t) {
    whoosh(out, t, { from: 1400, to: 5200, dur: 0.16, peak: 0.12 })
    grain(out, t + 0.12, 900, 0.1, 0.04)
  }

  // Cánh cổng footer mở: gió cuộn lên, hợp âm dâng dần rồi toả ra
  function portal(out, t) {
    whoosh(out, t, { from: 150, to: 4200, dur: 1.6, peak: 0.16, attack: 0.7 })
    ;[0, 4, 7, 11, 14].forEach((semis, i) => chime(out, t + 0.5 + i * 0.09, hz(semis + 12), { peak: 0.06, dur: 2.6 }))
  }

  const SOUNDS = {
    hero: (out, t) => impact(out, t),
    title: (out, t, step) => {
      whoosh(out, t, { from: 220, to: 1800, dur: 0.7, peak: 0.18 })
      chime(out, t + 0.22, noteHz(step, 262), { peak: 0.1, dur: 1.8 })
    },
    sentence: (out, t) => whoosh(out, t, { dur: 0.45, peak: 0.12 }),
    // Chữ rời đi: gió quét xuống, tắt chậm trong hồi âm nên nghe "nhoè" dần
    leave: (out, t) => whoosh(out, t, { from: 2400, to: 260, dur: 0.8, peak: 0.08, attack: 0.15 }),
    card: (out, t) => deal(out, t),
    item: (out, t, step) => blip(out, t, noteHz(step, 660), 0.04, 0.14),
    finale: (out, t) => whoosh(out, t, { from: 200, to: 3200, dur: 1.4, peak: 0.14 }),
    footer: (out, t) => portal(out, t),
    hover: (out, t, step) => blip(out, t, noteHz(step, 1046), 0.025, 0.06),
    click: (out, t) => blip(out, t, 520, 0.08, 0.05),
  }

  function play(kind, el, step = 0, { force = false } = {}) {
    if (!isRunning()) return
    const now = ctx.currentTime
    // Nhiều thứ hiện cùng lúc thì chỉ phát cái đầu, tránh rối tai
    if (!force && now - lastPlay < 0.07) return
    lastPlay = now
    const rect = el?.getBoundingClientRect?.()
    SOUNDS[kind](spatial(rect), now + 0.01, step)
  }

  // ---------- Theo dõi lúc các chữ/khối xuất hiện ----------
  function effectiveOpacity(el) {
    let opacity = 1
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const style = getComputedStyle(e)
      if (style.visibility === "hidden" || style.display === "none") return 0
      opacity *= Number(style.opacity)
    }
    return opacity
  }

  function inView(el) {
    const r = el.getBoundingClientRect()
    if (!r.width && !r.height) return false
    return r.bottom > innerHeight * 0.08 && r.top < innerHeight * 0.92 && r.right > 0 && r.left < innerWidth
  }

  const visibleTest = (el) => inView(el) && effectiveOpacity(el) > 0.5

  // Câu trong phần Hành trình: từng chữ trượt lên từ dưới khung cắt,
  // nên coi là đã hiện khi chữ đầu về gần vị trí gốc.
  const letterTest = (el) => {
    const letter = el.querySelector(".letter")
    if (!letter || !inView(el)) return false
    return letterOffset(letter) < 0.35
  }

  // Footer nằm sẵn dưới cùng nhưng bị che bằng clip-path hình tròn bán kính 0,
  // chỉ lộ ra khi hình tròn nở to ở cuối trang.
  const footerTest = (el) => {
    if (!inView(el)) return false
    const clip = getComputedStyle(el).clipPath
    const radius = /circle\(([\d.]+)px/.exec(clip)
    return radius ? Number(radius[1]) > 120 : clip === "none"
  }

  const groups = [
    { selector: ".manifesto .text", kind: "title", step: 0, leave: true },
    { selector: ".entry .title", kind: "title", step: 2, leave: true },
    { selector: ".trajectory-sentences__sentence", kind: "sentence", test: letterTest, leave: true },
    { selector: ".toolkit__title", kind: "title", step: 4, leave: true },
    { selector: ".toolkit__subtitle", kind: "sentence", leave: true },
    { selector: ".toolkit-card:not(.toolkit-card--transition)", kind: "card" },
    { selector: ".projects__title", kind: "title", step: 1, leave: true },
    { selector: ".projects__link", kind: "item", ascending: true },
    { selector: ".next-section__intro", kind: "title", step: 3, leave: true },
    { selector: ".next-section__text", kind: "finale" },
    { selector: ".next-footer", kind: "footer", test: footerTest },
  ]

  const watched = []
  groups.forEach((group) => {
    document.querySelectorAll(group.selector).forEach((el, index) => {
      watched.push({
        el,
        kind: group.kind,
        leave: group.leave,
        test: group.test || visibleTest,
        step: group.ascending ? index : group.step || 0,
        shown: null,
      })
    })
  })

  // ---------- Từng chữ chạy ra/vào: tiếng "sột soạt" ----------
  const LETTER_TEXTS = [...document.querySelectorAll(".manifesto .text, .entry .title, .trajectory-sentences__sentence")]
  const letterState = new WeakMap()
  let nextGrainTime = 0

  // Độ lệch của chữ so với vị trí gốc, tính theo chiều cao chữ (0 là đã về chỗ)
  function letterOffset(letter) {
    let m
    try {
      m = new DOMMatrixReadOnly(getComputedStyle(letter).transform)
    } catch (error) {
      return 0
    }
    const h = letter.offsetHeight || 1
    return Math.max(Math.abs(m.m41) / h, Math.abs(m.m42) / h, Math.abs(m.m12) * 3)
  }

  // Chữ về chỗ: hạt sáng, giòn. Chữ bay đi: hạt trầm, khẽ hơn.
  function rustle(letter, arriving) {
    const now = ctx.currentTime
    const t = Math.max(now + 0.005, nextGrainTime)
    // Cuộn quá nhanh thì bỏ bớt hạt thay vì dồn hàng chờ
    if (t - now > 0.12) return
    nextGrainTime = t + random(0.014, 0.03)
    const freq = arriving ? random(2800, 6200) : random(1100, 2400)
    grain(spatial(letter.getBoundingClientRect()), t, freq, arriving ? 0.05 : 0.03)
  }

  function scanLetters(silent) {
    for (const text of LETTER_TEXTS) {
      const r = text.getBoundingClientRect()
      if (r.bottom < 0 || r.top > innerHeight) continue
      for (const letter of text.querySelectorAll(".letter")) {
        if (!letter.textContent.trim()) continue
        const offset = letterOffset(letter)
        const prev = letterState.get(letter)
        // Ngưỡng kép để chữ đang rung nhẹ quanh vị trí gốc không kêu liên tục
        const settled = offset < 0.06 ? true : offset > 0.25 ? false : prev
        if (!silent && prev !== undefined && settled !== prev) rustle(letter, settled)
        letterState.set(letter, settled)
      }
    }
  }

  // Dòng chữ uốn theo đường cong cuối trang: cuộn tới đâu, gió nhoè lướt theo tới đó
  const nextText = document.querySelector(".next-section__text")
  const nextOrb = document.querySelector("#nextOrb")
  let orbScroll = null

  function scanOrb() {
    if (!nextText || !inView(nextText)) return (orbScroll = null)
    if (orbScroll === null) orbScroll = scrollY
    const moved = scrollY - orbScroll
    if (Math.abs(moved) < 90) return
    orbScroll = scrollY
    const up = moved > 0
    whoosh(spatial(nextOrb?.getBoundingClientRect()), ctx.currentTime + 0.01, {
      from: up ? 700 : 1800,
      to: up ? 1800 : 700,
      dur: 0.35,
      peak: 0.07,
    })
  }

  const hero = document.querySelector("#hero")
  let heroShown = null

  function scan(silent = false) {
    if (!isRunning()) return
    scanLetters(silent)
    scanOrb()
    for (const item of watched) {
      const shown = item.test(item.el)
      // Lần quét đầu chỉ ghi nhận trạng thái, không phát cho thứ đã có sẵn trên màn hình
      if (item.shown === false && shown) play(item.kind, item.el, item.step)
      if (item.shown === true && !shown && item.leave) play("leave", item.el)
      item.shown = shown
    }
    if (hero) {
      const shown = hero.getBoundingClientRect().bottom > innerHeight * 0.6
      if (heroShown === false && shown) play("hero", hero.querySelector(".webgl"), 0, { force: true })
      heroShown = shown
    }
  }

  let scanTimer = null
  function startScanning() {
    if (scanTimer) return
    scan(true)
    scanTimer = setInterval(scan, 60)
  }
  function stopScanning() {
    clearInterval(scanTimer)
    scanTimer = null
    watched.forEach((item) => (item.shown = null))
    heroShown = null
  }

  // ---------- Nhạc nền tự sinh, dày dần theo từng section ----------
  // 92 BPM, vòng hợp âm Cmaj9 – Am7 – Fmaj7 – G6. Càng cuộn sâu càng thêm lớp:
  // 1 hero: tiếng nền · 2 giới thiệu: + bass đệm · 3 hành trình: + đàn rải xoay 3D
  // 4 công cụ: + trống · 5 dự án: + hi-hat, chuông đối đáp trái/phải
  // 6 cuối trang: + lấp lánh bay quanh đầu. Cuộn/rê chuột còn làm nhạc sáng và dồn hơn.
  const BPM = 92
  const STEP = 60 / BPM / 4
  const CHORDS = [
    [0, 4, 7, 11, 14],
    [-3, 0, 4, 7, 12],
    [-7, -3, 0, 4, 9],
    [-5, -1, 2, 7, 9],
  ]
  const ARP = [0, 2, 1, 3, 2, 4, 3, 1]
  const BELLS = [4, 2, 3, 1]
  const SECTIONS = [...document.querySelectorAll("#hero, #manifesto, #parcours, #toolkit, #projects, .next-section")]
  const LAYER_COUNT = 6

  let musicBus = null
  let padFilter = null
  let layers = []
  let musicTimer = null
  let nextStepTime = 0
  let stepIndex = 0
  let energy = 0
  let energyTarget = 0
  let arpAngle = 0
  let lastScrollY = scrollY
  let level = 0

  function buildMusic() {
    musicBus = ctx.createGain()
    musicBus.gain.value = 0
    musicBus.connect(master)
    layers = Array.from({ length: LAYER_COUNT }, (_, i) => {
      const gain = ctx.createGain()
      gain.gain.value = i === 0 ? 1 : 0
      gain.connect(musicBus)
      return gain
    })
    padFilter = ctx.createBiquadFilter()
    padFilter.type = "lowpass"
    padFilter.frequency.value = 700
    padFilter.Q.value = 0.6
    padFilter.connect(layers[0])
  }

  // Section đang chiếm giữa màn hình quyết định số lớp nhạc
  function currentLevel() {
    const mid = innerHeight / 2
    for (let i = SECTIONS.length - 1; i >= 0; i--) {
      const r = SECTIONS[i].getBoundingClientRect()
      if (r.top <= mid && r.bottom >= mid) return i
    }
    return level
  }

  function setLevel(next, announce) {
    if (next === level && !announce) return
    const now = ctx.currentTime
    layers.forEach((gain, i) => gain.gain.setTargetAtTime(i <= next ? 1 : 0, now, i <= next ? 0.5 : 0.35))
    // Lớp mới vào: gió cuộn lên. Lớp rút đi: gió nhoè xuống.
    if (announce && next > level) whoosh(spatialAt(0, 0.4, -1), now + 0.02, { from: 180, to: 3600, dur: 1.3, peak: 0.09, attack: 0.75 })
    if (announce && next < level) SOUNDS.leave(spatialAt(0, -0.3, -1), now + 0.02)
    level = next
    if (toggle) toggle.dataset.level = String(level + 1)
  }

  function pad(t, chord, dur) {
    chord.slice(0, 4).forEach((semis) => {
      ;[-7, 7].forEach((cents) => {
        const osc = ctx.createOscillator()
        osc.type = "triangle"
        osc.frequency.value = hz(semis)
        osc.detune.value = cents
        const gain = ctx.createGain()
        gain.gain.setValueAtTime(0.0001, t)
        gain.gain.exponentialRampToValueAtTime(0.018, t + 1.2)
        gain.gain.setValueAtTime(0.018, t + dur - 0.2)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1)
        osc.connect(gain).connect(padFilter)
        osc.start(t)
        osc.stop(t + dur + 1.1)
      })
    })
  }

  function bass(t, semis, peak) {
    const osc = ctx.createOscillator()
    osc.type = "sine"
    osc.frequency.value = hz(semis - 24)
    const gain = ctx.createGain()
    envelope(gain, t, peak, 0.01, 0.5)
    osc.connect(gain).connect(layers[1])
    osc.start(t)
    osc.stop(t + 0.6)
  }

  function kick(t, peak) {
    const osc = ctx.createOscillator()
    osc.frequency.setValueAtTime(140, t)
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.18)
    const gain = ctx.createGain()
    envelope(gain, t, peak, 0.004, 0.26)
    osc.connect(gain).connect(layers[3])
    osc.start(t)
    osc.stop(t + 0.32)
  }

  function noiseHit(t, out, type, freq, peak, dur) {
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = freq
    const gain = ctx.createGain()
    envelope(gain, t, peak, 0.002, dur)
    src.connect(filter).connect(gain).connect(out)
    src.start(t, random(0, 0.5))
    src.stop(t + dur + 0.05)
  }

  function playStep(step, t) {
    const inBar = step % 16
    const bar = Math.floor(step / 16)
    const chord = CHORDS[bar % CHORDS.length]
    const e = energy

    // Lớp 1: tiếng nền
    if (inBar === 0) pad(t, chord, STEP * 16)

    // Lớp 2: bass đệm, thêm nốt nảy khi khách cuộn mạnh
    if (level >= 1) {
      if (inBar === 0 || inBar === 8) bass(t, chord[0], 0.2 + 0.08 * e)
      if (inBar === 14 || (inBar === 6 && e > 0.4)) bass(t, chord[2] - 12, 0.12 + 0.06 * e)
    }

    // Lớp 3: đàn rải móc 8, xoay vòng quanh đầu người nghe (cả phía sau) nhờ HRTF
    if (level >= 2 && inBar % 2 === 0) {
      const semis = chord[ARP[(inBar / 2) % ARP.length]] + 12
      arpAngle += 0.55
      const out = spatialAt(Math.sin(arpAngle) * 2.2, 0.3, -Math.cos(arpAngle) * 2.2, layers[2])
      pluck(out, t, hz(semis), 0.025 + 0.035 * e)
    }

    // Lớp 4: trống
    if (level >= 3) {
      if (inBar === 0 || inBar === 8 || (inBar === 10 && e > 0.5)) kick(t, 0.32 + 0.18 * e)
      if (inBar === 4 || inBar === 12) noiseHit(t, layers[3], "bandpass", 1900, 0.05 + 0.04 * e, 0.12)
    }

    // Lớp 5: hi-hat + chuông đối đáp trái/phải
    if (level >= 4) {
      if (inBar % 4 === 2) noiseHit(t, layers[4], "highpass", 7500, 0.03 + 0.02 * e, 0.035)
      if (e > 0.5 && inBar % 2 === 1) noiseHit(t, layers[4], "highpass", 9000, 0.015, 0.02)
      if (inBar === 0 || inBar === 6 || inBar === 12) {
        const side = inBar === 6 ? 1 : -1
        const semis = chord[BELLS[(bar + inBar) % BELLS.length]] + 24
        chime(spatialAt(side * 2.6, 0.6, -1.2, layers[4]), t, hz(semis), { peak: 0.035, dur: 1.2 })
      }
    }

    // Lớp 6: lấp lánh bay quanh đầu, có hạt từ phía sau lưng
    if (level >= 5 && inBar % 8 === 4) {
      for (let i = 0; i < 3; i++) {
        const angle = random(0, Math.PI * 2)
        const semis = chord[Math.floor(random(0, chord.length))] + 36
        const out = spatialAt(Math.sin(angle) * 2, random(0.5, 1.6), Math.cos(angle) * 2, layers[5])
        chime(out, t + i * STEP * 0.5, hz(semis), { peak: 0.018, dur: 1.4 })
      }
    }
  }

  function schedule() {
    // Năng lượng đuổi theo mục tiêu; mục tiêu tự nguội dần khi khách ngừng tay
    const dy = Math.abs(scrollY - lastScrollY)
    lastScrollY = scrollY
    energyTarget = Math.min(1, energyTarget * 0.985 + dy / 2400)
    energy += (energyTarget - energy) * (energyTarget > energy ? 0.12 : 0.03)
    padFilter.frequency.setTargetAtTime(650 + energy * 2200, ctx.currentTime, 0.3)
    setLevel(currentLevel(), true)

    // Tab bị ẩn rồi quay lại: không phát bù cả loạt nốt đã lỡ
    if (nextStepTime < ctx.currentTime - 0.05) nextStepTime = ctx.currentTime + 0.05
    while (nextStepTime < ctx.currentTime + 0.12) {
      playStep(stepIndex++, nextStepTime)
      nextStepTime += STEP
    }
  }

  function startMusic() {
    if (musicTimer) return
    if (!musicBus) buildMusic()
    const now = ctx.currentTime
    musicBus.gain.cancelScheduledValues(now)
    musicBus.gain.setValueAtTime(musicBus.gain.value, now)
    musicBus.gain.linearRampToValueAtTime(0.6, now + 2.5)
    level = currentLevel()
    setLevel(level, false)
    nextStepTime = now + 0.1
    stepIndex = 0
    lastScrollY = scrollY
    musicTimer = setInterval(schedule, 25)
  }

  function stopMusic() {
    if (!musicTimer) return
    clearInterval(musicTimer)
    musicTimer = null
    const now = ctx.currentTime
    musicBus.gain.cancelScheduledValues(now)
    musicBus.gain.setValueAtTime(musicBus.gain.value, now)
    musicBus.gain.linearRampToValueAtTime(0, now + 0.4)
  }

  const nudgeEnergy = (amount) => (energyTarget = Math.min(1, energyTarget + amount))

  // Rê chuột trên khối logo 3D: nốt thuỷ tinh rơi đúng chỗ con trỏ, theo hợp âm đang chơi
  let lastShimmer = 0
  hero?.addEventListener("pointermove", (event) => {
    if (!isRunning()) return
    nudgeEnergy(0.004)
    const now = ctx.currentTime
    const speed = Math.hypot(event.movementX, event.movementY)
    if (speed < 8 || now - lastShimmer < 0.18) return
    lastShimmer = now
    const chord = CHORDS[Math.floor(stepIndex / 16) % CHORDS.length]
    const semis = chord[Math.floor(random(0, chord.length))] + 24
    pluck(spatial({ left: event.clientX, top: event.clientY, width: 0, height: 0 }), now + 0.005, hz(semis), 0.03)
  })
  window.addEventListener("pointerdown", () => unlocked && nudgeEnergy(0.15), { passive: true })

  // ---------- Rê chuột và bấm ----------
  const INTERACTIVE = "a, button, .toolkit-card"
  let hovered = null
  document.addEventListener("pointerover", (event) => {
    if (event.pointerType !== "mouse") return
    const target = event.target.closest?.(INTERACTIVE)
    if (!target || target === hovered) return
    hovered = target
    const siblings = target.parentElement ? [...target.parentElement.children] : []
    play("hover", target, Math.max(0, siblings.indexOf(target)))
  })
  document.addEventListener("pointerout", (event) => {
    if (hovered && !hovered.contains(event.relatedTarget)) hovered = null
  })
  document.addEventListener("pointerdown", (event) => {
    const target = event.target.closest?.(INTERACTIVE)
    if (target && target !== toggle) play("click", target, 0, { force: true })
  })

  // ---------- Mở khoá và bật/tắt ----------
  async function unlock() {
    if (!AudioCtx) return
    if (!ctx) build()
    if (ctx.state !== "running") await ctx.resume().catch(() => {})
    if (ctx.state !== "running") return
    unlocked = true
    setState()
    startScanning()
    startMusic()
    // Đang ở đầu trang thì cho khách nghe ngay khối logo 3D "hạ cánh"
    if (hero && hero.getBoundingClientRect().bottom > innerHeight * 0.6) {
      play("hero", hero.querySelector(".webgl"), 0, { force: true })
    }
  }

  function firstGesture(event) {
    // Bấm vào chính nút âm thanh thì để trình xử lý click của nút lo
    if (toggle?.contains(event.target)) return
    if (wantsSound && !unlocked) unlock()
  }
  ;["pointerdown", "keydown", "touchend"].forEach((type) =>
    window.addEventListener(type, firstGesture, { capture: true, passive: true }),
  )

  toggle?.addEventListener("click", () => {
    if (wantsSound && !unlocked) return unlock()
    wantsSound = !wantsSound
    try {
      localStorage.setItem(STORAGE_KEY, wantsSound ? "on" : "off")
    } catch (error) {
      // Không lưu được thì chỉ áp dụng cho lần xem này
    }
    if (wantsSound) {
      unlock()
    } else {
      stopScanning()
      stopMusic()
      setState()
    }
  })

  document.addEventListener("visibilitychange", () => {
    if (!ctx || !unlocked) return
    document.hidden ? ctx.suspend() : wantsSound && ctx.resume()
  })

  if (!AudioCtx && toggle) toggle.hidden = true
  setState()
}
