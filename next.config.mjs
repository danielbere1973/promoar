/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // cpus: 1 fuerza la generación estática (generateStaticParams) a correr
  // secuencial en vez de en paralelo. Con connection_limit=3 en la
  // DATABASE_URL de producción, varias páginas SSG abriendo conexiones a la
  // vez agotaban el pool en build (P2024) aunque se haya bajado el take de
  // promos/[slug] y comercios/[slug].
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
    cpus: 1,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
