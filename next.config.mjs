/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // El proyecto usa imports relativos con extensión ".js" en archivos
    // .ts/.tsx (convención ESM estándar, ya resuelta por tsc/vitest/tsx vía
    // moduleResolution "Bundler") — el webpack de Next.js no la resuelve
    // por defecto, así que hay que decirle explícitamente que un import
    // ".js" puede corresponder a un archivo .ts/.tsx.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
