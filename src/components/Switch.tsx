interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  size?: 'sm' | 'md';
}

export function Switch({ checked, onChange, disabled = false, label, size = 'md' }: SwitchProps) {
  const sizeClasses = size === 'sm'
    ? { track: 'w-8 h-4', thumb: 'h-3 w-3', translate: 'translate-x-4' }
    : { track: 'w-11 h-6', thumb: 'h-5 w-5', translate: 'translate-x-5' };

  return (
    <label className={`inline-flex items-center ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`
          relative inline-flex shrink-0 ${sizeClasses.track}
          rounded-full border-2 border-transparent
          transition-colors duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          ${checked ? 'bg-blue-600' : 'bg-gray-200'}
          ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block ${sizeClasses.thumb}
            transform rounded-full bg-white shadow ring-0
            transition duration-200 ease-in-out
            ${checked ? sizeClasses.translate : 'translate-x-0'}
          `}
        />
      </button>
      {label && (
        <span className={`ml-2 ${size === 'sm' ? 'text-sm' : 'text-base'} text-gray-700`}>
          {label}
        </span>
      )}
    </label>
  );
}
