import { useEffect, useState } from 'react';
import { marked, type Tokens } from 'marked';

// Same markdown engine gpt/frontend uses (marked@11.1.1 from CDN there) —
// kept consistent so service docs render identically in both surfaces.
marked.setOptions({ gfm: true, breaks: false });

// Marked doesn't emit id="..." on headings by default, so ToC anchor links
// like [Project Structure](#project-structure) have nothing to scroll to.
// Add GitHub-style slug ids on every heading.
function slugify(text: string): string {
    // Mirrors GitHub's slug rule: lowercase, drop punctuation (keeping word
    // chars, CJK, spaces, dashes), then spaces → dashes. Consecutive dashes
    // are NOT collapsed — "Tools & MCP" becomes "tools--mcp" because the
    // dropped "&" leaves a double space that turns into two dashes. ToC
    // links in our READMEs are written against this convention.
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w一-鿿\s-]/g, '')
        .replace(/\s/g, '-');
}

marked.use({
    renderer: {
        // `this` is bound to the Renderer instance at render time; using
        // `function` (not arrow) keeps that binding. Token shape comes from
        // marked's Tokens.Heading.
        heading(token: Tokens.Heading) {
            const inline = this.parser.parseInline(token.tokens);
            const id = slugify(token.text);
            return `<h${token.depth} id="${id}">${inline}</h${token.depth}>\n`;
        },
    },
});

interface Props {
    /** URL to fetch the markdown file from. Use a path that's reachable via the
     *  Vite dev proxies (e.g. /gpt/backend/README.md). */
    url: string;
    /** Title shown above the rendered content. Optional. */
    title?: string;
}

export function ReadmeViewer({ url, title }: Props) {
    const [html, setHtml] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        setHtml('');
        // cache: 'no-cache' forces a conditional request (sends If-None-Match etc.)
        // so README edits show up without a hard refresh. Apache returns 304
        // when unchanged, full body when modified — cheap either way.
        fetch(url, {
            cache: 'no-cache',
            headers: { Accept: 'text/markdown, text/plain, */*' },
        })
            .then(async (res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
                const ct = res.headers.get('content-type') || '';
                // Catch the "Apache returned the SPA's index.html instead of the .md"
                // failure mode early — otherwise we'd render the SPA shell as markdown.
                if (ct.includes('text/html')) {
                    throw new Error(
                        'Got HTML instead of markdown. Check Apache .htaccess routing or Vite proxy for ' +
                            url
                    );
                }
                return res.text();
            })
            .then((text) => {
                if (cancelled) return;
                const rendered = marked.parse(text) as string;
                setHtml(rendered);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : 'Failed to load README.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [url]);

    return (
        <div>
            {title && <h2 className="text-lg font-semibold text-gray-800 mb-3">{title}</h2>}
            {loading && <div className="text-gray-500 text-sm">Loading documentation…</div>}
            {error && (
                <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
                    {error}
                </div>
            )}
            {!loading && !error && (
                <article
                    className="markdown-content"
                    // README content is authored in-repo; safe to render. If we ever
                    // load user-supplied markdown here, swap to DOMPurify.sanitize.
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            )}
        </div>
    );
}
