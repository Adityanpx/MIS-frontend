'use client';

import { Download, Droplets, Factory, FlaskConical, Fuel, LayoutGrid, Plus, Trash2, Users, Zap } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { BarChart } from '@/components/charts/bar-chart';
import { Donut } from '@/components/charts/donut';
import { PillBars } from '@/components/charts/pill-bars';
import { SplitBars } from '@/components/charts/split-bars';
import { TickGauge } from '@/components/charts/tick-gauge';
import { TrendChart } from '@/components/charts/trend-chart';
import { StatCard } from '@/components/data/stat-card';
import { Money } from '@/components/data/values';
import { DateNav, MonthNav } from '@/components/date/date-nav';
import { DateRangePicker } from '@/components/date/date-range-picker';
import { Stagger, StaggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/shell/page-header';
import { Badge, DeltaPill, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardMenu, Panel } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Drawer } from '@/components/ui/drawer';
import { Field } from '@/components/ui/field';
import { Input, PasswordInput, SearchInput } from '@/components/ui/input';
import { Checkbox, EmptyState, ProgressBar, Switch } from '@/components/ui/misc';
import { OtpInput } from '@/components/ui/otp-input';
import { Select } from '@/components/ui/select';
import { DataTable, Pagination } from '@/components/ui/table';
import { Segmented, Tabs } from '@/components/ui/tabs';
import { addDays, presetRange, todayIST } from '@/lib/dates';
import { fmtCompact, fmtDay, fmtMoney0, fmtNum, fmtQty } from '@/lib/format';

/** Sample data in the shape of the real engine output (Bherampur-like values). */
const today = todayIST();
const days = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29));
const inflow = days.map((d, i) => ({
  day: d,
  current: Math.round(112 + 8 * Math.sin(i / 3) + (i % 5)),
  previous: Math.round(106 + 6 * Math.cos(i / 4) + (i % 3)),
}));
const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'].map((m, i) => ({
  label: m,
  value: 3400 + i * 180 + (i % 2) * 260,
}));
const week = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => ({
  label: d,
  value: [3120, 3480, 3010, 3655, 3390, 2980, 3205][i] ?? 0,
}));
const chemicals = [
  {
    code: 'CHM-01',
    name: 'Poly Aluminium Chloride',
    unit: 'kg',
    used: 1240,
    std: 1500,
    cost: '186000.00',
    status: 'active',
  },
  {
    code: 'CHM-02',
    name: 'Sodium Hypochlorite',
    unit: 'L',
    used: 2310,
    std: 2100,
    cost: '92662.00',
    status: 'read_only',
  },
  { code: 'CHM-03', name: 'Polyelectrolyte', unit: 'kg', used: 645, std: 700, cost: '74048.00', status: 'active' },
];

