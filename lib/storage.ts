import { storage } from "wxt/utils/storage";
import { defaultSettings, normalizeSettings, type Settings } from "./settings";

export const settingsItem = storage.defineItem<Settings>("local:settings", {
  fallback: defaultSettings,
});

export async function loadSettings(): Promise<Settings> {
  return normalizeSettings(await settingsItem.getValue());
}
