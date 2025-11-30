/**
 * QR Code Generator
 * Generates QR codes for payment links with wallet deep links
 */

// QR Code matrix generation using Reed-Solomon error correction
// This is a pure TypeScript implementation without external dependencies

const EC_LEVEL = 1; // M = ~15% error correction
const MODE_BYTE = 4; // Byte mode indicator

/**
 * QR Code options
 */
export interface QRCodeOptions {
  /** Size in pixels (default: 256) */
  size?: number;
  /** Margin in modules (default: 4) */
  margin?: number;
  /** Dark color (default: #000000) */
  darkColor?: string;
  /** Light color (default: #ffffff) */
  lightColor?: string;
  /** Output format */
  format?: 'svg' | 'png-base64';
}

/**
 * Payment QR data
 */
export interface PaymentQRData {
  /** Chain ID */
  chainId: number;
  /** Recipient address */
  recipient: string;
  /** Amount to pay */
  amount: string;
  /** Token symbol */
  tokenSymbol: string;
  /** Payment link ID */
  payLinkId: string;
  /** Callback URL for confirmation */
  confirmUrl: string;
}

/**
 * Generate a payment URI for wallets
 */
export function generatePaymentURI(data: PaymentQRData): string {
  const { chainId, recipient, amount, tokenSymbol } = data;

  // Solana (chainId 101 = mainnet, 102 = devnet, 103 = testnet)
  if (chainId >= 101 && chainId <= 103) {
    // Solana Pay URI format
    // solana:<recipient>?amount=<amount>&label=<label>&message=<message>
    const params = new URLSearchParams({
      amount: amount,
      label: 'Paylink Payment',
      message: `Payment for ${data.payLinkId}`,
    });
    return `solana:${recipient}?${params.toString()}`;
  }

  // EVM chains - use EIP-681 format
  // ethereum:<address>@<chainId>/transfer?value=<value>
  const weiAmount = parseFloat(amount) * 1e18;
  
  // Determine scheme based on chain
  let scheme = 'ethereum';
  if (chainId === 137 || chainId === 80001) {
    scheme = 'polygon';
  } else if (chainId === 56 || chainId === 97) {
    scheme = 'bnb';
  } else if (chainId === 42161 || chainId === 421613) {
    scheme = 'arbitrum';
  }

  return `${scheme}:${recipient}@${chainId}?value=${weiAmount.toFixed(0)}`;
}

/**
 * Generate QR code as SVG
 */
export function generateQRCodeSVG(data: string, options: QRCodeOptions = {}): string {
  const {
    size = 256,
    margin = 4,
    darkColor = '#000000',
    lightColor = '#ffffff',
  } = options;

  const matrix = generateQRMatrix(data);
  const moduleCount = matrix.length;
  const moduleSize = size / (moduleCount + margin * 2);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`;
  svg += `<rect width="${size}" height="${size}" fill="${lightColor}"/>`;

  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (matrix[row][col]) {
        const x = (col + margin) * moduleSize;
        const y = (row + margin) * moduleSize;
        svg += `<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}" fill="${darkColor}"/>`;
      }
    }
  }

  svg += '</svg>';
  return svg;
}

/**
 * Generate QR code as data URL (base64 PNG simulation via SVG)
 */
