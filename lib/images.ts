import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';

export const RECEIPTS_BUCKET = 'receipts';
export const AVATARS_BUCKET = 'avatars';

export type PickResult = { uri: string | null; error?: string };

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64ToBytes(base64: string): Uint8Array {
  const lookup = new Uint8Array(256);
  for (let i = 0; i < BASE64_CHARS.length; i++) lookup[BASE64_CHARS.charCodeAt(i)] = i;

  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.ceil((clean.length * 3) / 4));
  let p = 0;

  for (let i = 0; i < clean.length; i += 4) {
    const c1 = lookup[clean.charCodeAt(i)];
    const c2 = lookup[clean.charCodeAt(i + 1)];
    const c3 = i + 2 < clean.length ? lookup[clean.charCodeAt(i + 2)] : 0;
    const c4 = i + 3 < clean.length ? lookup[clean.charCodeAt(i + 3)] : 0;

    bytes[p++] = (c1 << 2) | (c2 >> 4);
    if (i + 2 < clean.length) bytes[p++] = ((c2 & 15) << 4) | (c3 >> 2);
    if (i + 3 < clean.length) bytes[p++] = ((c3 & 3) << 6) | c4;
  }

  return bytes.subarray(0, p);
}

function contentTypeFor(uri: string): string {
  const ext = (uri.split('?')[0].split('.').pop() || '').toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

async function ensurePermission(source: 'library' | 'camera'): Promise<string | null> {
  const result =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (result.granted) return null;
  if (result.canAskAgain === false) {
    return `Izin ${source === 'camera' ? 'kamera' : 'foto'} ditolak. Aktifkan di Pengaturan perangkat.`;
  }
  return `Izin ${source === 'camera' ? 'kamera' : 'foto'} diperlukan untuk memilih gambar.`;
}

export async function pickImage(source: 'library' | 'camera' = 'library'): Promise<PickResult> {
  const permissionError = await ensurePermission(source);
  if (permissionError) return { uri: null, error: permissionError };

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.6,
    allowsEditing: false,
  };

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || !result.assets?.length) return { uri: null };
  return { uri: result.assets[0].uri };
}

export async function uploadImageFile(
  bucket: string,
  uri: string,
  userId: string,
  filename?: string
): Promise<{ path: string } | { error: string }> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (!base64) return { error: 'Gagal membaca file gambar' };

    const ext = (uri.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)
      ? ext === 'jpeg'
        ? 'jpg'
        : ext
      : 'jpg';
    const name = filename ? `${filename}.${safeExt}` : `${Date.now()}.${safeExt}`;
    const path = `${userId}/${name}`;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, base64ToBytes(base64), {
        contentType: contentTypeFor(uri),
        upsert: true,
      });

    if (error) return { error: error.message };
    return { path };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function getSignedImageUrl(
  bucket: string,
  path: string,
  expiresIn = 60 * 60 * 24 * 7
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

export async function removeImageFile(bucket: string, path: string): Promise<void> {
  try {
    await supabase.storage.from(bucket).remove([path]);
  } catch {
    // best-effort
  }
}
