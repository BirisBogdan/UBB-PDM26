// photos.ts — Ride photos kept on the phone with expo-file-system.
// The camera writes to a temporary cache file; we copy it to the app's
// document folder, which the system does not clean up, so it survives
// restarts and can be uploaded later when the phone is offline now.

import { Directory, File, Paths } from "expo-file-system";
import { SERVER_URL } from "../config";
import type { Ride } from "../types";

const photosDir = new Directory(Paths.document, "ride-photos");

// Copies the photo taken by the camera into the app's storage, returns its file:// uri
export function savePhotoOnDevice(tempUri: string): string {
  if (!photosDir.exists) photosDir.create({ intermediates: true });
  const target = new File(photosDir, `photo-${Date.now()}.jpg`);
  new File(tempUri).copySync(target);
  return target.uri;
}

export function deleteLocalPhoto(uri: string | null | undefined) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {}
}

// The copy on the phone when it exists (works offline), otherwise the server's photo
export function photoUri(ride: Pick<Ride, "local_photo" | "photo_url">): string | null {
  if (ride.local_photo) {
    try {
      if (new File(ride.local_photo).exists) return ride.local_photo;
    } catch {}
  }
  return ride.photo_url ? `${SERVER_URL}${ride.photo_url}` : null;
}
