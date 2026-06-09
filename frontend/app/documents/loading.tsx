import { PageSkeleton, SkeletonCardGrid } from "@/components/Skeleton";

export default function Loading() {
  return (
    <PageSkeleton>
      <SkeletonCardGrid
        count={6}
        gridClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      />
    </PageSkeleton>
  );
}
