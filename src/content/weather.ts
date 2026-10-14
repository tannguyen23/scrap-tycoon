import type { WeatherProfile } from '@domain/types'

/**
 * Lịch thời tiết của game: mỗi block = 480s = đúng một ngày game (xem
 * `lighting.DAY_LENGTH_SECONDS`), block đầu tiên luôn là `clear` — trời đẹp mở
 * màn cho người mới. `workMultiplier` toàn cục cho mọi thợ; `visual` là tham số
 * trình bày cho lớp weather của scene. Tinh chỉnh ở ĐÂY, không hardcode trong
 * systems/UI.
 */
export const WEATHER: WeatherProfile = {
  blockSeconds: 480,
  transitionSeconds: 24,
  kinds: [
    {
      id: 'clear',
      label: { vi: 'Nắng', en: 'Clear' },
      weight: 30,
      workMultiplier: 1,
      visual: { cloudCover: 0.15, rain: 0, wind: 0.25, lightning: 0 },
    },
    {
      id: 'cloudy',
      label: { vi: 'Nhiều mây', en: 'Cloudy' },
      weight: 26,
      workMultiplier: 0.97,
      visual: { cloudCover: 0.8, rain: 0, wind: 0.35, lightning: 0 },
    },
    {
      id: 'rain',
      label: { vi: 'Mưa rào', en: 'Rain' },
      weight: 20,
      workMultiplier: 0.9,
      visual: { cloudCover: 0.95, rain: 0.7, wind: 0.55, lightning: 0 },
    },
    {
      id: 'windy',
      label: { vi: 'Gió mạnh', en: 'Windy' },
      weight: 12,
      workMultiplier: 0.95,
      visual: { cloudCover: 0.55, rain: 0.15, wind: 1, lightning: 0 },
    },
    {
      id: 'storm',
      label: { vi: 'Bão', en: 'Storm' },
      weight: 12,
      workMultiplier: 0.75,
      visual: { cloudCover: 1, rain: 1, wind: 1.35, lightning: 8 },
    },
  ],
}
