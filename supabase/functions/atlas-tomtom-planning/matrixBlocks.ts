export type MatrixBlock = { row: number; col: number };

/** Tile a square matrix into Valhalla-compatible requests (max 100 cells each). */
export function buildMatrixBlocks(size: number, blockSize = 10): MatrixBlock[] {
  if (!Number.isInteger(size) || size < 1 || !Number.isInteger(blockSize) || blockSize < 1 || blockSize * blockSize > 100) {
    throw new Error("invalid_matrix_dimensions");
  }
  const blocks: MatrixBlock[] = [];
  for (let row = 0; row < size; row += blockSize) {
    for (let col = 0; col < size; col += blockSize) blocks.push({ row, col });
  }
  return blocks;
}
