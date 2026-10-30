import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';

/** Convierte base64 a bytes sin librerías extra. */
function base64ToBytes(b64: string): Uint8Array {
  const bin = globalThis.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Elige una foto, la recorta cuadrada a 512 px y la sube como JPEG.
 * Re-codificar la imagen elimina los metadatos EXIF (ubicación GPS, modelo del teléfono).
 * Devuelve la URL pública nueva, o null si la persona canceló.
 */
export async function pickAndUploadAvatar(userId: string): Promise<string | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1,
  });
  if (picked.canceled || !picked.assets[0]) return null;

  const ref = await ImageManipulator.manipulate(picked.assets[0].uri).resize({ width: 512, height: 512 }).renderAsync();
  const img = await ref.saveAsync({ compress: 0.8, format: SaveFormat.JPEG, base64: true });
  if (!img.base64) throw new Error('No se pudo procesar la foto');

  const path = `${userId}/avatar.jpg`;
  const { error } = await supabase.storage.from('avatars')
    .upload(path, base64ToBytes(img.base64), { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  // El parámetro evita que el teléfono muestre la foto anterior guardada en caché.
  return `${data.publicUrl}?v=${Date.now()}`;
}
