'use client';

import { useState } from 'react';

export default function ClassifyButton() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const handleClassify = async () => {
    setLoading(true);
    setStatus('Iniciando clasificación...');
    
    let keepGoing = true;
    let totalProcesadas = 0;

    try {
      while (keepGoing) {
        const res = await fetch('/api/admin/classify', { method: 'POST' });
        
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error("Respuesta del servidor:", text);
          throw new Error(`El servidor devolvió un error ${res.status}. Mira la consola.`);
        }

        if (!res.ok) {
          setStatus(`❌ Error: ${data.error || 'Algo falló en el servidor'}`);
          break;
        }

        totalProcesadas += (data.procesadas || 0);

        if (data.enviadas === 0) {
          setStatus(`✅ Listo. No quedan promos sin categoría. Total actualizadas: ${totalProcesadas}`);
          keepGoing = false;
        } else if (data.procesadas === 0) {
          setStatus(`✅ Listo. Clasificadas ${totalProcesadas} en total. Quedan ${data.enviadas} sin categoría que no matchean ninguna regla.`);
          keepGoing = false;
        } else {
          setStatus(`⏳ Procesando... ${totalProcesadas} actualizadas, quedan ${data.enviadas - data.procesadas} sin clasificar...`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (error: any) {
      setStatus(`❌ Error: ${error.message || 'Error de conexión'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border border-gray-200 rounded-lg shadow-sm bg-white mb-6">
      <h3 className="text-lg font-bold mb-2 text-gray-800">Auto-Clasificación con IA</h3>
      <p className="text-sm text-gray-600 mb-4">Usa Gemini para categorizar en lotes las promociones que quedaron "Sin Categoría".</p>
      <button onClick={handleClassify} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
        {loading ? 'Clasificando...' : 'Clasificar Promos Huérfanas'}
      </button>
      {status && <p className="mt-3 text-sm font-medium text-gray-700">{status}</p>}
    </div>
  );
}