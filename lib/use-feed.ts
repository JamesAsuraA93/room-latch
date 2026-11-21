'use client'
import {useEffect, useState} from 'react'
import {FEED, type FeedPost} from '@/lib/demo'

export type FeedStatus = 'loading' | 'ready' | 'error'

// Team posts from /api/feed (Neon). While loading, callers show skeletons; if it fails/returns none, use the labelled examples.
export function useFeedPosts(): {posts: FeedPost[]; status: FeedStatus} {
  const [state, setState] = useState<{posts: FeedPost[]; status: FeedStatus}>({posts: [], status: 'loading'})
  useEffect(() => {
    let live = true
    fetch('/api/feed').then(r => (r.ok ? r.json() : Promise.reject(r.status))).then(d => {
      if (live) setState({posts: d?.posts?.length ? d.posts as FeedPost[] : FEED, status: 'ready'})
    }).catch(() => { if (live) setState({posts: FEED, status: 'error'}) })
    return () => { live = false }
  }, [])
  return state
}
