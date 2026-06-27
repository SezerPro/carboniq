import type { Config } from "@react-router/dev/config";
import { vercelPreset } from "@vercel/react-router/vite";

// React Router v7.16+ : la config du framework (ssr, presets, future…) vit ici,
// le plugin Vite `reactRouter()` n'accepte plus d'argument.
// Le preset Vercel configure la sortie de build serverless — déplacé depuis vite.config.ts.
export default {
  ssr: true,
  presets: [vercelPreset()],
} satisfies Config;
