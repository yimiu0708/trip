import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface RegionSelectOption<T extends string> {
  value: T;
  label: string;
}

interface RegionSelectProps<T extends string> {
  value: T;
  options: RegionSelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
}

export default function RegionSelect<T extends string>({ value, options, onChange, ariaLabel }: RegionSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = `region-select-${useId().replace(/:/g, '')}`;
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selectedOption = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    optionRefs.current[activeIndex]?.focus();
  }, [activeIndex, open]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const openMenu = (index: number) => {
    setActiveIndex(index);
    setOpen(true);
  };

  const closeMenu = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const moveActive = (event: KeyboardEvent, index: number) => {
    event.preventDefault();
    setActiveIndex(Math.max(0, Math.min(options.length - 1, index)));
  };

  return (
    <div className={`region-select-box${open ? ' open' : ''}`} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="region-select-trigger"
        aria-label={`${ariaLabel}：${selectedOption.label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => open ? setOpen(false) : openMenu(selectedIndex)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            openMenu(selectedIndex);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            openMenu(options.length - 1);
          } else if (event.key === 'Escape') setOpen(false);
        }}
      >
        <span>{selectedOption.label}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>

      {open && (
        <div id={listboxId} className="region-select-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option, index) => (
            <button
              ref={(element) => { optionRefs.current[index] = element; }}
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`region-select-option${option.value === value ? ' selected' : ''}`}
              onClick={() => {
                onChange(option.value);
                closeMenu();
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') moveActive(event, activeIndex + 1);
                else if (event.key === 'ArrowUp') moveActive(event, activeIndex - 1);
                else if (event.key === 'Home') moveActive(event, 0);
                else if (event.key === 'End') moveActive(event, options.length - 1);
                else if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onChange(option.value);
                  closeMenu();
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  closeMenu();
                } else if (event.key === 'Tab') {
                  setOpen(false);
                }
              }}
            >
              <span>{option.label}</span>
              {option.value === value && <Check size={15} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
