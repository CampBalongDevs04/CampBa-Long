// ============================================================================
//  Minimal .xlsx writer — no dependencies
// ----------------------------------------------------------------------------
//  The export section used to hand out CSV named "Excel-compatible", which
//  loses every bit of formatting the resort's own Booking.xlsx relies on:
//  column widths, the bordered grid, real date cells, peso amounts that sum,
//  and the green/red PAID vs WITH BALANCE colouring. A CSV cannot carry any of
//  that, so this module writes the real thing.
//
//  An .xlsx is a ZIP of XML parts. Both halves are small enough to write by
//  hand, and doing so keeps a spreadsheet library out of a bundle that
//  otherwise ships nothing but React and the Supabase client:
//
//    [Content_Types].xml      what each part is
//    _rels/.rels              → xl/workbook.xml
//    xl/workbook.xml          the sheet list
//    xl/_rels/workbook.xml.rels
//    xl/styles.xml            fonts/fills/borders/number formats, by index
//    xl/worksheets/sheet1.xml the cells
//
//  Strings are written inline (t="inlineStr") rather than through a shared
//  string table — one fewer part to keep consistent, and a booking report has
//  little repetition to dedupe anyway.
//
//  Compression uses the browser's own CompressionStream('deflate-raw') where
//  it exists and falls back to storing the parts uncompressed, which is still
//  a valid ZIP. Either way the file opens in Excel, Google Sheets and
//  LibreOffice.
// ============================================================================

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

// ------------------------------------------------------------- style indexes
// Indexes into the <cellXfs> list built by stylesXml() below. Callers name a
// style instead of counting positions, so inserting one later cannot silently
// repaint every cell that came after it.
export const S = {
    DEFAULT: 0,
    EYEBROW: 1,       // 'CAMP BA-LONG' above the title
    TITLE: 2,
    META_LABEL: 3,    // 'Period:', 'Generated:'
    META_VALUE: 4,
    BAND: 5,          // cream filler, so the header block reads as one block
    HEADER: 6,        // the column headers
    TEXT: 7,          // centred body cell
    TEXT_LEFT: 8,
    DATE: 9,          // mm/dd/yyyy
    MONEY: 10,        // ₱#,##0.00
    SUM_LABEL: 11,
    SUM_MONEY: 12,
    SUM_COUNT: 13,
}

// Conditional-format styles, indexes into <dxfs>. Same colours the resort's
// own sheet uses on its Status column.
export const DXF = { PAID: 0, BALANCE: 1, CANCELLED: 2 }

// ------------------------------------------------------------------- helpers

// XML 1.0 has no escape for most control characters — they simply may not
// appear. One of them in a guest name would make the whole workbook
// unopenable rather than merely look wrong, so they are dropped here. Tab,
// newline and carriage return are the three that are allowed through.
function stripControls(value) {
    let out = ''
    for (const char of value) {
        const code = char.codePointAt(0)
        if (code < 32 && code !== 9 && code !== 10 && code !== 13) continue
        out += char
    }
    return out
}

function esc(value) {
    return stripControls(String(value))
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

// 0 → 'A', 25 → 'Z', 26 → 'AA'.
export function colName(index) {
    let name = ''
    let n = index + 1
    while (n > 0) {
        const remainder = (n - 1) % 26
        name = String.fromCharCode(65 + remainder) + name
        n = Math.floor((n - 1) / 26)
    }
    return name
}

// A JS Date → the number Excel stores dates as: days since 1899-12-30. The
// date is read in LOCAL parts and re-stamped as UTC, so a booking on Aug 11
// stays Aug 11 in the sheet instead of sliding a day west of Greenwich.
function serialDate(value) {
    const utc = Date.UTC(
        value.getFullYear(),
        value.getMonth(),
        value.getDate(),
        value.getHours(),
        value.getMinutes(),
        value.getSeconds(),
    )
    return utc / 86400000 + 25569
}

// ---------------------------------------------------------------- cell types
// A row is an array of these. A hole in a row (null/undefined) leaves the cell
// out of the XML entirely, which is how the spacer rows stay blank.

export function text(value, style = S.TEXT) {
    return { kind: 'text', value: value ?? '', style }
}

export function number(value, style = S.MONEY) {
    return { kind: 'number', value: Number(value) || 0, style }
}

export function date(value, style = S.DATE) {
    const parsed = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(parsed.getTime())) return text('—', S.TEXT)
    return { kind: 'number', value: serialDate(parsed), style }
}

export function blank(style = S.BAND) {
    return { kind: 'blank', style }
}

// ------------------------------------------------------------------ XML parts

function stylesXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="mm/dd/yyyy"/><numFmt numFmtId="165" formatCode="&quot;₱&quot;#,##0.00"/><numFmt numFmtId="166" formatCode="#,##0"/></numFmts>
<fonts count="7">
<font><sz val="11"/><color rgb="FF16291E"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FF16291E"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="18"/><color rgb="FF16291E"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FFF5F1E4"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="9"/><color rgb="FFC6A15B"/><name val="Calibri"/><family val="2"/></font>
<font><sz val="10"/><color rgb="FF4C6B4F"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="10"/><color rgb="FF16291E"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="5">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1E3A2B"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF5F1E4"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEFE9D6"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="3">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFD9CFB4"/></left><right style="thin"><color rgb="FFD9CFB4"/></right><top style="thin"><color rgb="FFD9CFB4"/></top><bottom style="thin"><color rgb="FFD9CFB4"/></bottom><diagonal/></border>
<border><left style="thin"><color rgb="FFD9CFB4"/></left><right style="thin"><color rgb="FFD9CFB4"/></right><top style="thin"><color rgb="FFC6A15B"/></top><bottom style="thin"><color rgb="FFC6A15B"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="14">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="4" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
<xf numFmtId="0" fontId="6" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
<xf numFmtId="0" fontId="5" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
<xf numFmtId="0" fontId="6" fillId="4" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
<xf numFmtId="165" fontId="1" fillId="4" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
<xf numFmtId="166" fontId="1" fillId="4" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
<dxfs count="3">
<dxf><font><b/><color rgb="FF0A2E17"/></font><fill><patternFill><bgColor rgb="FF00B050"/></patternFill></fill></dxf>
<dxf><font><b/><color rgb="FFFFFFFF"/></font><fill><patternFill><bgColor rgb="FFFF0000"/></patternFill></fill></dxf>
<dxf><font><i/><color rgb="FF5C5C5C"/></font><fill><patternFill><bgColor rgb="FFDDDDDD"/></patternFill></fill></dxf>
</dxfs>
</styleSheet>`
}

function cellXml(cell, ref) {
    if (cell == null) return ''
    const style = cell.style ? ` s="${cell.style}"` : ''
    if (cell.kind === 'blank') return `<c r="${ref}"${style}/>`
    if (cell.kind === 'number') {
        const value = Number.isFinite(cell.value) ? cell.value : 0
        return `<c r="${ref}"${style}><v>${value}</v></c>`
    }
    const value = esc(cell.value)
    if (value === '') return `<c r="${ref}"${style}/>`
    // xml:space keeps a value that ends in a space from being trimmed away.
    return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${value}</t></is></c>`
}

