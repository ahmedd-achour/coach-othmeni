import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Firestore, collection, collectionData, query, orderBy, doc, updateDoc } from '@angular/fire/firestore';
import { Observable, Subscription } from 'rxjs';

interface ApplicationRecord {
  id: string; // Made strictly required for structural document updates
  client_profile: {
    name: string;
    email: string;
    phone: string;
    country?: string;
  };
  physical_metrics: {
    height_cm: number;
    current_weight_kg: number;
    target_weight_kg: number;
  };
  subscription_tier: {
    plan_name: string;
    amount_paid_usd: number;
  };
  transaction_metadata: {
    stripe_session_id: string | null;
    payment_status: 'pending' | 'paid';
    processed_at: any;
  };
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit {
  credentials = { email: '', password: '' };
  isAuthenticated = false;
  loginErrorMessage = '';

  applications: ApplicationRecord[] = [];
  private dataSubscription!: Subscription;

  totalLeadsCount = 0;
  paidConversionsCount = 0;
  conversionRatePercent = 0;
  grossRevenueUsd = 0;

  paidVolumeHeight = 0;
  pendingVolumeHeight = 0;
  lossGoalPercent = 0;
  gainMusclePercent = 0;

  constructor(private firestore: Firestore, private router: Router) {}

  ngOnInit(): void {
    const activeSession = sessionStorage.getItem('admin_session_token');
    if (activeSession === 'granted_coaching_access_2026') {
      this.isAuthenticated = true;
      this.initializeDashboardDataPipeline();
    }
  }

  handleAdminLogin(): void {
    this.loginErrorMessage = '';
    const secureEmail = 'admin@othmeni.com';
    const securePassword = 'coach#1#uae';

    if (this.credentials.email === secureEmail && this.credentials.password === securePassword) {
      this.isAuthenticated = true;
      sessionStorage.setItem('admin_session_token', 'granted_coaching_access_2026');
      this.initializeDashboardDataPipeline();
    } else {
      this.loginErrorMessage = 'Access Refused. Invalid administration security parameters.';
    }
  }

  private initializeDashboardDataPipeline(): void {
    const dataReference = collection(this.firestore, 'coaching_applications');
    const optimizedQuery = query(dataReference, orderBy('transaction_metadata.processed_at', 'desc'));

    this.dataSubscription = (collectionData(optimizedQuery, { idField: 'id' }) as Observable<ApplicationRecord[]>)
      .subscribe({
        next: (records) => {
          this.applications = records;
          this.calculateAnalyticalMetrics();
        },
        error: (err) => {
          console.error('Failed to stream analytic telemetry from Firestore rules:', err);
        }
      });
  }

  /**
   * Toggles the dynamic payment state inside Firestore with an optimistic UI strategy pattern.
   * @param record The target client dataset payload to mutate
   */
  async togglePaymentStatus(record: ApplicationRecord): Promise<void> {
    if (!record.id) return;

    // Calculate invert step parameters cleanly
    const currentStatus = record.transaction_metadata?.payment_status || 'pending';
    const updatedStatus: 'paid' | 'pending' = currentStatus === 'paid' ? 'pending' : 'paid';

    // Mount structural document pointer directly into schema path
    const documentReference = doc(this.firestore, `coaching_applications/${record.id}`);

    try {
      await updateDoc(documentReference, {
        'transaction_metadata.payment_status': updatedStatus
      });
    } catch (err) {
      console.error(`Failed to execute target status switch context for document ${record.id}:`, err);
    }
  }

  private calculateAnalyticalMetrics(): void {
    this.totalLeadsCount = this.applications.length;
    if (this.totalLeadsCount === 0) {
      this.resetMetrics();
      return;
    }

    let totalPaid = 0;
    let accumulatedRevenue = 0;
    let weightLossProfiles = 0;

    this.applications.forEach(record => {
      const isPaid = record.transaction_metadata?.payment_status === 'paid';
      if (isPaid) {
        totalPaid++;
        accumulatedRevenue += Number(record.subscription_tier?.amount_paid_usd || 0);
      }

      const currentW = record.physical_metrics?.current_weight_kg || 0;
      const targetW = record.physical_metrics?.target_weight_kg || 0;
      if (targetW < currentW) {
        weightLossProfiles++;
      }
    });

    this.paidConversionsCount = totalPaid;
    this.grossRevenueUsd = accumulatedRevenue;
    this.conversionRatePercent = Math.round((totalPaid / this.totalLeadsCount) * 100);

    const pendingCount = this.totalLeadsCount - totalPaid;
    const peakMax = Math.max(totalPaid, pendingCount, 1);
    this.paidVolumeHeight = Math.round((totalPaid / peakMax) * 140);
    this.pendingVolumeHeight = Math.round((pendingCount / peakMax) * 140);

    this.lossGoalPercent = Math.round((weightLossProfiles / this.totalLeadsCount) * 100);
    this.gainMusclePercent = 100 - this.lossGoalPercent;
  }

  private resetMetrics(): void {
    this.paidConversionsCount = 0;
    this.grossRevenueUsd = 0;
    this.conversionRatePercent = 0;
    this.paidVolumeHeight = 0;
    this.pendingVolumeHeight = 0;
    this.lossGoalPercent = 0;
    this.gainMusclePercent = 0;
  }

  handleAdminLogout(): void {
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }
    this.isAuthenticated = false;
    sessionStorage.removeItem('admin_session_token');
    this.credentials = { email: '', password: '' };
  }
}
