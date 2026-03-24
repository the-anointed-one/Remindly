'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { IconProp } from '@fortawesome/fontawesome-svg-core'

interface IconProps {
    icon: IconProp
    className?: string
    style?: React.CSSProperties
}

export default function Icon({ icon, className, style }: IconProps) {
    return (
        <span className={className} style={style}>
            <FontAwesomeIcon icon={icon} />
        </span>
    );
}
