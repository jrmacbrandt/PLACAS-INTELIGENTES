import QRCode from 'qrcode';

type Point = [number, number];
type Polyline = Point[];

function arcPoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  startDeg: number,
  endDeg: number,
  steps = 14
): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const deg = startDeg + ((endDeg - startDeg) * i) / steps;
    const rad = (deg * Math.PI) / 180;
    pts.push([cx + rx * Math.cos(rad), cy + ry * Math.sin(rad)]);
  }
  return pts;
}

/**
 * Glifos vetoriais suaves (coordenadas normalizadas X: 0..1, Y: 0..1)
 * com curvas reais para tipografia limpa e legível na gravação a laser / impressão.
 */
const GLYPH_POLYLINES: Record<string, Polyline[]> = {
  '0': [
    [
      ...arcPoints(0.5, 0.28, 0.34, 0.20, 180, 360),
      ...arcPoints(0.5, 0.72, 0.34, 0.20, 0, 180),
      [0.16, 0.28],
    ],
    [[0.26, 0.78], [0.74, 0.22]],
  ],
  '1': [
    [[0.24, 0.24], [0.54, 0.08], [0.54, 0.92]],
    [[0.22, 0.92], [0.84, 0.92]],
  ],
  '2': [
    [
      ...arcPoints(0.50, 0.28, 0.33, 0.20, 195, 395),
      [0.16, 0.92],
      [0.86, 0.92],
    ],
  ],
  '3': [
    [
      ...arcPoints(0.48, 0.27, 0.32, 0.19, 200, 450),
      [0.38, 0.48],
    ],
    [
      [0.38, 0.48],
      ...arcPoints(0.48, 0.71, 0.35, 0.21, -90, 160),
    ],
  ],
  '4': [
    [[0.68, 0.92], [0.68, 0.08], [0.14, 0.66], [0.88, 0.66]],
  ],
  '5': [
    [
      [0.82, 0.08],
      [0.20, 0.08],
      [0.18, 0.46],
      ...arcPoints(0.50, 0.69, 0.34, 0.23, -115, 155),
    ],
  ],
  '6': [
    [
      ...arcPoints(0.52, 0.28, 0.32, 0.20, 335, 180),
      ...arcPoints(0.50, 0.70, 0.34, 0.22, 180, 540),
    ],
  ],
  '7': [
    [[0.14, 0.08], [0.86, 0.08], [0.36, 0.92]],
  ],
  '8': [
    [
      ...arcPoints(0.50, 0.27, 0.31, 0.19, 0, 360),
    ],
    [
      ...arcPoints(0.50, 0.70, 0.35, 0.22, 0, 360),
    ],
  ],
  '9': [
    [
      ...arcPoints(0.50, 0.30, 0.34, 0.22, 0, 360),
      [0.84, 0.30],
      ...arcPoints(0.48, 0.72, 0.34, 0.20, 0, 155),
    ],
  ],
  '-': [
    [[0.18, 0.52], [0.82, 0.52]],
  ],
  'P': [
    [[0.18, 0.08], [0.18, 0.92]],
    [
      [0.18, 0.08],
      [0.54, 0.08],
      ...arcPoints(0.54, 0.30, 0.30, 0.22, -90, 90),
      [0.18, 0.52],
    ],
  ],
  'L': [
    [[0.18, 0.08], [0.18, 0.92], [0.84, 0.92]],
  ],
  'K': [
    [[0.18, 0.08], [0.18, 0.92]],
    [[0.82, 0.08], [0.20, 0.52]],
    [[0.34, 0.42], [0.84, 0.92]],
  ],
};

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/**
 * Desenha os pixels (grayscale 0..255) do QR Code + Rodapé com o código sequencial `PLK-XXXXXX`
 * em uma matriz de tamanho 400 x 456.
 */
