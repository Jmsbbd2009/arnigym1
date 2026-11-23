import { useEffect, useState } from 'react';
import './phone-input.css';

// Country dial codes. Uzbekistan first (default), then neighbours and common diaspora countries.
export const COUNTRIES: { iso: string; flag: string; name: string; dial: string; sample: string }[] = [
  { iso: 'UZ', flag: '🇺🇿', name: 'O‘zbekiston', dial: '998', sample: '90 123 45 67' },
  { iso: 'KZ', flag: '🇰🇿', name: 'Qozog‘iston', dial: '7', sample: '701 234 56 78' },
  { iso: 'RU', flag: '🇷🇺', name: 'Rossiya', dial: '7', sample: '912 345 67 89' },
  { iso: 'KG', flag: '🇰🇬', name: 'Qirg‘iziston', dial: '996', sample: '555 123 456' },
  { iso: 'TJ', flag: '🇹🇯', name: 'Tojikiston', dial: '992', sample: '93 123 4567' },
  { iso: 'TM', flag: '🇹🇲', name: 'Turkmaniston', dial: '993', sample: '65 123456' },
  { iso: 'AF', flag: '🇦🇫', name: 'Afg‘oniston', dial: '93', sample: '70 123 4567' },
  { iso: 'AZ', flag: '🇦🇿', name: 'Ozarbayjon', dial: '994', sample: '50 123 45 67' },
  { iso: 'TR', flag: '🇹🇷', name: 'Turkiya', dial: '90', sample: '501 234 56 78' },
  { iso: 'AE', flag: '🇦🇪', name: 'BAA', dial: '971', sample: '50 123 4567' },
  { iso: 'SA', flag: '🇸🇦', name: 'Saudiya Arabistoni', dial: '966', sample: '50 123 4567' },
  { iso: 'KR', flag: '🇰🇷', name: 'Janubiy Koreya', dial: '82', sample: '10 1234 5678' },
  { iso: 'CN', flag: '🇨🇳', name: 'Xitoy', dial: '86', sample: '131 2345 6789' },
  { iso: 'JP', flag: '🇯🇵', name: 'Yaponiya', dial: '81', sample: '90 1234 5678' },
  { iso: 'IN', flag: '🇮🇳', name: 'Hindiston', dial: '91', sample: '81234 56789' },
  { iso: 'UA', flag: '🇺🇦', name: 'Ukraina', dial: '380', sample: '50 123 4567' },
  { iso: 'BY', flag: '🇧🇾', name: 'Belarus', dial: '375', sample: '29 123 45 67' },
  { iso: 'GE', flag: '🇬🇪', name: 'Gruziya', dial: '995', sample: '555 12 34 56' },
  { iso: 'DE', flag: '🇩🇪', name: 'Germaniya', dial: '49', sample: '1512 3456789' },
  { iso: 'GB', flag: '🇬🇧', name: 'Buyuk Britaniya', dial: '44', sample: '7400 123456' },
  { iso: 'PL', flag: '🇵🇱', name: 'Polsha', dial: '48', sample: '512 345 678' },
  { iso: 'CZ', flag: '🇨🇿', name: 'Chexiya', dial: '420', sample: '601 123 456' },
  { iso: 'FR', flag: '🇫🇷', name: 'Fransiya', dial: '33', sample: '6 12 34 56 78' },
  { iso: 'IT', flag: '🇮🇹', name: 'Italiya', dial: '39', sample: '312 345 6789' },
  { iso: 'ES', flag: '🇪🇸', name: 'Ispaniya', dial: '34', sample: '612 34 56 78' },
  { iso: 'US', flag: '🇺🇸', name: 'AQSh / Kanada', dial: '1', sample: '201 555 0123' },
];

/** Builds an E.164 number from a dial code and the local part the user typed. */
export function toE164(dial: string, local: string) {
  let digits = local.replace(/\D/g, '');
  if (digits.startsWith(dial) && digits.length > dial.length + 6) digits = digits.slice(dial.length); // pasted with code
  digits = digits.replace(/^0+/, ''); // trunk prefix (e.g. 8 / 0) is not part of E.164
  return `+${dial}${digits}`;
}
export const isE164 = (value: string) => /^\+[1-9]\d{7,14}$/.test(value);

/** Country-code select + local number. Calls onChange with the full E.164 value. */
export function PhoneInput({ value, onChange, required = false, id }: { value: string; onChange: (e164: string) => void; required?: boolean; id?: string }) {
  const [iso, setIso] = useState('UZ');
  const [local, setLocal] = useState('');
  const country = COUNTRIES.find(c => c.iso === iso) || COUNTRIES[0];

  // If the parent clears the value, clear the local field too.
  useEffect(() => { if (!value) setLocal(''); }, [value]);

  const update = (nextIso: string, nextLocal: string) => {
    let typed = nextLocal;
    let code = COUNTRIES.find(c => c.iso === nextIso) || COUNTRIES[0];
    // A full international number was typed/pasted: switch the country automatically.
    if (typed.trim().startsWith('+')) {
      const digits = typed.replace(/\D/g, '');
      const match = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length).find(c => digits.startsWith(c.dial));
      if (match) { code = match.dial === code.dial ? code : match; typed = digits.slice(match.dial.length); setIso(code.iso); }
    }
    setLocal(typed);
    onChange(typed.replace(/\D/g, '') ? toE164(code.dial, typed) : '');
  };

  return <div className="phone-input">
    <select aria-label="Mamlakat kodi" value={iso} onChange={e => update(e.target.value, local)}>
      {COUNTRIES.map(c => <option key={c.iso} value={c.iso}>{c.flag} +{c.dial} {c.name}</option>)}
    </select>
    <span className="phone-input-dial" aria-hidden="true">{country.flag} +{country.dial}</span>
    <input id={id} type="tel" inputMode="tel" autoComplete="tel-national" required={required} placeholder={country.sample}
      value={local} onChange={e => update(iso, e.target.value)} maxLength={20}/>
  </div>;
}
