type TrackingPaginationProps = {
  page: number;
  pageSize: number;
  totalCount: number;
  label: string;
  onPageChange: (page: number) => void;
};

export function TrackingPagination({
  page,
  pageSize,
  totalCount,
  label,
  onPageChange
}: TrackingPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  if (totalCount <= pageSize) {
    return totalCount > 0 ? (
      <p className="tracking-filter-caption tracking-pagination-label">
        {label}: {totalCount}
      </p>
    ) : null;
  }

  return (
    <div className="tracking-pagination">
      <button
        type="button"
        className="soft-primary-button tracking-pagination-button"
        disabled={page === 0}
        onClick={() => onPageChange(Math.max(0, page - 1))}
      >
        Anterior
      </button>
      <span className="tracking-filter-caption tracking-pagination-label">
        {label}: página {page + 1} de {totalPages} · {totalCount} registro(s)
      </span>
      <button
        type="button"
        className="soft-primary-button tracking-pagination-button"
        disabled={page + 1 >= totalPages}
        onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
      >
        Siguiente
      </button>
    </div>
  );
}