export function renderLabeledQrGrayscalePixels(
  urlPermanente: string,
  codigoSequencial: string
): { width: number; height: number; pixels: Uint8Array } {
  const width = 400;
  const height = 456;
  const qrSizeArea = 380;
  const qrTopOffset = 10;
  const qrLeftOffset = 10;

  const qr = QRCode.create(urlPermanente, { errorCorrectionLevel: 'M' });
  const modules = qr.modules;
  const moduleCount = modules.size;
  const marginModules = 2;
  const totalModules = moduleCount + marginModules * 2;
  const scale = qrSizeArea / totalModules;

  const pixels = new Uint8Array(width * height);
  pixels.fill(255); // Fundo branco #ffffff

  // 1. Renderiza módulos do QR Code
  for (let y = 0; y < qrSizeArea; y++) {
    const my = Math.floor(y / scale) - marginModules;
    const rowIdx = (y + qrTopOffset) * width;
    for (let x = 0; x < qrSizeArea; x++) {
      const mx = Math.floor(x / scale) - marginModules;
      if (mx >= 0 && mx < moduleCount && my >= 0 && my < moduleCount) {
        if (modules.get(my, mx)) {
          pixels[rowIdx + qrLeftOffset + x] = 15; // #0f172a
        }
      }
    }
  }

  // 2. Renderiza moldura pill e código sequencial centralizado na parte inferior
  const label = String(codigoSequencial || '').trim().toUpperCase();
  if (!label) {
    return { width, height, pixels };
  }

  const charW = 19;
  const charH = 27;
  const charGap = 6;
  const totalTextW = label.length * charW + Math.max(0, label.length - 1) * charGap;
  const startX = Math.round((width - totalTextW) / 2);
  const startY = 402;
  const strokeRadius = 2.45;

  // Moldura arredondada suave ao redor do número
  const pillX1 = startX - 20;
  const pillX2 = startX + totalTextW + 20;
  const pillY1 = startY - 9;
  const pillY2 = startY + charH + 9;
  const cornerR = 10;

  for (let y = pillY1; y <= pillY2; y++) {
    if (y < 0 || y >= height) continue;
    const rowIdx = y * width;
    for (let x = pillX1; x <= pillX2; x++) {
      if (x < 0 || x >= width) continue;
      // Distância para retângulo arredondado
      const qx = Math.max(pillX1 + cornerR - x, 0, x - (pillX2 - cornerR));
      const qy = Math.max(pillY1 + cornerR - y, 0, y - (pillY2 - cornerR));
      const dist = Math.hypot(qx, qy);
      if (dist <= cornerR + 0.5) {
        if (Math.abs(dist - cornerR) <= 0.9 || ((qx === 0 && (y === pillY1 || y === pillY2)) || (qy === 0 && (x === pillX1 || x === pillX2)))) {
          pixels[rowIdx + x] = 180; // Borda cinza nítida
        } else if (dist < cornerR) {
          pixels[rowIdx + x] = 246; // Preenchimento sutil #f6f8fa
        }
      }
    }
  }

  // 3. Renderiza cada caractere do código sequencial (ex: PLK-000057) com anti-aliasing SDF
  for (let i = 0; i < label.length; i++) {
    const ch = label[i];
    const polylines = GLYPH_POLYLINES[ch] || GLYPH_POLYLINES['-'];
    const cx0 = startX + i * (charW + charGap);
    const cy0 = startY;

    for (let py = cy0 - 4; py <= cy0 + charH + 4; py++) {
      if (py < 0 || py >= height) continue;
      const rowIdx = py * width;
      for (let px = cx0 - 4; px <= cx0 + charW + 4; px++) {
        if (px < 0 || px >= width) continue;
        let minDist = 999;
        for (const poly of polylines) {
          for (let j = 0; j < poly.length - 1; j++) {
            const [nx1, ny1] = poly[j];
            const [nx2, ny2] = poly[j + 1];
            const d = distToSegment(
              px,
              py,
              cx0 + nx1 * charW,
              cy0 + ny1 * charH,
              cx0 + nx2 * charW,
              cy0 + ny2 * charH
            );
            if (d < minDist) minDist = d;
          }
        }
        if (minDist <= strokeRadius + 0.75) {
          const alpha = Math.max(0, Math.min(1, strokeRadius + 0.45 - minDist));
          const bg = pixels[rowIdx + px];
          const fg = 15; // #0f172a
          pixels[rowIdx + px] = Math.round(bg * (1 - alpha) + fg * alpha);
        }
      }
    }
  }

  return { width, height, pixels };
}

/**
 * Gera DataURL PNG (400x456) no navegador usando <canvas> a partir dos pixels renderizados,
 * garantindo visual idêntico entre Backend (Storage) e Frontend (On-Demand Regeneration).
 */
export async function generateLabeledQrDataUrlInBrowser(
  urlPermanente: string,
  codigoSequencial: string
): Promise<string> {
  if (typeof document !== 'undefined') {
    const { width, height, pixels } = renderLabeledQrGrayscalePixels(urlPermanente, codigoSequencial);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imgData = ctx.createImageData(width, height);
      const data = imgData.data;
      for (let i = 0; i < pixels.length; i++) {
        const v = pixels[i];
        const idx = i * 4;
        data[idx] = v;
        data[idx + 1] = v;
        data[idx + 2] = v;
        data[idx + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
      return canvas.toDataURL('image/png');
    }
  }
  return QRCode.toDataURL(urlPermanente, { errorCorrectionLevel: 'M', margin: 2, width: 400 });
}
