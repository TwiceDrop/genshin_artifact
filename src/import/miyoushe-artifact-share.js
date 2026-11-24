import { titleDistance } from './ocr-name-match.mjs'
import { slotLabels } from './artifact-screenshot.mjs'

// The Genshin battle-record export puts a row of evenly spaced gold stars below
// each artifact icon. Anchor to these rows, since the character header can vary in height.
function findCards(canvas) {
    const w = canvas.width, h = canvas.height
    if (h < w * 2) return []
    const pixels = canvas.getContext('2d').getImageData(0, 0, w, h).data
    const cards = []
    for (const offset of [0, .454]) {
        let start = 0, stars = 0
        for (let y = Math.floor(h / 3); y < h; y++) {
            const runs = []
            let begin = 0
            for (let x = Math.floor(w * (.368 + offset)); x <= Math.ceil(w * (.465 + offset)); x++) {
                const i = 4 * (y*w+x), gold = pixels[i] > 200 && pixels[i+1] > 150 && pixels[i+2] < 125
                if (gold && !begin) begin = x
                if (!gold && begin) {
                    if (x-begin >= w*.0018 && x-begin <= w*.015) runs.push(begin)
                    begin = 0
                }
            }
            const row = runs.length >= 3 && runs.length <= 5 && runs.every((x,i) => !i || (x-runs[i-1] >= w*.012 && x-runs[i-1] <= w*.021))
            if (row) {
                if (!start) start = y
                stars = Math.max(stars, runs.length)
            } else if (start) {
                if (y-start >= w*.0045) cards.push({offset, y:(start+y-1)/2, stars})
                start = 0; stars = 0
            }
        }
    }
    return cards.sort((a,b) => Math.abs(a.y-b.y) < w*.015 ? a.offset-b.offset : a.y-b.y)
}

// Convert light or gold lettering on the blue card to dark text for the OCR worker.
function field(canvas, x, y, width, height) {
    const out = document.createElement('canvas')
    out.width = Math.round(width*2)+20; out.height = Math.round(height*2)+16
    const ctx = out.getContext('2d', {willReadFrequently:true})
    ctx.fillStyle = 'white'; ctx.fillRect(0,0,out.width,out.height)
    ctx.drawImage(canvas,x,y,width,height,10,8,out.width-20,out.height-16)
    const image = ctx.getImageData(10,8,out.width-20,out.height-16)
    for (let i=0; i<image.data.length; i+=4) {
        const shade = Math.max(0, Math.min(255, (165-Math.max(image.data[i],image.data[i+1]))*3))
        image.data[i] = shade; image.data[i+1] = shade; image.data[i+2] = shade
    }
    ctx.putImageData(image,10,8)
    return out
}

