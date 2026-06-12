import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidad | PromoAR',
  description: 'Cómo PromoAR recopila, usa y protege tus datos personales.',
  robots: { index: true, follow: true },
}

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1E3A5F] text-white">
        <div className="max-w-3xl mx-auto px-4 pt-10 pb-8">
          <Link href="/" className="inline-flex items-center gap-1.5 text-blue-300 text-xs font-semibold mb-6 hover:text-white transition-colors">
            ← Volver a PromoAR
          </Link>
          <h1 className="text-2xl font-black leading-tight">Política de Privacidad</h1>
          <p className="text-blue-200 text-sm mt-1">Última actualización: junio de 2026</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-5">
          <p className="text-sm text-gray-600 leading-relaxed">
            En PromoAR nos tomamos en serio la privacidad de tus datos. Esta política
            explica qué información recopilamos, para qué la usamos y qué derechos
            tenés sobre ella, en línea con la Ley 25.326 de Protección de Datos
            Personales de la República Argentina.
          </p>
        </div>

        <Section title="1. Qué datos recopilamos">
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Datos de cuenta:</strong> nombre, correo electrónico y contraseña (almacenada
              de forma encriptada, nunca en texto plano).</li>
            <li><strong>Perfil financiero:</strong> bancos, billeteras y tipos de tarjeta que indiques
              tener, usados solo para personalizar las promociones que ves. No se trata de
              datos de tu cuenta bancaria real ni de credenciales de acceso.</li>
            <li><strong>Datos de uso:</strong> promociones guardadas, búsquedas realizadas y
              preferencias de filtrado, para mejorar la experiencia dentro de la app.</li>
            <li><strong>Datos técnicos:</strong> dirección IP, tipo de dispositivo y navegador,
              recopilados de forma agregada con fines estadísticos y de seguridad.</li>
          </ul>
        </Section>

        <Section title="2. Qué NO recopilamos">
          PromoAR <strong>nunca</strong> solicita ni almacena contraseñas de homebanking,
          números completos de tarjetas, códigos de seguridad (CVV), claves de acceso a
          billeteras virtuales ni ningún otro dato que permita operar tus cuentas
          bancarias.
        </Section>

        <Section title="3. Para qué usamos tus datos">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Mostrarte las promociones más relevantes según tu perfil financiero.</li>
            <li>Permitirte iniciar sesión, recuperar tu contraseña y verificar tu cuenta
              por correo electrónico.</li>
            <li>Mejorar el servicio mediante estadísticas de uso agregadas y anónimas.</li>
            <li>Comunicarte novedades relevantes del servicio (podés darte de baja en
              cualquier momento).</li>
          </ul>
        </Section>

        <Section title="4. Con quién compartimos tus datos">
          No vendemos ni cedemos tus datos personales a terceros con fines comerciales.
          Podemos compartir información con proveedores que nos ayudan a operar el
          servicio (por ejemplo, hosting y envío de correos transaccionales), quienes
          están obligados a resguardar la confidencialidad de la información y usarla
          únicamente para prestar dicho servicio.
        </Section>

        <Section title="5. Cookies y almacenamiento local">
          Utilizamos cookies y almacenamiento local del navegador para mantener tu
          sesión iniciada, recordar tus preferencias (como tema claro/oscuro o filtros
          aplicados) y, en el caso de usuarios no registrados, guardar tu perfil
          financiero localmente en tu dispositivo.
        </Section>

        <Section title="6. Seguridad">
          Aplicamos medidas técnicas y organizativas razonables para proteger tu
          información, incluyendo el cifrado de contraseñas y conexiones seguras
          (HTTPS). Sin embargo, ningún sistema es 100% infalible, por lo que no podemos
          garantizar seguridad absoluta.
        </Section>

        <Section title="7. Tus derechos">
          Como titular de tus datos, tenés derecho a acceder, rectificar, actualizar o
          solicitar la eliminación de tu información personal. Podés hacerlo desde tu
          perfil dentro de la app o escribiéndonos a{' '}
          <a href="mailto:contacto@promoar.com.ar" className="text-[#1E3A5F] font-semibold underline">
            contacto@promoar.com.ar
          </a>. La Agencia de Acceso a la Información Pública, en su carácter de Órgano
          de Control de la Ley 25.326, tiene la atribución de atender las denuncias y
          reclamos que se interpongan con relación al incumplimiento de las normas sobre
          protección de datos personales.
        </Section>

        <Section title="8. Retención de datos">
          Conservamos tus datos mientras tu cuenta esté activa. Si solicitás la baja de
          tu cuenta, eliminamos o anonimizamos tus datos personales en un plazo
          razonable, salvo que debamos conservarlos por obligaciones legales.
        </Section>

        <Section title="9. Cambios en esta política">
          Podemos actualizar esta política para reflejar cambios en nuestras prácticas o
          por motivos legales. Publicaremos cualquier cambio relevante en esta misma
          página con su fecha de actualización.
        </Section>

        <Section title="10. Contacto">
          Para consultas sobre esta política de privacidad, escribinos a{' '}
          <a href="mailto:contacto@promoar.com.ar" className="text-[#1E3A5F] font-semibold underline">
            contacto@promoar.com.ar
          </a>{' '}
          o visitá nuestra <Link href="/contacto" className="text-[#1E3A5F] font-semibold underline">página de contacto</Link>.
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 px-5 py-5">
      <h2 className="text-sm font-black text-[#1E3A5F] mb-2">{title}</h2>
      <div className="text-sm text-gray-600 leading-relaxed">{children}</div>
    </div>
  )
}
