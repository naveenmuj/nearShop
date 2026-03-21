export default function Input({ label, error, icon: Icon, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />}
        <input className={`w-full rounded-lg border ${error ? 'border-red-500' : 'border-gray-300'} px-4 py-2 ${Icon ? 'pl-10' : ''} focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent`} {...props} />
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
