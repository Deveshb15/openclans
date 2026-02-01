// ============================================================
// MoltClans - Binary Heap (min-heap priority queue)
// ============================================================

export class BinaryHeap<T> {
  private data: T[] = [];
  private scoreFunc: (item: T) => number;

  constructor(scoreFunc: (item: T) => number) {
    this.scoreFunc = scoreFunc;
  }

  get size(): number {
    return this.data.length;
  }

  push(item: T): void {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(idx: number): void {
    const item = this.data[idx];
    const score = this.scoreFunc(item);

    while (idx > 0) {
      const parentIdx = ((idx + 1) >> 1) - 1;
      const parent = this.data[parentIdx];
      if (score >= this.scoreFunc(parent)) break;
      this.data[parentIdx] = item;
      this.data[idx] = parent;
      idx = parentIdx;
    }
  }

  private sinkDown(idx: number): void {
    const length = this.data.length;
    const item = this.data[idx];
    const score = this.scoreFunc(item);

    while (true) {
      const leftIdx = 2 * idx + 1;
      const rightIdx = 2 * idx + 2;
      let swapIdx = -1;
      let swapScore = score;

      if (leftIdx < length) {
        const leftScore = this.scoreFunc(this.data[leftIdx]);
        if (leftScore < swapScore) {
          swapIdx = leftIdx;
          swapScore = leftScore;
        }
      }

      if (rightIdx < length) {
        const rightScore = this.scoreFunc(this.data[rightIdx]);
        if (rightScore < swapScore) {
          swapIdx = rightIdx;
        }
      }

      if (swapIdx === -1) break;

      this.data[idx] = this.data[swapIdx];
      this.data[swapIdx] = item;
      idx = swapIdx;
    }
  }
}
