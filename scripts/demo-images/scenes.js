// 写真風プロダクトショット（SVG）を生成する
const S = 1000;

// 共通フィルタ：布の毛羽・ライティング・粒子
const defs = (id) => `
<defs>
  <filter id="fur${id}" x="-15%" y="-15%" width="130%" height="130%">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="${id + 2}" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="11" xChannelSelector="R" yChannelSelector="G" result="fz"/>
    <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="${id + 7}" result="n2"/>
    <feDiffuseLighting in="n2" surfaceScale="1.8" lighting-color="#ffffff" result="lt"><feDistantLight azimuth="225" elevation="58"/></feDiffuseLighting>
    <feComposite in="lt" in2="fz" operator="in" result="lt2"/>
    <feBlend in="fz" in2="lt2" mode="multiply"/>
  </filter>
  <filter id="canvas${id}" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="1.2 0.9" numOctaves="2" seed="4" result="n"/>
    <feDiffuseLighting in="n" surfaceScale="1.2" lighting-color="#fff" result="lt"><feDistantLight azimuth="225" elevation="62"/></feDiffuseLighting>
    <feComposite in="lt" in2="SourceGraphic" operator="in" result="l2"/>
    <feBlend in="SourceGraphic" in2="l2" mode="multiply"/>
  </filter>
  <filter id="blur8"><feGaussianBlur stdDeviation="8"/></filter>
  <filter id="blur20"><feGaussianBlur stdDeviation="20"/></filter>
  <filter id="blur40"><feGaussianBlur stdDeviation="40"/></filter>
  <filter id="dof"><feGaussianBlur stdDeviation="14"/></filter>
  <filter id="soft3"><feGaussianBlur stdDeviation="3"/></filter>
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11" stitchTiles="stitch"/>
    <feColorMatrix type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="table" tableValues="0 0.07"/></feComponentTransfer>
  </filter>
  <radialGradient id="eye" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#6b6b78"/><stop offset=".25" stop-color="#1d1a24"/><stop offset="1" stop-color="#0b0a10"/></radialGradient>
  <radialGradient id="vign" cx="50%" cy="45%" r="75%"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#2a1f3a" stop-opacity=".22"/></radialGradient>
  <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7f7f9"/><stop offset=".35" stop-color="#a9acb5"/><stop offset=".55" stop-color="#eef0f4"/><stop offset="1" stop-color="#7d808a"/></linearGradient>
</defs>`;

// スタジオ背景（壁＋床・窓からの光）
function studio(wall, floor, horizon = 640) {
  return `
  <rect width="${S}" height="${S}" fill="${wall}"/>
  <rect y="${horizon}" width="${S}" height="${S - horizon}" fill="${floor}"/>
  <rect y="${horizon - 40}" width="${S}" height="80" fill="${floor}" filter="url(#blur40)" opacity=".7"/>
  <ellipse cx="260" cy="180" rx="520" ry="380" fill="#fff" opacity=".45" filter="url(#blur40)"/>`;
}
const finish = () => `<rect width="${S}" height="${S}" fill="url(#vign)"/><rect width="${S}" height="${S}" filter="url(#grain)"/>`;

