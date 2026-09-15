/** Decode Unicode CSV without silently replacing damaged customer text. */
export async function decodeLeadCSV(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe
    ? 'utf-16le'
    : bytes[0] === 0xfe && bytes[1] === 0xff
      ? 'utf-16be'
      : 'utf-8';
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
  } catch {
    throw new Error('This CSV has an unsupported or damaged text encoding. Export it as CSV UTF-8 and upload it again.');
  }
}
