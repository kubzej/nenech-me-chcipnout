import { apiGetAuthed } from "./api";
import { supabase } from "./supabase";
import type { Workspace } from "../types/workspace";

const BUCKET = "plant-photos";
const MAX_DIMENSION_PX = 1600;
const JPEG_QUALITY = 0.8;

export type UploadedPlantPhoto = {
  storageBucket: string;
  storagePath: string;
};

export async function uploadPlantPhoto(
  kytkaId: string,
  file: File,
): Promise<UploadedPlantPhoto> {
  if (!supabase) {
    throw new Error("Supabase env není nastavené.");
  }

  const workspace = await apiGetAuthed<Workspace>("/api/workspaces/active");
  const blob = await compressImage(file);
  const storagePath = `${workspace.id}/${kytkaId}/${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, blob, {
    contentType: "image/jpeg",
  });

  if (error) {
    throw new Error(error.message);
  }

  return { storageBucket: BUCKET, storagePath };
}

export async function deleteUploadedPlantPhoto(storagePath: string): Promise<void> {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) {
    throw new Error(error.message);
  }
}

async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  const scale = Math.min(1, MAX_DIMENSION_PX / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas není podporovaný.");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error("Fotku se nepodařilo zpracovat."));
        }
      },
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}
