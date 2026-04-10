// src/utils/device.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import "react-native-get-random-values"; // Cần thiết cho uuid trên RN
import { v4 as uuidv4 } from "uuid";

export async function getDeviceId() {
  let deviceId = await AsyncStorage.getItem("deviceId");

  if (!deviceId) {
    deviceId = uuidv4();
    await AsyncStorage.setItem("deviceId", deviceId);
  }

  return deviceId;
}
