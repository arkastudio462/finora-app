const HEX: string[] = [];
for (let i = 0; i < 256; i += 1) HEX.push((i + 0x100).toString(16).slice(1));

export function newId(): string {
  const bytes = new Uint8Array(16);
  const cryptoObj = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;

  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return [
    HEX[bytes[0]], HEX[bytes[1]], HEX[bytes[2]], HEX[bytes[3]],
    '-',
    HEX[bytes[4]], HEX[bytes[5]],
    '-',
    HEX[bytes[6]], HEX[bytes[7]],
    '-',
    HEX[bytes[8]], HEX[bytes[9]],
    '-',
    HEX[bytes[10]], HEX[bytes[11]], HEX[bytes[12]], HEX[bytes[13]], HEX[bytes[14]], HEX[bytes[15]],
  ].join('');
}
