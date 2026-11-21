'use client'
import {useEffect, useState} from 'react'
import {EMPTY_SOCIAL, FEED, readSocial, writeSocial, type FeedPost, type Social} from '@/lib/demo'

type FeedStatus = 'loading' | 'ready' | 'error'

// Published community posts from /api/feed (Neon). While loading, callers show skeletons; if it fails/returns none, use the labelled examples.
export function useFeedPosts(): {posts: FeedPost[]; status: FeedStatus} {
  const [state, setState] = useState<{posts: FeedPost[]; status: FeedStatus}>({posts: [], status: 'loading'})
  useEffect(() => {
    let live = true
    const refresh = () => fetch('/api/feed', {cache: 'no-store'}).then(r => (r.ok ? r.json() : Promise.reject(r.status))).then(d => {
      if (live) setState({posts: d?.posts?.length ? d.posts as FeedPost[] : FEED, status: 'ready'})
    }).catch(() => { if (live) setState({posts: FEED, status: 'error'}) })
    void refresh()
    window.addEventListener('roomlatch:feed-updated', refresh)
    window.addEventListener('focus', refresh)
    return () => { live = false; window.removeEventListener('roomlatch:feed-updated', refresh); window.removeEventListener('focus', refresh) }
  }, [])
  return state
}

// ไลก์ เซฟ และโพสต์ของเครื่องนี้ (localStorage) อ่านหลัง mount เพราะฝั่ง server ไม่มี localStorage
export function useSocial(): [Social, (next: Social) => void] {
  const [social, setSocial] = useState<Social>(EMPTY_SOCIAL)
  useEffect(() => setSocial(readSocial()), [])
  return [social, next => { setSocial(next); writeSocial(next) }]
}
