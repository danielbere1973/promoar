'use client'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { X, Zap } from 'lucide-react'

interface Props {
  onDetect: (code: string, format?: string) => void
  onClose: () => void
}

// Formatos soportados por BarcodeDetector nativo
const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code', 'code_128', 'code_39', 'itf', 'data_matrix', 'pdf417', 'aztec']

export default function BarcodeScannerModal({ onDetect, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const detectedRef = useRef(false)
  const [status, setStatus] = useState<'loading' | 'scanning' | 'detected' | 'error'>('loading')
  const [error, setError] = useState('')
  const [useNative, setUseNative] = useState(false)

  const stopAll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const handleDetected = useCallback((code: string, format?: string) => {
    if (detectedRef.current) return
    detectedRef.current = true
    setStatus('detected')
    stopAll()
    setTimeout(() => onDetect(code, format), 150)
  }, [onDetect, stopAll])

  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        // Pedir cámara trasera con alta resolución
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          }
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setStatus('scanning')

        // Intentar BarcodeDetector nativo (Chrome 83+, Android)
        const native = (window as any).BarcodeDetector
        if (native) {
          setUseNative(true)
          const supported = await native.getSupportedFormats().catch(() => NATIVE_FORMATS)
          const formats = NATIVE_FORMATS.filter((f: string) => supported.includes(f))
          const detector = new native({ formats: formats.length ? formats : NATIVE_FORMATS })

          const scanFrame = async () => {
            if (cancelled || detectedRef.current) return
            if (videoRef.current && videoRef.current.readyState >= 2) {
              try {
                const results = await detector.detect(videoRef.current)
                if (results.length > 0) {
                  handleDetected(results[0].rawValue, results[0].format)
                  return
                }
              } catch {}
            }
            rafRef.current = requestAnimationFrame(scanFrame)
          }
          rafRef.current = requestAnimationFrame(scanFrame)

        } else {
          // Fallback: ZXing
          const ZXing = await import('@zxing/browser')
          if (cancelled) return
          const reader = new ZXing.BrowserMultiFormatReader()
          reader.decodeFromStream(stream, videoRef.current!, (result, err) => {
            if (cancelled || detectedRef.current) return
            if (result) handleDetected(result.getText(), result.getBarcodeFormat()?.toString())
          })
        }
      } catch (e: any) {
        if (cancelled) return
        const msg: string = e?.message || ''
        if (/permission|denied|notallowed/i.test(msg)) {
          setError('Permiso de cámara denegado. Habilitalo en la configuración del navegador.')
        } else if (/notfound|devicenotfound/i.test(msg)) {
          setError('No se encontró cámara disponible.')
        } else {
          setError(msg || 'No se pudo acceder a la cámara.')
        }
        setStatus('error')
      }
    }

    start()
    return () => {
      cancelled = true
      stopAll()
    }
  }, [handleDetected, stopAll])

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-sm bg-[#0A0A0A] rounded-3xl overflow-hidden shadow-2xl border border-white/10">

        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-white/10">
          <div>
            <p className="font-bold text-white text-sm flex items-center gap-1.5">
              Escanear código
              {useNative && status === 'scanning' && (
                <span className="text-[10px] font-normal bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5 flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5" /> Nativo
                </span>
              )}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">EAN · QR · Code128 · UPC</p>
          </div>
          <button onClick={() => { stopAll(); onClose() }} className="p-1.5 text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Visor */}
        <div className="relative bg-black" style={{ aspectRatio: '4/3' }}>
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />

          {/* Overlay de escaneo */}
          {status === 'scanning' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-56 h-44">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-white rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-white rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-white rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-white rounded-br-lg" />
                {/* Línea animada */}
                <div className="absolute inset-x-3 h-[2px] bg-white/60 animate-[scanline_2s_ease-in-out_infinite]" style={{ top: '50%' }} />
              </div>
            </div>
          )}

          {/* Loading overlay */}
          {status === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          )}

          {/* Detected flash */}
          {status === 'detected' && (
            <div className="absolute inset-0 bg-white/10 flex items-center justify-center">
              <div className="text-4xl">✓</div>
            </div>
          )}
        </div>

        {/* Estado */}
        <div className="p-4 text-center min-h-[56px] flex items-center justify-center">
          {status === 'error' ? (
            <p className="text-red-400 text-sm leading-relaxed">{error}</p>
          ) : status === 'detected' ? (
            <p className="text-emerald-400 text-sm font-semibold">✓ Código detectado — buscando...</p>
          ) : status === 'loading' ? (
            <p className="text-slate-500 text-xs">Iniciando cámara...</p>
          ) : (
            <p className="text-slate-400 text-xs">Apuntá al código de barras o QR del producto</p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes scanline {
          0%, 100% { transform: translateY(-32px); opacity: 0.4; }
          50% { transform: translateY(32px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
