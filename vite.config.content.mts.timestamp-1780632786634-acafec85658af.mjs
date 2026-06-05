// vite.config.content.mts
import { defineConfig as defineConfig2 } from "file:///D:/code/2025/2.Web-Extension/vitesse-webext/node_modules/.pnpm/vite@5.4.2_@types+node@22.5.0/node_modules/vite/dist/node/index.js";

// vite.config.mts
import { dirname, relative } from "node:path";
import { defineConfig } from "file:///D:/code/2025/2.Web-Extension/vitesse-webext/node_modules/.pnpm/vite@5.4.2_@types+node@22.5.0/node_modules/vite/dist/node/index.js";
import Vue from "file:///D:/code/2025/2.Web-Extension/vitesse-webext/node_modules/.pnpm/@vitejs+plugin-vue@5.1.2_vite@5.4.2_@types+node@22.5.0__vue@3.4.38_typescript@5.5.4_/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import Icons from "file:///D:/code/2025/2.Web-Extension/vitesse-webext/node_modules/.pnpm/unplugin-icons@0.19.2_@vue+compiler-sfc@3.4.38/node_modules/unplugin-icons/dist/vite.js";
import IconsResolver from "file:///D:/code/2025/2.Web-Extension/vitesse-webext/node_modules/.pnpm/unplugin-icons@0.19.2_@vue+compiler-sfc@3.4.38/node_modules/unplugin-icons/dist/resolver.js";
import Components from "file:///D:/code/2025/2.Web-Extension/vitesse-webext/node_modules/.pnpm/unplugin-vue-components@0.27.4_@babel+parser@7.25.3_rollup@4.21.0_vue@3.4.38_typescript@5.5.4_/node_modules/unplugin-vue-components/dist/vite.js";
import AutoImport from "file:///D:/code/2025/2.Web-Extension/vitesse-webext/node_modules/.pnpm/unplugin-auto-import@0.18.2_@vueuse+core@11.0.1_vue@3.4.38_typescript@5.5.4___rollup@4.21.0/node_modules/unplugin-auto-import/dist/vite.js";
import UnoCSS from "file:///D:/code/2025/2.Web-Extension/vitesse-webext/node_modules/.pnpm/unocss@0.62.2_postcss@8.4.41_rollup@4.21.0_vite@5.4.2_@types+node@22.5.0_/node_modules/unocss/dist/vite.mjs";

// scripts/utils.ts
import { resolve } from "node:path";
import process from "node:process";
import { bgCyan, black } from "file:///D:/code/2025/2.Web-Extension/vitesse-webext/node_modules/.pnpm/kolorist@1.8.0/node_modules/kolorist/dist/esm/index.mjs";
var __vite_injected_original_dirname = "D:\\code\\2025\\2.Web-Extension\\vitesse-webext\\scripts";
var port = Number(process.env.PORT || "") || 3303;
var r = (...args) => resolve(__vite_injected_original_dirname, "..", ...args);
var isDev = process.env.NODE_ENV !== "production";
var isFirefox = process.env.EXTENSION === "firefox";

