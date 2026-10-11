'use client';

import { Bell, CircleHelp, KeyRound, LogOut, Menu, Search, UserRound } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { IconButton } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown';
import { Avatar, Kbd } from '@/components/ui/misc';
import { Tooltip } from '@/components/ui/popover';
import { useModKey } from '@/lib/hooks';

/** Search pill (~320px, rounded-full, canvas bg, ⌘K keycap) that opens the command palette. */
export function SearchPill({ onOpen, placeholder = 'Search anything…' }: { onOpen: () => void; placeholder?: string }) {
  const mod = useModKey();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group border-line bg-canvas text-ink-400 hover:border-ink-300 hover:bg-surface hidden h-10 w-full max-w-[320px] items-center gap-2.5 rounded-full border pr-2 pl-4 text-sm transition-colors md:flex"
    >
      <Search className="size-[18px]" />
      <span className="flex-1 text-left">{placeholder}</span>
      <Kbd>{mod === '⌘' ? '⌘K' : 'Ctrl K'}</Kbd>
    </button>
  );
}

/**
 * Notifications are out of scope (decided): the bell is shown for the familiar layout but does nothing.
 * It has no badge, no dropdown and makes no API calls.
 */
export function BellButton() {
  return (
    <Tooltip content="Notifications — coming soon">
      <IconButton aria-label="Notifications (coming soon)" aria-disabled="true" className="cursor-default">
        <Bell />
      </IconButton>
    </Tooltip>
  );
}

export function UserMenu({
  name,
  subtitle,
  email,
  profileHref,
  onLogout,
  onLogoutAll,
  extra,
}: {
  name: string;
  subtitle?: string;
  email?: string;
  profileHref: string;
  onLogout: () => void;
  onLogoutAll?: () => void;
  extra?: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="hover:bg-canvas flex items-center gap-3 rounded-full p-0.5 pr-0.5 transition-colors lg:pr-3"
          aria-label="Account menu"
        >
          <Avatar name={name} size={40} />
          <span className="hidden text-left lg:block">
            <span className="text-ink-900 block max-w-[160px] truncate text-sm font-semibold">{name}</span>
            {subtitle && <span className="text-ink-500 block max-w-[160px] truncate text-xs">{subtitle}</span>}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="tracking-normal normal-case">
          <span className="text-ink-900 block truncate text-sm font-semibold">{name}</span>
          {email && <span className="text-ink-500 block truncate text-xs font-normal">{email}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={profileHref}>
            <UserRound />
            My profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`${profileHref}#security`}>
            <KeyRound />
            Password & 2FA
          </Link>
        </DropdownMenuItem>
        {extra}
        <DropdownMenuSeparator />
        {onLogoutAll && (
          <DropdownMenuItem onSelect={onLogoutAll}>
            <LogOut />
            Sign out of all devices
          </DropdownMenuItem>
        )}
        <DropdownMenuItem danger onSelect={onLogout}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** 72px white topbar: [☰ mobile] [search pill] ……… [help] [bell] [avatar]. */
export function Topbar({
  onMenu,
  onSearch,
  left,
  right,
  helpHref,
}: {
  onMenu: () => void;
  onSearch: () => void;
  left?: ReactNode;
  right: ReactNode;
  helpHref?: string;
}) {
  return (
    <header className="no-print border-line bg-surface/85 sticky top-0 z-30 flex h-[72px] shrink-0 items-center gap-3 border-b px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <IconButton className="lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu />
      </IconButton>
      <SearchPill onOpen={onSearch} />
      <IconButton className="md:hidden" onClick={onSearch} aria-label="Search">
        <Search />
      </IconButton>
      {left}
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {helpHref && (
          <Tooltip content="Help & support">
            <IconButton aria-label="Help & support" onClick={() => window.open(helpHref, '_blank', 'noopener')}>
              <CircleHelp />
            </IconButton>
          </Tooltip>
        )}
        <BellButton />
        {right}
      </div>
    </header>
  );
}
