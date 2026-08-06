import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import './App.css'
import { getSupabaseClient, supabaseConfigError } from './lib/supabase'
import {
  listRecentPhotos,
  prepareImageForUpload,
  type PhotoUpload,
  uploadCameraPhoto,
} from './lib/photoUpload'

type ImageDetails = {
  width: number
  height: number
}

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading' }
  | { status: 'success'; path: string }
  | { status: 'error'; message: string }

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function getImageDetails(url: string): Promise<ImageDetails> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error('Nepovedlo se přečíst rozměry obrázku.'))
    image.src = url
  })
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authBusy, setAuthBusy] = useState(true)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imageDetails, setImageDetails] = useState<ImageDetails | null>(null)
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle' })
  const [photos, setPhotos] = useState<PhotoUpload[]>([])
  const [photosError, setPhotosError] = useState<string | null>(null)
  const [photosLoaded, setPhotosLoaded] = useState(false)
  const [photosLoading, setPhotosLoading] = useState(false)

  const supabase = useMemo(() => getSupabaseClient(), [])
  const user = session?.user ?? null

  const refreshPhotos = useCallback(async () => {
    if (!user) {
      setPhotos([])
      setPhotosLoaded(false)
      return
    }

    try {
      setPhotosLoading(true)
      setPhotosLoaded(true)
      setPhotosError(null)
      const recentPhotos = await listRecentPhotos(user.id)
      setPhotos(recentPhotos)
    } catch (error) {
      setPhotosError(error instanceof Error ? error.message : 'Fotky se odmítly ukázat.')
    } finally {
      setPhotosLoading(false)
    }
  }, [user])

  useEffect(() => {
    let active = true

    async function loadSession() {
      if (!supabase) {
        setAuthBusy(false)
        return
      }

      const { data } = await supabase.auth.getSession()
      if (active) {
        setSession(data.session)
        setAuthBusy(false)
      }
    }

    void loadSession()

    return () => {
      active = false
    }
  }, [supabase])

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null)
      setImageDetails(null)
      return undefined
    }

    const url = URL.createObjectURL(selectedFile)
    setPreviewUrl(url)
    setImageDetails(null)
    void getImageDetails(url)
      .then(setImageDetails)
      .catch(() => setImageDetails(null))

    return () => URL.revokeObjectURL(url)
  }, [selectedFile])

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return

    setAuthError(null)
    setAuthBusy(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setAuthError(error.message)
    else setSession(data.session)
    setAuthBusy(false)
  }

  async function handleLogout() {
    if (!supabase) return
    await supabase.auth.signOut()
    setSession(null)
    setSelectedFile(null)
    setPhotos([])
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)
    setUploadState({ status: 'idle' })
  }

  async function handleUpload() {
    if (!user || !selectedFile) return

    setUploadState({ status: 'uploading' })
    try {
      const prepared = await prepareImageForUpload(selectedFile)
      const uploaded = await uploadCameraPhoto(user.id, prepared.blob)
      setUploadState({ status: 'success', path: uploaded.path })
      setSelectedFile(null)
      await refreshPhotos()
    } catch (error) {
      setUploadState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Upload se pokazil. Klasika.',
      })
    }
  }

  if (supabaseConfigError) {
    return (
      <main className="shell">
        <section className="panel">
          <p className="eyebrow">Camera spike</p>
          <h1>Nenech mě chcípnout!</h1>
          <p className="danger">{supabaseConfigError}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">iOS PWA camera spike</p>
          <h1>Nenech mě chcípnout!</h1>
          <p className="lead">
            Tady se neřeší produkt. Tady se ověřuje, jestli iPhone dovolí kytce
            vyfotit zoufalý portrét a poslat ho do Supabase.
          </p>
        </div>
        <div className="plant-badge" aria-hidden="true">
          <span>!</span>
        </div>
      </section>

      <section className="grid">
        <div className="panel">
          <div className="panel-heading">
            <p className="eyebrow">1. Přihlášení</p>
            <h2>Supabase Auth</h2>
          </div>

          {authBusy ? (
            <p className="muted">Ověřuju session. Kytka zatím zadržuje dech.</p>
          ) : user ? (
            <div className="stack">
              <p className="success">Přihlášeno jako {user.email}</p>
              <button className="secondary" type="button" onClick={handleLogout}>
                Odhlásit
              </button>
            </div>
          ) : (
            <form className="stack" onSubmit={handleLogin}>
              <label>
                Email
                <input
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                />
              </label>
              <label>
                Heslo
                <input
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                />
              </label>
              {authError ? <p className="danger">{authError}</p> : null}
              <button type="submit" disabled={authBusy}>
                Přihlásit
              </button>
            </form>
          )}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <p className="eyebrow">2. Foťák</p>
            <h2>Vyfoť testovací kytku</h2>
          </div>

          <div className="stack">
            <label className="file-picker">
              <input
                accept="image/*"
                capture="environment"
                disabled={!user}
                onChange={handleFileChange}
                type="file"
              />
              <span>{user ? 'Otevřít foťák / galerii' : 'Nejdřív se přihlas'}</span>
            </label>

            {selectedFile ? (
              <div className="diagnostics">
                <strong>{selectedFile.name || 'Fotka z iPhonu'}</strong>
                <span>{selectedFile.type || 'neznámý MIME typ'}</span>
                <span>{formatBytes(selectedFile.size)}</span>
                {imageDetails ? (
                  <span>
                    {imageDetails.width} x {imageDetails.height}px
                  </span>
                ) : null}
              </div>
            ) : (
              <p className="muted">Zatím žádná fotka. Kytka si myslí svoje.</p>
            )}

            {previewUrl ? (
              <img className="preview" src={previewUrl} alt="Náhled vybrané fotky" />
            ) : null}

            <button
              type="button"
              disabled={!selectedFile || !user || uploadState.status === 'uploading'}
              onClick={handleUpload}
            >
              {uploadState.status === 'uploading' ? 'Nahrávám...' : 'Nahrát do Supabase'}
            </button>

            {uploadState.status === 'success' ? (
              <p className="success">Nahráno: {uploadState.path}</p>
            ) : null}
            {uploadState.status === 'error' ? (
              <p className="danger">{uploadState.message}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <p className="eyebrow">3. Storage round-trip</p>
          <h2>Poslední uploady</h2>
        </div>

        {photosError ? <p className="danger">{photosError}</p> : null}
        {!user ? <p className="muted">Po přihlášení tady budou uložené fotky.</p> : null}
        {user && !photosLoaded ? (
          <div className="stack">
            <p className="muted">
              Uploady nenačítám automaticky, protože velké fotky umí Chrome
              přidusit. Klikni až budeš chtít ověřit storage round-trip.
            </p>
            <button type="button" className="secondary" onClick={refreshPhotos}>
              Načíst poslední uploady
            </button>
          </div>
        ) : null}
        {user && photosLoaded && photosLoading ? (
          <p className="muted">Načítám fotky ze Storage...</p>
        ) : null}
        {user && photosLoaded && !photosLoading && photos.length === 0 ? (
          <p className="muted">Storage zatím mlčí. Vyfoť něco zeleného.</p>
        ) : null}

        <div className="photos">
          {photos.map((photo) => (
            <a className="photo-card" href={photo.url} key={photo.path} target="_blank">
              <img src={photo.url} alt={photo.name} loading="lazy" />
              <span>{photo.name}</span>
            </a>
          ))}
        </div>
      </section>
    </main>
  )
}

export default App
