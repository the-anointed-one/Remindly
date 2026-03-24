import { useState, useRef, useEffect, useMemo } from 'react';
import Icon from './Icon';
import { faSearch, faChevronDown, faTimes, faCheck } from '@fortawesome/free-solid-svg-icons';

interface Option {
    id: string;
    name: string;
    subtext?: string;
    icon?: any;
}

interface Props {
    options: Option[];
    value?: string;
    onChange: (id: string) => void;
    placeholder?: string;
    loading?: boolean;
    className?: string;
}

export default function SearchableSelect({ 
    options, 
    value, 
    onChange, 
    placeholder = 'Select option...', 
    loading = false,
    className = '' 
}: Props) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedOption = useMemo(() => options.find(o => o.id === value), [options, value]);

    const filteredOptions = useMemo(() => {
        if (!search.trim()) return options;
        const s = search.toLowerCase();
        return options.filter(o => 
            o.name.toLowerCase().includes(s) || 
            o.subtext?.toLowerCase().includes(s)
        );
    }, [options, search]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (open && inputRef.current) {
            inputRef.current.focus();
        }
    }, [open]);

    const handleSelect = (id: string) => {
        onChange(id);
        setOpen(false);
        setSearch('');
    };

    const clearSelection = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        setSearch('');
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {/* Display Trigger */}
            <div 
                className={`input flex items-center justify-between cursor-pointer transition-all duration-200 ${open ? 'ring-2 ring-orange-500/50 border-orange-500' : ''}`}
                onClick={() => setOpen(!open)}
                style={{ minHeight: 42, padding: '0 12px' }}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    {selectedOption ? (
                        <>
                            {selectedOption.icon && <Icon icon={selectedOption.icon} className="text-muted text-sm" />}
                            <span className="truncate text-sm font-medium">{selectedOption.name}</span>
                        </>
                    ) : (
                        <span className="text-muted text-sm">{placeholder}</span>
                    )}
                </div>
                
                <div className="flex items-center gap-2 ml-2">
                    {value && (
                        <button 
                            type="button" 
                            onClick={clearSelection}
                            className="p-1 hover:bg-white/10 rounded-full text-muted transition-colors"
                        >
                            <Icon icon={faTimes} className="text-[10px]" />
                        </button>
                    )}
                    <Icon 
                        icon={faChevronDown} 
                        className={`text-xs text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} 
                    />
                </div>
            </div>

            {/* Dropdown Menu */}
            {open && (
                <div 
                    className="absolute z-50 w-full mt-2 glass-card overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 shadow-orange-950/20"
                    style={{ background: '#1e1e28', border: '1px solid #2a2a35' }}
                >
                    {/* Search Input */}
                    <div className="p-2 border-bottom border-[#2a2a35]">
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                                <Icon icon={faSearch} className="text-xs" />
                            </div>
                            <input
                                ref={inputRef}
                                type="text"
                                className="w-full bg-[#13131a] border border-[#2a2a35] rounded-md py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                                placeholder="Filter options..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Options List */}
                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                        {loading ? (
                            <div className="p-4 text-center text-muted text-sm">Loading options...</div>
                        ) : filteredOptions.length === 0 ? (
                            <div className="p-4 text-center text-muted text-sm">No matches found</div>
                        ) : (
                            filteredOptions.map((opt) => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    className={`w-full flex items-center justify-between px-3 py-2.5 text-left text-sm transition-colors hover:bg-orange-500/10 group ${value === opt.id ? 'bg-orange-500/5' : ''}`}
                                    onClick={() => handleSelect(opt.id)}
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${value === opt.id ? 'bg-orange-500 text-white' : 'bg-white/5 text-muted group-hover:bg-white/10'}`}>
                                            {opt.icon ? <Icon icon={opt.icon} className="text-xs" /> : opt.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex flex-col min-width-0">
                                            <span className={`font-medium truncate ${value === opt.id ? 'text-orange-500' : 'text-primary'}`}>
                                                {opt.name}
                                            </span>
                                            {opt.subtext && <span className="text-[11px] text-muted truncate">{opt.subtext}</span>}
                                        </div>
                                    </div>
                                    {value === opt.id && (
                                        <Icon icon={faCheck} className="text-orange-500 text-xs ml-2" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