function sheetXml({ rows, columns, merges, freezeRow, autoFilterRef, conditionalFormats, rowHeights }) {
    const colsXml = columns.length
        ? `<cols>${columns
              .map(
                  (column, index) =>
                      `<col min="${index + 1}" max="${index + 1}" width="${column.width}" customWidth="1"/>`,
              )
              .join('')}</cols>`
        : ''

    const sheetData = rows
        .map((row, rowIndex) => {
            const rowNumber = rowIndex + 1
            const height = rowHeights?.[rowNumber]
            const heightAttr = height ? ` ht="${height}" customHeight="1"` : ''
            const cells = row
                .map((cell, colIndex) => cellXml(cell, `${colName(colIndex)}${rowNumber}`))
                .join('')
            return `<row r="${rowNumber}"${heightAttr}>${cells}</row>`
        })
        .join('')

    const lastColumn = colName(Math.max(columns.length, 1) - 1)
    const dimension = `A1:${lastColumn}${Math.max(rows.length, 1)}`

    // A frozen header row is the whole reason this report stays readable at 200
    // rows — scrolling keeps the column names in view.
    const pane = freezeRow
        ? `<pane ySplit="${freezeRow}" topLeftCell="A${freezeRow + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${freezeRow + 1}" sqref="A${freezeRow + 1}"/>`
        : ''

    const mergesXml = merges.length
        ? `<mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`
        : ''

    const conditionalXml = conditionalFormats
        .map(
            ({ ref, rules }) =>
                `<conditionalFormatting sqref="${ref}">${rules
                    .map(
                        (rule, index) =>
                            `<cfRule type="cellIs" dxfId="${rule.dxfId}" priority="${index + 1}" operator="equal"><formula>"${esc(rule.equals)}"</formula></cfRule>`,
                    )
                    .join('')}</conditionalFormatting>`,
        )
        .join('')

    // The order below is fixed by the schema — cols before sheetData,
    // autoFilter before mergeCells before conditionalFormatting — and Excel
    // refuses to open a file that gets it wrong.
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><tabColor rgb="FF1E3A2B"/><pageSetUpPr fitToPage="1"/></sheetPr>
<dimension ref="${dimension}"/>
<sheetViews><sheetView showGridLines="0" tabSelected="1" workbookViewId="0">${pane}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
${colsXml}
<sheetData>${sheetData}</sheetData>
${autoFilterRef ? `<autoFilter ref="${autoFilterRef}"/>` : ''}
${mergesXml}
${conditionalXml}
<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>
<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`
}

function workbookXml(sheetName) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<workbookPr/>
<sheets><sheet name="${esc(sheetName)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

// ---------------------------------------------------------------------- zip

const CRC_TABLE = (() => {
    const table = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
        let c = i
        for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
        table[i] = c >>> 0
    }
    return table
})()

function crc32(bytes) {
    let crc = 0xffffffff
    for (let i = 0; i < bytes.length; i++) {
        crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
    }
    return (crc ^ 0xffffffff) >>> 0
}

// The browser's own deflate, where it has one. A ZIP entry may be stored
// uncompressed, so there is nothing to polyfill when it does not.
async function deflateRaw(bytes) {
    if (typeof CompressionStream !== 'function') return null
    try {
        const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))
        return new Uint8Array(await new Response(stream).arrayBuffer())
    } catch {
        return null
    }
}

// ZIP timestamps are DOS-era: two-second resolution, years counted from 1980.
function dosStamp(when) {
    return {
        time: (when.getHours() << 11) | (when.getMinutes() << 5) | Math.floor(when.getSeconds() / 2),
        date: ((when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate(),
    }
}

async function zipBlob(files) {
    const encoder = new TextEncoder()
    const { time, date: stampDate } = dosStamp(new Date())
    const parts = []
    const directory = []
    let offset = 0

    for (const file of files) {
        const name = encoder.encode(file.name)
        const raw = encoder.encode(file.data)
        const crc = crc32(raw)
        const deflated = await deflateRaw(raw)
        const compressed = deflated != null && deflated.length < raw.length
        const body = compressed ? deflated : raw
        const method = compressed ? 8 : 0

        const local = new Uint8Array(30 + name.length)
        const localView = new DataView(local.buffer)
        localView.setUint32(0, 0x04034b50, true)
        localView.setUint16(4, 20, true)
        localView.setUint16(6, 0, true)
        localView.setUint16(8, method, true)
        localView.setUint16(10, time, true)
        localView.setUint16(12, stampDate, true)
        localView.setUint32(14, crc, true)
        localView.setUint32(18, body.length, true)
        localView.setUint32(22, raw.length, true)
        localView.setUint16(26, name.length, true)
        local.set(name, 30)

        const entry = new Uint8Array(46 + name.length)
        const entryView = new DataView(entry.buffer)
        entryView.setUint32(0, 0x02014b50, true)
        entryView.setUint16(4, 20, true)
        entryView.setUint16(6, 20, true)
        entryView.setUint16(8, 0, true)
        entryView.setUint16(10, method, true)
        entryView.setUint16(12, time, true)
        entryView.setUint16(14, stampDate, true)
        entryView.setUint32(16, crc, true)
        entryView.setUint32(20, body.length, true)
        entryView.setUint32(24, raw.length, true)
        entryView.setUint16(28, name.length, true)
        entryView.setUint32(42, offset, true)
        entry.set(name, 46)

        parts.push(local, body)
        directory.push(entry)
        offset += local.length + body.length
    }

    const directorySize = directory.reduce((total, entry) => total + entry.length, 0)
    const end = new Uint8Array(22)
    const endView = new DataView(end.buffer)
    endView.setUint32(0, 0x06054b50, true)
    endView.setUint16(8, files.length, true)
    endView.setUint16(10, files.length, true)
    endView.setUint32(12, directorySize, true)
    endView.setUint32(16, offset, true)

    return new Blob([...parts, ...directory, end], { type: XLSX_MIME })
}

// ------------------------------------------------------------------- public

// Assemble one worksheet into an .xlsx Blob.
//
//   columns             [{ width }] — one per column, in order
//   rows                array of rows; a row is an array of cell objects
//   merges              ['A1:I1', …]
//   freezeRow           rows above this one stay put when scrolling
//   autoFilterRef       'A6:I6'
//   conditionalFormats  [{ ref, rules: [{ equals, dxfId }] }]
export function buildWorkbook({
    sheetName = 'Sheet1',
    columns = [],
    rows = [],
    merges = [],
    freezeRow = 0,
    autoFilterRef = '',
    conditionalFormats = [],
    rowHeights = {},
}) {
    return zipBlob([
        { name: '[Content_Types].xml', data: CONTENT_TYPES },
        { name: '_rels/.rels', data: ROOT_RELS },
        { name: 'xl/workbook.xml', data: workbookXml(sheetName) },
        { name: 'xl/_rels/workbook.xml.rels', data: WORKBOOK_RELS },
        { name: 'xl/styles.xml', data: stylesXml() },
        {
            name: 'xl/worksheets/sheet1.xml',
            data: sheetXml({
                rows,
                columns,
                merges,
                freezeRow,
                autoFilterRef,
                conditionalFormats,
                rowHeights,
            }),
        },
    ])
}

// Hand the finished workbook to the browser as a download.
export function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    // Revoking immediately can cancel the download in Safari; a tick is enough.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}
