import {redirect} from 'next/navigation'

// ฟีดย้ายไปรวมกับหน้าแรก เก็บ /feed ไว้ให้ลิงก์เก่ายังใช้ได้
export default function Feed() {
  redirect('/')
}
