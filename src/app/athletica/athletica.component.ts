import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AngularFirestore,
  AngularFirestoreCollection,
  DocumentChangeAction
} from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Subscription } from 'rxjs';
import firebase from 'firebase/compat/app';

/* ========== INTERFACES ========== */
export interface Package {
  key: string;
  label: string;
  sessions: number;
  per: number;
  total: number;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  packageKey: string;
  packageLabel: string;
  totalSessions: number;
  perSession: number;
  notes: string;
  createdAt: string;
}

export interface Session {
  id: string;
  clientId: string;
  date: string;       // YYYY-MM-DD
  time: string;       // HH:mm
  status: 'scheduled' | 'completed' | 'cancelled';
  note: string;
  remindedAt: string | null;
  createdAt: string;
}

export interface Settings {
  coachName: string;
  businessName: string;
  coachPhone: string;
  leadHours: number;
}

/* ========== COMPONENT ========== */
@Component({
  selector: 'app-athletica',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './athletica.component.html',
  styleUrls: ['./athletica.component.css']
})
export class AthleticaComponent implements OnInit, OnDestroy {

  /* ---- Constants ---- */
  readonly packages: Package[] = [
    { key: 'consistency',    label: 'Consistency',    sessions: 8,   per: 270, total: 2160 },
    { key: 'progress',       label: 'Progress',       sessions: 12,  per: 242, total: 2900 },
    { key: 'transformation', label: 'Transformation', sessions: 20,  per: 225, total: 4500 },
    { key: 'elite',          label: 'Elite',          sessions: 30,  per: 207, total: 6200 },
    { key: 'elite_pro',      label: 'Elite Pro',      sessions: 50,  per: 200, total: 10000 },
    { key: 'platinum',       label: 'Platinum',       sessions: 80,  per: 196, total: 15680 },
    { key: 'platinum_elite', label: 'Platinum Elite', sessions: 100, per: 190, total: 19000 }
  ];

  readonly hours = Array.from({ length: 16 }, (_, i) => i + 6); // 6am – 9pm
  readonly dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  readonly defaultSettings: Settings = {
    coachName: 'Aymen Othmani',
    businessName: 'Carthage Athletica',
    coachPhone: '',
    leadHours: 2
  };