// 立体感のある毛並みのクマ
function bear(cx, cy, k, c, id, opt = {}) {
  const { base, light, dark, inner } = c;
  const g = `bg${id}`;
  const shade = (gid, x = "35%", y = "30%") => `
    <radialGradient id="${gid}" cx="${x}" cy="${y}" r="80%">
      <stop offset="0" stop-color="${light}"/><stop offset=".55" stop-color="${base}"/><stop offset="1" stop-color="${dark}"/>
    </radialGradient>`;
  return `
  <defs>${shade(g)}${shade(g + "h", "38%", "28%")}
    <radialGradient id="${g}m" cx="45%" cy="35%" r="75%"><stop offset="0" stop-color="#fffdf9"/><stop offset="1" stop-color="${base}"/></radialGradient>
  </defs>
  <g transform="translate(${cx} ${cy}) scale(${k})">
    <ellipse cx="0" cy="300" rx="250" ry="34" fill="#3a2c48" opacity=".38" filter="url(#blur20)"/>
    <ellipse cx="0" cy="292" rx="170" ry="14" fill="#2b1f36" opacity=".45" filter="url(#soft3)"/>
    <g filter="url(#fur${id})">
      <!-- 足 -->
      <ellipse cx="-105" cy="250" rx="78" ry="58" fill="url(#${g})"/>
      <ellipse cx="105" cy="250" rx="78" ry="58" fill="url(#${g})"/>
      <!-- 胴 -->
      <ellipse cx="0" cy="150" rx="165" ry="150" fill="url(#${g})"/>
      <!-- 腕 -->
      <ellipse cx="-150" cy="140" rx="52" ry="92" transform="rotate(28 -150 140)" fill="url(#${g})"/>
      <ellipse cx="150" cy="140" rx="52" ry="92" transform="rotate(-28 150 140)" fill="url(#${g})"/>
      <!-- 耳 -->
      <circle cx="-162" cy="-236" r="64" fill="url(#${g}h)"/>
      <circle cx="162" cy="-236" r="64" fill="url(#${g}h)"/>
      <!-- 頭 -->
      <ellipse cx="0" cy="-90" rx="205" ry="178" fill="url(#${g}h)"/>
      <!-- 口元 -->
      <ellipse cx="0" cy="-30" rx="78" ry="58" fill="url(#${g}m)"/>
    </g>
    <!-- 足裏 -->
    <ellipse cx="-110" cy="262" rx="44" ry="36" fill="${inner}" opacity=".9" filter="url(#soft3)"/>
    <ellipse cx="110" cy="262" rx="44" ry="36" fill="${inner}" opacity=".9" filter="url(#soft3)"/>
    <!-- 内耳 -->
    <circle cx="-166" cy="-244" r="30" fill="${inner}" opacity=".8" filter="url(#soft3)"/>
    <circle cx="166" cy="-244" r="30" fill="${inner}" opacity=".8" filter="url(#soft3)"/>
    <!-- 頬 -->
    <ellipse cx="-118" cy="-30" rx="34" ry="20" fill="#f4a3be" opacity=".55" filter="url(#blur8)"/>
    <ellipse cx="118" cy="-30" rx="34" ry="20" fill="#f4a3be" opacity=".55" filter="url(#blur8)"/>
    <!-- 目（ビーズ） -->
    <circle cx="-70" cy="-92" r="19" fill="url(#eye)"/><circle cx="70" cy="-92" r="19" fill="url(#eye)"/>
    <ellipse cx="-76" cy="-99" rx="6" ry="5" fill="#fff" opacity=".9"/><ellipse cx="64" cy="-99" rx="6" ry="5" fill="#fff" opacity=".9"/>
    <ellipse cx="-70" cy="-70" rx="16" ry="4" fill="#000" opacity=".12" filter="url(#soft3)"/><ellipse cx="70" cy="-70" rx="16" ry="4" fill="#000" opacity=".12" filter="url(#soft3)"/>
    <!-- 鼻・口（刺繍） -->
    <path d="M-24 -52 Q0 -64 24 -52 Q18 -30 0 -26 Q-18 -30 -24 -52z" fill="#2a2230"/>
    <ellipse cx="-7" cy="-50" rx="7" ry="3.5" fill="#fff" opacity=".35"/>
    <path d="M0 -26 V-12 M0 -12 Q-16 2 -30 -8 M0 -12 Q16 2 30 -8" stroke="#2a2230" stroke-width="5" fill="none" stroke-linecap="round"/>
    ${opt.ribbon ? `<path d="M-60 40 Q0 70 60 40 L50 62 Q0 88 -50 62z" fill="${opt.ribbon}" opacity=".95"/><circle cx="0" cy="62" r="18" fill="${opt.ribbon}"/>` : ""}
    <!-- 縫い目 -->
    <path d="M0 -268 V-200" stroke="${dark}" stroke-width="2" stroke-dasharray="6 6" opacity=".35"/>
  </g>`;
}

