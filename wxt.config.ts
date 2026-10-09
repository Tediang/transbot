import { defineConfig } from "wxt";

const releaseVersion = process.env.TRANSBOT_VERSION;

export default defineConfig({
  manifest: {
    ...(releaseVersion ? { version: releaseVersion } : {}),
    name: "Transbot",
    description: "划词翻译和翻译框，使用 Azure 或火山引擎机器翻译。",
    permissions: ["storage", "contextMenus"],
    host_permissions: [
      "https://api.cognitive.microsofttranslator.com/*",
      "https://api-nam.cognitive.microsofttranslator.com/*",
      "https://api-apc.cognitive.microsofttranslator.com/*",
      "https://api-eur.cognitive.microsofttranslator.com/*",
      "https://*.cognitiveservices.azure.com/*",
      "https://translate.volcengineapi.com/*",
    ],
    commands: {
      "translate-selection": {
        suggested_key: { default: "Alt+Shift+T" },
        description: "翻译选中的文字",
      },
    },
    action: {
      default_title: "Transbot",
      default_icon: {
        16: "icon/16.png",
        32: "icon/32.png",
      },
    },
    icons: {
      16: "icon/16.png",
      32: "icon/32.png",
      48: "icon/48.png",
      128: "icon/128.png",
    },
  },
});
