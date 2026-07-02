'use client'
import React, { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

interface Props {
  onDetect: (ean: string) => void
  onClose: () => void
}

export default function BarcodeScannerModal({ onDetect, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  const [detected, setDetected] = useState(false)

  useEffect(() => {
    let cancelled = false
    let ZXing: any = null

    async function startScan() {
      try {
        ZXing = await import('@zxing/browser')
        const reader = new ZXing.BrowserMultiFormatReader()

        const devices = await ZXing.BrowserMultiFormatReader.listVideoInputDevices()
        if (devices.length === 0) {
          setError('No se encontró cámara disponible.')
          return
        }
        // Preferir cámara trasera
        const backCam = devices.find((d: MediaDeviceInfo) => /back|rear|environment/i.test(d.label))
        const deviceId = (backCam || devices[devices.length - 1]).deviceId

        await reader.decodeFromVideoDevice(deviceId, videoRef.current!, (result: any, _err: any) => {
          if (cancelled || detected) return
          if (result) {
            const text: string = result.getText()
            if (/^\d{8,14}$/.test(text)) {
              setDetected(true)
              cancelled = true
              try { ZXing.BrowserMultiFormatReader.releaseAllStreams() } catch {}
              onDetect(text)
            }
          }
        })
      } catch (e: any) {
        if (!cancelled) {
          const msg: string = e?.message || ''
          if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied')) {
            setError('Permiso de cámara denegado. Habilitalo en la configuración del navegador.')
          } else {
            setError(msg || 'No se pudo acceder a la cámara.')
          }
        }
      }
    }

    startScan()

    return () => {
      cancelled = true
      try { ZXing?.BrowserMultiFormatReader.releaseAllStreams() } catch {}
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-sm bg-[#0A0A0A] rounded-3xl overflow-hidden shadow-2xl border border-white/10">
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-white/10">
          <div>
            <p className="font-bold text-white text-sm">Escanear código de barras</p>
            <p className="text-[11px] text-slate-500 mt-0.5">EAN-8 / EAN-13 / UPC-A</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Visor de cámara */}
        <div className="relative bg-black" style={{ aspectRatio: '4/3' }}>
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />

          {/* Crosshair overlay */}
          {!error && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-56 h-32">
                {/* Marco esquinas */}
                <div className="absolute top-0 left-0 w-7 h-7 border-t-[3px] border-l-[3px] border-[#1E3A5F] rounded-tl-md" />
                <div className="absolute top-0 right-0 w-7 h-7 border-t-[3px] border-r-[3px] border-[#1E3A5F] rounded-tr-md" />
                <div className="absolute bottom-0 left-0 w-7 h-7 border-b-[3px] border-l-[3px] border-[#1E3A5F] rounded-bl-md" />
                <div className="absolute bottom-0 right-0 w-7 h-7 border-b-[3px] border-r-[3px] border-[#1E3A5F] rounded-br-md" />
                {/* Línea de escaneo animada */}
                {!detected && (
                  <div className="absolute inset-x-2 h-0.5 bg-[#1E3A5F]/80 top-1/2 -translate-y-1/2 animate-pulse" />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Estado */}
        <div className="p-4 text-center min-h-[56px] flex items-center justify-center">
          {error ? (
            <p className="text-red-400 text-sm leading-relaxed">{error}</p>
          ) : detected ? (
            <p className="text-emerald-400 text-sm font-semibold">✓ Código detectado — buscando...</p>
          ) : (
            <p className="text-slate-400 text-xs">Apuntá al código de barras del producto</p>
          )}
        </div>
      </div>
    </div>
  )
}
