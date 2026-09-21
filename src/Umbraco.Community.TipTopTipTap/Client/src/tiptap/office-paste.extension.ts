import OfficePaste from '@intevation/tiptap-extension-office-paste';
import { UmbTiptapExtensionApiBase } from '@umbraco-cms/backoffice/tiptap';
import { CleanupEmptyAttrs } from './cleanup-empty-attrs.extension.js';

export default class OfficePasteExtensionApi extends UmbTiptapExtensionApiBase {
    getTiptapExtensions() {
        return [
            OfficePaste,
            CleanupEmptyAttrs, // Cleans up empty class/style attributes left by office-paste
        ];
    }
}
