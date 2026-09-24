import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import OfficePaste from '@intevation/tiptap-extension-office-paste';

// ProseMirror only ever invokes ONE plugin's `transformPastedHTML` - it resolves the prop via
// `someProp`, which returns as soon as any plugin's handler produces a truthy result (see
// prosemirror-view's EditorView.someProp), and office-paste's handler always returns a string
// (even when it's a no-op passthrough for non-Word HTML), so it "wins" and our own handler would
// never run if registered as a second, separate plugin. Confirmed live: real Word paste left
// non-mso `style`/`class` values on headings completely untouched. The fix is to not rely on two
// competing plugins at all - pull office-paste's own transform function out and call it ourselves,
// first, inside this extension's single `transformPastedHTML`, so both cleanups are guaranteed to
// run every time regardless of plugin registration order.
const getOfficePastePlugins = OfficePaste.config.addProseMirrorPlugins as unknown as () => Plugin[];
const officePasteTransformPastedHTML = getOfficePastePlugins()[0].props
    .transformPastedHTML as (html: string, view: EditorView) => string;

/**
 * Extension to clean up attributes and elements left by office-paste.
 * Runs office-paste's own list/bookmark cleanup first (the one part of it worth keeping - its own
 * style/class cleanup is superseded below, see comments), then:
 * - Strips every style attribute, every class attribute, and any <style> block during paste
 * - Unwraps <span> elements left with no attributes at all, both at the raw-HTML stage below and
 *   (belt-and-braces) as ProseMirror marks in appendTransaction
 */
export const PasteAttributeCleanup = Extension.create({
    name: 'paste-attribute-cleanup',
    priority: 99999,

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey('paste-attribute-cleanup'),
                props: {
                    transformPastedHTML(html: string, view: EditorView): string {
                        html = officePasteTransformPastedHTML(html, view);

                        // Only process further if it looks like it might need cleanup
                        if (html.includes('style=') || html.includes('class=') || html.includes('<span') || html.includes('<style')) {
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(html, 'text/html');

                            // Remove <style> blocks entirely. ProseMirror's own readHTML()
                            // (prosemirror-view) runs AFTER transformPastedHTML and walks any
                            // stylesheets still present in the pasted HTML, re-applying their CSS
                            // rules as inline styles onto matching elements by class selector
                            // ("Inline styles defined in the pasted content, so that parse rules
                            // pick them up"). Word always embeds a <style> block defining
                            // .MsoNormal/.MsoSubtitle/.MsoToc1/etc. - left in place, it silently
                            // reconstructs the exact inline styles we just stripped below, straight
                            // from those class rules. Confirmed live: a real Word document survived
                            // paste cleanup completely intact until this line was added, while a
                            // plain fragment with no <style> block (nothing to reconstruct from)
                            // was unaffected either way - that's why it wasn't caught earlier.
                            doc.querySelectorAll('style').forEach((node) => node.remove());

                            // Remove every class attribute, not just empty ones. office-paste's own
                            // transformMsoHtmlClasses only strips the literal "MsoNormal" class -
                            // Word also produces MsoTitle/MsoSubtitle/MsoTocHeading/MsoToc1-9/
                            // MsoCommentText/MsoHeader/MsoCaption/etc. depending on version and
                            // locale, an effectively unbounded list not worth enumerating. With the
                            // <style> block already gone these classes have no visual effect left,
                            // but "fully clean html" means removing them outright rather than
                            // leaving dead Word class names sitting in the markup.
                            doc.querySelectorAll('[class]').forEach((node) => {
                                (node as Element).removeAttribute('class');
                            });

                            // Remove every style attribute, not just empty ones - pasted inline
                            // styles (Word/Office or otherwise) should never leak the source
                            // application's formatting into Umbraco content.
                            doc.querySelectorAll('[style]').forEach((node) => {
                                (node as Element).removeAttribute('style');
                            });

                            // Unwrap any <span> left with no attributes at all. Now that style/
                            // class are always stripped above, a bare <span> serves no purpose.
                            // Doing this here - on the raw pasted HTML, before ProseMirror parses
                            // it into the document schema - is more reliable than the mark-based
                            // cleanup in appendTransaction below, which only fires if this RTE's
                            // schema happens to register a generic "span" mark type at all.
                            doc.querySelectorAll('span').forEach((node) => {
                                if (node.attributes.length === 0) {
                                    while (node.firstChild) {
                                        node.parentNode?.insertBefore(node.firstChild, node);
                                    }
                                    node.remove();
                                }
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
