import {DesignResult} from '@/components/design-result'

export default async function Result({searchParams}: {searchParams: Promise<{job?: string}>}) {
  const {job} = await searchParams
  const jobId = typeof job === 'string' && /^[A-Za-z0-9-]{1,100}$/.test(job) ? job : undefined
  return <DesignResult jobId={jobId} />
}
