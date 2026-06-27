const Skeleton = ({ className = '', variant = 'text', width, height, count = 1 }) => {
  const base = 'animate-pulse bg-gray-200 rounded';
  const variants = {
    text: 'h-4 w-full',
    title: 'h-6 w-3/4',
    avatar: 'h-12 w-12 rounded-full',
    card: 'h-32 w-full rounded-xl',
    tableRow: 'h-12 w-full',
    badge: 'h-6 w-20 rounded-full',
    button: 'h-10 w-32 rounded-lg',
  };

  const sizeStyle = width ? ` w-${width}` : '';
  const heightStyle = height ? ` h-${height}` : '';

  const items = Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      className={`${base} ${variants[variant] || variants.text}${sizeStyle}${heightStyle} ${className}`}
    />
  ));

  return <>{items}</>;
};

const QueueSkeleton = () => (
  <div className="space-y-4 p-4">
    <div className="flex justify-between items-center mb-6">
      <Skeleton variant="title" className="!bg-gray-200" />
      <Skeleton variant="button" className="!bg-gray-200" />
    </div>
    {[1, 2, 3].map((i) => (
      <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton variant="avatar" className="!bg-gray-200" />
          <div className="space-y-2 flex-1">
            <Skeleton variant="title" className="!bg-gray-200" />
            <Skeleton variant="text" className="!bg-gray-200 w-1/2" />
          </div>
          <Skeleton variant="badge" className="!bg-gray-200" />
        </div>
        <div className="flex gap-4">
          <Skeleton variant="text" className="!bg-gray-200 w-1/4" />
          <Skeleton variant="text" className="!bg-gray-200 w-1/4" />
          <Skeleton variant="text" className="!bg-gray-200 w-1/4" />
        </div>
        <div className="flex gap-2 pt-2">
          <Skeleton variant="button" className="!bg-gray-200 w-24" />
          <Skeleton variant="button" className="!bg-gray-200 w-24" />
        </div>
      </div>
    ))}
  </div>
);

export { Skeleton, QueueSkeleton };
export default Skeleton;
