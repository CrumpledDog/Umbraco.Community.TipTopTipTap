import type { ManifestTiptapExtension } from '@umbraco-cms/backoffice/tiptap';

export const manifests: Array<ManifestTiptapExtension> = [
    {
        type: 'tiptapExtension',
        alias: 'Umbraco.Community.TipTopTipTap.OfficePaste',
        name: 'Office Paste Cleanup',
        api: () => import('./office-paste.extension.js'),
        meta: {
            icon: 'icon-save',
            label: 'Office Paste Cleanup',
            group: '#tiptap_extGroup_formatting',
        },
        weight: 100,
    },
];