// package.json
var package_default = {
  name: "web-marker-extension",
  displayName: "MarkFlow",
  version: "0.6.0",
  private: true,
  packageManager: "pnpm@9.7.1",
  description: "\u4E0D\u4EC5\u4EC5\u662F\u9AD8\u4EAE\u5DE5\u5177\uFF0C\u66F4\u662F\u4F60\u7684\u7F51\u9875\u5185\u5BB9\u5BFC\u822A\u4EEA\u3002\u667A\u80FD\u6784\u5EFA\u7ED3\u6784\u5316\u5927\u7EB2\uFF0C\u652F\u6301\u7CBE\u51C6\u56DE\u8DF3\u3002",
  keywords: [
    "\u7F51\u9875\u6807\u8BB0\u5DE5\u5177",
    "\u514D\u8D39",
    "\u9AD8\u4EAE\u3001\u5907\u6CE8",
    "\u5BFC\u51FA\u3001\u7BA1\u7406",
    "\u5FEB\u901F\u8DF3\u8F6C",
    "\u7ED3\u6784\u6027\u56DE\u987E",
    "free",
    "web annotator",
    "browser annotation",
    "highlight keeper",
    "save highlights",
    "web highlighter",
    "local data"
  ],
  scripts: {
    dev: "npm run clear && cross-env NODE_ENV=development run-p dev:*",
    "dev-firefox": "npm run clear && cross-env NODE_ENV=development EXTENSION=firefox run-p dev:*",
    "dev:prepare": "esno scripts/prepare.ts",
    "dev:background": "npm run build:background -- --mode development",
    "dev:web": "vite",
    "dev:js": "npm run build:js -- --mode development",
    build: "cross-env NODE_ENV=production run-s clear build:web build:prepare build:background build:js",
    "build:prepare": "esno scripts/prepare.ts",
    "build:background": "vite build --config vite.config.background.mts",
    "build:web": "vite build",
    "build:js": "vite build --config vite.config.content.mts",
    pack: "cross-env NODE_ENV=production run-p pack:*",
    "pack:zip": "rimraf extension.zip && jszip-cli add extension/* -o ./extension.zip",
    "pack:crx": "crx pack extension -o ./extension.crx",
    "pack:xpi": "cross-env WEB_EXT_ARTIFACTS_DIR=./ web-ext build --source-dir ./extension --filename extension.xpi --overwrite-dest",
    "start:chromium": "web-ext run --source-dir ./extension --target=chromium --start-url https://example.com",
    "start:firefox": "web-ext run --source-dir ./extension --target=firefox-desktop --start-url https://example.com",
    clear: "rimraf --glob extension/dist extension/manifest.json extension.*",
    lint: "eslint --cache .",
    test: "vitest test",
    "test:e2e": "playwright test",
    postinstall: "simple-git-hooks",
    typecheck: "tsc --noEmit",
    "build:firefox-dev": "cross-env NODE_ENV=development EXTENSION=firefox run-s clear dev:prepare dev:background dev:js",
    "build:chromium": "cross-env EXTENSION=chromium run-s build",
    "build:firefox": "cross-env NODE_ENV=production EXTENSION=firefox run-s clear build:web build:prepare build:background build:js",
    "pack:zip:firefox": "rimraf extension-firefox.zip && jszip-cli add extension/* -o ./extension-firefox.zip",
    "pack:zip:chromium": "rimraf extension-chromium.zip && jszip-cli add extension/* -o ./extension-chromium.zip",
    "pack:chromium": "npm run build:chromium && run-s pack:zip:chromium pack:crx",
    "pack:firefox": "npm run build:firefox && npm run pack:xpi && npm run pack:zip:firefox",
    "pack:all": "run-s clear pack:chromium pack:firefox"
  },
  dependencies: {
    rangy: "^1.3.2",
    turndown: "^7.2.4"
  },
  devDependencies: {
    "@antfu/eslint-config": "^2.27.0",
    "@ffflorian/jszip-cli": "^3.8.5",
    "@iconify/json": "^2.2.239",
    "@playwright/test": "^1.46.1",
    "@types/fs-extra": "^11.0.4",
    "@types/lodash-es": "^4.17.12",
    "@types/node": "^22.5.0",
    "@types/rangy": "^1.3.0",
    "@types/turndown": "^5.0.6",
    "@types/webextension-polyfill": "^0.12.0",
    "@typescript-eslint/eslint-plugin": "^8.2.0",
    "@unocss/reset": "^0.62.2",
    "@vitejs/plugin-vue": "^5.1.2",
    "@vue/compiler-sfc": "^3.4.38",
    "@vue/test-utils": "^2.4.6",
    "@vueuse/core": "^11.0.1",
    chokidar: "^3.6.0",
    "cross-env": "^7.0.3",
    crx: "^5.0.1",
    eslint: "^9.9.0",
    esno: "^4.7.0",
    "fs-extra": "^11.2.0",
    jsdom: "^24.1.1",
    kolorist: "^1.8.0",
    "lint-staged": "^15.2.9",
    "lodash-es": "^4.18.1",
    "npm-run-all": "^4.1.5",
    rimraf: "^6.0.1",
    "simple-git-hooks": "^2.11.1",
    typescript: "^5.5.4",
    unocss: "^0.62.2",
    "unplugin-auto-import": "^0.18.2",
    "unplugin-icons": "^0.19.2",
    "unplugin-vue-components": "^0.27.4",
    vite: "^5.4.2",
    vitest: "^2.0.5",
    vue: "^3.4.38",
    "vue-demi": "^0.14.10",
    "web-ext": "^8.2.0",
    "webext-bridge": "^6.0.1",
    "webextension-polyfill": "^0.12.0"
  },
  "simple-git-hooks": {
    "pre-commit": "npx lint-staged"
  },
  "lint-staged": {
    "*.{js,ts,mjs,cjs,vue,json,jsonc}": "eslint --fix"
  }
};

