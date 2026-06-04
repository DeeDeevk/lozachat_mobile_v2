import type { NotificationItem } from "@/types/post";

type SocialEventName = "notification";

type SocialEventPayloadMap = {
  notification: NotificationItem;
};

type Listener<T> = (payload: T) => void;

const listeners: {
  [K in SocialEventName]: Set<Listener<SocialEventPayloadMap[K]>>;
} = {
  notification: new Set(),
};

export function emitSocialEvent<K extends SocialEventName>(
  event: K,
  payload: SocialEventPayloadMap[K],
) {
  listeners[event].forEach((listener) => listener(payload));
}

export function subscribeSocialEvent<K extends SocialEventName>(
  event: K,
  listener: Listener<SocialEventPayloadMap[K]>,
) {
  listeners[event].add(listener);
  return () => {
    listeners[event].delete(listener);
  };
}