// Check the number of printed glyphs: adjacent narrow ones in the game's font
// can collapse into a single character when the entire value is read as a word.
async function readNumber(patch, reader, signal) {
    const read = async image => (await reader.readLine(image)).trim().replace(/\s/g,'')
    const text = await read(patch)
    const w = patch.width, h = patch.height, pixels = patch.getContext('2d').getImageData(0,0,w,h).data
    const glyphs = []
    let glyph
    for (let x=0;x<w;x++) {
        let top=h, bottom=-1
        for (let y=0;y<h;y++) if (pixels[4*(y*w+x)] < 130) { top=Math.min(top,y); bottom=y }
        if (bottom < top) { glyph=undefined; continue }
        if (!glyph) { glyph={left:x,right:x,top,bottom}; glyphs.push(glyph) }
        glyph.right=x; glyph.top=Math.min(top,glyph.top); glyph.bottom=Math.max(bottom,glyph.bottom)
    }
    if (!glyphs.length) return null
    if (glyphs.length === text.length && /^\d+(\.\d)?%?$/.test(text)) return text
    const tallest = Math.max(...glyphs.map(g => g.bottom-g.top+1))
    const chars = []
    let joinedDigits = false
    for (const [i,g] of glyphs.entries()) {
        if (signal.aborted) throw new DOMException('已取消','AbortError')
        const gw=g.right-g.left+1, gh=g.bottom-g.top+1
        if (gh < tallest*.37 && gw < tallest*.45) chars.push('.')
        else if (gw/gh < .54) chars.push('1')
        else if (i === glyphs.length-1 && text.endsWith('%')) chars.push('%')
        else {
            const single=document.createElement('canvas')
            single.width=gw+20; single.height=gh+20
            const ctx=single.getContext('2d')
            ctx.fillStyle='white'; ctx.fillRect(0,0,single.width,single.height)
            ctx.drawImage(patch,g.left,g.top,gw,gh,10,10,gw,gh)
            const character=await read(single)
            // Touching digits can occupy one ink region. Accept a multi-digit
            // reading only when the assembled regions agree with the full line.
            if (!/^(?:\d+|%)$/.test(character)) return ''
            if (character.length > 1) joinedDigits = true
            chars.push(character)
        }
    }
    const assembled = chars.join('')
    return joinedDigits && assembled !== text ? '' : assembled
}
function identifyPiece(title, pieces) {
    const exact = pieces.filter(p => title.includes(p.name))
    if (exact.length === 1) return exact[0]
    const partial = pieces.filter(p => Array.from({length: p.name.length-2}, (_,i) => p.name.slice(i,i+3)).some(part => title.includes(part)))
    if (partial.length === 1) return partial[0]
    const ranked = pieces.map(piece => ({piece, distance:titleDistance(title,piece.name)})).sort((a,b) => a.distance-b.distance)
    const [best, second] = ranked
    return best && best.distance <= best.piece.name.length*.45 && second?.distance >= best.distance+2 ? best.piece : null
}

export async function readShareCards(canvas, reader, signal, sets, locale, tags) {
    const cards = findCards(canvas)
    if (!cards.length) return null
    const pieces = Object.entries(sets).flatMap(([setName,set]) => Object.keys(slotLabels)
        .filter(position => locale[set[position]?.text])
        .map(position => ({position,setName,name:locale[set[position].text]})))
    const drafts = [], w = canvas.width
    const read = async (card,left,right,center,height) => {
        if (signal.aborted) throw new DOMException('已取消','AbortError')
        const patch = field(canvas,(card.offset+left)*w,card.y+(center-height/2)*w,(right-left)*w,height*w)
        const text = await reader.readLine(patch)
        return text.normalize('NFKC').replace(/\s/g,'')
    }
    const rows = [.072,.143,.212,.282,.351]
    const headers = []
    await reader.configure('chi_sim', '')
    for (const card of cards) {
        const title = await read(card,.087,.364,-.047,.042)
        const labels = []
        for (const row of rows) labels.push(await read(card,.087,.33,row,.045))
        headers.push({card,piece:identifyPiece(title,pieces),labels})
    }
    if (signal.aborted) throw new DOMException('已取消','AbortError')
    await reader.configure('eng', '0123456789.%')
    for (const {card,piece,labels} of headers) {
        const levelText = await read(card,.113,.164,-.003,.031)
        const level = levelText.match(/\d{1,2}$/)?.[0]
        const lines = []
        for (const [i,row] of rows.entries()) {
            const patch = field(canvas,(card.offset+.325)*w,card.y+(row-.023)*w,.137*w,.046*w)
            const reading = await readNumber(patch,reader,signal)
            const num = reading?.match(/^(\d+(?:\.\d)?)(%?)$/)
            const label = labels[i]
            const found = Object.values(tags).filter(tag => label.includes(tag.chs.replace(/%$/,'')))
            const tag = found.length === 1 ? found[0] : found.find(tag => tag.percentage === (!!num?.[2] || !!reading?.includes('.')))
            if (i === 0 || reading !== null || label) lines.push({row:i, name:tag?.name || '',value:num?.[1] || ''})
        }
        // A gold decoration alone is not an artifact. Require a piece name or readable stat rows.
        if (!piece && lines.filter(line => line.name && line.value).length < 2) continue
        const [mainTag,...normalTags] = lines
        drafts.push({setName:piece?.setName || '',position:piece?.position || '',star:card.stars,
            level:level != null && Number(level)<=20 ? Number(level) : '', mainTag,normalTags,
            region:{left:card.offset+.057,top:card.y/w-.09,width:.43,height:.49}})
    }
    return drafts.length ? drafts : null
}
