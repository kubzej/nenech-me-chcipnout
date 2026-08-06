import { getSupabaseClient } from './supabase'

const BUCKET = 'camera-spike'
const MAX_IMAGE_EDGE = 1600
const JPEG_QUALITY = 0.86

export type PhotoUpload = {
  name: string
  path: string
  url: string
  createdAt: string | null
}

function extensionFor(file: File) {
  const fromName = file.name.split('.').pop()
  if (fromName && fromName.length <= 5) return fromName.toLowerCase()
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/heic') return 'heic'
  return 'jpg'
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Nepovedlo se připravit zmenšenou fotku.'))
      },
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}

export async function prepareImageForUpload(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Vybraný soubor není obrázek.')
  }

  const bitmap = await createImageBitmap(file)
  const originalWidth = bitmap.width
  const originalHeight = bitmap.height
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(originalWidth, originalHeight))
  const width = Math.max(1, Math.round(originalWidth * scale))
  const height = Math.max(1, Math.round(originalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error('Browser nedal canvas context. Dneska si hraje na mrtvého.')
  }

  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await canvasToBlob(canvas)
  return {
    blob,
    width,
    height,
    originalWidth,
    originalHeight,
  }
}

export async function uploadCameraPhoto(userId: string, file: File | Blob) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase není nakonfigurovaný.')

  const extension = file instanceof File ? extensionFor(file) : 'jpg'
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const path = `${userId}/${timestamp}.${extension}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type || 'image/jpeg',
    upsert: false,
  })

  if (error) throw new Error(error.message)
  return { path }
}

export async function listRecentPhotos(userId: string): Promise<PhotoUpload[]> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase není nakonfigurovaný.')

  const { data, error } = await supabase.storage.from(BUCKET).list(userId, {
    limit: 10,
    sortBy: { column: 'created_at', order: 'desc' },
  })

  if (error) throw new Error(error.message)

  return Promise.all(
    (data ?? [])
      .filter((item) => item.name)
      .map(async (item) => {
        const path = `${userId}/${item.name}`
        const { data: signed, error: signedError } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, 60 * 60)

        if (signedError) throw new Error(signedError.message)

        return {
          name: item.name,
          path,
          url: signed.signedUrl,
          createdAt: item.created_at ?? null,
        }
      }),
  )
}
