import { HTMLAttributes } from 'react';

type ContainerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
    size?: ContainerSize;
    centered?: boolean;
}

const maxWidths: Record<ContainerSize, string> = {
    sm:   '640px',
    md:   '800px',
    lg:   '1024px',
    xl:   '1200px',
    full: '100%',
};

export default function Container({
    size = 'xl',
    centered = true,
    children,
    style,
    className = '',
    ...rest
}: ContainerProps) {
    return (
        <div
            className={className}
            style={{
                width: '100%',
                maxWidth: maxWidths[size],
                margin: centered ? '0 auto' : undefined,
                padding: '0 24px',
                ...style,
            }}
            {...rest}
        >
            {children}
        </div>
    );
}
