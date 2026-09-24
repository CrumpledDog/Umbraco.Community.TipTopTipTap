import { UmbTiptapExtensionApiBase } from '@umbraco-cms/backoffice/tiptap';
import { PasteAttributeCleanup } from './paste-attribute-cleanup.extension.js';

// Only PasteAttributeCleanup is registered here - it calls office-paste's own transform
// function internally (see paste-attribute-cleanup.extension.ts for why office-paste can no
// longer be registered as a separate, second plugin).
export default class OfficePasteExtensionApi extends UmbTiptapExtensionApiBase {
    getTiptapExtensions() {
        return [
            PasteAttributeCleanup,
        ];
    }
}
