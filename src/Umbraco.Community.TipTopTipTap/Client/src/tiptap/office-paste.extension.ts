import OfficePaste from '@intevation/tiptap-extension-office-paste';
import { UmbTiptapExtensionApiBase } from '@umbraco-cms/backoffice/tiptap';
import { PasteAttributeCleanup } from './paste-attribute-cleanup.extension.js';

export default class OfficePasteExtensionApi extends UmbTiptapExtensionApiBase {
    getTiptapExtensions() {
        return [
            OfficePaste,
            PasteAttributeCleanup, // Strips style/class attributes left by office-paste
        ];
    }
}
