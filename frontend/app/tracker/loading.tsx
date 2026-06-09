import { PageSkeleton, SkeletonTable } from "@/components/Skeleton";

export default function Loading() {
  return (
    <PageSkeleton>
      <SkeletonTable rows={6} />
    </PageSkeleton>
  );
}
