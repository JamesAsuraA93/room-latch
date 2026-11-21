// Example Feed posts (no imports: checked against the real catalog in scripts/real-catalog.test.mts).
// Items are exact Shopee listings from catalog/shopee-real-*.csv; links are rebuilt from shop/item ids.
// No price, stock or fit claims. Images stay null until a verified owner Before (by SHA256) and a
// Codex After exist locally; they are never bundled or published (see lib/local-demo.ts).
type ExampleItem = {id: string; name: string; url: string}
type ExamplePost = {id: string; style: string; roomType: string; roomLabel: string; items: ExampleItem[]}

const item = (shop: number, itemId: number, name: string): ExampleItem =>
  ({id: `shopee-${shop}-${itemId}`, name, url: `https://shopee.co.th/product/${shop}/${itemId}`})

export const EXAMPLE_POSTS: ExamplePost[] = [
  {
    id: 'ex-japandi', style: 'japandi', roomType: 'living', roomLabel: 'ห้องนั่งเล่นจริงของทีม',
    items: [
      item(752155244, 24157985406, 'LOOMS โซฟาผ้า 2 ที่นั่ง รุ่น KASIO สีครีม'),
      item(8716640, 29654432253, 'HomeHuk โต๊ะกลางทรงกลม รุ่นโฮมมี่ ขนาด 40 x 40 x 44 ซม. - สีธรรมชาติ'),
      item(203652492, 57803712732, 'โคมไฟตั้งพื้นสไตล์ครีมยอดนิยม โป๊ะจีบ วินเทจ ห้องนอน ข้างเตียง เพิ่มบรรยากาศอบอุ่น'),
      item(1026823971, 25633665966, 'MEET COZY พรมปูพื้นห้อง นุ่ม carpet living room พรม ผ้าแคชเมียร์เทียม พรมปูพื้น #1 DB-Jack'),
    ],
  },
  {
    id: 'ex-loft', style: 'loft', roomType: 'living', roomLabel: 'ห้องนั่งเล่นจริงของทีม',
    items: [
      item(821614879, 42478007215, 'DECOS RELAX โซฟา 2 ที่นั่ง สีน้ำตาล'),
      item(496944996, 19034903448, 'โต๊ะกลางโซฟาไม้จริง โครงขาเหล็ก'),
      item(404498696, 23614695077, 'LUZINO Maple FL90932B โคมไฟตั้งพื้น สีดำ–ทอง'),
      item(275314398, 50971525679, 'พรมขนแกะเทียม ลายทาง–เรขาคณิตวินเทจ'),
    ],
  },
]
