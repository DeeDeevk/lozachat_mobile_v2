import { router } from "expo-router";

export const navigationHelper = {
  goToTabs: () => router.replace("/(tabs)"),
};