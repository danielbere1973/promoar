import { redirect } from 'next/navigation'

export default function PreciosPage({
  searchParams,
}: {
  searchParams?: { section?: string; q?: string; cat?: string }
}) {
  const section = searchParams?.section?.toLowerCase()
  const q = searchParams?.q ? `?q=${encodeURIComponent(searchParams.q)}` : ''
  const cat = searchParams?.cat ? `?cat=${encodeURIComponent(searchParams.cat)}` : ''
  const query = q || cat

  if (section === 'farmacias' || section === 'farmacia') {
    redirect(`/precios/farmacias${query}`)
  }
  if (section === 'electrónica' || section === 'electronica' || section === 'tech' || section === 'electro') {
    redirect(`/precios/tech${query}`)
  }
  redirect(`/precios/super${query}`)
}
