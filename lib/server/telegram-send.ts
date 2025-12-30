export async function sendTelegramMessage(params: {
  botToken: string
  chatId: string
  text: string
  parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML'
  replyMarkup?: any
}): Promise<void> {
  const { botToken, chatId, text, parseMode, replyMarkup } = params
  if (!botToken || !chatId) return

  const payload: any = {
    chat_id: chatId,
    text,
  }
  if (parseMode) payload.parse_mode = parseMode
  if (replyMarkup) payload.reply_markup = replyMarkup

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Telegram sendMessage failed (${res.status}): ${body}`)
  }
}

export async function sendTelegramPdf(params: {
  botToken: string
  chatId: string
  filename: string
  pdfBuffer: Buffer
  caption?: string
}): Promise<void> {
  const { botToken, chatId, filename, pdfBuffer, caption } = params
  if (!botToken || !chatId) return

  const form = new FormData()
  form.append('chat_id', chatId)
  if (caption) form.append('caption', caption)

  const blob = new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' })
  form.append('document', blob, filename)

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Telegram sendDocument failed (${res.status}): ${body}`)
  }
}
