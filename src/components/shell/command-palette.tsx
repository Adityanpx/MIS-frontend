'use client';

import * as D from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { CornerDownLeft, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { Kbd } from '@/components/ui/misc';
import type { CommandItem } from './types';

/** ⌘K quick jump: pages, plants, reports and actions. Items come from the shell (client or admin). */
export function CommandPalette({
  open,
  onOpenChange,
  items,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: CommandItem[];
}) {
  const router = useRouter();
  const groups = [...new Set(items.map((i) => i.group))];
  const run = (it: CommandItem) => {
    onOpenChange(false);
    if (it.action) it.action();
    else if (it.href) router.push(it.href);
  };
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div
                className="bg-ink-900/25 fixed inset-0 z-50 backdrop-blur-[6px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </D.Overlay>
            <D.Content asChild forceMount>
              <motion.div
                className="border-line bg-surface shadow-float fixed top-[12vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-3xl border focus:outline-none"
                initial={{ opacity: 0, scale: 0.97, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -6 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                <D.Title className="sr-only">Search</D.Title>
                <D.Description className="sr-only">Jump to a page, plant or action</D.Description>
                <Command loop className="flex max-h-[60vh] flex-col">
                  <div className="border-line flex items-center gap-3 border-b px-5">
                    <Search className="text-ink-400 size-[18px]" />
                    <Command.Input
                      autoFocus
                      placeholder="Search pages, plants, reports…"
                      className="text-ink-900 placeholder:text-ink-400 h-14 flex-1 bg-transparent text-[15px] outline-none"
                    />
                    <Kbd>Esc</Kbd>
                  </div>
                  <Command.List className="scrollbar-thin overflow-y-auto p-2">
                    <Command.Empty className="text-ink-500 py-10 text-center text-sm">No results.</Command.Empty>
                    {groups.map((g) => (
                      <Command.Group
                        key={g}
                        heading={g}
                        className="[&_[cmdk-group-heading]]:text-ink-400 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:uppercase"
                      >
                        {items
                          .filter((i) => i.group === g)
                          .map((it) => {
                            const Icon = it.icon;
                            return (
                              <Command.Item
                                key={it.id}
                                value={`${it.label} ${it.hint ?? ''} ${it.keywords?.join(' ') ?? ''} ${it.id}`}
                                onSelect={() => run(it)}
                                className="group text-ink-700 data-[selected=true]:bg-brand-50 data-[selected=true]:text-brand-600 flex h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm"
                              >
                                {Icon && (
                                  <Icon
                                    className="text-ink-400 group-data-[selected=true]:text-brand-500 size-[18px]"
                                    strokeWidth={1.75}
                                  />
                                )}
                                <span className="flex-1 truncate font-medium">{it.label}</span>
                                {it.hint && <span className="text-ink-400 truncate text-xs">{it.hint}</span>}
                                <CornerDownLeft className="size-3.5 opacity-0 group-data-[selected=true]:opacity-100" />
                              </Command.Item>
                            );
                          })}
                      </Command.Group>
                    ))}
                  </Command.List>
                </Command>
              </motion.div>
            </D.Content>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}
