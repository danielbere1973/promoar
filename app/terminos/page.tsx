import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Términos y Condiciones | PromoAR',
  description: 'Términos y condiciones de uso de PromoAR, el agregador de promociones bancarias de Argentina.',
  robots: { index: true, follow: true },
}

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1E3A5F] text-white">
        <div className="max-w-3xl mx-auto px-4 pt-10 pb-8">
          <Link href="/" className="inline-flex items-center gap-1.5 text-blue-300 text-xs font-semibold mb-6 hover:text-white transition-colors">
            ← Volver a PromoAR
          </Link>
          <h1 className="text-2xl font-black leading-tight">Términos y Condiciones</h1>
          <p className="text-blue-200 text-sm mt-1">Última actualización: junio de 2026</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-5">
          <p className="text-sm text-gray-600 leading-relaxed">
            Bienvenido/a a PromoAR. Al acceder o utilizar nuestro sitio web y servicios
            (en adelante, &quot;el Servicio&quot;), aceptás los términos y condiciones descriptos
            a continuación. Si no estás de acuerdo, te pedimos que no utilices el Servicio.
          </p>
        </div>

        <Section title="1. Descripción del servicio">
          PromoAR es una plataforma que recopila y muestra información sobre promociones,
          descuentos, reintegros y cuotas sin interés ofrecidos por bancos, billeteras
          virtuales y otras entidades financieras de Argentina. El Servicio es gratuito
          para los usuarios.
        </Section>

        <Section title="2. PromoAR no es una entidad financiera">
          PromoAR no emite tarjetas, no otorga préstamos ni administra cuentas bancarias.
          Actuamos exclusivamente como un agregador de información pública o provista
          por las propias entidades. No tenemos relación comercial, societaria ni de
          representación con los bancos, billeteras o comercios mencionados, salvo que
          se indique expresamente.
        </Section>

        <Section title="3. Vigencia y exactitud de las promociones">
          Las promociones mostradas son provistas y modificadas por cada entidad
          financiera o comercio según sus propias políticas, por lo que pueden cambiar,
          finalizar o tener condiciones adicionales sin previo aviso. PromoAR realiza
          esfuerzos razonables para mantener la información actualizada, pero{' '}
          <strong>no garantiza</strong> la exactitud, vigencia ni disponibilidad de
          ninguna promoción. Te recomendamos verificar siempre las condiciones finales
          en los canales oficiales de la entidad o comercio antes de realizar una compra.
        </Section>

        <Section title="4. Cuenta de usuario">
          Para acceder a funciones personalizadas (como el filtrado de promociones según
          tu perfil financiero o el guardado de favoritos), podés crear una cuenta con
          tu nombre, correo electrónico y contraseña. Sos responsable de mantener la
          confidencialidad de tus credenciales y de toda actividad realizada desde tu
          cuenta. PromoAR{' '}
          <strong>nunca</strong> te va a pedir las claves de acceso, tarjetas o datos de
          tu homebanking.
        </Section>

        <Section title="5. Perfil financiero">
          La información que cargues en tu perfil (por ejemplo, qué bancos, billeteras o
          tipos de tarjeta tenés) se utiliza exclusivamente para personalizar las
          promociones que se te muestran. No representa una vinculación real con esas
          entidades ni implica que PromoAR tenga acceso a tus cuentas o movimientos.
        </Section>

        <Section title="6. Uso aceptable">
          Te comprometés a utilizar el Servicio de forma lícita y a no: (a) intentar
          acceder sin autorización a sistemas o datos de PromoAR; (b) extraer o
          reutilizar masivamente los contenidos del sitio (scraping) sin autorización;
          (c) usar el Servicio para fines fraudulentos o que infrinjan derechos de
          terceros.
        </Section>

        <Section title="7. Propiedad intelectual">
          Las marcas, logos, nombre &quot;PromoAR&quot; y el diseño del sitio son propiedad de
          sus titulares y están protegidos por la legislación vigente. Los logos y marcas
          de bancos, billeteras y comercios pertenecen a sus respectivos dueños y se
          utilizan únicamente con fines informativos e identificatorios.
        </Section>

        <Section title="8. Limitación de responsabilidad">
          El uso del Servicio es bajo tu propia responsabilidad. PromoAR no será
          responsable por pérdidas, daños o perjuicios derivados de: (a) cambios o
          cancelaciones de promociones por parte de terceros; (b) decisiones de compra
          tomadas en base a la información del sitio; (c) interrupciones temporales del
          Servicio.
        </Section>

        <Section title="9. Modificaciones">
          Podemos actualizar estos Términos y Condiciones en cualquier momento. Los
          cambios entrarán en vigencia desde su publicación en esta página. El uso
          continuado del Servicio implica la aceptación de la versión vigente.
        </Section>

        <Section title="10. Ley aplicable y jurisdicción">
          Estos Términos se rigen por las leyes de la República Argentina. Para
          cualquier controversia, las partes se someten a los tribunales ordinarios
          competentes de la Ciudad Autónoma de Buenos Aires, sin perjuicio de las normas
          de protección al consumidor (Ley 24.240) que pudieran corresponder.
        </Section>

        <Section title="11. Contacto">
          Ante cualquier duda sobre estos términos, podés escribirnos a{' '}
          <a href="mailto:contacto@promoar.com.ar" className="text-[#1E3A5F] font-semibold underline">
            contacto@promoar.com.ar
          </a>{' '}
          o visitar nuestra <Link href="/contacto" className="text-[#1E3A5F] font-semibold underline">página de contacto</Link>.
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 px-5 py-5">
      <h2 className="text-sm font-black text-[#1E3A5F] mb-2">{title}</h2>
      <p className="text-sm text-gray-600 leading-relaxed">{children}</p>
    </div>
  )
}
