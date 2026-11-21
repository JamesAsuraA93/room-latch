'use client'
import {useEffect, useRef, useState} from 'react'

/** onClick + Enter/Space สำหรับ element ที่ใช้ role="button" */
export const pressProps = (action: () => void) => ({
  onClick: () => action(),
  onKeyDown: (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      action()
    }
  },
})

/** ไฟล์ที่เลือกจาก <input type="file"> แล้วล้างค่า input ให้เลือกไฟล์เดิมซ้ำได้ */
export function pickedFiles(e: React.ChangeEvent<HTMLInputElement>): File[] {
  const files = Array.from(e.target.files || [])
  e.target.value = ''
  return files
}

/**
 * กรอบรับไฟล์: ลากวางลงกรอบ (dropProps) + วางจากคลิปบอร์ดได้ทั้งหน้า
 * onFiles ควรเป็น useCallback เพราะ listener ของ window ผูกใหม่ทุกครั้งที่ onFiles เปลี่ยน
 */
export function useFileDrop({disabled, onFiles, onEmptyDrop}: {
  disabled: boolean
  onFiles: (files: File[]) => void | Promise<void>
  onEmptyDrop: () => void
}) {
  const [dragging, setDragging] = useState(false)
  // dragenter/dragleave fire for every child element, so count depth instead of trusting one leave
  const depth = useRef(0)

  useEffect(() => {
    function paste(e: ClipboardEvent) {
      // Preserve normal paste behavior in any editable controls.
      if (e.target instanceof Element && e.target.closest('input, textarea, [contenteditable]:not([contenteditable="false"])')) return
      const data = e.clipboardData
      if (!data) return
      const files = Array.from(data.files)
      // Some browsers expose clipboard images only through DataTransferItem.
      if (!files.length) {
        for (const item of Array.from(data.items)) {
          const file = item.kind === 'file' ? item.getAsFile() : null
          if (file) files.push(file)
        }
      }
      if (!files.length) return
      e.preventDefault()
      void onFiles(files)
    }
    // Stop the browser from navigating away if a file misses the drop zone.
    function preventFileNavigation(e: DragEvent) {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
    }
    window.addEventListener('paste', paste)
    window.addEventListener('dragover', preventFileNavigation)
    window.addEventListener('drop', preventFileNavigation)
    return () => {
      window.removeEventListener('paste', paste)
      window.removeEventListener('dragover', preventFileNavigation)
      window.removeEventListener('drop', preventFileNavigation)
    }
  }, [onFiles])

  const dropProps = {
    onDragEnter(e: React.DragEvent) {
      if (!e.dataTransfer.types.includes('Files')) return
      e.preventDefault()
      depth.current += 1
      if (!disabled) setDragging(true)
    },
    onDragOver(e: React.DragEvent) {
      e.preventDefault()
      e.dataTransfer.dropEffect = disabled ? 'none' : 'copy'
    },
    onDragLeave(e: React.DragEvent) {
      e.preventDefault()
      depth.current = Math.max(0, depth.current - 1)
      if (!depth.current) setDragging(false)
    },
    onDrop(e: React.DragEvent) {
      e.preventDefault()
      depth.current = 0
      setDragging(false)
      const files = Array.from(e.dataTransfer.files)
      if (files.length) void onFiles(files)
      else onEmptyDrop()
    },
  }
  return {dragging, dropProps}
}
