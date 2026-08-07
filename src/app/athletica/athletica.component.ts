import { Component, OnInit, OnDestroy, inject, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subscription, firstValueFrom } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { Router } from '@angular/router';

import {
  Auth,
  authState,
  signInWithEmailAndPassword,
  signOut,
  User
} from '@angular/fire/auth';

import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  setDoc,
  deleteDoc,
  writeBatch,
  CollectionReference,
  DocumentReference
} from '@angular/fire/firestore';

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
  email: string;
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
  date: string;
  time: string;
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
  smsMode?: 'firebase' | 'device';
  brevoApiKey?: string;
  brevoSenderEmail?: string;
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

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private sanitizer = inject(DomSanitizer);
  private router = inject(Router);

  /* ---- Constants ---- */
  readonly FIREBASE_SMS_JETON = 'AVweKohsMBhkVyLAk_zLvnAv09I-gT-SemKtUSjcyAL2J-1ZexLKMJh7-FbZDfclZV7qo35IKF2skkH5zu4JkMkSKzLk31moFHYWJVWrNv04ZhsI_5kPy_2po25P3_pUfc8V8LKK5agWiTEkNXqK87Y5';

  readonly packages: Package[] = [
    { key: 'consistency',    label: 'Consistency',    sessions: 8,   per: 270, total: 2160 },
    { key: 'progress',       label: 'Progress',       sessions: 12,  per: 242, total: 2900 },
    { key: 'transformation', label: 'Transformation', sessions: 20,  per: 225, total: 4500 },
    { key: 'elite',          label: 'Elite',          sessions: 30,  per: 207, total: 6200 },
    { key: 'elite_pro',      label: 'Elite Pro',      sessions: 50,  per: 200, total: 10000 },
    { key: 'platinum',       label: 'Platinum',       sessions: 80,  per: 196, total: 15680 },
    { key: 'platinum_elite', label: 'Platinum Elite', sessions: 100, per: 190, total: 19000 }
  ];

  readonly hours: number[] = Array.from({ length: 16 }, (_, i) => i + 6);
  readonly dayNames: string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  readonly defaultSettings: Settings = {
    coachName: 'Aymen Othmani',
    businessName: 'Carthage Athletica',
    coachPhone: '',
    leadHours: 2,
    smsMode: 'firebase',
    brevoApiKey: '',
    brevoSenderEmail: ''
  };

  readonly navItems = [
    {
      id: 'today',
      label: 'Today',
      icon: 'M8 2v3M16 2v3M3.5 9h17M4.5 5h15A1.5 1.5 0 0 1 21 6.5v13A1.5 1.5 0 0 1 19.5 21h-15A1.5 1.5 0 0 1 3 19.5v-13A1.5 1.5 0 0 1 4.5 5z'
    },
    {
      id: 'calendar',
      label: 'Calendar',
      icon: 'M8 2v3M16 2v3M3.5 9h17M4.5 5h15A1.5 1.5 0 0 1 21 6.5v13A1.5 1.5 0 0 1 19.5 21h-15A1.5 1.5 0 0 1 3 19.5v-13A1.5 1.5 0 0 1 4.5 5z'
    },
    {
      id: 'clients',
      label: 'Clients',
      icon: 'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75'
    },
    {
      id: 'tracker',
      label: 'Session Tracker',
      icon: 'M3 3v18h18M7 15l4-5 3 3 5-7'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'
    }
  ];

  /* ---- State ---- */
  clients: Client[] = [];
  sessions: Session[] = [];
  settings: Settings = { ...this.defaultSettings };

  isAuthenticated = false;
  sidebarOpen = false;
  currentView = 'today';
  pageTitle = 'Today';
  pageSub = 'Your day at a glance';

  isLoadingData = true;
  isSaving = false;
  sendingSmsId: string | null = null;
  sendingEmailId: string | null = null;

  // Auth forms
  loginEmail = '';
  loginPass = '';
  loginError = '';

  // Calendar
  calendarMode: 'day' | 'week' | 'month' = 'week';
  weekStart: Date = this.startOfWeek(new Date());
  selectedDay: Date = new Date();
  monthCursor: Date = new Date();
  today: Date = new Date();

  // Booking modal
  showBookModal = false;
  bookModalTitle = 'Book a Session';
  clientMode: 'existing' | 'new' = 'existing';
  bkClientId = '';
  bkNewName = '';
  bkNewPhone = '';
  bkNewEmail = '';
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
  customRenewCount = 10;
  showRenewInput = false;

  // New client
  showNewClientModal = false;
  ncName = '';
  ncPhone = '';
  ncEmail = '';
  ncNote = '';
  selectedPkgKeyNC = 'elite';

  // Search & Filter
  clientSearch = '';
  clientFilterTab: 'all' | 'low' | 'empty' = 'all';
  filteredClients: Client[] = [];

  // Toast
  toastVisible = false;
  toastMessage = '';
  toastType: 'success' | 'error' | 'info' = 'success';
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  // Firebase refs
  private clientsCol!: CollectionReference;
  private sessionsCol!: CollectionReference;
  private settingsRef!: DocumentReference;
  private subs: Subscription[] = [];
  private dataLoaded = false;

  // Safe icons
  icoPhone: SafeHtml = this.sanitizer.bypassSecurityTrustHtml(
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`
  );

  icoSMS: SafeHtml = this.sanitizer.bypassSecurityTrustHtml(
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`
  );

  icoEmail: SafeHtml = this.sanitizer.bypassSecurityTrustHtml(
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`
  );

  icoChevronLeft: SafeHtml = this.sanitizer.bypassSecurityTrustHtml(
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" width="20" height="20"><path d="M15 18l-6-6 6-6"/></svg>`
  );

  icoChevronRight: SafeHtml = this.sanitizer.bypassSecurityTrustHtml(
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" width="20" height="20"><path d="M9 18l6-6-6-6"/></svg>`
  );

  Math = Math;

  /* ========== LIFECYCLE ========== */
  ngOnInit(): void {
    this.clientsCol = collection(this.firestore, 'clients');
    this.sessionsCol = collection(this.firestore, 'sessions');
    this.settingsRef = doc(this.firestore, 'settings/coach');

    this.subs.push(
      authState(this.auth).subscribe((user: User | null) => {
        this.isAuthenticated = !!user;
        if (user) {
          if (!this.dataLoaded) {
            this.loadData();
            this.dataLoaded = true;
          }
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
  }

  /* ========== FIREBASE ========== */
  private loadData(): void {
    // Clients
    this.subs.push(
      collectionData(this.clientsCol, { idField: 'id' }).subscribe((data) => {
        this.clients = data as Client[];
        this.filterClients();
        this.cdr.markForCheck();
      })
    );

    // Sessions
    this.subs.push(
      collectionData(this.sessionsCol, { idField: 'id' }).subscribe((data) => {
        this.sessions = data as Session[];
        this.cdr.markForCheck();
      })
    );

    // Settings (includes brevoApiKey + brevoSenderEmail from Firestore)
    this.subs.push(
      docData(this.settingsRef).subscribe((s) => {
        if (s) {
          this.settings = { ...this.defaultSettings, ...(s as Settings) };
          this.cdr.markForCheck();
        }
      })
    );
  }

  async saveClient(client: Client): Promise<void> {
    const { id, ...data } = client;
    await setDoc(doc(this.firestore, 'clients', id), data);
  }

  private async saveSession(session: Session): Promise<void> {
    const { id, ...data } = session;
    await setDoc(doc(this.firestore, 'sessions', id), data);
  }

  private async deleteClientDoc(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'clients', id));
  }

  private async deleteSessionDoc(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'sessions', id));
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
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  parseLocalDate(dateStr: string): Date {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2] || 1);
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
    const parts = t.split(':').map(Number);
    const h = parts[0];
    const m = parts[1] || 0;
    const ampm = h < 12 ? 'AM' : 'PM';
    let hh = h % 12;
    if (hh === 0) hh = 12;
    return hh + ':' + String(m).padStart(2, '0') + ' ' + ampm;
  }

  initials(name: string): string {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(w => (w[0] ? w[0].toUpperCase() : ''))
      .join('');
  }

  cleanPhone(p: string): string {
    return (p || '').replace(/[^\d+]/g, '');
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
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  completedCount(clientId: string): number {
    return this.sessions.filter(s => s.clientId === clientId && s.status === 'completed').length;
  }

  remainingCount(client: Client): number {
    return Math.max(0, client.totalSessions - this.completedCount(client.id));
  }

  progressPct(client: Client): number {
    if (!client.totalSessions) return 0;
    return Math.round((this.completedCount(client.id) / client.totalSessions) * 100);
  }

  pkgLabelSafe(cl: Client | undefined | null): string {
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
    const when =
      s.date === this.todayStr()
        ? 'today'
        : this.parseLocalDate(s.date).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric'
          });
    const coachFirst = (this.settings.coachName || 'Aymen').split(' ')[0];
    return `Hi ${first}, this is a reminder from Coach ${coachFirst} (Carthage Athletica) — your training session is ${when} at ${this.fmtTime12(s.time)}.`;
  }

  sessionDateTime(s: Session): Date {
    const [y, m, d] = s.date.split('-').map(Number);
    const [hh, mm] = (s.time || '00:00').split(':').map(Number);
    return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
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
      const d = this.parseLocalDate(s.date);
      return d >= start && d < end && s.status !== 'cancelled';
    });
  }

  get distinctClientsToday(): number {
    return new Set(this.todaysSessions().map(s => s.clientId)).size;
  }

  lowRemainingClients(): Client[] {
    return this.clients
      .filter(c => {
        const rem = this.remainingCount(c);
        return rem > 0 && rem <= 3;
      })
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
      today: [
        'Today',
        new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric'
        })
      ],
      calendar: ['Calendar', 'Monday through Sunday, every session'],
      clients: ['Clients', 'Every client, one place'],
      tracker: ['Session Tracker', 'Who has sessions left to use'],
      settings: ['Settings', 'Coach details & reminder timing']
    };
    this.pageTitle = titles[v][0];
    this.pageSub = titles[v][1];
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  /* ========== CALENDAR ========== */
  get weekDays(): Date[] {
    return Array.from({ length: 7 }, (_, i) => this.addDays(this.weekStart, i));
  }

  get weekRangeLabel(): string {
    const days = this.weekDays;
    const m0 = days[0].toLocaleDateString('en-US', { month: 'short' });
    const m6 = days[6].toLocaleDateString('en-US', { month: 'short' });
    return `${m0} ${days[0].getDate()} – ${m6} ${days[6].getDate()}, ${days[6].getFullYear()}`;
  }

  dayName(d: Date): string {
    return this.dayNames[(d.getDay() + 6) % 7];
  }

  cellSessions(dateStr: string, hour: number): Session[] {
  return this.sessions.filter(
    s => s.date === dateStr &&
         this.timeToHour(s.time) === hour
  );
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
    return this.selectedDay.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  }

  shiftDay(n: number): void {
    this.selectedDay = this.addDays(this.selectedDay, n);
  }

  goTodayDay(): void {
    this.selectedDay = new Date();
  }

  get monthLabel(): string {
    return this.monthCursor.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  }

  get monthCells(): {
    day: number;
    dateStr: string;
    inMonth: boolean;
    isToday: boolean;
    count: number;
  }[] {
    const firstOfMonth = new Date(
      this.monthCursor.getFullYear(),
      this.monthCursor.getMonth(),
      1
    );
    const gridStart = this.startOfWeek(firstOfMonth);
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = this.addDays(gridStart, i);
      const dateStr = this.fmtDate(d);
      const inMonth = d.getMonth() === this.monthCursor.getMonth();
      const isToday = this.isSameDate(d, new Date());
      const count = this.sessions.filter(
        s => s.date === dateStr && s.status !== 'cancelled'
      ).length;
      cells.push({ day: d.getDate(), dateStr, inMonth, isToday, count });
    }
    return cells;
  }

  shiftMonth(n: number): void {
    this.monthCursor = new Date(
      this.monthCursor.getFullYear(),
      this.monthCursor.getMonth() + n,
      1
    );
  }

  goTodayMonth(): void {
    this.monthCursor = new Date();
  }

  jumpToDay(dateStr: string): void {
    this.selectedDay = this.parseLocalDate(dateStr);
    this.calendarMode = 'day';
  }

  cellClicked(date: string, time: string): void {
    this.openBookingModal({ date, time });
  }

  /* ========== CLIENTS ========== */
  setClientFilterTab(tab: 'all' | 'low' | 'empty'): void {
    this.clientFilterTab = tab;
    this.filterClients();
  }

  filterClients(): void {
    const q = (this.clientSearch || '').toLowerCase().trim();
    this.filteredClients = this.clients
      .filter(c => {
        const matchesSearch =
          c.name.toLowerCase().includes(q) ||
          (c.phone || '').includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.packageLabel || '').toLowerCase().includes(q);
        if (!matchesSearch) return false;
        const rem = this.remainingCount(c);
        if (this.clientFilterTab === 'low') return rem > 0 && rem <= 3;
        if (this.clientFilterTab === 'empty') return rem === 0;
        return true;
      })
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
    this.bkNewEmail = '';
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
      if (!this.bkNewEmail.trim() || !this.bkNewEmail.includes('@')) {
        this.showToast('Enter a valid client email (Required)', 'error');
        return;
      }
      const pkg = this.pkgByKey(this.selectedPkgKey);
      if (!pkg) {
        this.showToast('Invalid package');
        return;
      }
      const newClient: Client = {
        id: this.uid(),
        name: this.bkNewName.trim(),
        phone: this.bkNewPhone.trim(),
        email: this.bkNewEmail.trim().toLowerCase(),
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
    this.ncEmail = '';
    this.ncNote = '';
    this.selectedPkgKeyNC = 'elite';
    this.showNewClientModal = true;
  }

  async submitNewClient(): Promise<void> {
    if (!this.ncName.trim() || !this.ncPhone.trim()) {
      this.showToast('Enter the client name and phone');
      return;
    }
    if (!this.ncEmail.trim() || !this.ncEmail.includes('@')) {
      this.showToast('Enter a valid client email (Required)', 'error');
      return;
    }
    const pkg = this.pkgByKey(this.selectedPkgKeyNC);
    if (!pkg) {
      this.showToast('Invalid package');
      return;
    }
    const client: Client = {
      id: this.uid(),
      name: this.ncName.trim(),
      phone: this.ncPhone.trim(),
      email: this.ncEmail.trim().toLowerCase(),
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

    const idx = this.sessions.findIndex(x => x.id === updated.id);
    if (idx !== -1) {
      this.sessions[idx] = updated;
      this.sessions = [...this.sessions];
      this.cdr.detectChanges();
    }

    try {
      await this.saveSession(updated);
      this.closeModal('sess');
      this.showToast('Session updated');
    } catch (err) {
      console.error(err);
      this.showToast('Failed to update session', 'error');
    }
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
    const extra = prompt(
      `How many extra sessions to add for ${this.activeClient.name}? (current total: ${this.activeClient.totalSessions})`,
      '10'
    );
    if (extra === null) return;
    const n = parseInt(extra, 10);
    if (!n || n <= 0) {
      this.showToast('Enter a valid number');
      return;
    }
    const updated: Client = {
      ...this.activeClient,
      totalSessions: this.activeClient.totalSessions + n
    };
    await this.saveClient(updated);
    this.activeClient = updated;
    this.showToast(`${n} sessions added`);
  }

  async deleteClient(): Promise<void> {
    if (!this.activeClient) return;
    if (!confirm('Delete this client and all their session history? This cannot be undone.')) {
      return;
    }

    const id = this.activeClient.id;
    const related = this.sessions.filter(s => s.clientId === id);
    await Promise.all(related.map(s => this.deleteSessionDoc(s.id)));
    await this.deleteClientDoc(id);

    this.closeModal('client');
    this.showToast('Client deleted');
  }

  async markReminded(id: string): Promise<void> {
    const s = this.sessions.find(x => x.id === id);
    if (!s) return;
    const updated: Session = {
      ...s,
      remindedAt: new Date().toISOString()
    };
    await this.saveSession(updated);
  }

  /* ========== SETTINGS ========== */
  async saveSettings(): Promise<void> {
    const payload: Settings = {
      coachName: this.settings.coachName.trim() || this.defaultSettings.coachName,
      businessName: this.settings.businessName.trim() || this.defaultSettings.businessName,
      coachPhone: this.settings.coachPhone.trim(),
      leadHours:
        this.settings.leadHours > 0 && this.settings.leadHours <= 48
          ? this.settings.leadHours
          : this.defaultSettings.leadHours,
      smsMode: this.settings.smsMode || 'firebase',
      brevoApiKey: (this.settings.brevoApiKey || '').trim(),
      brevoSenderEmail: (this.settings.brevoSenderEmail || '').trim()
    };

    await setDoc(this.settingsRef, payload, { merge: true });
    this.settings = { ...this.settings, ...payload };
    this.showToast('Settings saved');
  }

  async clearAllData(): Promise<void> {
    if (!confirm('This deletes ALL clients and sessions permanently. Continue?')) {
      return;
    }
    if (!confirm('Are you absolutely sure? This cannot be undone.')) {
      return;
    }

    const batch = writeBatch(this.firestore);
    this.clients.forEach(c => batch.delete(doc(this.firestore, 'clients', c.id)));
    this.sessions.forEach(s => batch.delete(doc(this.firestore, 'sessions', s.id)));
    await batch.commit();

    this.showToast('All data cleared');
    this.switchView('today');
  }

  /* ========== AUTH ========== */
  async submitLogin(): Promise<void> {
    this.loginError = '';
    const email = this.loginEmail.trim().toLowerCase();
    const pass = this.loginPass;

    try {
      await signInWithEmailAndPassword(this.auth, email, pass);
      this.loginEmail = '';
      this.loginPass = '';
    } catch {
      this.loginError = 'Incorrect email or password.';
    }
  }

  async lockApp(): Promise<void> {
    this.sidebarOpen = false;
    await signOut(this.auth);
  }

  async signOutAndRedirect(): Promise<void> {
    this.sidebarOpen = false;
    await signOut(this.auth);
    this.router.navigate(['/']);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeModal('book');
    this.closeModal('sess');
    this.closeModal('client');
    this.closeModal('newClient');
  }

  /* ========== EMAIL SENDER (reads key from Firestore settings only) ========== */
  async sendEmailReminder(session: Session, client: Client): Promise<void> {
    if (!client?.email?.trim()) {
      this.showToast('Client email address missing', 'error');
      return;
    }

    const emailAddr = client.email.trim();
    const apiKey = (this.settings.brevoApiKey || '').trim();
    const senderEmail = (this.settings.brevoSenderEmail || '').trim();
    const senderName = this.settings.businessName || 'Carthage Athletica';

    if (!apiKey) {
      this.showToast('Brevo API key is missing in Settings', 'error');
      return;
    }
    if (!senderEmail) {
      this.showToast('Brevo sender email is missing in Settings', 'error');
      return;
    }

    const when = session.date === this.todayStr()
      ? 'Today'
      : this.parseLocalDate(session.date).toLocaleDateString('en-US', {
          weekday: 'long', month: 'short', day: 'numeric'
        });
    const timeFormatted = this.fmtTime12(session.time);
    const coachFirst = (this.settings.coachName || 'Aymen').split(' ')[0];
    const subject = `Training Session Reminder - ${senderName}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; background-color: #f3ead9; padding: 24px; color: #241a12;">
        <div style="max-width: 520px; margin: 0 auto; background-color: #fbf6ec; border-radius: 12px; padding: 30px; border: 1px solid #ddc9a3; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <div style="border-bottom: 2px solid #a3572e; padding-bottom: 12px; margin-bottom: 20px;">
            <h2 style="color: #a3572e; margin: 0; font-size: 22px;">${senderName}</h2>
            <p style="margin: 4px 0 0; color: #7a6852; font-size: 13px;">Coach ${this.settings.coachName}</p>
          </div>
          <p style="font-size: 16px; margin-bottom: 16px;">Hi <strong>${client.name}</strong>,</p>
          <p style="font-size: 15px; line-height: 1.5; color: #3b2b1e;">
            This is a friendly reminder for your upcoming training session!
          </p>
          <div style="background-color: #eee3cd; padding: 16px 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #a3572e;">
            <p style="margin: 0 0 6px; font-weight: bold; font-size: 16px; color: #241a12;">📅 Session Details:</p>
            <p style="margin: 4px 0; font-size: 14px; color: #3b2b1e;"><strong>Date:</strong> ${when} (${session.date})</p>
            <p style="margin: 4px 0; font-size: 14px; color: #3b2b1e;"><strong>Time:</strong> ${timeFormatted}</p>
            ${session.note ? `<p style="margin: 4px 0; font-size: 14px; color: #3b2b1e;"><strong>Note:</strong> ${session.note}</p>` : ''}
          </div>
          <p style="font-size: 14px; color: #3b2b1e; line-height: 1.5;">
            Please let us know 24 hours before the session if you need to reschedule.
          </p>
          <div style="margin-top: 30px; padding-top: 16px; border-top: 1px solid #e8dabd; font-size: 12px; color: #7a6852; text-align: center;">
            Sent by Coach ${coachFirst} via ${senderName}
          </div>
        </div>
      </div>
    `;

    this.sendingEmailId = session.id;

    try {
      const payload = {
        sender: { name: senderName, email: senderEmail },
        to: [{ email: emailAddr, name: client.name }],
        subject,
        htmlContent
      };

      const headers = new HttpHeaders({
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      });

      const res = await firstValueFrom(
        this.http.post<any>('https://api.brevo.com/v3/smtp/email', payload, { headers })
      );

      if (res && (res.messageId || res.id)) {
        await this.markReminded(session.id);
        this.showToast(`Email reminder sent to ${client.name}!`, 'success');
      } else {
        this.showToast('Brevo did not accept the email. Check console.', 'error');
      }
    } catch (err: any) {
      console.error('Brevo sendEmailReminder error:', err);
      const msg = err?.error?.message || err?.message || 'Network / Auth error';
      this.showToast(`Email failed: ${msg}`, 'error');
    } finally {
      this.sendingEmailId = null;
    }
  }

  async sendDirectClientEmail(client: Client): Promise<void> {
    if (!client?.email?.trim()) {
      this.showToast('Client email address missing', 'error');
      return;
    }

    const emailAddr = client.email.trim();
    const apiKey = (this.settings.brevoApiKey || '').trim();
    const senderEmail = (this.settings.brevoSenderEmail || '').trim();
    const senderName = this.settings.businessName || 'Carthage Athletica';
    const coachFirst = (this.settings.coachName || 'Aymen').split(' ')[0];

    if (!apiKey || !senderEmail) {
      this.showToast('Brevo API key or sender email missing in Settings', 'error');
      return;
    }

    const subject = `Message from Coach ${coachFirst} - ${senderName}`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; background-color: #f3ead9; padding: 24px; color: #241a12;">
        <div style="max-width: 520px; margin: 0 auto; background-color: #fbf6ec; border-radius: 12px; padding: 30px; border: 1px solid #ddc9a3;">
          <h2 style="color: #a3572e; margin-top: 0;">${senderName}</h2>
          <p style="font-size: 16px;">Hi <strong>${client.name}</strong>,</p>
          <p style="font-size: 15px; line-height: 1.5; color: #3b2b1e;">
            This is Coach ${coachFirst} reaching out from ${senderName}.
            You currently have <strong>${this.remainingCount(client)}</strong> of <strong>${client.totalSessions}</strong> training sessions remaining.
          </p>
          <p style="font-size: 14px; color: #7a6852;">Keep up the great effort!</p>
        </div>
      </div>
    `;

    try {
      const payload = {
        sender: { name: senderName, email: senderEmail },
        to: [{ email: emailAddr, name: client.name }],
        subject,
        htmlContent
      };

      const headers = new HttpHeaders({
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      });

      const res = await firstValueFrom(
        this.http.post<any>('https://api.brevo.com/v3/smtp/email', payload, { headers })
      );

      if (res && (res.messageId || res.id)) {
        this.showToast(`Email sent to ${client.name}`, 'success');
      } else {
        this.showToast('Brevo did not accept the email. Check console.', 'error');
      }
    } catch (err: any) {
      console.error('Brevo sendDirectClientEmail error:', err);
      const msg = err?.error?.message || err?.message || 'Network / Auth error';
      this.showToast(`Email failed: ${msg}`, 'error');
    }
  }

  /* ========== SMS SENDER ========== */
  async sendSMSReminder(session: Session, client: Client): Promise<void> {
    if (!client || !client.phone) {
      this.showToast('Client phone number missing', 'error');
      return;
    }

    const msg = this.reminderMsg(client, session);
    this.sendingSmsId = session.id;

    try {
      const payload = {
        phone: this.cleanPhone(client.phone),
        message: msg,
        token: this.FIREBASE_SMS_JETON,
        clientName: client.name,
        sessionDate: session.date,
        sessionTime: session.time
      };

      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.FIREBASE_SMS_JETON}`
      });

      const endpoint = 'https://us-central1-coach-othmeni.cloudfunctions.net/sendSMS';

      const res = await firstValueFrom(this.http.post<any>(endpoint, payload, { headers })).catch(err => {
        console.warn('Firebase SMS API error:', err);
        return null;
      });

      if (res && (res.success || res.status === 'ok' || res.id)) {
        await this.markReminded(session.id);
        this.showToast(`Firebase SMS sent to ${client.name}!`, 'success');
      } else {
        const smsUrl = this.smsHrefWithBody(client.phone, msg);
        window.location.href = smsUrl;
        await this.markReminded(session.id);
        this.showToast(`SMS opened for ${client.name} (Tap send to deliver)`, 'info');
      }
    } catch {
      const smsUrl = this.smsHrefWithBody(client.phone, msg);
      window.location.href = smsUrl;
      await this.markReminded(session.id);
      this.showToast(`SMS prepared for ${client.name}`, 'info');
    } finally {
      this.sendingSmsId = null;
    }
  }

  async sendDirectClientSMS(client: Client, customMsg?: string): Promise<void> {
    if (!client || !client.phone) {
      this.showToast('Client phone number missing', 'error');
      return;
    }
    const coachFirst = (this.settings.coachName || 'Aymen').split(' ')[0];
    const msg = customMsg || `Hi ${client.name.split(' ')[0]}, this is Coach ${coachFirst} (${this.settings.businessName || 'Carthage Athletica'}).`;

    try {
      const payload = {
        phone: this.cleanPhone(client.phone),
        message: msg,
        token: this.FIREBASE_SMS_JETON
      };
      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.FIREBASE_SMS_JETON}`
      });
      const endpoint = 'https://us-central1-coach-othmeni.cloudfunctions.net/sendSMS';
      await firstValueFrom(this.http.post<any>(endpoint, payload, { headers })).catch(() => null);

      const smsUrl = this.smsHrefWithBody(client.phone, msg);
      window.location.href = smsUrl;
      this.showToast(`SMS sent to ${client.name}`, 'success');
    } catch {
      const smsUrl = this.smsHrefWithBody(client.phone, msg);
      window.location.href = smsUrl;
    }
  }

  /* ========== QUICK STATUS TOGGLE ========== */
  async quickToggleStatus(s: Session, newStatus: Session['status'], event?: Event): Promise<void> {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    const idx = this.sessions.findIndex(x => x.id === s.id);
    if (idx === -1) return;

    const previousStatus = this.sessions[idx].status;

    // Optimistic update
    this.sessions[idx] = { ...this.sessions[idx], status: newStatus };
    this.sessions = [...this.sessions];
    this.cdr.detectChanges();

    try {
      await this.saveSession({ ...s, status: newStatus });
      this.showToast(`Session marked as ${newStatus}`, 'success');
    } catch (err) {
      this.sessions[idx] = { ...this.sessions[idx], status: previousStatus };
      this.sessions = [...this.sessions];
      this.cdr.detectChanges();
      console.error(err);
      this.showToast('Failed to update session', 'error');
    }
  }

  async addExtraSessions(cl: Client, count: number): Promise<void> {
    if (count <= 0) return;
    const updated: Client = {
      ...cl,
      totalSessions: cl.totalSessions + count
    };
    await this.saveClient(updated);
    this.activeClient = updated;
    this.showToast(`+${count} sessions added for ${cl.name}`, 'success');
  }

  /* ========== TOAST ========== */
  showToast(msg: string, type: 'success' | 'error' | 'info' = 'success'): void {
    this.toastMessage = msg;
    this.toastType = type;
    this.toastVisible = true;
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toastTimer = setTimeout(() => {
      this.toastVisible = false;
    }, 2800);
  }
}
