'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Users, Heart, Flag, MessageSquare, Plus, Zap, AlertTriangle, Tag, Gift, X, MapPin, Store } from 'lucide-react'
import BottomNav from '../components/BottomNav'

// Asignamos iconos basados en el tipo
const IconoTipo = ({ tipo, className }: { tipo: string, className?: string }) => {
  switch (tipo.toLowerCase()) {
    case 'avivada': return <Zap size={14} className={className} />;
    case 'promo': return <Tag size={14} className={className} />;
    case 'error_precio': return <AlertTriangle size={14} className={className} />;
    case 'combo': return <Gift size={14} className={className} />;
    default: return <MessageSquare size={14} className={className} />;
  }
}

// Genera un avatar simple segun las iniciales del nombre
const generateAvatarProps = (name: string, email: string) => {
  const chars = (name || email || 'US').substring(0, 2).toUpperCase()
  const bgColors = ['#DBEAFE', '#D1FAE5', '#FCE7F3', '#F3E8FF', '#FEF3C7', '#E0E7FF']
  const textColors = ['#1E40AF', '#065F46', '#BE185D', '#6B21A8', '#92400E', '#3730A3']
  const idx = chars.charCodeAt(0) % bgColors.length
  return { initials: chars, bg: bgColors[idx], color: textColors[idx] }
}

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `hace ${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours}h`
  return `hace ${Math.floor(hours / 24)}d`
}

