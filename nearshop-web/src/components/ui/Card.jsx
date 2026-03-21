export default function Card({ children, className = '', onClick, ...props }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${className}`} onClick={onClick} {...props}>
      {children}
    </div>
  )
}
Card.Header = ({ children, className = '' }) => <div className={`px-4 py-3 border-b border-gray-100 ${className}`}>{children}</div>
Card.Body = ({ children, className = '' }) => <div className={`px-4 py-3 ${className}`}>{children}</div>
Card.Footer = ({ children, className = '' }) => <div className={`px-4 py-3 border-t border-gray-100 ${className}`}>{children}</div>
