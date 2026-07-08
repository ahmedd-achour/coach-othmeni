import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, collectionData, query, doc, updateDoc } from '@angular/fire/firestore';
import { Observable, Subscription } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { getFunctions, httpsCallable } from 'firebase/functions';

Chart.register(...registerables);

interface ApplicationRecord {
  id: string;
  client_profile: {
    name: string;
    email: string;
    phone: string;
    country: string;
  };
  physical_metrics: {
    height_cm: number;
    current_weight_kg: number;
    target_weight_kg: number;
  };
  subscription: {
    plan_name: string;
    amount: number;
    stripePriceId?: string;
    stripePdfPriceId?: string;
  };
  payment?: {
    stripeSessionId?: string | null;
    status: 'pending' | 'paid' | 'cancelled';
  };
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit, OnDestroy {

  credentials = { email: '', password: '' };
  isAuthenticated = false;
  loginErrorMessage = '';
  isLoginMode = true;

  applications: ApplicationRecord[] = [];
  filteredApplications: ApplicationRecord[] = [];
  private dataSubscription!: Subscription;

  // Real-Time Workspace Filters
  searchTerm = '';
  selectedCountry = '';
  selectedStatus = 'all';

  // Telemetry Metric Trackers
  totalLeadsCount = 0;
  paidConversionsCount = 0;
  conversionRatePercent = 0;
  grossRevenueUsd = 0;
  avgWeightLossKg = 0;
  lossGoalPercent = 0;
  gainMusclePercent = 0;

  countryStats: any[] = [];
  tierStats: any[] = [];

  private paymentChart!: Chart;
  private tierRevenueChart!: Chart;

  constructor(private firestore: Firestore, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    if (sessionStorage.getItem('admin_session_token') === 'granted_coaching_access_2026') {
      this.isAuthenticated = true;
      setTimeout(() => this.loadData(), 100);
    }
  }
isCancelingMap: { [key: string]: boolean } = {};

async cancelSubscription(applicationId: string) {
    if (!applicationId) return;

    const confirmCancel = confirm("Are you sure you want to disable credit card auto-renewal for this client?");
    if (!confirmCancel) return;

    this.isCancelingMap[applicationId] = true;

    try {
      const functions = getFunctions();
      const cancelFn = httpsCallable<{ applicationId: string }, { success: boolean; message: string }>(
        functions,
        'cancelUserSubscription'
      );

      const response = await cancelFn({ applicationId });

      if (response.data?.success) {
        alert("Success! Auto-renewal stopped. Stripe is updating the database ledger files now.");
      }
    } catch (error: any) {
      console.error("Cancellation trip failure:", error);
      alert(`Operation Failed: ${error.message || error}`);
    } finally {
      this.isCancelingMap[applicationId] = false;
      this.cdr.detectChanges();
    }
  }
  toggleAuthMode() {
    this.isLoginMode = !this.isLoginMode;
    this.loginErrorMessage = '';
  }

  handleAuthSubmit() {
    const secureEmail = 'admin@othmeni.com';
    const securePassword = 'coach#1#uae';

    if (this.isLoginMode) {
      if (this.credentials.email === secureEmail && this.credentials.password === securePassword) {
        this.isAuthenticated = true;
        sessionStorage.setItem('admin_session_token', 'granted_coaching_access_2026');
        this.cdr.detectChanges();
        setTimeout(() => this.loadData(), 100);
      } else {
        this.loginErrorMessage = 'Access Refused. Invalid credentials.';
      }
    } else {
      this.loginErrorMessage = 'Registration closed. Please login with the master credentials.';
      this.isLoginMode = true;
    }
  }

  private loadData() {
    const ref = collection(this.firestore, 'coaching_applications');
    const q = query(ref);

    this.dataSubscription = (collectionData(q, { idField: 'id' }) as Observable<any[]>)
      .subscribe({
        next: (rawDocs) => {
          if (!rawDocs || rawDocs.length === 0) {
            this.applications = [];
            this.applyFilters();
            return;
          }

          this.applications = rawDocs.map(docData => {
            return {
              id: docData.id,
              client_profile: {
                name: docData.client_profile?.name || 'Anonymous',
                email: docData.client_profile?.email || '',
                phone: docData.client_profile?.phone || '',
                country: docData.client_profile?.country || 'Unknown'
              },
              physical_metrics: {
                height_cm: Number(docData.physical_metrics?.height_cm || 0),
                current_weight_kg: Number(docData.physical_metrics?.current_weight_kg || 0),
                target_weight_kg: Number(docData.physical_metrics?.target_weight_kg || 0)
              },
              subscription: {
                plan_name: docData.subscription?.plan_name || docData.subscription_tier?.plan_name || 'Standard Plan',
                amount: Number(docData.subscription?.amount || docData.subscription_tier?.amount_paid_usd || 0),
                stripePriceId: docData.subscription?.stripePriceId || '',
                stripePdfPriceId: docData.subscription?.stripePdfPriceId || ''
              },
              payment: {
                stripeSessionId: docData.payment?.stripeSessionId || null,
                status: docData.payment?.status === 'paid' ? 'paid' :  docData.payment?.status === 'cancelled' ? 'cancelled' : 'pending',
              }
            };
          });

          // Client-side sort fallback


          this.applyFilters();
        },
        error: (err) => {
          console.error('CRITICAL: Firestore sub pipeline crashed:', err);
        }
      });
  }

  applyFilters() {
    this.runDeepAnalysis();

    this.filteredApplications = this.applications.filter(app => {
      const searchMatch = !this.searchTerm ||
        app.client_profile?.name?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        app.client_profile?.email?.toLowerCase().includes(this.searchTerm.toLowerCase());

      const countryMatch = !this.selectedCountry || app.client_profile?.country === this.selectedCountry;
      const statusMatch = this.selectedStatus === 'all' ||
        app.payment?.status === this.selectedStatus;

      return searchMatch && countryMatch && statusMatch;
    });

    this.cdr.detectChanges();

    setTimeout(() => {
      this.renderCharts();
    }, 50);
  }

  private runDeepAnalysis() {
    if (!this.applications || this.applications.length === 0) {
      this.totalLeadsCount = 0;
      this.paidConversionsCount = 0;
      this.grossRevenueUsd = 0;
      this.conversionRatePercent = 0;
      return;
    }

    let paidCount = 0;
    let accumulatedRevenue = 0;
    let weightLossSum = 0;
    let weightLossCount = 0;

    const countryMap = new Map<string, number>();
    const tierMap = new Map<string, number>();

    this.applications.forEach(app => {
      const isPaid = app.payment?.status === 'paid';
      const amount = Number(app.subscription?.amount || 0);

      const currentWeight = Number(app.physical_metrics?.current_weight_kg || 0);
      const targetWeight = Number(app.physical_metrics?.target_weight_kg || 0);
      const loss = currentWeight - targetWeight;

      // ADJUSTMENT: Total revenues is sum of amount where payment status == "paid"
      // ADJUSTMENT: Paid conversion is the sum of documents where status == "paid"
      if (isPaid) {
        paidCount++;
        accumulatedRevenue += amount;
      }

      if (loss > 0) {
        weightLossSum += loss;
        weightLossCount++;
      }

      const country = app.client_profile?.country || 'Unknown';
      const tier = app.subscription?.plan_name || 'Unknown';

      countryMap.set(country, (countryMap.get(country) || 0) + 1);
      tierMap.set(tier, (tierMap.get(tier) || 0) + 1);
    });

    this.totalLeadsCount = this.applications.length;
    this.paidConversionsCount = paidCount;
    this.grossRevenueUsd = Math.round(accumulatedRevenue);

    // ADJUSTMENT: Conversion rate is exactly (total paid over total users) * 100
    this.conversionRatePercent = this.totalLeadsCount ? Math.round((paidCount / this.totalLeadsCount) * 100) : 0;

    this.avgWeightLossKg = weightLossCount ? Math.round((weightLossSum / weightLossCount) * 10) / 10 : 0;
    this.lossGoalPercent = this.totalLeadsCount ? Math.round((weightLossCount / this.totalLeadsCount) * 100) : 0;
    this.gainMusclePercent = 100 - this.lossGoalPercent;

    this.countryStats = Array.from(countryMap, ([country, count]) => ({ country, count }));
    this.tierStats = Array.from(tierMap, ([tier, count]) => ({ tier, count }));
  }

  private renderCharts() {
    this.destroyCharts();

    const paymentCanvas = document.getElementById('paymentChart') as HTMLCanvasElement;
    const tierCanvas = document.getElementById('tierRevenueChart') as HTMLCanvasElement;

    if (!paymentCanvas || !tierCanvas) return;

    try {
      this.paymentChart = new Chart(paymentCanvas, {
        type: 'doughnut',
        data: {
          labels: ['Paid', 'Pending'],
          datasets: [{
            data: [this.paidConversionsCount, this.totalLeadsCount - this.paidConversionsCount],
            backgroundColor: ['#5B7065', '#C5A059'],
            borderWidth: 1
          }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });

      this.tierRevenueChart = new Chart(tierCanvas, {
        type: 'bar',
        data: {
          labels: this.tierStats.map(t => t.tier),
          datasets: [{
            label: 'Registrations By Plan',
            data: this.tierStats.map(t => t.count),
            backgroundColor: '#5B7065'
          }]
        },
        options: { responsive: true, indexAxis: 'y' }
      });
    } catch (e) {
      console.error('ChartJs integration loop issue:', e);
    }
  }

  private destroyCharts() {
    if (this.paymentChart) this.paymentChart.destroy();
    if (this.tierRevenueChart) this.tierRevenueChart.destroy();
  }

  async togglePaymentStatus(app: ApplicationRecord) {
    if (!app.id) return;

    const currentStatus = app.payment?.status || 'pending';
    const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';

    try {
      await updateDoc(doc(this.firestore, `coaching_applications/${app.id}`), {
        'payment.status': newStatus
      });
    } catch (e) {
      console.error('Failed to patch status field parameter:', e);
    }
  }

  handleAdminLogout() {
    this.destroyCharts();
    if (this.dataSubscription) this.dataSubscription.unsubscribe();
    this.isAuthenticated = false;
    sessionStorage.removeItem('admin_session_token');
  }

  ngOnDestroy() {
    this.destroyCharts();
    if (this.dataSubscription) this.dataSubscription.unsubscribe();
  }
}