export function Gallery() {
  const [range, setRange] = useState(presetRange('30d'));
  const [date, setDate] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [seg, setSeg] = useState<'today' | 'mtd' | 'utd'>('mtd');
  const [tab, setTab] = useState<'general' | 'parameters' | 'stock'>('general');
  const [drawer, setDrawer] = useState(false);
  const [modal, setModal] = useState(false);
  const [otp, setOtp] = useState('');
  const [sel, setSel] = useState<string>('stp');
  const [sw, setSw] = useState(true);
  const [cb, setCb] = useState(false);

  return (
    <div className="bg-canvas min-h-dvh px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-[1440px]">
        <PageHeader
          title="Dashboard"
          subtitle="UI kit — every component with sample data (development only)"
          actions={
            <>
              <DateRangePicker value={range} onChange={setRange} max={today} />
              <Button variant="secondary" onClick={() => setDrawer(true)}>
                <LayoutGrid />
                Add widget
              </Button>
              <Button
                onClick={() =>
                  toast.success('Export started', { description: 'Your Excel file will download shortly.' })
                }
              >
                <Download />
                Export
              </Button>
            </>
          }
        />

        <Stagger className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <StaggerItem>
            <StatCard
              title="Inflow (MLD)"
              icon={<Droplets />}
              value={118.42}
              format={(n) => fmtNum(n, 2)}
              delta={{ value: 2.4 }}
              caption="vs. 115.64 yesterday"
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              title="EB power (kWh)"
              icon={<Zap />}
              value={34120}
              delta={{ value: -3.1, invert: true }}
              caption="vs. 35,212 last period"
              iconTone="warning"
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              title="Revenue MTD"
              icon={<Fuel />}
              value={3860000}
              format={(n) => fmtCompact(n, { money: true })}
              delta={{ value: 8.4, colour: 'blue' }}
              caption="vs. ₹35.6 L last month"
              spark={months.map((m) => m.value)}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              title="Outlet BOD (mg/L)"
              icon={<FlaskConical />}
              value={8.6}
              format={(n) => fmtNum(n, 1)}
              delta={{ value: 10.5, colour: 'red', arrow: 'up' }}
              caption="Standard ≤ 10 mg/L"
              iconTone="danger"
            />
          </StaggerItem>
        </Stagger>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.7fr_1fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Treated water vs last month"
                subtitle="MLD per day"
                action={<CardMenu items={[{ label: 'Open trend report', onSelect: () => toast('Opening report…') }]} />}
              />
              <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:items-center">
                <div>
                  <p className="text-ink-900 tabular text-[42px] leading-none font-bold tracking-tight">3,412.6</p>
                  <div className="mt-3 flex items-center gap-2">
                    <DeltaPill value={24.4} />
                    <span className="text-ink-500 text-xs">vs. last period</span>
                  </div>
                </div>
                <TrendChart
                  data={inflow}
                  xKey="day"
                  xFormat={fmtDay}
                  series={[
                    { key: 'current', label: 'this month' },
                    { key: 'previous', label: 'last month', dashed: true },
                  ]}
                  format={(v) => fmtQty(v, 'MLD', 0)}
                  reference={{ y: 120, label: 'Design 120' }}
                />
              </div>
              <Panel className="mt-6">
                <CardHeader
                  title="Power split"
                  className="mb-3"
                  action={<CardMenu items={[{ label: 'Details', onSelect: () => undefined }]} />}
                />
                <SplitBars
                  items={[
                    { label: 'EB grid', value: 34120, tone: 'blue', icon: <Zap /> },
                    { label: 'Biogas engine', value: 12880, tone: 'green', icon: <Fuel /> },
                    { label: 'DG set', value: 2140, tone: 'orange', icon: <Factory /> },
                  ]}
                />
              </Panel>
            </Card>

            <Card>
              <CardHeader
                title="Chemical consumption"
                action={<CardMenu items={[{ label: 'Export', onSelect: () => undefined }]} />}
              />
              <DataTable
                rows={chemicals}
                rowKey={(r) => r.code}
                columns={[
                  { key: 'code', header: 'ID', cell: (r) => <span className="text-ink-500">#{r.code}</span> },
                  {
                    key: 'name',
                    header: 'Name',
                    cell: (r) => <span className="text-ink-900 font-medium">{r.name}</span>,
                  },
                  { key: 'used', header: 'Used', align: 'right', cell: (r) => `${fmtNum(r.used)} ${r.unit}` },
                  {
                    key: 'std',
                    header: 'Standard',
                    align: 'right',
                    hideBelow: 'md',
                    cell: (r) => `${fmtNum(r.std)} ${r.unit}`,
                  },
                  {
                    key: 'cost',
                    header: 'Cost',
                    align: 'right',
                    cell: (r) => (
                      <Money value={r.cost} className={r.used > r.std ? 'text-danger-600' : 'text-success-600'} />
                    ),
                  },
                  { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.status} size="sm" /> },
                ]}
              />
              <Pagination page={1} pageSize={25} total={3} onPageChange={() => undefined} />
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Power, last 7 days" subtitle="kWh" />
              <PillBars data={week} />
            </Card>
            <Card>
              <CardHeader title="Outlet compliance" />
              <TickGauge
                value={68}
                caption="On track for 80% target"
                target={80}
                action={
                  <Button size="sm" variant="secondary">
                    Show details
                  </Button>
                }
              />
            </Card>
            <Card>
              <CardHeader title="Monthly revenue" subtitle="₹ thousands" />
              <BarChart data={months} format={(v) => fmtMoney0(v * 1000)} seriesLabel="Revenue" />
            </Card>
            <Card>
              <CardHeader title="Sludge by destination" />
              <Donut
                data={[
                  { label: 'Dried beds', value: 420 },
                  { label: 'Composting', value: 260 },
                  { label: 'Landfill', value: 90 },
                ]}
                centre="770"
                centreLabel="tonnes"
                size={150}
              />
            </Card>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Controls" />
            <div className="space-y-5">
              <div className="flex flex-wrap gap-3">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="soft">Soft</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">
                  <Trash2 />
                  Danger
                </Button>
                <Button loading>Saving</Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">Brand</Badge>
                <Badge tone="success" dot>
                  Live
                </Badge>
                <StatusBadge status="grace" />
                <StatusBadge status="overdue" />
                <StatusBadge status="settings_pending" />
                <DeltaPill value={15.5} />
                <DeltaPill value={-10.5} />
              </div>
              <Segmented
                items={[
                  { value: 'today', label: 'Today' },
                  { value: 'mtd', label: 'MTD' },
                  { value: 'utd', label: 'UTD' },
                ]}
                value={seg}
                onChange={setSeg}
              />
              <Tabs
                items={[
                  { value: 'general', label: 'General' },
                  { value: 'parameters', label: 'Parameters', count: 86 },
                  { value: 'stock', label: 'Stock' },
                ]}
                value={tab}
                onChange={setTab}
              />
              <div className="flex flex-wrap items-center gap-3">
                <DateNav value={date} onChange={setDate} max={today} />
                <MonthNav value={month} onChange={setMonth} />
              </div>
              <ProgressBar value={7} max={10} tone="auto" />
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={sw} onCheckedChange={setSw} aria-label="Email alerts" />
                  Email alerts
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={cb} onCheckedChange={setCb} aria-label="Agree" />I agree
                </label>
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader title="Forms" />
            <div className="space-y-4">
              <Field label="Plant name" htmlFor="pn" required>
                <Input id="pn" placeholder="Bherampur 120 MLD STP" />
              </Field>
              <Field label="Search">
                <SearchInput />
              </Field>
              <Field label="Password" error="Password must be at least 10 characters.">
                <PasswordInput invalid />
              </Field>
              <Field label="Plant type">
                <Select
                  value={sel}
                  onValueChange={setSel}
                  options={[
                    { value: 'stp', label: 'STP' },
                    { value: 'wtp', label: 'WTP' },
                    { value: 'etp', label: 'ETP' },
                  ]}
                />
              </Field>
              <OtpInput value={otp} onChange={setOtp} autoFocus={false} />
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setModal(true)}>
                  Open modal
                </Button>
                <Button variant="secondary" onClick={() => setDrawer(true)}>
                  Open drawer
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <Card className="mt-6">
          <EmptyState
            title="No logsheets yet"
            description="Data appears here after the first logsheet is submitted."
            action={
              <Button>
                <Plus />
                New logsheet
              </Button>
            }
          />
        </Card>
      </div>

      <Drawer
        open={drawer}
        onOpenChange={setDrawer}
        title="Add Widget"
        description="Choose the cards on your dashboard."
      >
        <div className="space-y-4">
          {['Inflow & outflow', 'Revenue split', 'Lab compliance'].map((t, i) => (
            <div key={t} className="border-line flex gap-4 rounded-2xl border p-4">
              <div className="bg-muted-bg grid size-24 shrink-0 place-items-center rounded-2xl">
                <Users className="text-brand-500 size-7" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-ink-900 font-semibold">{t}</p>
                <p className="text-ink-500 mt-1 text-sm">Sample widget description number {i + 1}.</p>
                <div className="mt-3 flex items-center justify-between">
                  <Badge shape="tag">#Operations</Badge>
                  <Button size="sm">Select</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Drawer>
      <Modal
        open={modal}
        onOpenChange={setModal}
        title="Suspend client?"
        description="A reason is required and is written to the audit log."
        tone="danger"
        icon={<Trash2 />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => setModal(false)}>
              Suspend
            </Button>
          </>
        }
      />
    </div>
  );
}
