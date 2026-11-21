// Single source of truth for the app's style and room-type ids.
// No imports: loaded by Next (via '@/lib/styles') and by plain Node tests/scripts (via './styles.ts').
// Style ids must match the `styles` column in catalog/products.csv and the keys in prompts/registry.json.
export const STYLE_IDS = ['minimal', 'muji', 'japandi', 'scandi', 'loft', 'luxe', 'boho', 'nordic'] as const
export type StyleId = typeof STYLE_IDS[number]

export const ROOM_TYPE_IDS = ['condo', 'bedroom', 'living', 'empty', 'cluttered'] as const
export type RoomTypeId = typeof ROOM_TYPE_IDS[number]

export const isStyleId = (v: unknown): v is StyleId => (STYLE_IDS as readonly unknown[]).includes(v)
export const isRoomTypeId = (v: unknown): v is RoomTypeId => (ROOM_TYPE_IDS as readonly unknown[]).includes(v)