// vite.config.mts
var sharedConfig = {
  root: r("src"),
  resolve: {
    alias: {
      "~/": `${r("src")}/`
    }
  },
  define: {
    __DEV__: isDev,
    __NAME__: JSON.stringify(package_default.name)
  },
  plugins: [
    Vue(),
    AutoImport({
      imports: [
        "vue",
        {
          "webextension-polyfill": [
            ["=", "browser"]
          ]
        }
      ],
      dts: r("src/auto-imports.d.ts")
    }),
    // https://github.com/antfu/unplugin-vue-components
    Components({
      dirs: [r("src/components")],
      // generate `components.d.ts` for ts support with Volar
      dts: r("src/components.d.ts"),
      resolvers: [
        // auto import icons
        IconsResolver({
          prefix: ""
        })
      ]
    }),
    // https://github.com/antfu/unplugin-icons
    Icons(),
    // https://github.com/unocss/unocss
    UnoCSS(),
    // rewrite assets to use relative path
    {
      name: "assets-rewrite",
      enforce: "post",
      apply: "build",
      transformIndexHtml(html, { path }) {
        return html.replace(/"\/assets\//g, `"${relative(dirname(path), "/assets")}/`);
      }
    }
  ],
  optimizeDeps: {
    include: [
      "vue",
      "@vueuse/core",
      "webextension-polyfill"
    ],
    exclude: [
      "vue-demi"
    ]
  }
};
var vite_config_default = defineConfig(({ command }) => ({
  ...sharedConfig,
  base: command === "serve" ? `http://localhost:${port}/` : "/dist/",
  server: {
    port,
    hmr: {
      host: "localhost"
    },
    origin: `http://localhost:${port}`
  },
  build: {
    watch: isDev ? {} : void 0,
    outDir: r("extension/dist"),
    emptyOutDir: false,
    sourcemap: isDev ? "inline" : false,
    // https://developer.chrome.com/docs/webstore/program_policies/#:~:text=Code%20Readability%20Requirements
    terserOptions: {
      mangle: false
    },
    rollupOptions: {
      input: {
        options: r("src/options/index.html"),
        popup: r("src/popup/index.html"),
        sidepanel: r("src/sidepanel/index.html")
      }
    }
  },
  test: {
    globals: true,
    environment: "jsdom"
  }
}));

// vite.config.content.mts
var vite_config_content_default = defineConfig2({
  ...sharedConfig,
  define: {
    "__DEV__": isDev,
    "__NAME__": JSON.stringify(package_default.name),
    // https://github.com/vitejs/vite/issues/9320
    // https://github.com/vitejs/vite/issues/9186
    "process.env.NODE_ENV": JSON.stringify(isDev ? "development" : "production")
  },
  build: {
    watch: isDev ? {} : void 0,
    outDir: r("extension/dist/contentScripts"),
    cssCodeSplit: false,
    emptyOutDir: false,
    sourcemap: isDev ? "inline" : false,
    lib: {
      entry: r("src/contentScripts/index.ts"),
      name: package_default.name,
      formats: ["iife"]
    },
    rollupOptions: {
      output: {
        entryFileNames: "index.global.js",
        extend: true
      }
    }
  }
});
export {
  vite_config_content_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuY29udGVudC5tdHMiLCAidml0ZS5jb25maWcubXRzIiwgInNjcmlwdHMvdXRpbHMudHMiLCAicGFja2FnZS5qc29uIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiRDpcXFxcY29kZVxcXFwyMDI1XFxcXDIuV2ViLUV4dGVuc2lvblxcXFx2aXRlc3NlLXdlYmV4dFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRDpcXFxcY29kZVxcXFwyMDI1XFxcXDIuV2ViLUV4dGVuc2lvblxcXFx2aXRlc3NlLXdlYmV4dFxcXFx2aXRlLmNvbmZpZy5jb250ZW50Lm10c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovY29kZS8yMDI1LzIuV2ViLUV4dGVuc2lvbi92aXRlc3NlLXdlYmV4dC92aXRlLmNvbmZpZy5jb250ZW50Lm10c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnXHJcbmltcG9ydCB7IHNoYXJlZENvbmZpZyB9IGZyb20gJy4vdml0ZS5jb25maWcubWpzJ1xyXG5pbXBvcnQgeyBpc0RldiwgciB9IGZyb20gJy4vc2NyaXB0cy91dGlscydcclxuaW1wb3J0IHBhY2thZ2VKc29uIGZyb20gJy4vcGFja2FnZS5qc29uJ1xyXG5cclxuLy8gYnVuZGxpbmcgdGhlIGNvbnRlbnQgc2NyaXB0IHVzaW5nIFZpdGVcclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICAuLi5zaGFyZWRDb25maWcsXHJcbiAgZGVmaW5lOiB7XHJcbiAgICAnX19ERVZfXyc6IGlzRGV2LFxyXG4gICAgJ19fTkFNRV9fJzogSlNPTi5zdHJpbmdpZnkocGFja2FnZUpzb24ubmFtZSksXHJcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vdml0ZWpzL3ZpdGUvaXNzdWVzLzkzMjBcclxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS92aXRlanMvdml0ZS9pc3N1ZXMvOTE4NlxyXG4gICAgJ3Byb2Nlc3MuZW52Lk5PREVfRU5WJzogSlNPTi5zdHJpbmdpZnkoaXNEZXYgPyAnZGV2ZWxvcG1lbnQnIDogJ3Byb2R1Y3Rpb24nKSxcclxuICB9LFxyXG4gIGJ1aWxkOiB7XHJcbiAgICB3YXRjaDogaXNEZXZcclxuICAgICAgPyB7fVxyXG4gICAgICA6IHVuZGVmaW5lZCxcclxuICAgIG91dERpcjogcignZXh0ZW5zaW9uL2Rpc3QvY29udGVudFNjcmlwdHMnKSxcclxuICAgIGNzc0NvZGVTcGxpdDogZmFsc2UsXHJcbiAgICBlbXB0eU91dERpcjogZmFsc2UsXHJcbiAgICBzb3VyY2VtYXA6IGlzRGV2ID8gJ2lubGluZScgOiBmYWxzZSxcclxuICAgIGxpYjoge1xyXG4gICAgICBlbnRyeTogcignc3JjL2NvbnRlbnRTY3JpcHRzL2luZGV4LnRzJyksXHJcbiAgICAgIG5hbWU6IHBhY2thZ2VKc29uLm5hbWUsXHJcbiAgICAgIGZvcm1hdHM6IFsnaWlmZSddLFxyXG4gICAgfSxcclxuICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgb3V0cHV0OiB7XHJcbiAgICAgICAgZW50cnlGaWxlTmFtZXM6ICdpbmRleC5nbG9iYWwuanMnLFxyXG4gICAgICAgIGV4dGVuZDogdHJ1ZSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfSxcclxufSlcclxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxjb2RlXFxcXDIwMjVcXFxcMi5XZWItRXh0ZW5zaW9uXFxcXHZpdGVzc2Utd2ViZXh0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxjb2RlXFxcXDIwMjVcXFxcMi5XZWItRXh0ZW5zaW9uXFxcXHZpdGVzc2Utd2ViZXh0XFxcXHZpdGUuY29uZmlnLm10c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovY29kZS8yMDI1LzIuV2ViLUV4dGVuc2lvbi92aXRlc3NlLXdlYmV4dC92aXRlLmNvbmZpZy5tdHNcIjsvLy8gPHJlZmVyZW5jZSB0eXBlcz1cInZpdGVzdFwiIC8+XHJcblxyXG5pbXBvcnQgeyBkaXJuYW1lLCByZWxhdGl2ZSB9IGZyb20gJ25vZGU6cGF0aCdcclxuaW1wb3J0IHR5cGUgeyBVc2VyQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IFZ1ZSBmcm9tICdAdml0ZWpzL3BsdWdpbi12dWUnXHJcbmltcG9ydCBJY29ucyBmcm9tICd1bnBsdWdpbi1pY29ucy92aXRlJ1xyXG5pbXBvcnQgSWNvbnNSZXNvbHZlciBmcm9tICd1bnBsdWdpbi1pY29ucy9yZXNvbHZlcidcclxuaW1wb3J0IENvbXBvbmVudHMgZnJvbSAndW5wbHVnaW4tdnVlLWNvbXBvbmVudHMvdml0ZSdcclxuaW1wb3J0IEF1dG9JbXBvcnQgZnJvbSAndW5wbHVnaW4tYXV0by1pbXBvcnQvdml0ZSdcclxuaW1wb3J0IFVub0NTUyBmcm9tICd1bm9jc3Mvdml0ZSdcclxuaW1wb3J0IHsgaXNEZXYsIHBvcnQsIHIgfSBmcm9tICcuL3NjcmlwdHMvdXRpbHMnXHJcbmltcG9ydCBwYWNrYWdlSnNvbiBmcm9tICcuL3BhY2thZ2UuanNvbidcclxuXHJcbmV4cG9ydCBjb25zdCBzaGFyZWRDb25maWc6IFVzZXJDb25maWcgPSB7XHJcbiAgcm9vdDogcignc3JjJyksXHJcbiAgcmVzb2x2ZToge1xyXG4gICAgYWxpYXM6IHtcclxuICAgICAgJ34vJzogYCR7cignc3JjJyl9L2AsXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgZGVmaW5lOiB7XHJcbiAgICBfX0RFVl9fOiBpc0RldixcclxuICAgIF9fTkFNRV9fOiBKU09OLnN0cmluZ2lmeShwYWNrYWdlSnNvbi5uYW1lKSxcclxuICB9LFxyXG4gIHBsdWdpbnM6IFtcclxuICAgIFZ1ZSgpLFxyXG5cclxuICAgIEF1dG9JbXBvcnQoe1xyXG4gICAgICBpbXBvcnRzOiBbXHJcbiAgICAgICAgJ3Z1ZScsXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgJ3dlYmV4dGVuc2lvbi1wb2x5ZmlsbCc6IFtcclxuICAgICAgICAgICAgWyc9JywgJ2Jyb3dzZXInXSxcclxuICAgICAgICAgIF0sXHJcbiAgICAgICAgfSxcclxuICAgICAgXSxcclxuICAgICAgZHRzOiByKCdzcmMvYXV0by1pbXBvcnRzLmQudHMnKSxcclxuICAgIH0pLFxyXG5cclxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9hbnRmdS91bnBsdWdpbi12dWUtY29tcG9uZW50c1xyXG4gICAgQ29tcG9uZW50cyh7XHJcbiAgICAgIGRpcnM6IFtyKCdzcmMvY29tcG9uZW50cycpXSxcclxuICAgICAgLy8gZ2VuZXJhdGUgYGNvbXBvbmVudHMuZC50c2AgZm9yIHRzIHN1cHBvcnQgd2l0aCBWb2xhclxyXG4gICAgICBkdHM6IHIoJ3NyYy9jb21wb25lbnRzLmQudHMnKSxcclxuICAgICAgcmVzb2x2ZXJzOiBbXHJcbiAgICAgICAgLy8gYXV0byBpbXBvcnQgaWNvbnNcclxuICAgICAgICBJY29uc1Jlc29sdmVyKHtcclxuICAgICAgICAgIHByZWZpeDogJycsXHJcbiAgICAgICAgfSksXHJcbiAgICAgIF0sXHJcbiAgICB9KSxcclxuXHJcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vYW50ZnUvdW5wbHVnaW4taWNvbnNcclxuICAgIEljb25zKCksXHJcblxyXG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3Vub2Nzcy91bm9jc3NcclxuICAgIFVub0NTUygpLFxyXG5cclxuICAgIC8vIHJld3JpdGUgYXNzZXRzIHRvIHVzZSByZWxhdGl2ZSBwYXRoXHJcbiAgICB7XHJcbiAgICAgIG5hbWU6ICdhc3NldHMtcmV3cml0ZScsXHJcbiAgICAgIGVuZm9yY2U6ICdwb3N0JyxcclxuICAgICAgYXBwbHk6ICdidWlsZCcsXHJcbiAgICAgIHRyYW5zZm9ybUluZGV4SHRtbChodG1sLCB7IHBhdGggfSkge1xyXG4gICAgICAgIHJldHVybiBodG1sLnJlcGxhY2UoL1wiXFwvYXNzZXRzXFwvL2csIGBcIiR7cmVsYXRpdmUoZGlybmFtZShwYXRoKSwgJy9hc3NldHMnKX0vYClcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgXSxcclxuICBvcHRpbWl6ZURlcHM6IHtcclxuICAgIGluY2x1ZGU6IFtcclxuICAgICAgJ3Z1ZScsXHJcbiAgICAgICdAdnVldXNlL2NvcmUnLFxyXG4gICAgICAnd2ViZXh0ZW5zaW9uLXBvbHlmaWxsJyxcclxuICAgIF0sXHJcbiAgICBleGNsdWRlOiBbXHJcbiAgICAgICd2dWUtZGVtaScsXHJcbiAgICBdLFxyXG4gIH0sXHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBjb21tYW5kIH0pID0+ICh7XHJcbiAgLi4uc2hhcmVkQ29uZmlnLFxyXG4gIGJhc2U6IGNvbW1hbmQgPT09ICdzZXJ2ZScgPyBgaHR0cDovL2xvY2FsaG9zdDoke3BvcnR9L2AgOiAnL2Rpc3QvJyxcclxuICBzZXJ2ZXI6IHtcclxuICAgIHBvcnQsXHJcbiAgICBobXI6IHtcclxuICAgICAgaG9zdDogJ2xvY2FsaG9zdCcsXHJcbiAgICB9LFxyXG4gICAgb3JpZ2luOiBgaHR0cDovL2xvY2FsaG9zdDoke3BvcnR9YCxcclxuICB9LFxyXG4gIGJ1aWxkOiB7XHJcbiAgICB3YXRjaDogaXNEZXZcclxuICAgICAgPyB7fVxyXG4gICAgICA6IHVuZGVmaW5lZCxcclxuICAgIG91dERpcjogcignZXh0ZW5zaW9uL2Rpc3QnKSxcclxuICAgIGVtcHR5T3V0RGlyOiBmYWxzZSxcclxuICAgIHNvdXJjZW1hcDogaXNEZXYgPyAnaW5saW5lJyA6IGZhbHNlLFxyXG4gICAgLy8gaHR0cHM6Ly9kZXZlbG9wZXIuY2hyb21lLmNvbS9kb2NzL3dlYnN0b3JlL3Byb2dyYW1fcG9saWNpZXMvIzp+OnRleHQ9Q29kZSUyMFJlYWRhYmlsaXR5JTIwUmVxdWlyZW1lbnRzXHJcbiAgICB0ZXJzZXJPcHRpb25zOiB7XHJcbiAgICAgIG1hbmdsZTogZmFsc2UsXHJcbiAgICB9LFxyXG4gICAgcm9sbHVwT3B0aW9uczoge1xyXG4gICAgICBpbnB1dDoge1xyXG4gICAgICAgIG9wdGlvbnM6IHIoJ3NyYy9vcHRpb25zL2luZGV4Lmh0bWwnKSxcclxuICAgICAgICBwb3B1cDogcignc3JjL3BvcHVwL2luZGV4Lmh0bWwnKSxcclxuICAgICAgICBzaWRlcGFuZWw6IHIoJ3NyYy9zaWRlcGFuZWwvaW5kZXguaHRtbCcpLFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICB9LFxyXG4gIHRlc3Q6IHtcclxuICAgIGdsb2JhbHM6IHRydWUsXHJcbiAgICBlbnZpcm9ubWVudDogJ2pzZG9tJyxcclxuICB9LFxyXG59KSlcclxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxjb2RlXFxcXDIwMjVcXFxcMi5XZWItRXh0ZW5zaW9uXFxcXHZpdGVzc2Utd2ViZXh0XFxcXHNjcmlwdHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXGNvZGVcXFxcMjAyNVxcXFwyLldlYi1FeHRlbnNpb25cXFxcdml0ZXNzZS13ZWJleHRcXFxcc2NyaXB0c1xcXFx1dGlscy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovY29kZS8yMDI1LzIuV2ViLUV4dGVuc2lvbi92aXRlc3NlLXdlYmV4dC9zY3JpcHRzL3V0aWxzLnRzXCI7aW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ25vZGU6cGF0aCdcclxuaW1wb3J0IHByb2Nlc3MgZnJvbSAnbm9kZTpwcm9jZXNzJ1xyXG5pbXBvcnQgeyBiZ0N5YW4sIGJsYWNrIH0gZnJvbSAna29sb3Jpc3QnXHJcblxyXG5leHBvcnQgY29uc3QgcG9ydCA9IE51bWJlcihwcm9jZXNzLmVudi5QT1JUIHx8ICcnKSB8fCAzMzAzXHJcbmV4cG9ydCBjb25zdCByID0gKC4uLmFyZ3M6IHN0cmluZ1tdKSA9PiByZXNvbHZlKF9fZGlybmFtZSwgJy4uJywgLi4uYXJncylcclxuZXhwb3J0IGNvbnN0IGlzRGV2ID0gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJ1xyXG5leHBvcnQgY29uc3QgaXNGaXJlZm94ID0gcHJvY2Vzcy5lbnYuRVhURU5TSU9OID09PSAnZmlyZWZveCdcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBsb2cobmFtZTogc3RyaW5nLCBtZXNzYWdlOiBzdHJpbmcpIHtcclxuICBjb25zb2xlLmxvZyhibGFjayhiZ0N5YW4oYCAke25hbWV9IGApKSwgbWVzc2FnZSlcclxufVxyXG4iLCAie1xuICBcIm5hbWVcIjogXCJ3ZWItbWFya2VyLWV4dGVuc2lvblwiLFxuICBcImRpc3BsYXlOYW1lXCI6IFwiTWFya0Zsb3dcIixcbiAgXCJ2ZXJzaW9uXCI6IFwiMC42LjBcIixcbiAgXCJwcml2YXRlXCI6IHRydWUsXG4gIFwicGFja2FnZU1hbmFnZXJcIjogXCJwbnBtQDkuNy4xXCIsXG4gIFwiZGVzY3JpcHRpb25cIjogXCJcdTRFMERcdTRFQzVcdTRFQzVcdTY2MkZcdTlBRDhcdTRFQUVcdTVERTVcdTUxNzdcdUZGMENcdTY2RjRcdTY2MkZcdTRGNjBcdTc2ODRcdTdGNTFcdTk4NzVcdTUxODVcdTVCQjlcdTVCRkNcdTgyMkFcdTRFRUFcdTMwMDJcdTY2N0FcdTgwRkRcdTY3ODRcdTVFRkFcdTdFRDNcdTY3ODRcdTUzMTZcdTU5MjdcdTdFQjJcdUZGMENcdTY1MkZcdTYzMDFcdTdDQkVcdTUxQzZcdTU2REVcdThERjNcdTMwMDJcIixcbiAgXCJrZXl3b3Jkc1wiOiBbXG4gICAgXCJcdTdGNTFcdTk4NzVcdTY4MDdcdThCQjBcdTVERTVcdTUxNzdcIixcbiAgICBcIlx1NTE0RFx1OEQzOVwiLFxuICAgIFwiXHU5QUQ4XHU0RUFFXHUzMDAxXHU1OTA3XHU2Q0U4XCIsXG4gICAgXCJcdTVCRkNcdTUxRkFcdTMwMDFcdTdCQTFcdTc0MDZcIixcbiAgICBcIlx1NUZFQlx1OTAxRlx1OERGM1x1OEY2Q1wiLFxuICAgIFwiXHU3RUQzXHU2Nzg0XHU2MDI3XHU1NkRFXHU5ODdFXCIsXG4gICAgXCJmcmVlXCIsXG4gICAgXCJ3ZWIgYW5ub3RhdG9yXCIsXG4gICAgXCJicm93c2VyIGFubm90YXRpb25cIixcbiAgICBcImhpZ2hsaWdodCBrZWVwZXJcIixcbiAgICBcInNhdmUgaGlnaGxpZ2h0c1wiLFxuICAgIFwid2ViIGhpZ2hsaWdodGVyXCIsXG4gICAgXCJsb2NhbCBkYXRhXCJcbiAgXSxcbiAgXCJzY3JpcHRzXCI6IHtcbiAgICBcImRldlwiOiBcIm5wbSBydW4gY2xlYXIgJiYgY3Jvc3MtZW52IE5PREVfRU5WPWRldmVsb3BtZW50IHJ1bi1wIGRldjoqXCIsXG4gICAgXCJkZXYtZmlyZWZveFwiOiBcIm5wbSBydW4gY2xlYXIgJiYgY3Jvc3MtZW52IE5PREVfRU5WPWRldmVsb3BtZW50IEVYVEVOU0lPTj1maXJlZm94IHJ1bi1wIGRldjoqXCIsXG4gICAgXCJkZXY6cHJlcGFyZVwiOiBcImVzbm8gc2NyaXB0cy9wcmVwYXJlLnRzXCIsXG4gICAgXCJkZXY6YmFja2dyb3VuZFwiOiBcIm5wbSBydW4gYnVpbGQ6YmFja2dyb3VuZCAtLSAtLW1vZGUgZGV2ZWxvcG1lbnRcIixcbiAgICBcImRldjp3ZWJcIjogXCJ2aXRlXCIsXG4gICAgXCJkZXY6anNcIjogXCJucG0gcnVuIGJ1aWxkOmpzIC0tIC0tbW9kZSBkZXZlbG9wbWVudFwiLFxuICAgIFwiYnVpbGRcIjogXCJjcm9zcy1lbnYgTk9ERV9FTlY9cHJvZHVjdGlvbiBydW4tcyBjbGVhciBidWlsZDp3ZWIgYnVpbGQ6cHJlcGFyZSBidWlsZDpiYWNrZ3JvdW5kIGJ1aWxkOmpzXCIsXG4gICAgXCJidWlsZDpwcmVwYXJlXCI6IFwiZXNubyBzY3JpcHRzL3ByZXBhcmUudHNcIixcbiAgICBcImJ1aWxkOmJhY2tncm91bmRcIjogXCJ2aXRlIGJ1aWxkIC0tY29uZmlnIHZpdGUuY29uZmlnLmJhY2tncm91bmQubXRzXCIsXG4gICAgXCJidWlsZDp3ZWJcIjogXCJ2aXRlIGJ1aWxkXCIsXG4gICAgXCJidWlsZDpqc1wiOiBcInZpdGUgYnVpbGQgLS1jb25maWcgdml0ZS5jb25maWcuY29udGVudC5tdHNcIixcbiAgICBcInBhY2tcIjogXCJjcm9zcy1lbnYgTk9ERV9FTlY9cHJvZHVjdGlvbiBydW4tcCBwYWNrOipcIixcbiAgICBcInBhY2s6emlwXCI6IFwicmltcmFmIGV4dGVuc2lvbi56aXAgJiYganN6aXAtY2xpIGFkZCBleHRlbnNpb24vKiAtbyAuL2V4dGVuc2lvbi56aXBcIixcbiAgICBcInBhY2s6Y3J4XCI6IFwiY3J4IHBhY2sgZXh0ZW5zaW9uIC1vIC4vZXh0ZW5zaW9uLmNyeFwiLFxuICAgIFwicGFjazp4cGlcIjogXCJjcm9zcy1lbnYgV0VCX0VYVF9BUlRJRkFDVFNfRElSPS4vIHdlYi1leHQgYnVpbGQgLS1zb3VyY2UtZGlyIC4vZXh0ZW5zaW9uIC0tZmlsZW5hbWUgZXh0ZW5zaW9uLnhwaSAtLW92ZXJ3cml0ZS1kZXN0XCIsXG4gICAgXCJzdGFydDpjaHJvbWl1bVwiOiBcIndlYi1leHQgcnVuIC0tc291cmNlLWRpciAuL2V4dGVuc2lvbiAtLXRhcmdldD1jaHJvbWl1bSAtLXN0YXJ0LXVybCBodHRwczovL2V4YW1wbGUuY29tXCIsXG4gICAgXCJzdGFydDpmaXJlZm94XCI6IFwid2ViLWV4dCBydW4gLS1zb3VyY2UtZGlyIC4vZXh0ZW5zaW9uIC0tdGFyZ2V0PWZpcmVmb3gtZGVza3RvcCAtLXN0YXJ0LXVybCBodHRwczovL2V4YW1wbGUuY29tXCIsXG4gICAgXCJjbGVhclwiOiBcInJpbXJhZiAtLWdsb2IgZXh0ZW5zaW9uL2Rpc3QgZXh0ZW5zaW9uL21hbmlmZXN0Lmpzb24gZXh0ZW5zaW9uLipcIixcbiAgICBcImxpbnRcIjogXCJlc2xpbnQgLS1jYWNoZSAuXCIsXG4gICAgXCJ0ZXN0XCI6IFwidml0ZXN0IHRlc3RcIixcbiAgICBcInRlc3Q6ZTJlXCI6IFwicGxheXdyaWdodCB0ZXN0XCIsXG4gICAgXCJwb3N0aW5zdGFsbFwiOiBcInNpbXBsZS1naXQtaG9va3NcIixcbiAgICBcInR5cGVjaGVja1wiOiBcInRzYyAtLW5vRW1pdFwiLFxuICAgIFwiYnVpbGQ6ZmlyZWZveC1kZXZcIjogXCJjcm9zcy1lbnYgTk9ERV9FTlY9ZGV2ZWxvcG1lbnQgRVhURU5TSU9OPWZpcmVmb3ggcnVuLXMgY2xlYXIgZGV2OnByZXBhcmUgZGV2OmJhY2tncm91bmQgZGV2OmpzXCIsXG4gICAgXCJidWlsZDpjaHJvbWl1bVwiOiBcImNyb3NzLWVudiBFWFRFTlNJT049Y2hyb21pdW0gcnVuLXMgYnVpbGRcIixcbiAgICBcImJ1aWxkOmZpcmVmb3hcIjogXCJjcm9zcy1lbnYgTk9ERV9FTlY9cHJvZHVjdGlvbiBFWFRFTlNJT049ZmlyZWZveCBydW4tcyBjbGVhciBidWlsZDp3ZWIgYnVpbGQ6cHJlcGFyZSBidWlsZDpiYWNrZ3JvdW5kIGJ1aWxkOmpzXCIsXG4gICAgXCJwYWNrOnppcDpmaXJlZm94XCI6IFwicmltcmFmIGV4dGVuc2lvbi1maXJlZm94LnppcCAmJiBqc3ppcC1jbGkgYWRkIGV4dGVuc2lvbi8qIC1vIC4vZXh0ZW5zaW9uLWZpcmVmb3guemlwXCIsXG4gICAgXCJwYWNrOnppcDpjaHJvbWl1bVwiOiBcInJpbXJhZiBleHRlbnNpb24tY2hyb21pdW0uemlwICYmIGpzemlwLWNsaSBhZGQgZXh0ZW5zaW9uLyogLW8gLi9leHRlbnNpb24tY2hyb21pdW0uemlwXCIsXG4gICAgXCJwYWNrOmNocm9taXVtXCI6IFwibnBtIHJ1biBidWlsZDpjaHJvbWl1bSAmJiBydW4tcyBwYWNrOnppcDpjaHJvbWl1bSBwYWNrOmNyeFwiLFxuICAgIFwicGFjazpmaXJlZm94XCI6IFwibnBtIHJ1biBidWlsZDpmaXJlZm94ICYmIG5wbSBydW4gcGFjazp4cGkgJiYgbnBtIHJ1biBwYWNrOnppcDpmaXJlZm94XCIsXG4gICAgXCJwYWNrOmFsbFwiOiBcInJ1bi1zIGNsZWFyIHBhY2s6Y2hyb21pdW0gcGFjazpmaXJlZm94XCJcbiAgfSxcbiAgXCJkZXBlbmRlbmNpZXNcIjoge1xuICAgIFwicmFuZ3lcIjogXCJeMS4zLjJcIixcbiAgICBcInR1cm5kb3duXCI6IFwiXjcuMi40XCJcbiAgfSxcbiAgXCJkZXZEZXBlbmRlbmNpZXNcIjoge1xuICAgIFwiQGFudGZ1L2VzbGludC1jb25maWdcIjogXCJeMi4yNy4wXCIsXG4gICAgXCJAZmZmbG9yaWFuL2pzemlwLWNsaVwiOiBcIl4zLjguNVwiLFxuICAgIFwiQGljb25pZnkvanNvblwiOiBcIl4yLjIuMjM5XCIsXG4gICAgXCJAcGxheXdyaWdodC90ZXN0XCI6IFwiXjEuNDYuMVwiLFxuICAgIFwiQHR5cGVzL2ZzLWV4dHJhXCI6IFwiXjExLjAuNFwiLFxuICAgIFwiQHR5cGVzL2xvZGFzaC1lc1wiOiBcIl40LjE3LjEyXCIsXG4gICAgXCJAdHlwZXMvbm9kZVwiOiBcIl4yMi41LjBcIixcbiAgICBcIkB0eXBlcy9yYW5neVwiOiBcIl4xLjMuMFwiLFxuICAgIFwiQHR5cGVzL3R1cm5kb3duXCI6IFwiXjUuMC42XCIsXG4gICAgXCJAdHlwZXMvd2ViZXh0ZW5zaW9uLXBvbHlmaWxsXCI6IFwiXjAuMTIuMFwiLFxuICAgIFwiQHR5cGVzY3JpcHQtZXNsaW50L2VzbGludC1wbHVnaW5cIjogXCJeOC4yLjBcIixcbiAgICBcIkB1bm9jc3MvcmVzZXRcIjogXCJeMC42Mi4yXCIsXG4gICAgXCJAdml0ZWpzL3BsdWdpbi12dWVcIjogXCJeNS4xLjJcIixcbiAgICBcIkB2dWUvY29tcGlsZXItc2ZjXCI6IFwiXjMuNC4zOFwiLFxuICAgIFwiQHZ1ZS90ZXN0LXV0aWxzXCI6IFwiXjIuNC42XCIsXG4gICAgXCJAdnVldXNlL2NvcmVcIjogXCJeMTEuMC4xXCIsXG4gICAgXCJjaG9raWRhclwiOiBcIl4zLjYuMFwiLFxuICAgIFwiY3Jvc3MtZW52XCI6IFwiXjcuMC4zXCIsXG4gICAgXCJjcnhcIjogXCJeNS4wLjFcIixcbiAgICBcImVzbGludFwiOiBcIl45LjkuMFwiLFxuICAgIFwiZXNub1wiOiBcIl40LjcuMFwiLFxuICAgIFwiZnMtZXh0cmFcIjogXCJeMTEuMi4wXCIsXG4gICAgXCJqc2RvbVwiOiBcIl4yNC4xLjFcIixcbiAgICBcImtvbG9yaXN0XCI6IFwiXjEuOC4wXCIsXG4gICAgXCJsaW50LXN0YWdlZFwiOiBcIl4xNS4yLjlcIixcbiAgICBcImxvZGFzaC1lc1wiOiBcIl40LjE4LjFcIixcbiAgICBcIm5wbS1ydW4tYWxsXCI6IFwiXjQuMS41XCIsXG4gICAgXCJyaW1yYWZcIjogXCJeNi4wLjFcIixcbiAgICBcInNpbXBsZS1naXQtaG9va3NcIjogXCJeMi4xMS4xXCIsXG4gICAgXCJ0eXBlc2NyaXB0XCI6IFwiXjUuNS40XCIsXG4gICAgXCJ1bm9jc3NcIjogXCJeMC42Mi4yXCIsXG4gICAgXCJ1bnBsdWdpbi1hdXRvLWltcG9ydFwiOiBcIl4wLjE4LjJcIixcbiAgICBcInVucGx1Z2luLWljb25zXCI6IFwiXjAuMTkuMlwiLFxuICAgIFwidW5wbHVnaW4tdnVlLWNvbXBvbmVudHNcIjogXCJeMC4yNy40XCIsXG4gICAgXCJ2aXRlXCI6IFwiXjUuNC4yXCIsXG4gICAgXCJ2aXRlc3RcIjogXCJeMi4wLjVcIixcbiAgICBcInZ1ZVwiOiBcIl4zLjQuMzhcIixcbiAgICBcInZ1ZS1kZW1pXCI6IFwiXjAuMTQuMTBcIixcbiAgICBcIndlYi1leHRcIjogXCJeOC4yLjBcIixcbiAgICBcIndlYmV4dC1icmlkZ2VcIjogXCJeNi4wLjFcIixcbiAgICBcIndlYmV4dGVuc2lvbi1wb2x5ZmlsbFwiOiBcIl4wLjEyLjBcIlxuICB9LFxuICBcInNpbXBsZS1naXQtaG9va3NcIjoge1xuICAgIFwicHJlLWNvbW1pdFwiOiBcIm5weCBsaW50LXN0YWdlZFwiXG4gIH0sXG4gIFwibGludC1zdGFnZWRcIjoge1xuICAgIFwiKi57anMsdHMsbWpzLGNqcyx2dWUsanNvbixqc29uY31cIjogXCJlc2xpbnQgLS1maXhcIlxuICB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQStVLFNBQVMsZ0JBQUFBLHFCQUFvQjs7O0FDRTVXLFNBQVMsU0FBUyxnQkFBZ0I7QUFFbEMsU0FBUyxvQkFBb0I7QUFDN0IsT0FBTyxTQUFTO0FBQ2hCLE9BQU8sV0FBVztBQUNsQixPQUFPLG1CQUFtQjtBQUMxQixPQUFPLGdCQUFnQjtBQUN2QixPQUFPLGdCQUFnQjtBQUN2QixPQUFPLFlBQVk7OztBQ1Z3VCxTQUFTLGVBQWU7QUFDblcsT0FBTyxhQUFhO0FBQ3BCLFNBQVMsUUFBUSxhQUFhO0FBRjlCLElBQU0sbUNBQW1DO0FBSWxDLElBQU0sT0FBTyxPQUFPLFFBQVEsSUFBSSxRQUFRLEVBQUUsS0FBSztBQUMvQyxJQUFNLElBQUksSUFBSSxTQUFtQixRQUFRLGtDQUFXLE1BQU0sR0FBRyxJQUFJO0FBQ2pFLElBQU0sUUFBUSxRQUFRLElBQUksYUFBYTtBQUN2QyxJQUFNLFlBQVksUUFBUSxJQUFJLGNBQWM7OztBQ1BuRDtBQUFBLEVBQ0UsTUFBUTtBQUFBLEVBQ1IsYUFBZTtBQUFBLEVBQ2YsU0FBVztBQUFBLEVBQ1gsU0FBVztBQUFBLEVBQ1gsZ0JBQWtCO0FBQUEsRUFDbEIsYUFBZTtBQUFBLEVBQ2YsVUFBWTtBQUFBLElBQ1Y7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxFQUNGO0FBQUEsRUFDQSxTQUFXO0FBQUEsSUFDVCxLQUFPO0FBQUEsSUFDUCxlQUFlO0FBQUEsSUFDZixlQUFlO0FBQUEsSUFDZixrQkFBa0I7QUFBQSxJQUNsQixXQUFXO0FBQUEsSUFDWCxVQUFVO0FBQUEsSUFDVixPQUFTO0FBQUEsSUFDVCxpQkFBaUI7QUFB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