export default function Comunidad() {
  const { data: session } = useSession()
  const router = useRouter()
  
  const [filtro, setFiltro] = useState('todos')
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [formType, setFormType] = useState('AVIVADA')
  const [formBody, setFormBody] = useState('')
  const [formCommerce, setFormCommerce] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const filtros = ['todos', 'avivada', 'promo', 'error_precio', 'combo']
  const filtrosLabel: Record<string, string> = {
    todos: 'Para Vos', avivada: 'Avivadas', promo: 'Promos', error_precio: 'Errores', combo: 'Combos'
  }

  const loadPosts = async () => {
    setLoading(true)
    try {
      const url = filtro === 'todos' ? '/api/comunidad' : `/api/comunidad?type=${filtro}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setPosts(data.posts || [])
      }
    } catch(err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPosts()
  }, [filtro])

  const handleLike = async (postId: string) => {
    if (!session?.user?.email) return router.push('/login')
    
    // Optimistic Update
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: p.likes + 1 } : p))
    
    try {
      await fetch(`/api/comunidad/${postId}/like`, {
        method: 'POST',
      })
      // Recargar opcional
      // loadPosts()
    } catch(e) {
      // Rollback on fail would go here
    }
  }

  const handleSubmitPost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.user?.email) return router.push('/login')
    
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/comunidad', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: formType,
          body: formBody,
          commerce: formCommerce,
          location: formLocation
        })
      })
      
      if (res.ok) {
        setShowModal(false)
        setFormBody('')
        setFormCommerce('')
        setFormLocation('')
        loadPosts() // Recargamos para ver el nuevo post
      }
    } catch (error) {
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 relative">
      {/* Header Sticky */}
      <div className="bg-white/90 backdrop-blur-xl border-b border-gray-100/60 sticky top-0 z-20 shadow-sm shadow-black/[0.02]">
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 text-blue-600 p-2 rounded-xl">
               <Users size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Comunidad</h1>
              <p className="text-sm text-gray-500 mt-0.5">Avivadas, errores y secretos de ahorro</p>
            </div>
          </div>
        </div>

        {/* Filtros horizontales */}
        <div className="flex gap-2.5 px-5 py-3 overflow-x-auto scrollbar-hide">
          {filtros.map(f => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`whitespace-nowrap flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-2xl border font-semibold transition-all ${
                filtro === f
                  ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                  : 'bg-white text-gray-500 border-gray-200 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              {filtro === f && <IconoTipo tipo={f === 'todos' ? 'avivada' : f} />}
              {filtrosLabel[f]}
            </button>
          ))}
          <div className="w-2 shrink-0"></div>
        </div>
      </div>

      <div className="px-4 py-6 pb-28 max-w-lg mx-auto space-y-4">
        
        {filtro === 'todos' && (
          <div className="mb-2 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50/50 border border-blue-100/60 rounded-3xl p-5 shadow-sm">
            <div>
               <p className="text-sm font-bold text-gray-900">¿Descubriste un error de precio?</p>
               <p className="text-xs text-blue-800/80 mt-1 leading-relaxed max-w-[220px]">
                 Compartir hace que más usuarios ahorren. Y si te sirvió la avivada de otro, ¡dejale un like!
               </p>
            </div>
            <div className="bg-blue-100/80 p-3 rounded-full text-blue-600">
               <Zap size={24} />
            </div>
          </div>
        )}

        {/* Feed de Posts */}
        {loading ? (
          <div className="py-10 text-center text-sm font-medium text-gray-400 animate-pulse">Cargando comunidad...</div>
        ) : posts.length === 0 ? (
          <div className="py-16 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-4 text-gray-300">
              <MessageSquare size={32} />
            </div>
            <p className="text-gray-900 font-medium">Aún no hay posteos acá.</p>
            <p className="text-sm text-gray-500 mt-2 mx-auto">Sé el primero en aportar a la comunidad.</p>
          </div>
        ) : (
          posts.map(post => {
            const avatar = generateAvatarProps(post.author?.name, post.author?.email)
            return (
              <div key={post.id} className="bg-white border text-left border-gray-100 rounded-[28px] p-5 shadow-sm shadow-black/[0.01] hover:shadow-md transition-shadow relative group">
                <div className="flex items-start gap-3 mb-3 relative z-10">
                  <div 
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold flex-shrink-0 relative overflow-hidden"
                    style={{ background: avatar.bg, color: avatar.color }}
                  >
                    <div className="absolute top-0 right-0 w-4 h-4 bg-white/30 rounded-full blur-[2px] transform translate-x-1 -translate-y-1"></div>
                    {avatar.initials}
                  </div>
                  
                  <div className="flex-1 mt-0.5">
                    <div className="flex items-baseline justify-between mb-0.5">
                      <p className="text-sm font-bold text-gray-900">{post.author?.name || 'Usuario'}</p>
                      <p className="text-[11px] font-medium text-gray-400">{timeAgo(post.createdAt)}</p>
                    </div>
                    
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md mt-0.5 bg-gray-100 text-gray-700">
                      <IconoTipo tipo={post.type} /> {post.type.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                
                <p className="text-[14px] text-gray-700 leading-relaxed relative z-10 font-medium mb-3">
                  {post.body}
                </p>

                {(post.commerce || post.location) && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {post.commerce && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded-lg"><Store size={12}/> {post.commerce}</span>}
                    {post.location && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded-lg"><MapPin size={12}/> {post.location}</span>}
                  </div>
                )}
                
                <div className="flex items-center gap-4 mt-2 pt-3 border-t border-gray-50">
                  <button 
                    onClick={() => handleLike(post.id)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-xl transition-colors active:scale-95"
                  >
                    <Heart size={16} /> <span>{post.likes} útiles</span>
                  </button>
                  <button className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-blue-500 hover:bg-blue-50 px-2.5 py-1.5 rounded-xl transition-colors">
                    <MessageSquare size={16} /> <span>Responder</span>
                  </button>
                  <button className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-gray-600 ml-auto p-2 rounded-lg">
                    <Flag size={14} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* FAB (Floating Action Button) */}
      <div className="fixed bottom-20 right-4 z-30 sm:right-auto sm:left-1/2 sm:ml-[160px] pb-safe">
        <button 
          onClick={() => {
            if (!session) router.push('/login')
            else setShowModal(true)
          }}
          className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-4 py-3.5 rounded-full shadow-lg shadow-gray-900/20 transform hover:-translate-y-1 transition-all active:scale-95"
        >
          <Plus size={20} />
          <span className="text-sm font-bold pr-1">Nuevo Aporte</span>
        </button>
      </div>

      {/* Modal Reusable */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center bg-black/40 backdrop-blur-sm p-4 sm:p-0">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl relative animate-in fade-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            <button 
              onClick={() => setShowModal(false)}
              className="absolute top-5 right-5 p-2 bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200 transition-colors"
            >
              <X size={16} />
            </button>

            <h2 className="text-xl font-bold text-gray-900 mb-5">Compartir en Comunidad</h2>

            <form onSubmit={handleSubmitPost} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2 ml-1">Tipo de Aporte</label>
                <select 
                  value={formType}
                  onChange={e => setFormType(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 text-gray-900 text-sm rounded-2xl p-3 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium transition-colors appearance-none"
                >
                  <option value="AVIVADA">Avivada</option>
                  <option value="PROMO">Promo / Oferta</option>
                  <option value="ERROR_PRECIO">Error de Precio</option>
                  <option value="COMBO">Combo (Apurar promos locales)</option>
                  <option value="CONSULTA">Consulta o Duda</option>
                </select>
              </div>
              
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2 ml-1">Mensaje principal</label>
                <textarea 
                  value={formBody}
                  onChange={e => setFormBody(e.target.value)}
                  placeholder="Ej: Acabo de descubrir que sumando Galicia y Modo en..."
                  className="w-full bg-gray-50 border border-gray-100 text-gray-900 text-sm rounded-2xl p-4 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium transition-colors resize-none h-28"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1 ml-1 whitespace-nowrap overflow-hidden text-ellipsis">Comercio (Opcional)</label>
                  <div className="relative">
                    <Store size={14} className="absolute left-3 top-3 text-gray-400" />
                    <input 
                      type="text" 
                      value={formCommerce} 
                      onChange={e => setFormCommerce(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-100 text-gray-900 text-sm rounded-xl pl-8 pr-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                      placeholder="Ej: Coto"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1 ml-1 whitespace-nowrap overflow-hidden text-ellipsis">Ubicación (Opcional)</label>
                  <div className="relative">
                    <MapPin size={14} className="absolute left-3 top-3 text-gray-400" />
                    <input 
                      type="text" 
                      value={formLocation} 
                      onChange={e => setFormLocation(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-100 text-gray-900 text-sm rounded-xl pl-8 pr-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                      placeholder="Ej: CABA"
                    />
                  </div>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting || !formBody.trim()}
                className="w-full bg-gray-900 hover:bg-black text-white font-bold text-sm py-4 rounded-2xl transition-all shadow-md shadow-black/10 active:scale-[0.98] disabled:opacity-50 mt-2"
              >
                {isSubmitting ? 'Publicando...' : 'Publicar Aporte'}
              </button>
            </form>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}