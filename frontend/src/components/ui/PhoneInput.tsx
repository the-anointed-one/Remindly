'use client';

import PhoneInputLib from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

// ─────────────────────────────────────────────────────────────────────────────
// Shared phone field: a country selector (flag + dial code) FIRST, then the
// number, formatting/validating per the chosen country and emitting an E.164
// string (e.g. "+15551234567") via onChange.
//
// There is intentionally NO defaultCountry — the user must pick a country when
// entering a number rather than silently assuming one. onChange emits '' when
// the field is cleared, matching the plain-string contract the call sites use.
// ─────────────────────────────────────────────────────────────────────────────

interface PhoneInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    id?: string;
    required?: boolean;
}

export default function PhoneInput({
    value,
    onChange,
    placeholder = 'Phone number',
    disabled = false,
    id,
    required = false,
}: PhoneInputProps) {
    return (
        <PhoneInputLib
            id={id}
            international
            value={value || undefined}
            onChange={(v) => onChange(v || '')}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            className="meetora-phone"
        />
    );
}

// Re-export the validator so call sites can gate submission on a valid number
// using the same library the component (and the backend) rely on.
export { isValidPhoneNumber } from 'react-phone-number-input';
