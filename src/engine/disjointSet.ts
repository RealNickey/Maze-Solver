/**
 * Disjoint Set (Union-Find) data structure with path compression and union by rank.
 * Supports O(alpha(n)) amortized find and union operations for Randomized Kruskal's maze generation.
 */
export class DisjointSet {
  public readonly parent: number[];
  public readonly rank: number[];
  public readonly size: number[];
  private _componentCount: number;

  constructor(count: number) {
    if (count < 0 || !Number.isInteger(count)) {
      throw new RangeError(`DisjointSet count must be a non-negative integer, received ${count}`);
    }
    this.parent = Array.from({ length: count }, (_, i) => i);
    this.rank = new Array<number>(count).fill(0);
    this.size = new Array<number>(count).fill(1);
    this._componentCount = count;
  }

  public get count(): number {
    return this.parent.length;
  }

  public get componentCount(): number {
    return this._componentCount;
  }

  /**
   * Finds the representative root of element x with path compression.
   */
  public find(x: number): number {
    let root = x;
    while (this.parent[root] !== root) {
      root = this.parent[root];
    }
    // Path compression pass
    let curr = x;
    while (curr !== root) {
      const next = this.parent[curr];
      this.parent[curr] = root;
      curr = next;
    }
    return root;
  }

  /**
   * Returns true if elements a and b belong to the same equivalence class.
   */
  public connected(a: number, b: number): boolean {
    return this.find(a) === this.find(b);
  }

  /**
   * Merges the sets containing a and b using union by rank.
   * Returns { merged: boolean, rootA, rootB, newRoot }.
   */
  public union(a: number, b: number): {
    merged: boolean;
    rootA: number;
    rootB: number;
    newRoot: number;
  } {
    const rootA = this.find(a);
    const rootB = this.find(b);

    if (rootA === rootB) {
      return { merged: false, rootA, rootB, newRoot: rootA };
    }

    let newRoot: number;
    if (this.rank[rootA] < this.rank[rootB]) {
      this.parent[rootA] = rootB;
      this.size[rootB] += this.size[rootA];
      newRoot = rootB;
    } else if (this.rank[rootA] > this.rank[rootB]) {
      this.parent[rootB] = rootA;
      this.size[rootA] += this.size[rootB];
      newRoot = rootA;
    } else {
      this.parent[rootB] = rootA;
      this.rank[rootA] += 1;
      this.size[rootA] += this.size[rootB];
      newRoot = rootA;
    }

    this._componentCount -= 1;
    return { merged: true, rootA, rootB, newRoot };
  }

  /**
   * Returns a snapshot array mapping every element index to its current root representative.
   */
  public snapshotRoots(): number[] {
    const roots = new Array<number>(this.parent.length);
    for (let i = 0; i < this.parent.length; i++) {
      roots[i] = this.find(i);
    }
    return roots;
  }
}

/**
 * Curated harmonious botanical tint palette for Disjoint Set visualization.
 * Each root ID hashes deterministically to a pleasant garden pastel/jewel tint.
 */
const BOTANICAL_SET_HUES_LIGHT = [
  'rgba(52, 211, 153, 0.44)',  // bright mint
  'rgba(56, 189, 248, 0.48)',  // sky bluebell
  'rgba(250, 204, 21, 0.48)',  // sunlit buttercup
  'rgba(192, 132, 252, 0.46)', // lavender bloom
  'rgba(251, 113, 133, 0.44)', // wild rose
  'rgba(45, 212, 191, 0.46)',  // dew lagoon
  'rgba(251, 146, 60, 0.46)',  // marigold peach
  'rgba(129, 140, 248, 0.46)', // periwinkle
  'rgba(163, 230, 53, 0.48)',  // spring clover
  'rgba(244, 114, 182, 0.44)', // foxglove pink
  'rgba(96, 165, 250, 0.48)',  // cornflower
  'rgba(253, 224, 71, 0.46)',  // primrose
];

const BOTANICAL_SET_HUES_DARK = [
  'rgba(52, 211, 153, 0.42)',
  'rgba(56, 189, 248, 0.45)',
  'rgba(250, 204, 21, 0.42)',
  'rgba(192, 132, 252, 0.42)',
  'rgba(251, 113, 133, 0.42)',
  'rgba(45, 212, 191, 0.44)',
  'rgba(251, 146, 60, 0.42)',
  'rgba(129, 140, 248, 0.44)',
  'rgba(163, 230, 53, 0.42)',
  'rgba(244, 114, 182, 0.40)',
  'rgba(96, 165, 250, 0.44)',
  'rgba(253, 224, 71, 0.40)',
];

export function getSetTintColor(rootId: number, isDark: boolean): string {
  // Knuth multiplicative hash for visually distinct adjacent roots
  const hashed = Math.abs((rootId * 2654435761) >>> 0);
  const palette = isDark ? BOTANICAL_SET_HUES_DARK : BOTANICAL_SET_HUES_LIGHT;
  return palette[hashed % palette.length];
}
