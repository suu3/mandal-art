import { useBoardProgress } from "../model/useBoardProgress";
export function BoardProgress({ boardId }: { boardId: string }) {
  const { data } = useBoardProgress(boardId);
  return (
    <section className="progress-summary" aria-label="보드 진행률">
      <div>
        <span>전체 진행률</span>
        <strong>
          {data?.percent ?? 0}
          <small>%</small>
        </strong>
      </div>
      <div className="progress-track">
        <i style={{ width: `${data?.percent ?? 0}%` }} />
      </div>
      <p>
        완료 {data?.done ?? 0} / 전체 {data?.total ?? 0}
      </p>
    </section>
  );
}
