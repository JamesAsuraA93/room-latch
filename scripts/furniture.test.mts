import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {furnitureCatalog, furnitureCategory, furnitureTotal, recommendFurniture, replaceFurniture, selectionContext, validateFurnitureIds, type Furniture} from '../lib/furniture.ts'
import {parseCsv, toProducts} from '../lib/plan.ts'
import {FIXTURES} from '../lib/fixtures.ts'
import {STYLE_IDS} from '../lib/styles.ts'
import {isListingImageUrl} from '../lib/listing-image.ts'
import {buildPrompt} from '../lib/live-render-core.ts'

const catalog = furnitureCatalog([], [...toProducts(parseCsv(readFileSync('catalog/products.csv', 'utf8'))), ...FIXTURES])
for (const style of STYLE_IDS) for (const roomType of ['condo', 'living', 'bedroom']) for (const budget of [1, 3500, 5000, 10000]) {
  const items = recommendFurniture(catalog, {style, roomType, budget})
  assert.ok(furnitureTotal(items).total <= budget)
  assert.ok(items.every(item => item.styles.includes(style)))
  assert.equal(new Set(items.map(item => item.id)).size, items.length)
  assert.equal(new Set(items.map(item => item.category)).size, items.length)
  assert.ok(items.length <= 6)
}
const plan = {style: 'minimal', roomType: 'condo', budget: 5000}
const selected = recommendFurniture(catalog, plan)
const chair = selected.find(item => item.category === 'chair')!
const sofa = catalog.find(item => item.category === 'sofa')!
assert.ok(chair && sofa, 'recommendations include a chair and replacements include a sofa')
const swapped = replaceFurniture(selected, chair.id, sofa)
assert.equal(swapped.length, selected.length)
assert.ok(swapped.some(item => item.id === sofa.id))
assert.ok(!swapped.some(item => item.id === chair.id))
assert.deepEqual(swapped.filter(item => item.id !== sofa.id), selected.filter(item => item.id !== chair.id))
assert.equal(furnitureTotal(swapped).total, furnitureTotal(selected).total - chair.price! + sofa.price!)
assert.deepEqual(replaceFurniture(selected, chair.id, selected.find(item => item.id !== chair.id)!), selected, 'no duplicate selection')
assert.deepEqual(replaceFurniture(selected, 'missing', sofa), selected)
assert.equal(furnitureCategory('LOOMS โซฟา 2 ที่นั่ง', 'seating'), 'sofa')
assert.equal(furnitureCategory('เก้าอี้ไม้', 'seating'), 'chair')
assert.equal(furnitureCategory('โคมไฟตั้งโต๊ะ', 'light'), 'light')
assert.equal(furnitureCategory('แจกันสำหรับโต๊ะกินข้าว', 'accent'), 'decor')
assert.equal(furnitureCategory('พรมวางหน้าโซฟา', 'textile'), 'rug')
const unknown: Furniture = {...sofa, id: 'shopee-unknown', price: null, priceKind: 'unknown'}
assert.deepEqual(furnitureTotal([unknown]), {total: 0, unknown: 1, estimated: false})
assert.deepEqual(recommendFurniture([unknown], plan), [], 'unknown prices cannot be claimed to fit the budget')
const realChair: Furniture = {...chair, id: 'shopee-chair', priceKind: 'listed', price: 1000, image: 'https://down-th.img.susercontent.com/file/chair'}
const placeholder = furnitureCatalog([{id: 'shopee-placeholder', title: 'เก้าอี้', category: 'seating', styles: ['minimal'], url: 'https://shopee.co.th/product/1/2', verification: 'listing', dimensions: null, notes: '', price: 1}], [])
assert.equal(placeholder[0].price, null, 'a promotional placeholder must not be treated as a furniture price')
assert.equal(placeholder[0].priceKind, 'unknown')
assert.ok(recommendFurniture([...catalog, realChair], plan).some(item => item.id === realChair.id), 'prefer a known-price listing')
assert.notEqual(selectionContext(plan), selectionContext({...plan, budget: 10000}))
const known = new Map(catalog.map(item => [item.id, item.name]))
assert.equal(validateFurnitureIds(swapped.map(item => item.id), known), true)
for (const ids of [[], ['unknown'], [chair.id, chair.id], catalog.slice(0, 7).map(item => item.id)]) assert.equal(validateFurnitureIds(ids, known), false)
assert.equal(isListingImageUrl('https://down-th.img.susercontent.com/file/test'), true)
for (const url of ['http://down-th.img.susercontent.com/file/test', 'https://localhost/image', 'https://down-th.img.susercontent.com.evil.test/image', 'https://user:pass@down-th.img.susercontent.com/image', 'https://down-th.img.susercontent.com:8443/image', 'file:///etc/passwd']) assert.equal(isListingImageUrl(url), false)
const prompt = buildPrompt({key: 'minimal', th: 'มินิมอล', prompt: 'simple'}, swapped.map(item => ({id: item.id, name: item.name, x: 0, y: 0, w: 0})), 'input.png')
assert.ok(prompt.includes(sofa.name))
assert.ok(!prompt.includes(chair.name))
assert.match(prompt, /approximate visual description/)
console.log('Furniture recommendations, chair-to-sofa replacement, totals, selection validation and image URL boundaries passed')
