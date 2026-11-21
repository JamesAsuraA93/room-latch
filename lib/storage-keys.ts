// Every browser-storage key the app uses, each defined once.
// No imports: loaded by Next (via '@/lib/storage-keys') and by plain Node tests (via './storage-keys.ts').

// sessionStorage: this tab only, gone when the tab closes
export const PLAN_KEY = 'room-ai-plan'
export const ROOM_IMAGE_KEY = 'room-ai-photo' // main room photo, always equal to the first entry of ROOM_IMAGES_KEY
export const ROOM_IMAGES_KEY = 'room-ai-photos'
export const STYLE_REFERENCE_KEY = 'room-ai-style-reference'
export const FLOOR_PLAN_KEY = 'room-ai-floor-plan'
export const PRODUCT_RENDER_KEY = 'room-ai-product-render' // product photos attached for the AI render
export const PLACEMENT_KEY = 'room-ai-placement'
export const RENDER_KEY = 'room-ai-render' // ผลจาก /api/render ล่าสุด (provider, jobId) ไม่มีรูป
export const RECOMMEND_KEY = 'room-ai-recommend' // last AI product picks and the plan they were made for
export const LAST_DESIGN_KEY = 'room-ai-last-design'
export const FURNITURE_SELECTION_KEY = 'room-ai-furniture-selection'
export const DESIGN_JOB_KEY = 'room-ai-design-job'

// localStorage: stays on this device
export const SOCIAL_KEY = 'room-ai-social'
export const DRAFTS_KEY = 'room-ai-drafts'
export const DISMISSED_OUTCOME_PREFIX = 'room-ai-dismissed-outcome:'
