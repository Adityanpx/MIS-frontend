'use client';

import * as S from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useFieldId } from './field';

export interface SelectOption {
  value: string;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
}

/** Pill select (same look as Input). For long searchable lists use the Combobox from a later file. */
export function Select({
  value,
  onValueChange,
  options,
  placeholder = 'Select…',
  disabled,
  invalid,
  className,
  size = 'md',
  id,
  'aria-label': ariaLabel,
}: {
  value: string | undefined;
  onValueChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  size?: 'sm' | 'md';
  id?: string;
  'aria-label'?: string;
}) {
  const fid = useFieldId(id);
  return (
    <S.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <S.Trigger
        id={fid}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        className={cn(
          'border-line bg-canvas text-ink-900 hover:border-ink-300 focus:border-brand-500 focus:ring-brand-500/12 data-[placeholder]:text-ink-400 aria-[invalid=true]:border-danger-500 inline-flex w-full items-center justify-between gap-2 rounded-full border px-4 text-left text-sm transition-[border-color,box-shadow] focus:ring-4 focus:outline-none disabled:opacity-60',
          size === 'md' ? 'h-11' : 'h-9 px-3.5 text-[13px]',
          className,
        )}
      >
        <span className="truncate">
          <S.Value placeholder={placeholder} />
        </span>
        <S.Icon>
          <ChevronDown className="text-ink-500 size-4" />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content
          position="popper"
          sideOffset={6}
          className="ommis-pop border-line bg-surface shadow-float z-50 max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border p-1.5"
        >
          <S.Viewport>
            {options.map((o) => (
              <S.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className="text-ink-700 data-[highlighted]:bg-canvas data-[state=checked]:text-ink-900 relative flex min-h-9 cursor-pointer items-center rounded-xl py-1.5 pr-8 pl-3 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[state=checked]:font-medium"
              >
                <div className="min-w-0">
                  <S.ItemText>{o.label}</S.ItemText>
                  {o.hint && <div className="text-ink-500 text-xs">{o.hint}</div>}
                </div>
                <S.ItemIndicator className="absolute right-2.5">
                  <Check className="text-brand-500 size-4" />
                </S.ItemIndicator>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}
