import { ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'brand' | 'brand-accent';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    loading?: boolean;
    fullWidth?: boolean;
}

const variantClass: Record<Variant, string> = {
    primary:      'btn btn-primary',
    secondary:    'btn btn-secondary',
    ghost:        'btn btn-ghost',
    danger:       'btn btn-danger',
    brand:        'btn btn-brand',
    'brand-accent': 'btn btn-brand-accent',
};

const sizeClass: Record<Size, string> = {
    sm: 'btn-sm',
    md: '',
    lg: 'btn-lg',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = 'primary', size = 'md', loading = false, fullWidth = false, disabled, children, className = '', style, ...rest },
    ref,
) {
    return (
        <button
            ref={ref}
            className={`${variantClass[variant]} ${sizeClass[size]} ${className}`}
            disabled={disabled || loading}
            style={{ width: fullWidth ? '100%' : undefined, ...style }}
            {...rest}
        >
            {loading ? (
                <>
                    <span style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.6s linear infinite' }} />
                    {children}
                </>
            ) : children}
        </button>
    );
});

export default Button;
