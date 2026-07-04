/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Necessário para o Docker build otimizado (standalone server)
  output: "standalone",
};

export default nextConfig;
