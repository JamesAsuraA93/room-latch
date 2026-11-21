'use client'
import {useEffect, useState} from 'react'
import {FEED, type FeedPost} from '@/lib/demo'

// Team posts from /api/feed (Neon). Until it answers, or if it fails/returns none, use the labelled examples.
export function useFeedPosts(): FeedPost[] {
  const [posts, setPosts] = useState<FeedPost[]>(FEED)
  useEffect(() => {
    let live = true
    fetch('/api/feed').then(r => (r.ok ? r.json() : null)).then(d => {
      if (live && d?.posts?.length) setPosts(d.posts as FeedPost[])
    }).catch(() => {})
    return () => { live = false }
  }, [])
  return posts
}
