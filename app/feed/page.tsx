import {FeedList} from '@/components/feed-list'
import {PageHeader} from '@/components/page-header'

export default function Feed() {
  return <div className="space-y-6">
    <PageHeader title="ห้องจากชุมชน">บันทึกไอเดียที่ชอบ หรือลองใช้กับห้องของคุณ</PageHeader>
    <FeedList tabs />
  </div>
}
