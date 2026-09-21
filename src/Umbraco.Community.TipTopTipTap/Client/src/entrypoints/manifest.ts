export const manifests: Array<UmbExtensionManifest> = [
  {
    name: "Crumpled Package Template Entrypoint",
    alias: "Umbraco.Community.TipTopTipTap.Entrypoint",
    type: "backofficeEntryPoint",
    js: () => import("./entrypoint.js"),
  },
];
