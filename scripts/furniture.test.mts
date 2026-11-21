import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {furnitureCatalog, furnitureCategory, furnitureTotal, recommendFurniture, replaceFurniture, replaceUnavailableFurniture, selectionContext, validateFurnitureIds, type Furniture} from '../lib/furniture.ts'
import {parseCsv, toProducts} from '../lib/plan.ts'
import {FIXTURES} from '../lib/fixtures.ts'
import {STYLE_IDS} from '../lib/styles.ts'
import {isListingImageUrl, listingImagePath} from '../lib/listing-image.ts'
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
assert.notEqual(selectionContext({...plan, need: 'เก้าอี้'}), selectionContext({...plan, need: 'โซฟา'}), 'changed needs invalidate the saved furniture selection')
assert.equal(selectionContext({...plan, need: ' โซฟา '}), selectionContext({...plan, need: 'โซฟา'}), 'ignore outer whitespace')
assert.equal(selectionContext(plan), selectionContext({...plan, need: '', areaM2: null}))
assert.notEqual(selectionContext({...plan, areaM2: 20}), selectionContext({...plan, areaM2: 40}))
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

const seat: Furniture = {...sofa, id: 'seat', styles: ['minimal'], image: '/seat.jpg', price: 3000, priceKind: 'listed'}
const brokenLight: Furniture = {...seat, id: 'broken', category: 'light', price: 1000, image: null}
const light: Furniture = {...brokenLight, id: 'replacement', image: '/light.jpg', price: 1500}
const alternatives = [
  {...light, id: 'too-expensive', price: 2500},
  {...light, id: 'also-broken'},
  {...light, id: 'wrong-style', styles: ['loft']},
  {...light, id: 'no-photo', image: null},
  {...light, id: 'wrong-category', category: 'table' as const},
  light,
]
const repaired = replaceUnavailableFurniture([seat, brokenLight], alternatives, plan, new Set(['broken', 'also-broken']))
assert.deepEqual(repaired.items.map(item => item.id), ['seat', 'replacement'])
assert.equal(repaired.items[0], seat, 'keep the other user-selected product intact')
assert.equal(furnitureTotal(repaired.items).total, 4500)
assert.equal(repaired.unfilled.length, 0)
const noFit = replaceUnavailableFurniture([seat, brokenLight], alternatives, {...plan, budget: 4000}, new Set(['broken', 'also-broken']))
assert.equal(noFit.unfilled.length, 1, 'explicitly report when no photographed replacement fits')
assert.deepEqual(noFit.items.map(item => item.id), ['seat'])
assert.equal(listingImagePath('shopee-1873613185-50463733071'), '/api/listings/shopee-1873613185-50463733071/image')
assert.equal(listingImagePath('../../secret'), null)
console.log('Missing-photo replacements preserve category, style, other selections and budget')
