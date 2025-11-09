export default function JobCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 animate-pulse">
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3"></div>
      
      <div className="flex gap-2 mb-3">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
      </div>
      
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-3"></div>
      
      <div className="flex gap-2">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
      </div>
    </div>
  );
}


