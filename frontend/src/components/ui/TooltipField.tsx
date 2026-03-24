'use client';

import React, { ReactNode, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipFieldProps {
    label: string;
    tooltip: string;
    children: ReactNode;
    className?: string;
    style?: React.CSSProperties;
}

export default function TooltipField({ label, tooltip, children, className = '', style }: TooltipFieldProps) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div className={`flex flex-col gap-1.5 ${className}`} style={style}>
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-text-secondary">{label}</label>
                <div 
                    className="relative flex items-center justify-center cursor-help text-text-muted hover:text-primary transition-colors"
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    <FontAwesomeIcon icon={faCircleQuestion} className="w-4 h-4" />
                    <AnimatePresence>
                        {isHovered && (
                            <motion.div 
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 4 }}
                                transition={{ duration: 0.15 }}
                                className="absolute bottom-full right-0 mb-2 w-48 p-2 text-xs text-white bg-gray-800 rounded-lg shadow-lg z-50 pointer-events-none"
                            >
                                {tooltip}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
            {children}
        </div>
    );
}