export function generateQRCodeDataURL(data: string, options: QRCodeOptions = {}): string {
  const svg = generateQRCodeSVG(data, options);
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Generate complete payment QR code
 */
export function generatePaymentQR(
  data: PaymentQRData,
  options: QRCodeOptions = {}
): { uri: string; svg: string; dataUrl: string } {
  const uri = generatePaymentURI(data);
  const svg = generateQRCodeSVG(uri, options);
  const dataUrl = generateQRCodeDataURL(uri, options);

  return { uri, svg, dataUrl };
}

// ============================================
// QR Matrix Generation (Simplified Version 2)
// ============================================

function generateQRMatrix(data: string): boolean[][] {
  const bytes = Buffer.from(data, 'utf8');
  const version = getMinVersion(bytes.length);
  const size = version * 4 + 17;

  // Initialize matrix
  const matrix: boolean[][] = Array(size)
    .fill(null)
    .map(() => Array(size).fill(false));

  const reserved: boolean[][] = Array(size)
    .fill(null)
    .map(() => Array(size).fill(false));

  // Add finder patterns
  addFinderPattern(matrix, reserved, 0, 0);
  addFinderPattern(matrix, reserved, size - 7, 0);
  addFinderPattern(matrix, reserved, 0, size - 7);

  // Add timing patterns
  addTimingPatterns(matrix, reserved, size);

  // Add alignment patterns (for version 2+)
  if (version >= 2) {
    addAlignmentPatterns(matrix, reserved, version, size);
  }

  // Reserve format info areas
  reserveFormatAreas(reserved, size);

  // Encode data
  const encoded = encodeData(bytes, version);

  // Place data in matrix
  placeData(matrix, reserved, encoded, size);

  // Apply mask (using mask 0 for simplicity)
  applyMask(matrix, reserved, size, 0);

  // Add format info
  addFormatInfo(matrix, size, 0);

  return matrix;
}

function getMinVersion(dataLength: number): number {
  // Simplified version selection for byte mode with M error correction
  const capacities = [0, 14, 26, 42, 62, 84, 106, 122, 152, 180, 213];
  for (let v = 1; v <= 10; v++) {
    if (dataLength <= capacities[v]) return v;
  }
  return 10; // Max version we support
}

function addFinderPattern(
  matrix: boolean[][],
  reserved: boolean[][],
  row: number,
  col: number
): void {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || cc < 0 || rr >= matrix.length || cc >= matrix.length) continue;

      reserved[rr][cc] = true;

      if (r === -1 || r === 7 || c === -1 || c === 7) {
        matrix[rr][cc] = false;
      } else if (r === 0 || r === 6 || c === 0 || c === 6) {
        matrix[rr][cc] = true;
      } else if (r >= 2 && r <= 4 && c >= 2 && c <= 4) {
        matrix[rr][cc] = true;
      } else {
        matrix[rr][cc] = false;
      }
    }
  }
}

function addTimingPatterns(matrix: boolean[][], reserved: boolean[][], size: number): void {
  for (let i = 8; i < size - 8; i++) {
    const bit = i % 2 === 0;
    matrix[6][i] = bit;
    matrix[i][6] = bit;
    reserved[6][i] = true;
    reserved[i][6] = true;
  }
}

function addAlignmentPatterns(
  matrix: boolean[][],
  reserved: boolean[][],
  version: number,
  size: number
): void {
  const positions = getAlignmentPositions(version);

  for (const row of positions) {
    for (const col of positions) {
      // Skip if overlapping with finder patterns
      if (
        (row < 9 && col < 9) ||
        (row < 9 && col > size - 10) ||
        (row > size - 10 && col < 9)
      ) {
        continue;
      }

      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const rr = row + r;
          const cc = col + c;
          reserved[rr][cc] = true;

          if (r === -2 || r === 2 || c === -2 || c === 2) {
            matrix[rr][cc] = true;
          } else if (r === 0 && c === 0) {
            matrix[rr][cc] = true;
          } else {
            matrix[rr][cc] = false;
          }
        }
      }
    }
  }
}

function getAlignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const positions = [6];
  const step = Math.floor((version * 4 + 10) / (Math.floor(version / 7) + 1));
  let pos = version * 4 + 10;
  while (pos > 6 + step) {
    positions.unshift(pos);
    pos -= step;
  }
  positions.unshift(6);
  return [...new Set(positions)].sort((a, b) => a - b);
}

function reserveFormatAreas(reserved: boolean[][], size: number): void {
  // Around top-left finder
  for (let i = 0; i < 9; i++) {
    reserved[8][i] = true;
    reserved[i][8] = true;
  }
  // Around top-right finder
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = true;
  }
  // Around bottom-left finder
  for (let i = 0; i < 8; i++) {
    reserved[size - 1 - i][8] = true;
  }
  // Dark module
  reserved[size - 8][8] = true;
}

function encodeData(data: Buffer, version: number): boolean[] {
  const bits: boolean[] = [];

  // Mode indicator (byte mode = 0100)
  pushBits(bits, MODE_BYTE, 4);

  // Character count (8 bits for version 1-9, 16 for 10+)
  const countBits = version < 10 ? 8 : 16;
  pushBits(bits, data.length, countBits);

  // Data
  for (const byte of data) {
    pushBits(bits, byte, 8);
  }

  // Terminator
  const capacity = getDataCapacity(version);
  const remaining = capacity - bits.length;
  if (remaining > 0) {
    pushBits(bits, 0, Math.min(4, remaining));
  }

  // Pad to byte boundary
  while (bits.length % 8 !== 0) {
    bits.push(false);
  }

  // Pad codewords
  const padBytes = [0xec, 0x11];
  let padIndex = 0;
  while (bits.length < capacity) {
    pushBits(bits, padBytes[padIndex % 2], 8);
    padIndex++;
  }

  // Add error correction
  return addErrorCorrection(bits, version);
}

function getDataCapacity(version: number): number {
  // Data capacity in bits for M error correction level
  const capacities = [0, 128, 224, 352, 512, 688, 864, 992, 1232, 1456, 1728];
  return capacities[version] || 1728;
}

