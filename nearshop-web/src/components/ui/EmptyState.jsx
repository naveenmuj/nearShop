export default function EmptyState({ icon: Icon, title, message, action, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {Icon && <Icon className="h-16 w-16 text-gray-300 mb-4" />}
      <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
      {message && <p className="text-gray-500 mb-4">{message}</p>}
      {action && onAction && (
        <button onClick={onAction} className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors">{action}</button>
      )}
    </div>
  )
}
