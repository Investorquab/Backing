/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Optional peer deps pulled in by wallet SDKs that we don't use.
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.resolve.fallback = { ...config.resolve.fallback, "@react-native-async-storage/async-storage": false };
    // Wallet SDKs only run in the browser; keep their Node builds out of the server bundle.
    if (isServer) {
      config.resolve.alias = { ...config.resolve.alias, "@base-org/account": false, "@coinbase/cdp-sdk": false };
    }
    return config;
  },
};
export default nextConfig;