function pushBits(arr: boolean[], value: number, count: number): void {
  for (let i = count - 1; i >= 0; i--) {
    arr.push(((value >> i) & 1) === 1);
  }
}

function addErrorCorrection(data: boolean[], version: number): boolean[] {
  // Simplified: For versions 1-10 with M level, add basic EC
  // In production, use proper Reed-Solomon encoding

  const dataBytes: number[] = [];
  for (let i = 0; i < data.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8 && i + j < data.length; j++) {
      if (data[i + j]) byte |= 1 << (7 - j);
    }
    dataBytes.push(byte);
  }

  // Generate EC codewords (simplified polynomial division)
  const ecCount = getECCount(version);
  const ecBytes = generateECBytes(dataBytes, ecCount);

  // Combine data and EC
  const result: boolean[] = [...data];
  for (const byte of ecBytes) {
    pushBits(result, byte, 8);
  }

  return result;
}

function getECCount(version: number): number {
  // EC codewords for M level
  const counts = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
  return counts[version] || 26;
}

function generateECBytes(data: number[], ecCount: number): number[] {
  // Simplified Reed-Solomon using GF(256)
  const gfExp = new Uint8Array(512);
  const gfLog = new Uint8Array(256);

  // Generate GF tables
  let x = 1;
  for (let i = 0; i < 255; i++) {
    gfExp[i] = x;
    gfLog[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    gfExp[i] = gfExp[i - 255];
  }

  // Generate generator polynomial
  const gen: number[] = [1];
  for (let i = 0; i < ecCount; i++) {
    const newGen: number[] = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      newGen[j] ^= gen[j];
      newGen[j + 1] ^= gfExp[(gfLog[gen[j]] + i) % 255];
    }
    gen.length = 0;
    gen.push(...newGen);
  }

  // Perform polynomial division
  const msg = [...data, ...new Array(ecCount).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 1; j < gen.length; j++) {
        if (gen[j] !== 0) {
          msg[i + j] ^= gfExp[(gfLog[gen[j]] + gfLog[coef]) % 255];
        }
      }
    }
  }

  return msg.slice(data.length);
}

function placeData(
  matrix: boolean[][],
  reserved: boolean[][],
  data: boolean[],
  size: number
): void {
  let dataIndex = 0;
  let upward = true;

  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col = 5; // Skip timing pattern column

    for (let i = 0; i < size; i++) {
      const row = upward ? size - 1 - i : i;

      for (const c of [col, col - 1]) {
        if (!reserved[row][c] && dataIndex < data.length) {
          matrix[row][c] = data[dataIndex++];
        }
      }
    }

    upward = !upward;
  }
}

function applyMask(
  matrix: boolean[][],
  reserved: boolean[][],
  size: number,
  mask: number
): void {
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!reserved[row][col] && shouldMask(row, col, mask)) {
        matrix[row][col] = !matrix[row][col];
      }
    }
  }
}

function shouldMask(row: number, col: number, mask: number): boolean {
  switch (mask) {
    case 0:
      return (row + col) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return col % 3 === 0;
    case 3:
      return (row + col) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5:
      return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6:
      return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    case 7:
      return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
    default:
      return false;
  }
}

function addFormatInfo(matrix: boolean[][], size: number, mask: number): void {
  // Format info for EC level M (01) and mask
  const formatBits = getFormatBits(EC_LEVEL, mask);

  // Place format info
  for (let i = 0; i < 15; i++) {
    const bit = formatBits[i];

    // Around top-left
    if (i < 6) {
      matrix[i][8] = bit;
    } else if (i < 8) {
      matrix[i + 1][8] = bit;
    } else {
      matrix[8][14 - i] = bit;
    }

    // Around top-right and bottom-left
    if (i < 8) {
      matrix[8][size - 1 - i] = bit;
    } else {
      matrix[size - 15 + i][8] = bit;
    }
  }

  // Dark module
  matrix[size - 8][8] = true;
}

function getFormatBits(ecLevel: number, mask: number): boolean[] {
  // Pre-computed format strings for M level (01) and masks 0-7
  const formats: { [key: string]: string } = {
    '1-0': '101010000010010',
    '1-1': '101000100100101',
    '1-2': '101111001111100',
    '1-3': '101101101001011',
    '1-4': '100010111111001',
    '1-5': '100000011001110',
    '1-6': '100111110010111',
    '1-7': '100101010100000',
  };

  const key = `${ecLevel}-${mask}`;
  const format = formats[key] || formats['1-0'];

  return format.split('').map(c => c === '1');
}