const WHITE = { base: "#f3ede6", light: "#ffffff", dark: "#cfc4bb", inner: "#f6cfd9" };
const LAV = { base: "#ddd2f3", light: "#f5f1fc", dark: "#b3a3dc", inner: "#f6cfd9" };

// クマの顔のプリント（平面）
function printBear(cx, cy, r, fill = "#fff", line = "#4e4470") {
  return `<g transform="translate(${cx} ${cy})">
    <circle cx="${-r * .62}" cy="${-r * .66}" r="${r * .32}" fill="${fill}" stroke="${line}" stroke-width="${r * .05}"/>
    <circle cx="${r * .62}" cy="${-r * .66}" r="${r * .32}" fill="${fill}" stroke="${line}" stroke-width="${r * .05}"/>
    <ellipse rx="${r}" ry="${r * .86}" fill="${fill}" stroke="${line}" stroke-width="${r * .05}"/>
    <circle cx="${-r * .36}" cy="${-r * .06}" r="${r * .08}" fill="${line}"/><circle cx="${r * .36}" cy="${-r * .06}" r="${r * .08}" fill="${line}"/>
    <ellipse cx="${-r * .6}" cy="${r * .2}" rx="${r * .16}" ry="${r * .1}" fill="#f4a3be"/><ellipse cx="${r * .6}" cy="${r * .2}" rx="${r * .16}" ry="${r * .1}" fill="#f4a3be"/>
    <ellipse cy="${r * .14}" rx="${r * .09}" ry="${r * .06}" fill="${line}"/>
    <path d="M${-r * .12} ${r * .26} Q0 ${r * .36} ${r * .12} ${r * .26}" stroke="${line}" stroke-width="${r * .04}" fill="none" stroke-linecap="round"/>
  </g>`;
}

// 背景の小物（ボケ）
const bokehPlant = (x, y) => `<g filter="url(#dof)" opacity=".85"><rect x="${x - 40}" y="${y}" width="80" height="110" rx="14" fill="#f2e7df"/>
  <ellipse cx="${x - 30}" cy="${y - 40}" rx="30" ry="70" transform="rotate(-25 ${x - 30} ${y - 40})" fill="#9cb89a"/>
  <ellipse cx="${x + 25}" cy="${y - 55}" rx="28" ry="80" transform="rotate(18 ${x + 25} ${y - 55})" fill="#86a787"/></g>`;
const bokehBooks = (x, y) => `<g filter="url(#dof)" opacity=".8"><rect x="${x}" y="${y}" width="190" height="34" rx="4" fill="#f3c9d6"/><rect x="${x + 10}" y="${y - 30}" width="170" height="32" rx="4" fill="#d9ccf2"/><rect x="${x + 22}" y="${y - 58}" width="150" height="30" rx="4" fill="#fff6ee"/></g>`;

