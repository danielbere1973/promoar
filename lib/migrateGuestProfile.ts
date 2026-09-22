// CPO Dictamen "Cierre de pendientes Guest/Home v2" (31/8/2026): si el usuario cargó
// su perfil financiero sin cuenta (PromoWizard, localStorage.guestProfile) y después se
// registra o inicia sesión, migramos ese perfil a la cuenta recién autenticada en vez de
// perderlo. Degradación silenciosa: si falla, no bloquea el login/registro y deja el
// localStorage intacto para no perder el trabajo del usuario.
export async function migrateGuestProfile(): Promise<void> {
  try {
    const raw = localStorage.getItem('guestProfile')
    if (!raw) return
    const guestProfile = JSON.parse(raw)
    if (!guestProfile?.cards?.length) {
      localStorage.removeItem('guestProfile')
      return
    }

    const res = await fetch('/api/perfil/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cards: guestProfile.cards, onlyIfEmpty: true }),
    })

    if (res.ok) {
      localStorage.removeItem('guestProfile')
    } else {
      console.error('[migrateGuestProfile] fallo la migración, se conserva en localStorage:', res.status)
    }
  } catch (e) {
    console.error('[migrateGuestProfile] error inesperado:', e)
  }
}
