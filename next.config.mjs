/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      // Deshabilitar caché de webpack en desarrollo para evitar RangeError de memoria
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
