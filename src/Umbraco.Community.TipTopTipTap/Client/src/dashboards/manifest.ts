export const manifests: Array<UmbExtensionManifest> = [
  {
    name: "Crumpled Package Template Dashboard",
    alias: "Umbraco.Community.TipTopTipTap.Dashboard",
    type: "dashboard",
    js: () => import("./dashboard.element.js"),
    meta: {
      label: "Crumpled Package Template",
      pathname: "umbraco-community-tip-top-tip-tap",
    },
    conditions: [
      {
        alias: "Umb.Condition.SectionAlias",
        match: "Umb.Section.Settings",
      },
    ],
  },
];
