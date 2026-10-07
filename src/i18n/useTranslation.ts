import { usePreferences } from "../stores/preferencesStore";
import { messages } from "./messages";

export function useTranslation() {
  return messages[usePreferences((state) => state.language)];
}
