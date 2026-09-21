import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * Extension to clean up empty attributes and elements left by office-paste
 * Runs after office-paste (priority 99998 < 99999) to:
 * - Remove empty class and style attributes during paste
 * - Unwrap span tags with no attributes after document changes
 */
export const CleanupEmptyAttrs = Extension.create({
    name: 'cleanup-empty-attrs',
    priority: 99998, // Run just after office-paste (priority 99999)

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey('cleanup-empty-attrs'),
                props: {
                    transformPastedHTML(html: string): string {
                        // Only process if it looks like it might need cleanup
                        if (html.includes('class=""') || html.includes('style=""') || html.includes('<span')) {
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(html, 'text/html');

                            // Remove empty class attributes
                            doc.querySelectorAll('[class=""]').forEach((node) => {
                                (node as Element).removeAttribute('class');
                            });

                            // Remove empty style attributes
                            doc.querySelectorAll('[style=""]').forEach((node) => {
                                (node as Element).removeAttribute('style');
                            });

                            return doc.documentElement.outerHTML;
                        }
                        return html;
                    }
                },
                // Cleanup empty spans after they're inserted into the document
                appendTransaction(transactions, _oldState, newState) {
                    const tr = newState.tr;
                    let modified = false;

                    // Check if this transaction is from a paste or contains new content
                    if (transactions.some(transaction => transaction.docChanged)) {
                        // Find all text nodes in the document
                        newState.doc.descendants((node, pos) => {
                            // Look for text nodes with marks (inline formatting)
                            if (node.type.name === 'text' && node.marks.length > 0) {
                                // Check each mark to see if it should be removed
                                node.marks.forEach(mark => {
                                    // Only target span marks
                                    if (mark.type.name !== 'span') {
                                        return;
                                    }

                                    // Remove span marks that have no meaningful attributes
                                    const attrs = mark.attrs || {};
                                    const hasContent = Object.keys(attrs).some(key => {
                                        const value = attrs[key];

                                        // Null or undefined = no content
                                        if (value === null || value === undefined) return false;

                                        // Empty string = no content
                                        if (typeof value === 'string' && value.trim() === '') return false;

                                        // Empty object (like DOMStringMap with no keys) = no content
                                        if (typeof value === 'object' && Object.keys(value).length === 0) return false;

                                        // Otherwise, has content
                                        return true;
                                    });

                                    if (!hasContent) {
                                        tr.removeMark(pos, pos + node.nodeSize, mark.type);
                                        modified = true;
                                    }
                                });
                            }
                            return true;
                        });
                    }

                    return modified ? tr : null;
                }
            })
        ];
    }
});
