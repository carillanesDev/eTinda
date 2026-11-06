/**
 * Pure TypeScript, zero-dependency QR Code matrix generator (Byte Mode, ECC Level L/M).
 * Runs 100% offline in browser and Node.js without any network requests or external libraries.
 */

// Galois Field GF(256) tables for Reed-Solomon error correction
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(function initGF() {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = val;
    GF_EXP[i + 255] = val;
    GF_LOG[val] = i;
    val = (val << 1) ^ (val >= 128 ? 0x11d : 0);
  }
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return GF_EXP[GF_LOG[x] + GF_LOG[y]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], GF_EXP[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

function rsCalculateEcc(data: Uint8Array, eccCount: number): Uint8Array {
  const gen = rsGeneratorPoly(eccCount);
  const res = new Uint8Array(data.length + eccCount);
  res.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return res.slice(data.length);
}

// QR Code Specifications for Version 2 (25x25) and Version 4 (33x33)
interface QrVersionSpec {
  version: number;
  size: number;
  dataCapacity: number;
  eccCapacity: number;
  alignPos: number[];
}

const QR_VERSIONS: QrVersionSpec[] = [
  { version: 2, size: 25, dataCapacity: 34, eccCapacity: 10, alignPos: [6, 18] },
  { version: 4, size: 33, dataCapacity: 64, eccCapacity: 36, alignPos: [6, 26] },
  { version: 6, size: 41, dataCapacity: 108, eccCapacity: 64, alignPos: [6, 22, 38] },
];

/**
 * Encodes string into a 2D boolean matrix where true = black pixel, false = white pixel.
 */
export function generateQrMatrix(text: string): boolean[][] {
  const utf8Bytes = new TextEncoder().encode(text);

  // Pick smallest fitting version
  const spec =
    QR_VERSIONS.find((v) => utf8Bytes.length + 3 <= v.dataCapacity) ??
    QR_VERSIONS[QR_VERSIONS.length - 1];

  const { size, dataCapacity, eccCapacity, alignPos } = spec;

  // 1. Prepare data bitstream (Byte mode: 0100)
  const bitBuffer: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bitBuffer.push((val >> i) & 1);
    }
  };

  pushBits(0b0100, 4); // Byte mode indicator
  pushBits(utf8Bytes.length, 8); // Character count indicator (8-bit for V1-9)
  for (const byte of utf8Bytes) {
    pushBits(byte, 8);
  }
  // Terminator
  for (let i = 0; i < 4 && bitBuffer.length < dataCapacity * 8; i++) {
    bitBuffer.push(0);
  }
  while (bitBuffer.length % 8 !== 0) {
    bitBuffer.push(0);
  }
  // Pad bytes
  const pad = [0xec, 0x11];
  let padIdx = 0;
  while (bitBuffer.length < dataCapacity * 8) {
    pushBits(pad[padIdx % 2], 8);
    padIdx++;
  }

  // Convert bits to data codewords
  const dataCodewords = new Uint8Array(dataCapacity);
  for (let i = 0; i < dataCapacity; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | bitBuffer[i * 8 + b];
    }
    dataCodewords[i] = byte;
  }

  // Calculate ECC codewords
  const eccCodewords = rsCalculateEcc(dataCodewords, eccCapacity);
  const allCodewords = new Uint8Array(dataCapacity + eccCapacity);
  allCodewords.set(dataCodewords);
  allCodewords.set(eccCodewords, dataCapacity);

  // 2. Initialize matrix (-1 = unassigned)
  const matrix: number[][] = Array.from({ length: size }, () =>
    Array(size).fill(-1)
  );

  const setFixed = (r: number, c: number, val: number) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r][c] = val;
    }
  };

  // Finder Patterns (7x7 squares at 3 corners)
  const drawFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        if (r === -1 || r === 7 || c === -1 || c === 7) {
          setFixed(row + r, col + c, 0); // Separator
        } else if (r === 0 || r === 6 || c === 0 || c === 6) {
          setFixed(row + r, col + c, 1);
        } else if (r >= 2 && r <= 4 && c >= 2 && c <= 4) {
          setFixed(row + r, col + c, 1);
        } else {
          setFixed(row + r, col + c, 0);
        }
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    const val = i % 2 === 0 ? 1 : 0;
    if (matrix[6][i] === -1) setFixed(6, i, val);
    if (matrix[i][6] === -1) setFixed(i, 6, val);
  }

  // Alignment patterns
  for (const r of alignPos) {
    for (const c of alignPos) {
      if (matrix[r][c] !== -1) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const isBorder = Math.abs(dr) === 2 || Math.abs(dc) === 2;
          const isCenter = dr === 0 && dc === 0;
          setFixed(r + dr, c + dc, isBorder || isCenter ? 1 : 0);
        }
      }
    }
  }

  // Dark module
  setFixed(size - 8, 8, 1);

  // Reserve format information areas
  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === -1) setFixed(8, i, 0);
    if (matrix[i][8] === -1) setFixed(i, 8, 0);
  }
  for (let i = size - 8; i < size; i++) {
    if (matrix[8][i] === -1) setFixed(8, i, 0);
    if (matrix[i][8] === -1) setFixed(i, 8, 0);
  }

  // 3. Place data codewords in zig-zag order
  const allBits: number[] = [];
  for (const byte of allCodewords) {
    for (let b = 7; b >= 0; b--) {
      allBits.push((byte >> b) & 1);
    }
  }

  let bitIdx = 0;
  let upwards = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--; // Skip vertical timing column
    const rows = upwards
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const row of rows) {
      for (const c of [col, col - 1]) {
        if (matrix[row][c] === -1) {
          const bit = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
          // Apply standard mask 0: (row + col) % 2 === 0
          const mask = (row + c) % 2 === 0 ? 1 : 0;
          matrix[row][c] = bit ^ mask;
        }
      }
    }
    upwards = !upwards;
  }

  // 4. Write format information (Mask 0, ECC Level L: 0b111011111000100)
  const formatBits = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];
  const formatCoordsTopLeft: [number, number][] = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
    [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  const formatCoordsOther: [number, number][] = [
    [size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8], [size - 5, 8], [size - 6, 8], [size - 7, 8],
    [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5], [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1],
  ];

  for (let i = 0; i < 15; i++) {
    const bit = formatBits[i];
    const [r1, c1] = formatCoordsTopLeft[i];
    matrix[r1][c1] = bit;
    const [r2, c2] = formatCoordsOther[i];
    matrix[r2][c2] = bit;
  }

  return matrix.map((row) => row.map((cell) => cell === 1));
}
