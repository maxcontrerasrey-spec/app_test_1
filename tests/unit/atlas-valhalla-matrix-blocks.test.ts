import { describe, expect, it } from "vitest";
import { buildMatrixBlocks } from "../../supabase/functions/atlas-tomtom-planning/matrixBlocks";

describe("Atlas Valhalla matrix request blocks", () => {
  it("keeps all 13 stops within Valhalla's 100-pair limit and covers every matrix cell", () => {
    const size = 13;
    const blockSize = 10;
    const blocks = buildMatrixBlocks(size, blockSize);

    expect(blocks).toHaveLength(4);
    expect(blocks.every(({ row, col }) =>
      Math.min(blockSize, size - row) * Math.min(blockSize, size - col) <= 100
    )).toBe(true);

    const coveredCells = blocks.flatMap(({ row, col }) =>
      Array.from({ length: Math.min(blockSize, size - row) }, (_, rowOffset) =>
        Array.from({ length: Math.min(blockSize, size - col) }, (_, colOffset) => `${row + rowOffset}:${col + colOffset}`)
      ).flat()
    );
    expect(coveredCells).toHaveLength(size * size);
    expect(new Set(coveredCells).size).toBe(size * size);
  });

  it("does not allow a configured block size above the provider's pair cap", () => {
    expect(() => buildMatrixBlocks(13, 11)).toThrow("invalid_matrix_dimensions");
  });
});
