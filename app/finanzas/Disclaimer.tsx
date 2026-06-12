import { AlertCircle } from 'lucide-react'

export default function Disclaimer() {
  return (
    <div className="flex items-start gap-2 bg-gray-50 dark:bg-slate-700 border border-gray-100 rounded-2xl p-4 mt-4">
      <AlertCircle size={14} className="text-gray-300 shrink-0 mt-0.5" />
      <p className="text-[10px] text-gray-400 dark:text-slate-500 leading-relaxed">
        La información mostrada es de carácter informativo y no constituye asesoramiento financiero ni recomendación de inversión.
        Verificá condiciones directamente con cada entidad antes de operar.
      </p>
    </div>
  )
}