  readonly navItems = [
    { id: 'today',    label: 'Today',           icon: 'M8 2v3M16 2v3M3.5 9h17M4.5 5h15A1.5 1.5 0 0 1 21 6.5v13A1.5 1.5 0 0 1 19.5 21h-15A1.5 1.5 0 0 1 3 19.5v-13A1.5 1.5 0 0 1 4.5 5z' },
    { id: 'calendar', label: 'Calendar',        icon: 'M8 2v3M16 2v3M3.5 9h17M4.5 5h15A1.5 1.5 0 0 1 21 6.5v13A1.5 1.5 0 0 1 19.5 21h-15A1.5 1.5 0 0 1 3 19.5v-13A1.5 1.5 0 0 1 4.5 5z' },
    { id: 'clients',  label: 'Clients',         icon: 'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
    { id: 'tracker',  label: 'Session Tracker', icon: 'M3 3v18h18M7 15l4-5 3 3 5-7' },
    { id: 'settings', label: 'Settings',        icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' }
  ];

  /* ---- State ---- */
  clients: Client[] = [];
  sessions: Session[] = [];
  settings: Settings = { ...this.defaultSettings };

  isAuthenticated = false;
  authExists = false;
  sidebarOpen = false;
  currentView = 'today';
  pageTitle = 'Today';
  pageSub = 'Your day at a glance';

  // Auth forms
  setupEmail = '';
  setupPass = '';
  setupPass2 = '';
  setupError = '';
  loginEmail = '';
  loginPass = '';
  loginError = '';

  // Calendar
  calendarMode: 'day' | 'week' | 'month' = 'week';
  weekStart = this.startOfWeek(new Date());
  selectedDay = new Date();
  monthCursor = new Date();
  today = new Date();

  // Booking modal
  showBookModal = false;
  bookModalTitle = 'Book a Session';
  clientMode: 'existing' | 'new' = 'existing';
  bkClientId = '';
  bkNewName = '';
  bkNewPhone = '';
  bkDate = '';
  bkTime = '09:00';
  bkNote = '';
  selectedPkgKey = 'elite';

  // Session detail
  showSessModal = false;
  activeSession: Session | null = null;
  edDate = '';
  edTime = '';
  edNote = '';
  edStatus: Session['status'] = 'scheduled';

  // Client detail
  showClientModal = false;
  activeClient: Client | null = null;
  clientHistory: Session[] = [];

  // New client
  showNewClientModal = false;
  ncName = '';
  ncPhone = '';
  ncNote = '';
  selectedPkgKeyNC = 'elite';

  // Clients search
  clientSearch = '';
  filteredClients: Client[] = [];

  // Toast
  toastVisible = false;
  toastMessage = '';
  private toastTimer: any;

  // Firebase
  private clientsCol!: AngularFirestoreCollection<Client>;
  private sessionsCol!: AngularFirestoreCollection<Session>;
  private settingsDoc: any;
  private subs: Subscription[] = [];

  // Icons (SVG strings for [innerHTML])
  icoPhone = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
  icoSMS = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
  icoChevronLeft = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 18l-6-6 6-6"/></svg>`;
  icoChevronRight = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 18l6-6-6-6"/></svg>`;

  Math = Math; // expose for template

  constructor(
    private afs: AngularFirestore,
    private afAuth: AngularFireAuth
  ) {}

  /* ========== LIFECYCLE ========== */
  ngOnInit(): void {
    this.clientsCol = this.afs.collection<Client>('clients');
    this.sessionsCol = this.afs.collection<Session>('sessions');
    this.settingsDoc = this.afs.doc('settings/coach');

    // Auth state
    this.subs.push(
      this.afAuth.authState.subscribe(user => {
        this.isAuthenticated = !!user;
        this.authExists = !!user; // simple check – in real app you may query a coach profile
        if (user) {
          this.loadData();
        }
      })
    );

    // Check if any auth user exists (for first-run setup UI)
    // For simplicity we rely on Firebase Auth – first user creates the account
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  /* ========== FIREBASE DATA ========== */
  private loadData(): void {
    this.subs.push(
      this.clientsCol.snapshotChanges().subscribe(actions => {
        this.clients = actions.map(a => {
          const data = a.payload.doc.data() as Client;
          const id = a.payload.doc.id;
          return { ...data, id };
        });
        this.filterClients();
      })
    );

    this.subs.push(
      this.sessionsCol.snapshotChanges().subscribe(actions => {
        this.sessions = actions.map(a => {
          const data = a.payload.doc.data() as Session;
          const id = a.payload.doc.id;
          return { ...data, id };
        });
      })
    );

    this.subs.push(
      this.settingsDoc.valueChanges().subscribe((s: Settings | undefined) => {
        if (s) {
          this.settings = { ...this.defaultSettings, ...s };
        }
      })
    );
  }

  private async saveClient(client: Client): Promise<void> {
    const { id, ...data } = client;
    // include id in the stored data to satisfy the Client type
    await this.clientsCol.doc(id).set({ ...data, id });
  }

  private async saveSession(session: Session): Promise<void> {
    const { id, ...data } = session;
    // include id in the stored data to satisfy the Session type
    await this.sessionsCol.doc(id).set({ ...data, id });
  }

  private async deleteClientDoc(id: string): Promise<void> {
    await this.clientsCol.doc(id).delete();
  }

  private async deleteSessionDoc(id: string): Promise<void> {
    await this.sessionsCol.doc(id).delete();
  }

  /* ========== HELPERS ========== */
  uid(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  startOfWeek(d: Date): Date {
    const dt = new Date(d);
    const day = (dt.getDay() + 6) % 7;
    dt.setDate(dt.getDate() - day);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  addDays(d: Date, n: number): Date {
    const dt = new Date(d);
    dt.setDate(dt.getDate() + n);
    return dt;
  }

  fmtDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  isSameDate(a: Date, b: Date): boolean {
    return this.fmtDate(a) === this.fmtDate(b);
  }

  todayStr(): string {
    return this.fmtDate(new Date());
  }

  hourLabel(h: number): string {
    const ampm = h < 12 ? 'am' : 'pm';
    let hh = h % 12;
    if (hh === 0) hh = 12;
    return hh + ampm;
  }

  padHour(h: number): string {
    return String(h).padStart(2, '0') + ':00';
  }

  timeToHour(t: string): number {
    return parseInt(t.split(':')[0], 10);
  }

  fmtTime12(t: string): string {
    const [h, m] = t.split(':').map(Number);
    const ampm = h < 12 ? 'AM' : 'PM';
    let hh = h % 12;
    if (hh === 0) hh = 12;
    return hh + ':' + String(m).padStart(2, '0') + ' ' + ampm;
  }

  initials(name: string): string {
    return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
  }

  cleanPhone(p: string): string {
    return (p || '').replace(/[^\d+]/g, '');
  }

  telLink(p: string): string {
    return 'tel:' + this.cleanPhone(p);
  }

  smsLink(p: string): string {
    return 'sms:' + this.cleanPhone(p);
  }

  isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent || '');
  }

  smsHrefWithBody(phone: string, msg: string): string {
    const sep = this.isIOS() ? '&' : '?';
    return `sms:${this.cleanPhone(phone)}${sep}body=${encodeURIComponent(msg)}`;
  }

  pkgByKey(k: string): Package | undefined {
    return this.packages.find(p => p.key === k);
  }

  clientById(id: string): Client | undefined {
    return this.clients.find(c => c.id === id);
  }

  capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  completedCount(clientId: string): number {
    return this.sessions.filter(s => s.clientId === clientId && s.status === 'completed').length;
  }

  remainingCount(client: Client): number {
    return Math.max(0, client.totalSessions - this.completedCount(client.id));
  }

  progressPct(client: Client): number {
    return client.totalSessions
      ? Math.round((this.completedCount(client.id) / client.totalSessions) * 100)
      : 0;
  }

  pkgLabelSafe(cl: Client | undefined): string {
    return cl?.packageLabel || 'Custom package';
  }

  shortName(clientId: string): string {
    const cl = this.clientById(clientId);
    if (!cl) return 'Client';
    const parts = cl.name.split(' ');
    return parts[0] + (parts[1] ? ' ' + parts[1][0] + '.' : '');
  }

  reminderMsg(cl: Client, s: Session): string {
    const first = cl.name.trim().split(' ')[0];
    const when = s.date === this.todayStr()
      ? 'today'
      : new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    return `Hi ${first}, this is a reminder from Coach ${this.settings.coachName.split(' ')[0]} (Carthage Athletica) — your training session is ${when} at ${this.fmtTime12(s.time)}. See you there!`;
  }

  sessionDateTime(s: Session): Date {
    return new Date(s.date + 'T' + s.time + ':00');
  }

  /* ========== QUERIES ========== */
  todaysSessions(): Session[] {
    return this.sessions
      .filter(s => s.date === this.todayStr() && s.status !== 'cancelled')
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  weekSessions(): Session[] {
    const start = this.startOfWeek(new Date());
    const end = this.addDays(start, 7);
    return this.sessions.filter(s => {
      const d = new Date(s.date + 'T00:00:00');
      return d >= start && d < end && s.status !== 'cancelled';
    });
  }

  get distinctClientsToday(): number {
    return new Set(this.todaysSessions().map(s => s.clientId)).size;
  }

  lowRemainingClients(): Client[] {
    return this.clients
      .filter(c => this.remainingCount(c) > 0 && this.remainingCount(c) <= 3)
      .sort((a, b) => this.remainingCount(a) - this.remainingCount(b));
  }

  dueReminders(): Session[] {
    const now = new Date();
    return this.sessions
      .filter(s => {
        if (s.status !== 'scheduled' || s.remindedAt) return false;
        const dt = this.sessionDateTime(s);
        const diffMin = (dt.getTime() - now.getTime()) / 60000;
        return diffMin <= this.settings.leadHours * 60 && diffMin > -90;
      })
      .sort((a, b) => this.sessionDateTime(a).getTime() - this.sessionDateTime(b).getTime());
  }

  get sortedByRemaining(): Client[] {
    return [...this.clients].sort((a, b) => this.remainingCount(a) - this.remainingCount(b));
  }

  pillClass(cl: Client): string {
    const rem = this.remainingCount(cl);
    if (rem === 0 || rem <= 3) return 'low';
    if (rem <= cl.totalSessions * 0.3) return 'mid';
    return 'ok';
  }

  /* ========== NAV ========== */
  switchView(v: string): void {
    this.currentView = v;
    this.sidebarOpen = false;
    const titles: Record<string, [string, string]> = {
      today:    ['Today', new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })],
      calendar: ['Calendar', 'Monday through Sunday, every session'],
      clients:  ['Clients', 'Every client, one place'],
      tracker:  ['Session Tracker', 'Who has sessions left to use'],
      settings: ['Settings', 'Coach details & reminder timing']
    };
    this.pageTitle = titles[v][0];
    this.pageSub = titles[v][1];
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  /* ========== CALENDAR HELPERS ========== */
  get weekDays(): Date[] {
    return Array.from({ length: 7 }, (_, i) => this.addDays(this.weekStart, i));
  }

  get weekRangeLabel(): string {
    const days = this.weekDays;
    return `${days[0].toLocaleDateString('en-US', { month: 'short' })} ${days[0].getDate()} – ${days[6].toLocaleDateString('en-US', { month: 'short' })} ${days[6].getDate()}, ${days[6].getFullYear()}`;
  }

  dayName(d: Date): string {
    return this.dayNames[(d.getDay() + 6) % 7];
  }

  cellSessions(dateStr: string, hour: number): Session[] {
    return this.sessions.filter(s => s.date === dateStr && this.timeToHour(s.time) === hour);
  }

  setCalMode(m: 'day' | 'week' | 'month'): void {
    this.calendarMode = m;
  }

  shiftWeek(n: number): void {
    this.weekStart = this.addDays(this.weekStart, n * 7);
  }

  goTodayWeek(): void {
    this.weekStart = this.startOfWeek(new Date());
  }

  get selectedDayLabel(): string {
    return this.selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  shiftDay(n: number): void {
    this.selectedDay = this.addDays(this.selectedDay, n);
  }

  goTodayDay(): void {
    this.selectedDay = new Date();
  }

  get monthLabel(): string {
    return this.monthCursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  get monthCells(): { day: number; dateStr: string; inMonth: boolean; isToday: boolean; count: number }[] {
    const firstOfMonth = new Date(this.monthCursor.getFullYear(), this.monthCursor.getMonth(), 1);
    const gridStart = this.startOfWeek(firstOfMonth);
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = this.addDays(gridStart, i);
      const dateStr = this.fmtDate(d);
      const inMonth = d.getMonth() === this.monthCursor.getMonth();
      const isToday = this.isSameDate(d, new Date());
      const count = this.sessions.filter(s => s.date === dateStr && s.status !== 'cancelled').length;
      cells.push({ day: d.getDate(), dateStr, inMonth, isToday, count });
    }
    return cells;
  }

  shiftMonth(n: number): void {
    this.monthCursor = new Date(this.monthCursor.getFullYear(), this.monthCursor.getMonth() + n, 1);
  }

  goTodayMonth(): void {
    this.monthCursor = new Date();
  }

  jumpToDay(dateStr: string): void {
    this.selectedDay = new Date(dateStr + 'T00:00:00');
    this.calendarMode = 'day';
  }

  cellClicked(date: string, time: string): void {
    this.openBookingModal({ date, time });
  }

  /* ========== CLIENTS ========== */
  filterClients(): void {
    const q = (this.clientSearch || '').toLowerCase();
    this.filteredClients = this.clients
      .filter(c => c.name.toLowerCase().includes(q) || (c.phone || '').includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /* ========== MODALS ========== */
  openModal(which: string): void {
    if (which === 'book') this.showBookModal = true;
    if (which === 'sess') this.showSessModal = true;
    if (which === 'client') this.showClientModal = true;
    if (which === 'newClient') this.showNewClientModal = true;
  }

  closeModal(which: string): void {
    if (which === 'book') this.showBookModal = false;
    if (which === 'sess') this.showSessModal = false;
    if (which === 'client') this.showClientModal = false;
    if (which === 'newClient') this.showNewClientModal = false;
  }

  openBookingModal(opts: { clientId?: string; date?: string; time?: string } = {}): void {
    this.bookModalTitle = 'Book a Session';
    this.bkClientId = opts.clientId || '';
    this.bkDate = opts.date || this.fmtDate(new Date());
    this.bkTime = opts.time || '09:00';
    this.bkNote = '';
    this.bkNewName = '';
    this.bkNewPhone = '';
    this.selectedPkgKey = 'elite';
    this.clientMode = this.clients.length ? 'existing' : 'new';
    this.showBookModal = true;
  }

  setClientMode(mode: 'existing' | 'new'): void {
    this.clientMode = mode;
  }

  async submitBooking(): Promise<void> {
    if (!this.bkDate || !this.bkTime) {
      this.showToast('Pick a date and time');
      return;
    }
    let clientId = this.bkClientId;

    if (this.clientMode === 'new') {
      if (!this.bkNewName.trim() || !this.bkNewPhone.trim()) {
        this.showToast('Enter the client name and phone');
        return;
      }
      const pkg = this.pkgByKey(this.selectedPkgKey)!;
      const newClient: Client = {
        id: this.uid(),
        name: this.bkNewName.trim(),
        phone: this.bkNewPhone.trim(),
        packageKey: pkg.key,
        packageLabel: pkg.label,
        totalSessions: pkg.sessions,
        perSession: pkg.per,
        notes: '',
        createdAt: new Date().toISOString()
      };
      await this.saveClient(newClient);
      clientId = newClient.id;
    } else if (!clientId) {
      this.showToast('Select a client');
      return;
    }

    const session: Session = {
      id: this.uid(),
      clientId,
      date: this.bkDate,
      time: this.bkTime,
      status: 'scheduled',
      note: this.bkNote.trim(),
      remindedAt: null,
      createdAt: new Date().toISOString()
    };
    await this.saveSession(session);
    this.closeModal('book');
    this.showToast('Session booked — added to the calendar automatically');
  }

  openNewClientModal(): void {
    this.ncName = '';
    this.ncPhone = '';
    this.ncNote = '';
    this.selectedPkgKeyNC = 'elite';
    this.showNewClientModal = true;
  }

  async submitNewClient(): Promise<void> {
    if (!this.ncName.trim() || !this.ncPhone.trim()) {
      this.showToast('Enter the client name and phone');
      return;
    }
    const pkg = this.pkgByKey(this.selectedPkgKeyNC)!;
    const client: Client = {
      id: this.uid(),
      name: this.ncName.trim(),
      phone: this.ncPhone.trim(),
      packageKey: pkg.key,
      packageLabel: pkg.label,
      totalSessions: pkg.sessions,
      perSession: pkg.per,
      notes: this.ncNote.trim(),
      createdAt: new Date().toISOString()
    };
    await this.saveClient(client);
    this.closeModal('newClient');
    this.showToast('Client added');
  }

  openSessionDetail(id: string): void {
    const s = this.sessions.find(x => x.id === id);
    if (!s) return;
    this.activeSession = s;
    this.edDate = s.date;
    this.edTime = s.time;
    this.edNote = s.note || '';
    this.edStatus = s.status;
    this.showSessModal = true;
  }

  async saveSessionEdit(): Promise<void> {
    if (!this.activeSession) return;
    const updated: Session = {
      ...this.activeSession,
      date: this.edDate,
      time: this.edTime,
      note: this.edNote.trim(),
      status: this.edStatus
    };
    await this.saveSession(updated);
    this.closeModal('sess');
    this.showToast('Session updated');
  }

  async deleteSession(): Promise<void> {
    if (!this.activeSession) return;
    await this.deleteSessionDoc(this.activeSession.id);
    this.closeModal('sess');
    this.showToast('Session deleted');
  }

  openClientDetail(id: string): void {
    const cl = this.clientById(id);
    if (!cl) return;
    this.activeClient = cl;
    this.clientHistory = this.sessions
      .filter(s => s.clientId === id)
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    this.showClientModal = true;
  }

  async openRenewInline(): Promise<void> {
    if (!this.activeClient) return;
    const extra = prompt(`How many extra sessions to add for ${this.activeClient.name}? (current total: ${this.activeClient.totalSessions})`, '10');
    if (extra === null) return;
    const n = parseInt(extra, 10);
    if (!n || n <= 0) {
      this.showToast('Enter a valid number');
      return;
    }
    const updated = { ...this.activeClient, totalSessions: this.activeClient.totalSessions + n };
    await this.saveClient(updated);
    this.activeClient = updated;
    this.showToast(`${n} sessions added`);
  }

  async deleteClient(): Promise<void> {
    if (!this.activeClient) return;
    if (!confirm('Delete this client and all their session history? This cannot be undone.')) return;
    const id = this.activeClient.id;
    // delete related sessions
    const related = this.sessions.filter(s => s.clientId === id);
    await Promise.all(related.map(s => this.deleteSessionDoc(s.id)));
    await this.deleteClientDoc(id);
    this.closeModal('client');
    this.showToast('Client deleted');
  }

  async markReminded(id: string): Promise<void> {
    const s = this.sessions.find(x => x.id === id);
    if (!s) return;
    const updated = { ...s, remindedAt: new Date().toISOString() };
    await this.saveSession(updated);
  }

  /* ========== SETTINGS ========== */
  async saveSettings(): Promise<void> {
    const payload = {
      coachName: this.settings.coachName.trim() || this.defaultSettings.coachName,
      businessName: this.settings.businessName.trim() || this.defaultSettings.businessName,
      coachPhone: this.settings.coachPhone.trim(),
      leadHours: (this.settings.leadHours > 0 && this.settings.leadHours <= 48)
        ? this.settings.leadHours
        : this.defaultSettings.leadHours
    };
    await this.settingsDoc.set(payload, { merge: true });
    this.settings = { ...this.settings, ...payload };
    this.showToast('Settings saved');
  }

  async clearAllData(): Promise<void> {
    if (!confirm('This deletes ALL clients and sessions permanently. Continue?')) return;
    if (!confirm('Are you absolutely sure? This cannot be undone.')) return;
    const batch = this.afs.firestore.batch();
    this.clients.forEach(c => batch.delete(this.clientsCol.doc(c.id).ref));
    this.sessions.forEach(s => batch.delete(this.sessionsCol.doc(s.id).ref));
    await batch.commit();
    this.showToast('All data cleared');
    this.switchView('today');
  }

  /* ========== AUTH ========== */
  async submitSetup(): Promise<void> {
    this.setupError = '';
    const email = this.setupEmail.trim().toLowerCase();
    const pass = this.setupPass;
    if (!email || !email.includes('@')) {
      this.setupError = 'Enter a valid email.';
      return;
    }
    if (pass.length < 4) {
      this.setupError = 'Password must be at least 4 characters.';
      return;
    }
    if (pass !== this.setupPass2) {
      this.setupError = 'Passwords do not match.';
      return;
    }
    try {
      await this.afAuth.createUserWithEmailAndPassword(email, pass);
      // isAuthenticated will be set by the authState subscription
    } catch (e: any) {
      this.setupError = e.message || 'Could not create account.';
    }
  }

  async submitLogin(): Promise<void> {
    this.loginError = '';
    const email = this.loginEmail.trim().toLowerCase();
    const pass = this.loginPass;
    try {
      await this.afAuth.signInWithEmailAndPassword(email, pass);
      this.loginEmail = '';
      this.loginPass = '';
    } catch (e: any) {
      this.loginError = 'Incorrect email or password.';
    }
  }

  async lockApp(): Promise<void> {
    this.sidebarOpen = false;
    await this.afAuth.signOut();
  }

  async resetAuth(): Promise<void> {
    if (!confirm('This clears your saved login so you can set a new email & password. Your clients and sessions are not affected. Continue?')) return;
    // In Firebase the user must be signed in to delete the account.
    // For a true “reset” you would normally send a password-reset email.
    // Here we just sign out and let the user create a new account if needed.
    await this.afAuth.signOut();
    this.authExists = false; // force setup UI
  }

  /* ========== TOAST ========== */
  showToast(msg: string): void {
    this.toastMessage = msg;
    this.toastVisible = true;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastVisible = false, 2600);
  }
}