const scenes = {
  plush: (i) => `${studio("#efe6f6", "#f7eff0")}${bokehPlant(840, 470)}${bokehBooks(60, 600)}${bear(500, 470, 1.05, WHITE, i)}`,
  "plush-lavender": (i) => `${studio("#f6eef0", "#efe7f6")}${bokehPlant(150, 470)}${bear(500, 470, 1.05, LAV, i)}`,
  mini: (i) => `${studio("#f6ecef", "#f1e8f7")}${bear(330, 520, .62, WHITE, i)}${bear(660, 600, .45, LAV, i + 1, { ribbon: "#e98bab" })}
     <g transform="translate(700 380)" opacity=".95"><rect x="-70" y="-26" width="140" height="52" rx="8" fill="#fff" stroke="#e6dcf0"/><text x="0" y="8" text-anchor="middle" font-family="Arial" font-weight="700" font-size="22" fill="#7e66c4">MINI 8cm</text></g>`,
  charm: (i) => `${studio("#f3ebf8", "#f8f0f2", 560)}
     <ellipse cx="520" cy="820" rx="210" ry="30" fill="#3a2c48" opacity=".3" filter="url(#blur20)"/>
     <!-- ボールチェーン -->
     <g fill="url(#metal)">${Array.from({ length: 16 }, (_, j) => `<circle cx="${460 + j * 2}" cy="${130 + j * 16}" r="6"/>`).join("")}</g>
     <circle cx="500" cy="395" r="40" fill="none" stroke="url(#metal)" stroke-width="10"/>
     <!-- アクリル本体（厚み＋透明感） -->
     <g transform="translate(500 600) rotate(-6)">
       <path d="M-200 -120 a70 70 0 1 1 90 -85 a200 170 0 0 1 220 0 a70 70 0 1 1 90 85 a210 190 0 1 1 -400 0z" fill="#ffffff" opacity=".55" transform="translate(10 12)"/>
       <path d="M-200 -120 a70 70 0 1 1 90 -85 a200 170 0 0 1 220 0 a70 70 0 1 1 90 85 a210 190 0 1 1 -400 0z" fill="#ffffff" opacity=".85" stroke="#ffffff" stroke-width="6"/>
       <g transform="scale(.9)">${printBear(0, 20, 190, "#fffaf4", "#4e4470")}</g>
       <path d="M-170 -150 Q-120 -190 -60 -170" stroke="#fff" stroke-width="10" fill="none" opacity=".9" stroke-linecap="round"/>
       <path d="M140 120 Q160 60 170 0" stroke="#fff" stroke-width="6" fill="none" opacity=".6" stroke-linecap="round"/>
     </g>`,
  acrylic: (i) => `${studio("#eef1f8", "#f6f1ee", 600)}${bokehPlant(860, 430)}
     <ellipse cx="500" cy="860" rx="260" ry="34" fill="#3a2c48" opacity=".28" filter="url(#blur20)"/>
     <!-- 台座 -->
     <ellipse cx="500" cy="830" rx="230" ry="44" fill="#ffffff" opacity=".75"/>
     <ellipse cx="500" cy="818" rx="230" ry="44" fill="#ffffff" opacity=".9" stroke="#e6e9f2" stroke-width="3"/>
     <!-- パネル -->
     <rect x="300" y="170" width="400" height="640" rx="46" fill="#fff" opacity=".35" transform="translate(12 10)"/>
     <rect x="300" y="170" width="400" height="640" rx="46" fill="#ffffff" opacity=".55" stroke="#ffffff" stroke-width="7"/>
     ${printBear(500, 420, 140, "#fffaf4")}
     <g transform="translate(500 640)"><rect x="-120" y="-34" width="240" height="68" rx="34" fill="#f3c9d6"/><text x="0" y="12" text-anchor="middle" font-family="Arial" font-weight="800" font-size="34" fill="#4e4470">PARTY!</text></g>
     <circle cx="390" cy="260" r="10" fill="#f9d16d"/><circle cx="620" cy="300" r="8" fill="#a8d8e8"/><circle cx="600" cy="230" r="7" fill="#f3c9d6"/>
     <path d="M330 200 L330 520" stroke="#fff" stroke-width="12" opacity=".75" stroke-linecap="round"/>
     <path d="M675 560 L675 770" stroke="#fff" stroke-width="6" opacity=".5" stroke-linecap="round"/>`,
  tote: (i) => `${studio("#f4ece6", "#efe5dc", 700)}
     <ellipse cx="500" cy="905" rx="290" ry="30" fill="#3a2c48" opacity=".28" filter="url(#blur20)"/>
     <!-- 持ち手 -->
     <path d="M380 330 Q380 120 500 120 Q620 120 620 330" fill="none" stroke="#d9cbb7" stroke-width="34" filter="url(#canvas${i})"/>
     <path d="M380 330 Q380 120 500 120 Q620 120 620 330" fill="none" stroke="#000" stroke-opacity=".08" stroke-width="34" transform="translate(4 4)"/>
     <!-- 本体 -->
     <path d="M250 320 L750 320 L770 890 Q500 905 230 890z" fill="#ece2d3" filter="url(#canvas${i})"/>
     <path d="M250 320 L750 320 L752 360 L248 360z" fill="#000" opacity=".05"/>
     <path d="M330 340 Q340 620 300 880" stroke="#000" stroke-opacity=".06" stroke-width="30" fill="none" filter="url(#blur20)"/>
     <path d="M690 340 Q660 600 720 880" stroke="#fff" stroke-opacity=".25" stroke-width="40" fill="none" filter="url(#blur20)"/>
     <g opacity=".92">${printBear(500, 600, 130, "#fffaf4")}</g>
     <text x="500" y="790" text-anchor="middle" font-family="Arial" font-weight="800" letter-spacing="6" font-size="30" fill="#e07aa0">MAINICHI</text>`,
  mug: (i) => `${studio("#eef0f6", "#f6efec", 640)}${bokehBooks(700, 600)}
     <ellipse cx="480" cy="850" rx="250" ry="34" fill="#3a2c48" opacity=".3" filter="url(#blur20)"/>
     <defs><linearGradient id="cer" x1="0" x2="1"><stop offset="0" stop-color="#d8d4dc"/><stop offset=".25" stop-color="#ffffff"/><stop offset=".55" stop-color="#f7f4f6"/><stop offset="1" stop-color="#bdb6c2"/></linearGradient></defs>
     <path d="M690 450 Q820 450 820 580 Q820 710 680 720" fill="none" stroke="url(#cer)" stroke-width="46"/>
     <path d="M280 360 L280 790 Q480 870 680 790 L680 360z" fill="url(#cer)"/>
     <ellipse cx="480" cy="360" rx="200" ry="52" fill="#f3eff2"/>
     <ellipse cx="480" cy="368" rx="178" ry="40" fill="#6b4632"/>
     <ellipse cx="450" cy="362" rx="80" ry="14" fill="#a07258" opacity=".6"/>
     ${printBear(480, 590, 110, "#fffaf4")}
     <text x="480" y="740" text-anchor="middle" font-family="Arial" font-weight="800" font-size="30" fill="#7e66c4">GOOD MORNING</text>
     <rect x="320" y="400" width="26" height="370" rx="13" fill="#fff" opacity=".7"/>`,
  sticker: (i) => `${studio("#f2eef7", "#f7f1ef", 520)}
     <g transform="translate(500 560) rotate(-5)">
       <rect x="-330" y="-300" width="660" height="620" rx="22" fill="#000" opacity=".22" filter="url(#blur20)" transform="translate(14 18)"/>
       <rect x="-330" y="-300" width="660" height="620" rx="22" fill="#fffdfb"/>
       ${[[-170, -150, "#fff7ef"], [140, -160, "#fbe6ee"], [0, 20, "#efe7fb"], [-180, 170, "#fff7ef"], [170, 170, "#fbe6ee"]].map(([x, y, f], j) => `
         <g transform="translate(${x} ${y}) rotate(${j * 9 - 12})">
           <ellipse rx="118" ry="104" fill="#000" opacity=".12" filter="url(#soft3)" transform="translate(3 5)"/>
           <ellipse rx="118" ry="104" fill="#fff"/>${printBear(0, 6, 80, f)}
           <path d="M-80 -60 Q-40 -90 10 -86" stroke="#fff" stroke-width="10" opacity=".7" fill="none" stroke-linecap="round"/>
         </g>`).join("")}
     </g>`,
  keyholder: (i) => `${studio("#f7eef2", "#efe8f6", 600)}
     <ellipse cx="510" cy="800" rx="200" ry="28" fill="#3a2c48" opacity=".3" filter="url(#blur20)"/>
     <circle cx="500" cy="170" r="78" fill="none" stroke="url(#metal)" stroke-width="16"/>
     <path d="M500 248 v70" stroke="url(#metal)" stroke-width="14"/>
     <circle cx="500" cy="330" r="18" fill="none" stroke="url(#metal)" stroke-width="9"/>
     <g transform="translate(500 520)">
       <g transform="translate(10 14)" opacity=".9">${printBear(0, 0, 210, "#e8a6bd", "#e8a6bd")}</g>
       ${printBear(0, 0, 210, "#f8cbd9", "#b85b80")}
       <path d="M-150 -160 Q-100 -200 -40 -190" stroke="#fff" stroke-width="12" opacity=".6" fill="none" stroke-linecap="round"/>
     </g>`,
};

module.exports = { scenes, defs, finish, S };
