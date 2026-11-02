/** Prefix tree for instant search-as-you-type over destination and place names. */
interface TrieNode { children: Map<string, TrieNode>; ids: Set<string> }

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ');

export class Trie {
  private root: TrieNode = { children: new Map(), ids: new Set() };

  /** Index every word of `text` (and the full phrase) so "valley" finds "Spiti Valley". */
  insert(text: string, id: string): void {
    const words = norm(text).split(/\s+/).filter(Boolean);
    const phrases = new Set([words.join(' '), ...words]);
    for (const phrase of phrases) {
      let node = this.root;
      for (const ch of phrase) {
        let next = node.children.get(ch);
        if (!next) { next = { children: new Map(), ids: new Set() }; node.children.set(ch, next); }
        node = next;
        node.ids.add(id); // every prefix node remembers which ids pass through it
      }
    }
  }

  /** All ids whose indexed words start with `prefix`. */
  search(prefix: string): string[] {
    const q = norm(prefix).trim();
    if (!q) return [];
    let node = this.root;
    for (const ch of q) {
      const next = node.children.get(ch);
      if (!next) return [];
      node = next;
    }
    return [...node.ids];
  }
}
