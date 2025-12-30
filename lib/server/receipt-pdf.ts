import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export type ReceiptKind = 'deposit' | 'withdrawal'

export type ReceiptLineItem = {
  label: string
  value: string
}

export type ReceiptInput = {
  kind: ReceiptKind
  receiptNo: string
  issuedAtIso: string
  username: string
  telegramId?: string | null
  amountEtb: number
  status: 'approved' | 'completed'
  subtitle?: string
  items: ReceiptLineItem[]
}

function formatEtb(amount: number) {
  const n = Number(amount || 0)
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`
}

export async function generateReceiptPdfBuffer(input: ReceiptInput): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89]) // A4 in points

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const margin = 48
  const width = page.getWidth()
  const height = page.getHeight()
  let y = height - margin

  const title = input.kind === 'deposit' ? 'Deposit Receipt' : 'Withdrawal Receipt'
  const subtitle =
    input.subtitle ||
    (input.kind === 'deposit'
      ? 'Deposit approved and credited to wallet'
      : 'Withdrawal approved for processing')

  const gray = rgb(0.42, 0.45, 0.5)
  const dark = rgb(0.07, 0.07, 0.07)
  const border = rgb(0.9, 0.91, 0.93)
  const bg = rgb(0.98, 0.98, 0.99)

  const drawText = (text: string, x: number, yy: number, size = 10, bold = false, color = dark) => {
    page.drawText(text, {
      x,
      y: yy,
      size,
      font: bold ? fontBold : fontRegular,
      color,
    })
  }

  // Header
  drawText('BingoX', margin, y, 18, true)
  drawText('Admin Receipt', width - margin - 80, y + 4, 10, false, gray)
  y -= 22
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: border })
  y -= 28

  drawText(title, margin, y, 16, true)
  y -= 18
  drawText(subtitle, margin, y, 10, false, rgb(0.2, 0.2, 0.2))
  y -= 28

  // Meta columns
  const issued = new Date(input.issuedAtIso)
  const issuedText = Number.isFinite(issued.getTime()) ? issued.toLocaleString() : input.issuedAtIso

  const metaLeft: ReceiptLineItem[] = [
    { label: 'Receipt No', value: input.receiptNo },
    { label: 'Issued At', value: issuedText },
    { label: 'Status', value: input.status.toUpperCase() },
  ]
  const metaRight: ReceiptLineItem[] = [
    { label: 'User', value: input.username || 'Unknown' },
    ...(input.telegramId ? [{ label: 'Telegram ID', value: String(input.telegramId) }] : []),
    { label: 'Amount', value: formatEtb(input.amountEtb) },
  ]

  const colGap = 24
  const colW = (width - margin * 2 - colGap) / 2
  const labelSize = 9
  const valueSize = 10

  const renderMeta = (x: number, startY: number, items: ReceiptLineItem[]) => {
    let yy = startY
    for (const it of items) {
      drawText(it.label, x, yy, labelSize, false, gray)
      yy -= 12
      drawText(String(it.value), x, yy, valueSize, false, dark)
      yy -= 18
    }
    return yy
  }

  const yLeft = renderMeta(margin, y, metaLeft)
  const yRight = renderMeta(margin + colW + colGap, y, metaRight)
  y = Math.min(yLeft, yRight) - 8

  // Details box
  const boxPadding = 16
  const lineH = 16
  const boxHeight = 22 + input.items.length * lineH + 18
  const boxY = y - boxHeight

  page.drawRectangle({
    x: margin,
    y: boxY,
    width: width - margin * 2,
    height: boxHeight,
    color: bg,
    borderColor: border,
    borderWidth: 1,
  })

  let yy = y - 18
  drawText('Details', margin + boxPadding, yy, 11, true)
  yy -= 20

  for (const item of input.items) {
    drawText(item.label, margin + boxPadding, yy, 9, false, gray)
    const value = String(item.value || '')
    // Simple right-align by measuring text width
    const valueWidth = fontRegular.widthOfTextAtSize(value, 10)
    const vx = width - margin - boxPadding - valueWidth
    drawText(value, vx, yy, 10, false, dark)
    yy -= lineH
  }

  y = boxY - 26

  drawText(
    'This receipt is generated electronically by the BingoX admin system. No signature required.',
    margin,
    y,
    9,
    false,
    gray
  )

  const bytes = await pdfDoc.save()
  return Buffer.from(bytes)
}
