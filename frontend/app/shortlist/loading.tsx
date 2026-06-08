import { PageSkeleton, SkeletonCardGrid } from "@/components/Skeleton";

export default function Loading() {
  return (
    <PageSkeleton>
      <SkeletonCardGrid
        count={8}
        gridClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
      />
    </PageSkeleton>
  );
}
