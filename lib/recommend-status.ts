export type RecommendFailure = 'missing_api_key' | 'no_candidates' | 'daily_limit' | 'schema_required' | 'limit_check_failed' | 'api_auth' | 'api_quota' | 'model_unavailable' | 'model_request_invalid' | 'model_timeout' | 'model_network' | 'model_invalid_response' | 'model_failed'

const MESSAGES: Record<RecommendFailure, string> = {
  missing_api_key: 'ยังไม่ได้ตั้งค่าการเชื่อมต่อ AI บนเซิร์ฟเวอร์',
  no_candidates: 'ไม่พบสินค้าที่มีรูปในสไตล์และงบนี้ ลองปรับสไตล์หรืองบ',
  daily_limit: 'ใช้ AI แนะนำสินค้าครบขีดจำกัดประจำวันแล้ว',
  schema_required: 'ฐานข้อมูลสำหรับบันทึกการใช้ AI ยังไม่ได้อัปเดต',
  limit_check_failed: 'ตรวจสอบสิทธิ์การใช้ AI กับฐานข้อมูลไม่ได้ กรุณาลองใหม่',
  api_auth: 'AI ปฏิเสธการเชื่อมต่อ กรุณาตรวจ API key และสิทธิ์บนเซิร์ฟเวอร์',
  api_quota: 'โควตาหรืออัตราการเรียก AI ถึงขีดจำกัดแล้ว',
  model_unavailable: 'โมเดล AI ที่ตั้งค่าไว้ไม่พร้อมใช้งานหรือบัญชีไม่มีสิทธิ์',
  model_request_invalid: 'การตั้งค่าโมเดล AI ไม่รองรับคำขอแนะนำสินค้า',
  model_timeout: 'AI ใช้เวลาตอบนานเกินไป กรุณาลองใหม่',
  model_network: 'เซิร์ฟเวอร์เชื่อมต่อ AI ไม่ได้ กรุณาลองใหม่',
  model_invalid_response: 'AI ส่งรายการสินค้าที่ใช้ไม่ได้ กรุณาลองใหม่',
  model_failed: 'AI แนะนำสินค้าไม่สำเร็จ กรุณาลองใหม่',
}
export const recommendationFailureMessage = (code?: RecommendFailure) => MESSAGES[code ?? 'model_failed'] ?? MESSAGES.model_failed

/** Only safe codes reach the browser; provider messages may include user data. */
export function recommendationFailure(error: unknown): RecommendFailure {
  const e = error as {code?: string; status?: number; name?: string; cause?: {code?: string}}
  if (e?.code === 'missing_api_key') return 'missing_api_key'
  if (e?.status === 401 || e?.status === 403) return 'api_auth'
  if (e?.status === 429) return 'api_quota'
  if (e?.status === 404) return 'model_unavailable'
  if (e?.status === 400 || e?.status === 422) return 'model_request_invalid'
  if (e?.name === 'TimeoutError' || e?.name === 'AbortError') return 'model_timeout'
  if (e?.code === 'bad_response') return 'model_invalid_response'
  if (e?.name === 'TypeError' || e?.cause?.code) return 'model_network'
  return 'model_failed'
}
